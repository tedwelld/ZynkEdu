using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;

namespace ZynkEdu.Infrastructure.Messaging;

public sealed class TimetableDispatchHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TimetableDispatchHostedService> _logger;

    public TimetableDispatchHostedService(IServiceScopeFactory scopeFactory, ILogger<TimetableDispatchHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var dispatcher = scope.ServiceProvider.GetRequiredService<ITimetableDispatchService>();
                await dispatcher.DispatchDueTimetablesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Timetable dispatch loop failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }
}
