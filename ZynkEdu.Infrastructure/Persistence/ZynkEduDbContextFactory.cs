using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using ZynkEdu.Application.Abstractions;

namespace ZynkEdu.Infrastructure.Persistence;

public sealed class ZynkEduDbContextFactory : IDesignTimeDbContextFactory<ZynkEduDbContext>
{
    public ZynkEduDbContext CreateDbContext(string[] args)
    {
        var configuration = CreateConfiguration();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;";

        var optionsBuilder = new DbContextOptionsBuilder<ZynkEduDbContext>();
        optionsBuilder.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure());

        return new ZynkEduDbContext(optionsBuilder.Options, new DesignTimeCurrentUserContext());
    }

    private static IConfigurationRoot CreateConfiguration()
    {
        var builder = new ConfigurationBuilder();
        var apiAppSettingsPath = FindApiAppSettingsPath();

        if (apiAppSettingsPath is not null)
        {
            var apiDirectory = Path.GetDirectoryName(apiAppSettingsPath)!;
            builder.SetBasePath(apiDirectory);
            builder.AddJsonFile("appsettings.json", optional: true, reloadOnChange: false);

            var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
                ?? "Development";

            builder.AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false);
        }

        builder.AddEnvironmentVariables();
        return builder.Build();
    }

    private static string? FindApiAppSettingsPath()
    {
        var currentDirectory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (currentDirectory is not null)
        {
            var candidate = Path.Combine(currentDirectory.FullName, "ZynkEdu.Api", "appsettings.json");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            currentDirectory = currentDirectory.Parent;
        }

        return null;
    }

    private sealed class DesignTimeCurrentUserContext : ICurrentUserContext
    {
        public bool IsAuthenticated => false;
        public bool HasSchoolScope => false;
        public bool IsPlatformAdmin => false;
        public int? UserId => null;
        public int? SchoolId => null;
        public string? UserName => "DesignTime";
        public ZynkEdu.Domain.Enums.UserRole? Role => null;
        public string? ParentPhone => null;
        public string? ParentEmail => null;
    }
}
