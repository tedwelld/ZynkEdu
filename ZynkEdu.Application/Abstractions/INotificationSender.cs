namespace ZynkEdu.Application.Abstractions;

public interface ISmsSender
{
    Task SendAsync(string destination, string message, CancellationToken cancellationToken = default);
}

public sealed record EmailAttachment(
    byte[] Content,
    string FileName,
    string ContentType = "application/pdf");

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
    Task SendAsync(
        string destination,
        string subject,
        string message,
        string htmlMessage,
        IReadOnlyList<EmailAttachment> attachments,
        CancellationToken cancellationToken = default);
    Task SendAsync(
        string destination,
        string subject,
        string message,
        IReadOnlyList<EmailAttachment> attachments,
        CancellationToken cancellationToken = default);
}
