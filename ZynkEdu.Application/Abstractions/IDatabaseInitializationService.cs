namespace ZynkEdu.Application.Abstractions;

public interface IDatabaseInitializationService
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}
