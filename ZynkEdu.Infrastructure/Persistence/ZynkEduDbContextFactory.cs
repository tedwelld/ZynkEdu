using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Persistence;

public sealed class ZynkEduDbContextFactory : IDesignTimeDbContextFactory<ZynkEduDbContext>
{
    public ZynkEduDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;";

        var optionsBuilder = new DbContextOptionsBuilder<ZynkEduDbContext>();
        optionsBuilder.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure());

        return new ZynkEduDbContext(optionsBuilder.Options, new DesignTimeCurrentUserContext());
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
