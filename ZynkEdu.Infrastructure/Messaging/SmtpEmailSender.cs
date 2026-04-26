using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
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
            _logger.LogInformation("EMAIL to {Destination}: {Subject} {Message}", destination, subject, message);
            return;
        }

        var body = string.IsNullOrWhiteSpace(_options.RefLink)
            ? message
            : $"{message}{Environment.NewLine}{Environment.NewLine}View the portal: {_options.RefLink}";

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(_options.EmailUsername, _options.FromDisplayName),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };
        mailMessage.To.Add(destination);

        using var client = new SmtpClient(_options.EmailHost, _options.EmailPort)
        {
            EnableSsl = _options.EnableSsl,
            Credentials = new NetworkCredential(_options.EmailUsername, _options.EmailPassword)
        };

        await client.SendMailAsync(mailMessage, cancellationToken);
    }
}
