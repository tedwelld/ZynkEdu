using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Seeding;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
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

await EnsureDatabaseCreatedAsync(app.Services, app.Logger);
await EnsureRuntimeSchemaAsync(app.Services, app.Logger);
await SeedDemoDataAsync(app.Services, app.Logger);
await SeedPlatformAdminAsync(app.Services, app.Configuration, app.Logger);

app.Run();

static async Task SeedDemoDataAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<DemoDataSeeder>();

        await seeder.SeedAsync();
        logger.LogInformation("Seeded demo schools, users, classes, results, and notifications.");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Demo data bootstrap was skipped because the database is not ready yet.");
    }
}

static async Task EnsureDatabaseCreatedAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ZynkEduDbContext>();

        await dbContext.Database.EnsureCreatedAsync();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database creation was skipped because the SQL Server instance is not available yet.");
    }
}

static async Task EnsureRuntimeSchemaAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ZynkEduDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'ParentPasswordHash') IS NULL
BEGIN
    ALTER TABLE Students ADD ParentPasswordHash nvarchar(512) NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Schools', 'AdminContactEmail') IS NULL
BEGIN
    ALTER TABLE Schools ADD AdminContactEmail nvarchar(200) NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'Level') IS NULL
BEGIN
    ALTER TABLE Students ADD Level nvarchar(100) NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'EnrollmentYear') IS NULL
BEGIN
    ALTER TABLE Students ADD EnrollmentYear int NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'GuardianId') IS NULL
BEGIN
    ALTER TABLE Students ADD GuardianId int NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[Guardians]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Guardians] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Guardians] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [StudentId] int NULL,
        [DisplayName] nvarchar(200) NOT NULL,
        [ParentEmail] nvarchar(200) NOT NULL,
        [ParentPhone] nvarchar(50) NOT NULL,
        [PasswordHash] nvarchar(512) NOT NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF_Guardians_IsActive] DEFAULT (1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Guardians_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Guardians_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students] ([Id]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Guardians_SchoolId'
      AND object_id = OBJECT_ID(N'[dbo].[Guardians]', N'U')
)
BEGIN
    CREATE INDEX [IX_Guardians_SchoolId]
    ON [dbo].[Guardians] ([SchoolId]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Guardians_StudentId'
      AND object_id = OBJECT_ID(N'[dbo].[Guardians]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_Guardians_StudentId]
    ON [dbo].[Guardians] ([StudentId])
    WHERE [StudentId] IS NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Guardians_ParentEmail'
      AND object_id = OBJECT_ID(N'[dbo].[Guardians]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_Guardians_ParentEmail]
    ON [dbo].[Guardians] ([ParentEmail]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Guardians_ParentPhone'
      AND object_id = OBJECT_ID(N'[dbo].[Guardians]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_Guardians_ParentPhone]
    ON [dbo].[Guardians] ([ParentPhone]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Students_Guardians_GuardianId'
)
BEGIN
    ALTER TABLE [dbo].[Students]
    ADD CONSTRAINT [FK_Students_Guardians_GuardianId]
        FOREIGN KEY ([GuardianId]) REFERENCES [dbo].[Guardians] ([Id]) ON DELETE SET NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AdminUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AdminUsers] (
        [Id] int NOT NULL CONSTRAINT [PK_AdminUsers] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [DisplayName] nvarchar(200) NOT NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF_AdminUsers_IsActive] DEFAULT (1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AdminUsers_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_AdminUsers_Users_Id] FOREIGN KEY ([Id]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'[dbo].[StaffAdmins]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[StaffAdmins] (
        [Id] int NOT NULL CONSTRAINT [PK_StaffAdmins] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [DisplayName] nvarchar(200) NOT NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF_StaffAdmins_IsActive] DEFAULT (1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_StaffAdmins_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_StaffAdmins_Users_Id] FOREIGN KEY ([Id]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'[dbo].[TeacherUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TeacherUsers] (
        [Id] int NOT NULL CONSTRAINT [PK_TeacherUsers] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [DisplayName] nvarchar(200) NOT NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF_TeacherUsers_IsActive] DEFAULT (1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_TeacherUsers_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_TeacherUsers_Users_Id] FOREIGN KEY ([Id]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AdminUsers]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[AdminUsers] ([Id], [SchoolId], [DisplayName], [IsActive], [CreatedAt])
    SELECT u.[Id], u.[SchoolId], u.[DisplayName], u.[IsActive], u.[CreatedAt]
    FROM [dbo].[Users] u
    WHERE u.[Role] = 0
      AND NOT EXISTS (SELECT 1 FROM [dbo].[AdminUsers] au WHERE au.[Id] = u.[Id]);
END;

IF OBJECT_ID(N'[dbo].[StaffAdmins]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[StaffAdmins] ([Id], [SchoolId], [DisplayName], [IsActive], [CreatedAt])
    SELECT u.[Id], u.[SchoolId], u.[DisplayName], u.[IsActive], u.[CreatedAt]
    FROM [dbo].[Users] u
    WHERE u.[Role] = 1
      AND NOT EXISTS (SELECT 1 FROM [dbo].[StaffAdmins] sa WHERE sa.[Id] = u.[Id]);
END;

IF OBJECT_ID(N'[dbo].[TeacherUsers]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[TeacherUsers] ([Id], [SchoolId], [DisplayName], [IsActive], [CreatedAt])
    SELECT u.[Id], u.[SchoolId], u.[DisplayName], u.[IsActive], u.[CreatedAt]
    FROM [dbo].[Users] u
    WHERE u.[Role] = 2
      AND NOT EXISTS (SELECT 1 FROM [dbo].[TeacherUsers] tu WHERE tu.[Id] = u.[Id]);
END;");

        await dbContext.Database.ExecuteSqlRawAsync(@"
UPDATE Students
SET
    Level = CASE
        WHEN Level IS NOT NULL AND LTRIM(RTRIM(Level)) <> '' THEN Level
        WHEN [Class] LIKE 'Form 1%' OR [Class] LIKE 'Form 2%' THEN 'ZGC Level'
        WHEN [Class] LIKE 'Form 3%' OR [Class] LIKE 'Form 4%' THEN 'O''Level'
        WHEN [Class] LIKE 'Form 5%' OR [Class] LIKE 'Form 6%' THEN 'A''Level'
        ELSE 'ZGC Level'
    END,
    EnrollmentYear = COALESCE(EnrollmentYear, YEAR(CreatedAt), YEAR(GETUTCDATE()))
WHERE Level IS NULL OR LTRIM(RTRIM(Level)) = '' OR EnrollmentYear IS NULL;");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'Level') IS NOT NULL
BEGIN
    ALTER TABLE Students ALTER COLUMN Level nvarchar(100) NOT NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students', 'EnrollmentYear') IS NOT NULL
BEGIN
    ALTER TABLE Students ALTER COLUMN EnrollmentYear int NOT NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[Guardians]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[Guardians] ([SchoolId], [StudentId], [DisplayName], [ParentEmail], [ParentPhone], [PasswordHash], [IsActive], [CreatedAt])
    SELECT
        s.[SchoolId],
        s.[Id],
        s.[FullName],
        s.[ParentEmail],
        s.[ParentPhone],
        s.[ParentPasswordHash],
        1,
        COALESCE(s.[CreatedAt], SYSUTCDATETIME())
    FROM [dbo].[Students] s
    WHERE s.[ParentEmail] IS NOT NULL
      AND LTRIM(RTRIM(s.[ParentEmail])) <> ''
      AND s.[ParentPhone] IS NOT NULL
      AND LTRIM(RTRIM(s.[ParentPhone])) <> ''
      AND s.[ParentPasswordHash] IS NOT NULL
      AND LTRIM(RTRIM(s.[ParentPasswordHash])) <> ''
      AND NOT EXISTS (SELECT 1 FROM [dbo].[Guardians] g WHERE g.[StudentId] = s.[Id]);

    UPDATE s
    SET s.[GuardianId] = g.[Id]
    FROM [dbo].[Students] s
    INNER JOIN [dbo].[Guardians] g ON g.[StudentId] = s.[Id]
    WHERE s.[GuardianId] IS NULL;
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[StudentSubjectEnrollments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[StudentSubjectEnrollments] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StudentSubjectEnrollments] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [StudentId] int NOT NULL,
        [SubjectId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_StudentSubjectEnrollments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_StudentSubjectEnrollments_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_StudentSubjectEnrollments_Subjects_SubjectId] FOREIGN KEY ([SubjectId]) REFERENCES [dbo].[Subjects] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_StudentSubjectEnrollments_SchoolId_StudentId_SubjectId'
      AND object_id = OBJECT_ID(N'[dbo].[StudentSubjectEnrollments]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_StudentSubjectEnrollments_SchoolId_StudentId_SubjectId]
    ON [dbo].[StudentSubjectEnrollments] ([SchoolId], [StudentId], [SubjectId]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_StudentSubjectEnrollments_StudentId'
      AND object_id = OBJECT_ID(N'[dbo].[StudentSubjectEnrollments]', N'U')
)
BEGIN
    CREATE INDEX [IX_StudentSubjectEnrollments_StudentId]
    ON [dbo].[StudentSubjectEnrollments] ([StudentId]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_StudentSubjectEnrollments_SubjectId'
      AND object_id = OBJECT_ID(N'[dbo].[StudentSubjectEnrollments]', N'U')
)
BEGIN
    CREATE INDEX [IX_StudentSubjectEnrollments_SubjectId]
    ON [dbo].[StudentSubjectEnrollments] ([SubjectId]);
END;");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AcademicTerms]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AcademicTerms] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AcademicTerms] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [TermNumber] int NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [StartDate] date NULL,
        [EndDate] date NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AcademicTerms_CreatedAt] DEFAULT (SYSUTCDATETIME())
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AcademicTerms_SchoolId_TermNumber'
      AND object_id = OBJECT_ID(N'[dbo].[AcademicTerms]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_AcademicTerms_SchoolId_TermNumber]
    ON [dbo].[AcademicTerms] ([SchoolId], [TermNumber]);
END;

IF OBJECT_ID(N'[dbo].[SchoolCalendarEvents]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SchoolCalendarEvents] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SchoolCalendarEvents] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [AcademicTermId] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [EventDate] date NOT NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_SchoolCalendarEvents_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_SchoolCalendarEvents_AcademicTerms_AcademicTermId] FOREIGN KEY ([AcademicTermId]) REFERENCES [dbo].[AcademicTerms] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_SchoolCalendarEvents_AcademicTermId'
      AND object_id = OBJECT_ID(N'[dbo].[SchoolCalendarEvents]', N'U')
)
BEGIN
    CREATE INDEX [IX_SchoolCalendarEvents_AcademicTermId]
    ON [dbo].[SchoolCalendarEvents] ([AcademicTermId]);
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AttendanceRegisters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttendanceRegisters] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AttendanceRegisters] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [TeacherId] int NOT NULL,
        [AcademicTermId] int NOT NULL,
        [Class] nvarchar(100) NOT NULL,
        [AttendanceDate] datetime2 NOT NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AttendanceRegisters_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] datetime2 NOT NULL CONSTRAINT [DF_AttendanceRegisters_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [DispatchedAt] datetime2 NULL,
        CONSTRAINT [FK_AttendanceRegisters_Users_TeacherId] FOREIGN KEY ([TeacherId]) REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [FK_AttendanceRegisters_AcademicTerms_AcademicTermId] FOREIGN KEY ([AcademicTermId]) REFERENCES [dbo].[AcademicTerms] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AttendanceRegisters_SchoolId_Class_AttendanceDate'
      AND object_id = OBJECT_ID(N'[dbo].[AttendanceRegisters]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_AttendanceRegisters_SchoolId_Class_AttendanceDate]
    ON [dbo].[AttendanceRegisters] ([SchoolId], [Class], [AttendanceDate]);
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AttendanceRegisterEntries]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttendanceRegisterEntries] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AttendanceRegisterEntries] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [AttendanceRegisterId] int NOT NULL,
        [StudentId] int NOT NULL,
        [Status] int NOT NULL,
        [Note] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AttendanceRegisterEntries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_AttendanceRegisterEntries_AttendanceRegisters_AttendanceRegisterId] FOREIGN KEY ([AttendanceRegisterId]) REFERENCES [dbo].[AttendanceRegisters] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AttendanceRegisterEntries_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AttendanceRegisterEntries_SchoolId_AttendanceRegisterId_StudentId'
      AND object_id = OBJECT_ID(N'[dbo].[AttendanceRegisterEntries]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_AttendanceRegisterEntries_SchoolId_AttendanceRegisterId_StudentId]
    ON [dbo].[AttendanceRegisterEntries] ([SchoolId], [AttendanceRegisterId], [StudentId]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AttendanceRegisterEntries_AttendanceRegisterId'
      AND object_id = OBJECT_ID(N'[dbo].[AttendanceRegisterEntries]', N'U')
)
BEGIN
    CREATE INDEX [IX_AttendanceRegisterEntries_AttendanceRegisterId]
    ON [dbo].[AttendanceRegisterEntries] ([AttendanceRegisterId]);
END");

        await dbContext.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[AttendanceDispatchLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttendanceDispatchLogs] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AttendanceDispatchLogs] PRIMARY KEY,
        [SchoolId] int NOT NULL,
        [AttendanceDate] datetime2 NOT NULL,
        [DispatchedAt] datetime2 NOT NULL,
        [EmailSucceeded] bit NOT NULL,
        [DestinationEmail] nvarchar(200) NULL,
        [ErrorMessage] nvarchar(1000) NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AttendanceDispatchLogs_SchoolId_AttendanceDate'
      AND object_id = OBJECT_ID(N'[dbo].[AttendanceDispatchLogs]', N'U')
)
BEGIN
    CREATE UNIQUE INDEX [IX_AttendanceDispatchLogs_SchoolId_AttendanceDate]
    ON [dbo].[AttendanceDispatchLogs] ([SchoolId], [AttendanceDate]);
END");

        var students = await dbContext.Students.IgnoreQueryFilters()
            .Where(x => string.IsNullOrWhiteSpace(x.ParentPasswordHash))
            .ToListAsync();

        foreach (var student in students)
        {
            student.ParentPasswordHash = hasher.HashPassword(new AppUser { Username = student.ParentEmail }, "Parent123!");
        }

        if (students.Count > 0)
        {
            await dbContext.SaveChangesAsync();
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Runtime schema bootstrap was skipped because the database is not ready yet.");
    }
}

static async Task SeedPlatformAdminAsync(IServiceProvider services, IConfiguration configuration, ILogger logger)
{
    try
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ZynkEduDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        var firstSchoolId = await dbContext.Schools.AsNoTracking()
            .OrderBy(x => x.Id)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var username = configuration["Bootstrap:PlatformAdmin:Username"];
        var password = configuration["Bootstrap:PlatformAdmin:Password"];
        var displayName = configuration["Bootstrap:PlatformAdmin:DisplayName"] ?? "Platform Admin";

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        username = username.Trim().ToLowerInvariant();
        var existing = await dbContext.Users.FirstOrDefaultAsync(x => x.Username == username && x.Role == UserRole.PlatformAdmin);
        if (existing is not null)
        {
            existing.DisplayName = displayName;
            existing.SchoolId = firstSchoolId;
            existing.IsActive = true;
            if (string.IsNullOrWhiteSpace(existing.PasswordHash))
            {
                existing.PasswordHash = hasher.HashPassword(existing, password);
            }

            await dbContext.SaveChangesAsync();
            return;
        }

        var platformAdmin = new AppUser
        {
            Username = username,
            PasswordHash = string.Empty,
            Role = UserRole.PlatformAdmin,
            SchoolId = firstSchoolId,
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
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Platform admin bootstrap skipped because the database is not ready yet.");
    }
}
