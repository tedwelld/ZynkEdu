using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class DatabaseInitializationService : IDatabaseInitializationService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ILogger<DatabaseInitializationService> _logger;

    public DatabaseInitializationService(ZynkEduDbContext dbContext, ILogger<DatabaseInitializationService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        var databaseExists = await CanConnectAsync(cancellationToken);

        if (!databaseExists)
        {
            _logger.LogInformation("Database is not reachable yet. EF Core migrations will create it if the SQL Server instance is available.");
            await _dbContext.Database.MigrateAsync(cancellationToken);
            _logger.LogInformation("Database created and migrations applied successfully.");
            return;
        }

        var pendingMigrations = (await _dbContext.Database.GetPendingMigrationsAsync(cancellationToken)).ToArray();
        if (pendingMigrations.Length == 0)
        {
            _logger.LogInformation("Database already exists and has no pending migrations.");
            return;
        }

        _logger.LogInformation("Applying {Count} pending migration(s): {Migrations}", pendingMigrations.Length, string.Join(", ", pendingMigrations));
        await _dbContext.Database.MigrateAsync(cancellationToken);
        _logger.LogInformation("Database migrations applied successfully.");
    }

    private async Task<bool> CanConnectAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await _dbContext.Database.CanConnectAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Database connectivity check failed. EF Core migrations will retry through the startup bootstrap.");
            return false;
        }
    }
}
