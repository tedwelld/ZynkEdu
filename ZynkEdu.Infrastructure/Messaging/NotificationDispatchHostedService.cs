using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Messaging;

public sealed class NotificationDispatchHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationDispatchHostedService> _logger;

    public NotificationDispatchHostedService(IServiceScopeFactory scopeFactory, ILogger<NotificationDispatchHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchPendingAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Notification dispatch loop failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private async Task DispatchPendingAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ZynkEduDbContext>();
        var smsSender = scope.ServiceProvider.GetRequiredService<ISmsSender>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

        var pendingRecipients = await db.NotificationRecipients
            .Include(x => x.Notification)
            .Include(x => x.Student)
            .Include(x => x.StaffUser)
            .Where(x => x.Status == NotificationStatus.Pending)
            .OrderBy(x => x.Id)
            .Take(25)
            .ToListAsync(cancellationToken);

        foreach (var recipient in pendingRecipients)
        {
            recipient.Status = NotificationStatus.Processing;
            recipient.Attempts++;
            recipient.LastAttemptAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var recipient in pendingRecipients)
        {
            try
            {
                var notification = recipient.Notification;
                var student = recipient.Student;
                var destination = recipient.Destination;

                if (string.IsNullOrWhiteSpace(destination))
                {
                    throw new InvalidOperationException("Recipient destination is missing.");
                }

                var message = $"{notification.Title}: {notification.Message}";

                if (notification.Type == NotificationType.Email)
                {
                    await emailSender.SendAsync(destination, notification.Title, message, cancellationToken);
                }
                else if (notification.Type == NotificationType.Sms)
                {
                    await smsSender.SendAsync(destination, message, cancellationToken);
                }
                else
                {
                    _logger.LogInformation("System notification {NotificationId} queued for recipient {RecipientId}", notification.Id, recipient.Id);
                }

                recipient.Status = NotificationStatus.Delivered;
                recipient.DeliveredAt = DateTime.UtcNow;
                recipient.LastError = null;
            }
            catch (Exception ex)
            {
                recipient.Status = NotificationStatus.Failed;
                recipient.LastError = ex.Message;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
