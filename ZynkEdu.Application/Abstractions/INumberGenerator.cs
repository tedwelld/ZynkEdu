namespace ZynkEdu.Application.Abstractions;

public interface IStudentNumberGenerator
{
    Task<string> GenerateAsync(int schoolId, CancellationToken cancellationToken = default);
}
