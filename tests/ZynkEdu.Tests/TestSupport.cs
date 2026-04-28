using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Tests;

internal sealed class TestCurrentUserContext : ICurrentUserContext
{
    public bool IsAuthenticated => true;
    public bool HasSchoolScope => Role is UserRole.Admin or UserRole.Teacher;
    public bool IsPlatformAdmin => Role == UserRole.PlatformAdmin;
    public int? UserId { get; init; }
    public int? SchoolId { get; init; }
    public string? UserName { get; init; }
    public UserRole? Role { get; init; }
    public string? ParentPhone { get; init; }
    public string? ParentEmail { get; init; }
}

internal sealed class RecordingSmsSender : ISmsSender
{
    public List<(string Destination, string Message)> Messages { get; } = new();

    public Task SendAsync(string destination, string message, CancellationToken cancellationToken = default)
    {
        Messages.Add((destination, message));
        return Task.CompletedTask;
    }
}

internal sealed class RecordingEmailSender : IEmailSender
{
    public List<(string Destination, string Subject, string Message, string? AttachmentFileName, byte[]? AttachmentBytes)> Messages { get; } = new();

    public Task SendAsync(string destination, string subject, string message, CancellationToken cancellationToken = default)
    {
        Messages.Add((destination, subject, message, null, null));
        return Task.CompletedTask;
    }

    public Task SendAsync(string destination, string subject, string message, byte[] attachmentBytes, string attachmentFileName, string attachmentContentType = "application/pdf", CancellationToken cancellationToken = default)
    {
        Messages.Add((destination, subject, message, attachmentFileName, attachmentBytes));
        return Task.CompletedTask;
    }
}

internal sealed class NoOpAuditLogService : IAuditLogService
{
    public Task LogAsync(int? schoolId, string action, string entityType, string entityId, string summary, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<IReadOnlyList<AuditLogResponse>> GetRecentAsync(int? schoolId = null, int take = 10, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<AuditLogResponse>>(Array.Empty<AuditLogResponse>());
}

internal static class TestDatabase
{
    public static async Task<(SqliteConnection Connection, ZynkEduDbContext DbContext)> CreateContextAsync(string databasePath, ICurrentUserContext currentUserContext)
    {
        var connection = new SqliteConnection($"Data Source={databasePath}");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<ZynkEduDbContext>()
            .UseSqlite(connection)
            .Options;

        var context = new ZynkEduDbContext(options, currentUserContext);
        await context.Database.EnsureCreatedAsync();
        return (connection, context);
    }

    public static IOptions<ParentOtpOptions> ParentOtpOptions(int expirationMinutes = 10, int maxAttempts = 5)
        => Options.Create(new ParentOtpOptions { ExpirationMinutes = expirationMinutes, MaxAttempts = maxAttempts });

    public static IOptions<JwtOptions> JwtOptions()
        => Options.Create(new JwtOptions
        {
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            SigningKey = "test-signing-key-which-is-long-enough-1234567890",
            ExpirationMinutes = 60,
            ParentExpirationMinutes = 30
        });

    public static string CreateDatabasePath()
    {
        return Path.Combine(Path.GetTempPath(), $"zynkedu-tests-{Guid.NewGuid():N}.db");
    }
}
