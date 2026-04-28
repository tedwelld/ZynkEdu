using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Messaging;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddZynkEduInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();

        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.Configure<ParentOtpOptions>(configuration.GetSection("ParentOtp"));
        services.Configure<EmailOptions>(configuration.GetSection("Email"));

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;";

        services.AddDbContext<ZynkEduDbContext>(options =>
        {
            options.UseSqlServer(connectionString, sqlOptions =>
            {
                sqlOptions.EnableRetryOnFailure();
            });
        });

        services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ISchoolCodeGenerator, SchoolCodeGenerator>();
        services.AddScoped<ISubjectCodeGenerator, SubjectCodeGenerator>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IPlatformSubjectCatalogService, PlatformSubjectCatalogService>();
        services.AddScoped<IStudentNumberGenerator, StudentNumberGenerator>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ISchoolService, SchoolService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IStudentService, StudentService>();
        services.AddScoped<IAttendanceService, AttendanceService>();
        services.AddScoped<ITeacherAssignmentService, TeacherAssignmentService>();
        services.AddScoped<IResultService, ResultService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<ITimetableService, TimetableService>();
        services.AddScoped<IAcademicCalendarService, AcademicCalendarService>();
        services.AddScoped<IAttendanceDispatchService, AttendanceDispatchService>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddScoped<ISmsSender, LoggingSmsSender>();
        services.AddHostedService<NotificationDispatchHostedService>();
        services.AddHostedService<AttendanceDispatchHostedService>();
        services.AddScoped<IPasswordHasher<Domain.Entities.AppUser>, PasswordHasher<Domain.Entities.AppUser>>();

        return services;
    }
}
