using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Options;

namespace ZynkEdu.Infrastructure.Messaging;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly EmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string destination, string subject, string message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.EmailHost) || string.IsNullOrWhiteSpace(_options.EmailUsername))
        {
            _logger.LogWarning("SMTP configuration is incomplete. Email to {Destination} was not sent and will be logged instead.", destination);
            _logger.LogInformation("EMAIL to {Destination}: {Subject} {Message}", destination, subject, message);
            return;
        }

        var body = string.IsNullOrWhiteSpace(_options.RefLink)
            ? message
            : $"{message}{Environment.NewLine}{Environment.NewLine}View the portal: {_options.RefLink}";

        var fromAddress = string.IsNullOrWhiteSpace(_options.FromAddress)
            ? _options.EmailUsername
            : _options.FromAddress;

        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(new MailboxAddress(_options.FromDisplayName, fromAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(destination));
        mimeMessage.Subject = subject;
        mimeMessage.Body = new TextPart("plain")
        {
            Text = body
        };

        var secureSocketOptions = _options.EnableSsl
            ? (_options.EmailPort == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
            : SecureSocketOptions.None;

        var attempts = Math.Max(1, _options.MaxRetries);
        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            try
            {
                using var client = new SmtpClient
                {
                    Timeout = Math.Max(1000, _options.TimeoutMilliseconds)
                };

                await client.ConnectAsync(_options.EmailHost, _options.EmailPort, secureSocketOptions, cancellationToken);
                await client.AuthenticateAsync(_options.EmailUsername, _options.EmailPassword, cancellationToken);
                await client.SendAsync(mimeMessage, cancellationToken);
                await client.DisconnectAsync(true, cancellationToken);
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex) when (attempt < attempts)
            {
                _logger.LogWarning(
                    ex,
                    "SMTP send attempt {Attempt}/{Attempts} failed for {Destination} via {Host}:{Port}. Retrying.",
                    attempt,
                    attempts,
                    destination,
                    _options.EmailHost,
                    _options.EmailPort);

                await Task.Delay(Math.Max(250, _options.RetryDelayMilliseconds), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "SMTP send failed for {Destination} via {Host}:{Port} after {Attempts} attempt(s).",
                    destination,
                    _options.EmailHost,
                    _options.EmailPort,
                    attempts);

                throw new InvalidOperationException(
                    $"Failed to send email to {destination} via {_options.EmailHost}:{_options.EmailPort}.",
                    ex);
            }
        }
    }

    public async Task SendAsync(string destination, string subject, string message, string htmlMessage, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.EmailHost) || string.IsNullOrWhiteSpace(_options.EmailUsername))
        {
            _logger.LogWarning("SMTP configuration is incomplete. Email to {Destination} was not sent and will be logged instead.", destination);
            _logger.LogInformation("EMAIL to {Destination}: {Subject} {Message} [HTML length: {HtmlLength}]", destination, subject, message, htmlMessage.Length);
            return;
        }

        var fromAddress = string.IsNullOrWhiteSpace(_options.FromAddress)
            ? _options.EmailUsername
            : _options.FromAddress;

        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(new MailboxAddress(_options.FromDisplayName, fromAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(destination));
        mimeMessage.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            TextBody = string.IsNullOrWhiteSpace(_options.RefLink)
                ? message
                : $"{message}{Environment.NewLine}{Environment.NewLine}View the portal: {_options.RefLink}",
            HtmlBody = string.IsNullOrWhiteSpace(htmlMessage)
                ? null
                : htmlMessage
        };
        mimeMessage.Body = bodyBuilder.ToMessageBody();

        await SendWithRetriesAsync(destination, mimeMessage, cancellationToken);
    }

    public async Task SendAsync(
        string destination,
        string subject,
        string message,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.EmailHost) || string.IsNullOrWhiteSpace(_options.EmailUsername))
        {
            _logger.LogWarning("SMTP configuration is incomplete. Email to {Destination} was not sent and will be logged instead.", destination);
            _logger.LogInformation(
                "EMAIL to {Destination}: {Subject} {Message} [{AttachmentFileName} {AttachmentContentType} {AttachmentSize} bytes]",
                destination,
                subject,
                message,
                attachmentFileName,
                attachmentContentType,
                attachmentBytes.Length);
            return;
        }

        var body = string.IsNullOrWhiteSpace(_options.RefLink)
            ? message
            : $"{message}{Environment.NewLine}{Environment.NewLine}View the portal: {_options.RefLink}";

        var fromAddress = string.IsNullOrWhiteSpace(_options.FromAddress)
            ? _options.EmailUsername
            : _options.FromAddress;

        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(new MailboxAddress(_options.FromDisplayName, fromAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(destination));
        mimeMessage.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            TextBody = body
        };
        bodyBuilder.Attachments.Add(attachmentFileName, attachmentBytes, ContentType.Parse(attachmentContentType));
        mimeMessage.Body = bodyBuilder.ToMessageBody();

        var secureSocketOptions = _options.EnableSsl
            ? (_options.EmailPort == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
            : SecureSocketOptions.None;

        var attempts = Math.Max(1, _options.MaxRetries);
        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            try
            {
                using var client = new SmtpClient
                {
                    Timeout = Math.Max(1000, _options.TimeoutMilliseconds)
                };

                await client.ConnectAsync(_options.EmailHost, _options.EmailPort, secureSocketOptions, cancellationToken);
                await client.AuthenticateAsync(_options.EmailUsername, _options.EmailPassword, cancellationToken);
                await client.SendAsync(mimeMessage, cancellationToken);
                await client.DisconnectAsync(true, cancellationToken);
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex) when (attempt < attempts)
            {
                _logger.LogWarning(
                    ex,
                    "SMTP send attempt {Attempt}/{Attempts} failed for {Destination} via {Host}:{Port}. Retrying.",
                    attempt,
                    attempts,
                    destination,
                    _options.EmailHost,
                    _options.EmailPort);

                await Task.Delay(Math.Max(250, _options.RetryDelayMilliseconds), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "SMTP send failed for {Destination} via {Host}:{Port} after {Attempts} attempt(s).",
                    destination,
                    _options.EmailHost,
                    _options.EmailPort,
                    attempts);

                throw new InvalidOperationException(
                    $"Failed to send email to {destination} via {_options.EmailHost}:{_options.EmailPort}.",
                    ex);
            }
        }
    }

    public async Task SendAsync(
        string destination,
        string subject,
        string message,
        string htmlMessage,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.EmailHost) || string.IsNullOrWhiteSpace(_options.EmailUsername))
        {
            _logger.LogWarning("SMTP configuration is incomplete. Email to {Destination} was not sent and will be logged instead.", destination);
            _logger.LogInformation(
                "EMAIL to {Destination}: {Subject} {Message} [HTML length: {HtmlLength}] [{AttachmentFileName} {AttachmentContentType} {AttachmentSize} bytes]",
                destination,
                subject,
                message,
                htmlMessage.Length,
                attachmentFileName,
                attachmentContentType,
                attachmentBytes.Length);
            return;
        }

        var fromAddress = string.IsNullOrWhiteSpace(_options.FromAddress)
            ? _options.EmailUsername
            : _options.FromAddress;

        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(new MailboxAddress(_options.FromDisplayName, fromAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(destination));
        mimeMessage.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            TextBody = string.IsNullOrWhiteSpace(_options.RefLink)
                ? message
                : $"{message}{Environment.NewLine}{Environment.NewLine}View the portal: {_options.RefLink}",
            HtmlBody = string.IsNullOrWhiteSpace(htmlMessage)
                ? null
                : htmlMessage
        };
        bodyBuilder.Attachments.Add(attachmentFileName, attachmentBytes, ContentType.Parse(attachmentContentType));
        mimeMessage.Body = bodyBuilder.ToMessageBody();

        await SendWithRetriesAsync(destination, mimeMessage, cancellationToken);
    }

    private async Task SendWithRetriesAsync(string destination, MimeMessage mimeMessage, CancellationToken cancellationToken)
    {
        var secureSocketOptions = _options.EnableSsl
            ? (_options.EmailPort == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls)
            : SecureSocketOptions.None;

        var attempts = Math.Max(1, _options.MaxRetries);
        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            try
            {
                using var client = new SmtpClient
                {
                    Timeout = Math.Max(1000, _options.TimeoutMilliseconds)
                };

                await client.ConnectAsync(_options.EmailHost, _options.EmailPort, secureSocketOptions, cancellationToken);
                await client.AuthenticateAsync(_options.EmailUsername, _options.EmailPassword, cancellationToken);
                await client.SendAsync(mimeMessage, cancellationToken);
                await client.DisconnectAsync(true, cancellationToken);
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex) when (attempt < attempts)
            {
                _logger.LogWarning(
                    ex,
                    "SMTP send attempt {Attempt}/{Attempts} failed for {Destination} via {Host}:{Port}. Retrying.",
                    attempt,
                    attempts,
                    destination,
                    _options.EmailHost,
                    _options.EmailPort);

                await Task.Delay(Math.Max(250, _options.RetryDelayMilliseconds), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "SMTP send failed for {Destination} via {Host}:{Port} after {Attempts} attempt(s).",
                    destination,
                    _options.EmailHost,
                    _options.EmailPort,
                    attempts);

                throw new InvalidOperationException(
                    $"Failed to send email to {destination} via {_options.EmailHost}:{_options.EmailPort}.",
                    ex);
            }
        }
    }
}
