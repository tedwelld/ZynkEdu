using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;

namespace ZynkEdu.Infrastructure.Messaging;

public sealed class LoggingSmsSender : ISmsSender
{
    private readonly ILogger<LoggingSmsSender> _logger;

    public LoggingSmsSender(ILogger<LoggingSmsSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string destination, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SMS to {Destination}: {Message}", destination, message);
        return Task.CompletedTask;
    }
}
