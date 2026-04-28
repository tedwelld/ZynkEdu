using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;

namespace ZynkEdu.Infrastructure.Messaging;

public sealed class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string destination, string subject, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("EMAIL to {Destination}: {Subject} {Message}", destination, subject, message);
        return Task.CompletedTask;
    }

    public Task SendAsync(string destination, string subject, string message, string htmlMessage, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("EMAIL to {Destination}: {Subject} {Message} [HTML length: {HtmlLength}]", destination, subject, message, htmlMessage.Length);
        return Task.CompletedTask;
    }

    public Task SendAsync(
        string destination,
        string subject,
        string message,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "EMAIL to {Destination}: {Subject} {Message} [{AttachmentFileName} {AttachmentContentType} {AttachmentSize} bytes]",
            destination,
            subject,
            message,
            attachmentFileName,
            attachmentContentType,
            attachmentBytes.Length);
        return Task.CompletedTask;
    }

    public Task SendAsync(
        string destination,
        string subject,
        string message,
        string htmlMessage,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "EMAIL to {Destination}: {Subject} {Message} [HTML length: {HtmlLength}] [{AttachmentFileName} {AttachmentContentType} {AttachmentSize} bytes]",
            destination,
            subject,
            message,
            htmlMessage.Length,
            attachmentFileName,
            attachmentContentType,
            attachmentBytes.Length);
        return Task.CompletedTask;
    }
}
