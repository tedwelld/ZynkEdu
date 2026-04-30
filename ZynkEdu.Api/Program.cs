using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddZynkEduInfrastructure(builder.Configuration);

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseMiddleware<ZynkEdu.Api.Middleware.ExceptionHandlingMiddleware>();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

var databaseMigrated = await RunBootstrapStepAsync("database initialization", () => InitializeDatabaseAsync(app.Services, app.Logger), app.Logger);
if (!databaseMigrated)
{
    throw new InvalidOperationException("Database initialization could not be completed. Run .\\scripts\\Update-Database.ps1 and confirm that LocalDB is available before starting the API.");
}

await RunBootstrapStepAsync("platform admin", () => SeedPlatformAdminAsync(app.Services, app.Configuration, app.Logger), app.Logger);

app.Run();

static async Task<bool> RunBootstrapStepAsync(string stepName, Func<Task<bool>> step, ILogger logger, int maxAttempts = 5)
{
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        if (await step())
        {
            return true;
        }

        if (attempt < maxAttempts)
        {
            var delay = TimeSpan.FromSeconds(Math.Min(10, attempt * 2));
            logger.LogWarning("Bootstrap step {StepName} did not complete. Retrying in {DelaySeconds} seconds ({Attempt}/{MaxAttempts}).", stepName, (int)delay.TotalSeconds, attempt, maxAttempts);
            await Task.Delay(delay);
        }
    }

    logger.LogWarning("Bootstrap step {StepName} could not be completed after {MaxAttempts} attempts.", stepName, maxAttempts);
    return false;
}

static async Task<bool> InitializeDatabaseAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var databaseInitializationService = scope.ServiceProvider.GetRequiredService<IDatabaseInitializationService>();
        await databaseInitializationService.InitializeAsync();
        return true;
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database initialization was skipped because the SQL Server instance is not available yet.");
        return false;
    }
}

static async Task<bool> SeedPlatformAdminAsync(IServiceProvider services, IConfiguration configuration, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ZynkEduDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        var schoolCodeGenerator = scope.ServiceProvider.GetRequiredService<ISchoolCodeGenerator>();
        var gradingSchemeService = scope.ServiceProvider.GetRequiredService<IGradingSchemeService>();
        var firstSchool = await dbContext.Schools.AsNoTracking()
            .OrderBy(x => x.Id)
            .FirstOrDefaultAsync();

        var username = configuration["Bootstrap:PlatformAdmin:Username"];
        var password = configuration["Bootstrap:PlatformAdmin:Password"];
        var displayName = configuration["Bootstrap:PlatformAdmin:DisplayName"] ?? "Platform Admin";

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return true;
        }

        username = username.Trim().ToLowerInvariant();
        if (firstSchool is null)
        {
            firstSchool = new School
            {
                SchoolCode = await schoolCodeGenerator.GenerateAsync("Platform Administration"),
                Name = "Platform Administration",
                Address = "System",
                AdminContactEmail = null,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Schools.Add(firstSchool);
            await dbContext.SaveChangesAsync();
        }

        await gradingSchemeService.EnsureDefaultsAsync(firstSchool.Id);

        var existing = await dbContext.Users.FirstOrDefaultAsync(x => x.Username == username && x.Role == UserRole.PlatformAdmin);
        if (existing is not null)
        {
            existing.DisplayName = displayName;
            existing.SchoolId = firstSchool.Id;
            existing.IsActive = true;
            if (string.IsNullOrWhiteSpace(existing.PasswordHash))
            {
                existing.PasswordHash = hasher.HashPassword(existing, password);
            }

            await dbContext.SaveChangesAsync();
            return true;
        }

        var platformAdmin = new AppUser
        {
            Username = username,
            PasswordHash = string.Empty,
            Role = UserRole.PlatformAdmin,
            SchoolId = firstSchool.Id,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        platformAdmin.PasswordHash = hasher.HashPassword(platformAdmin, password);
        dbContext.Users.Add(platformAdmin);

        await dbContext.SaveChangesAsync();

        if (!await dbContext.AdminUsers.AnyAsync(x => x.Id == platformAdmin.Id))
        {
            dbContext.AdminUsers.Add(new AdminUser
            {
                Id = platformAdmin.Id,
                SchoolId = platformAdmin.SchoolId,
                DisplayName = platformAdmin.DisplayName,
                IsActive = true,
                CreatedAt = platformAdmin.CreatedAt
            });
            await dbContext.SaveChangesAsync();
        }

        logger.LogInformation("Seeded platform admin account {Username}", username);
        return true;
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Platform admin bootstrap skipped because the database is not ready yet.");
        return false;
    }
}
