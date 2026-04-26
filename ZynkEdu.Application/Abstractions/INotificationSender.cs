namespace ZynkEdu.Application.Abstractions;

public interface ISmsSender
{
    Task SendAsync(string destination, string message, CancellationToken cancellationToken = default);
}

public interface IEmailSender
{
    Task SendAsync(string destination, string subject, string message, CancellationToken cancellationToken = default);
}
