using Microsoft.AspNetCore.Identity;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task LoginAsync_IssuesTokenForPlatformAdmin()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var user = new AppUser
        {
            Username = "platform.admin",
            PasswordHash = string.Empty,
            Role = UserRole.PlatformAdmin,
            SchoolId = 1,
            DisplayName = "Platform Admin",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        var hasher = new PasswordHasher<AppUser>();
        user.PasswordHash = hasher.HashPassword(user, "Password123!");
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = new AuthService(
            context,
            hasher,
            new JwtTokenService(TestDatabase.JwtOptions()));

        var response = await authService.LoginAsync(new LoginRequest("platform.admin", "Password123!", null));

        Assert.Equal("PlatformAdmin", response.Role);
        Assert.NotEmpty(response.AccessToken);
        Assert.Equal(user.Id, response.UserId);
    }
}
