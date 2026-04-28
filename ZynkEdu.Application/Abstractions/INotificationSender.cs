namespace ZynkEdu.Application.Abstractions;

public interface ISmsSender
{
    Task SendAsync(string destination, string message, CancellationToken cancellationToken = default);
}

public interface IEmailSender
{
    Task SendAsync(string destination, string subject, string message, CancellationToken cancellationToken = default);
    Task SendAsync(string destination, string subject, string message, string htmlMessage, CancellationToken cancellationToken = default);
    Task SendAsync(
        string destination,
        string subject,
        string message,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default);
    Task SendAsync(
        string destination,
        string subject,
        string message,
        string htmlMessage,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType = "application/pdf",
        CancellationToken cancellationToken = default);
}
