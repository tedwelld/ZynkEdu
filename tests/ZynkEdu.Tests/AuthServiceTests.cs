using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task ParentOtpRoundTrip_IssuesTokenAfterVerification()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Students.Add(new Student
        {
            SchoolId = 1,
            StudentNumber = "SCH001-0001",
            FullName = "Jane Doe",
            Class = "Grade 3",
            ParentEmail = "parent@example.com",
            ParentPhone = "2777000000",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var sms = new RecordingSmsSender();
        var email = new RecordingEmailSender();
        var authService = new AuthService(
            context,
            new PasswordHasher<AppUser>(),
            new JwtTokenService(TestDatabase.JwtOptions()),
            email,
            sms,
            TestDatabase.ParentOtpOptions());

        var challenge = await authService.RequestParentOtpAsync(new ParentOtpRequest("2777000000", null));
        Assert.Single(sms.Messages);
        Assert.Equal("2777000000", challenge.Destination);

        var storedChallenge = await context.ParentOtpChallenges.FirstAsync();
        var otpCode = sms.Messages[0].Message.Split(' ')[4].TrimEnd('.');
        var response = await authService.VerifyParentOtpAsync(new VerifyParentOtpRequest(storedChallenge.Id, otpCode));

        Assert.Equal("Parent", response.Role);
        Assert.NotEmpty(response.AccessToken);
    }
}
