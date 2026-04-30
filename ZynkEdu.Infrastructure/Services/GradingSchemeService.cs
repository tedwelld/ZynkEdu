using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class GradingSchemeService : IGradingSchemeService
{
    private static readonly string[] ConfiguredLevels = [SchoolLevelCatalog.ZgcLevel, SchoolLevelCatalog.OLevel, SchoolLevelCatalog.ALevel];
    private static readonly string[] DisplayGrades = ["A", "B", "C", "D", "F"];
    private static readonly string[] ValidationGrades = ["F", "D", "C", "B", "A"];
    private static readonly IReadOnlyList<DefaultBandTemplate> DefaultBands =
    [
        new(SchoolLevelCatalog.ZgcLevel, "A", 80m, 100m),
        new(SchoolLevelCatalog.ZgcLevel, "B", 70m, 79.9m),
        new(SchoolLevelCatalog.ZgcLevel, "C", 60m, 69.9m),
        new(SchoolLevelCatalog.ZgcLevel, "D", 50m, 59.9m),
        new(SchoolLevelCatalog.ZgcLevel, "F", 0m, 49.9m),
        new(SchoolLevelCatalog.OLevel, "A", 80m, 100m),
        new(SchoolLevelCatalog.OLevel, "B", 70m, 79.9m),
        new(SchoolLevelCatalog.OLevel, "C", 60m, 69.9m),
        new(SchoolLevelCatalog.OLevel, "D", 50m, 59.9m),
        new(SchoolLevelCatalog.OLevel, "F", 0m, 49.9m),
        new(SchoolLevelCatalog.ALevel, "A", 80m, 100m),
        new(SchoolLevelCatalog.ALevel, "B", 70m, 79.9m),
        new(SchoolLevelCatalog.ALevel, "C", 60m, 69.9m),
        new(SchoolLevelCatalog.ALevel, "D", 50m, 59.9m),
        new(SchoolLevelCatalog.ALevel, "F", 0m, 49.9m)
    ];

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;

    public GradingSchemeService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
    }

    public async Task<GradingSchemeResponse> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveManagedSchoolId(schoolId);
        var school = await LoadSchoolAsync(resolvedSchoolId, cancellationToken);
        await EnsureDefaultsAsync(resolvedSchoolId, cancellationToken);

        var bands = await LoadBandsAsync(resolvedSchoolId, cancellationToken);
        return BuildResponse(school, bands);
    }

    public async Task<GradingSchemeResponse> SaveAsync(SaveGradingSchemeRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveManagedSchoolId(schoolId);
        var school = await LoadSchoolAsync(resolvedSchoolId, cancellationToken);
        var normalizedBands = NormalizeAndValidate(request.Bands);

        var existingBands = await _dbContext.SchoolGradingBands
            .Where(x => x.SchoolId == resolvedSchoolId)
            .ToListAsync(cancellationToken);

        _dbContext.SchoolGradingBands.RemoveRange(existingBands);
        _dbContext.SchoolGradingBands.AddRange(normalizedBands.Select(band => new SchoolGradingBand
        {
            SchoolId = resolvedSchoolId,
            Level = band.Level,
            Grade = band.Grade,
            MinScore = band.MinScore,
            MaxScore = band.MaxScore
        }));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "GradingScheme", resolvedSchoolId.ToString(), $"Updated grading bands for {school.Name}.", cancellationToken);

        return await GetAsync(resolvedSchoolId, cancellationToken);
    }

    public async Task<string> ResolveGradeAsync(int schoolId, string level, decimal score, CancellationToken cancellationToken = default)
    {
        var normalizedLevel = NormalizeLevel(level);
        var normalizedScore = RoundScore(score);

        var bands = await LoadBandsForLevelAsync(schoolId, normalizedLevel, cancellationToken);
        if (bands.Count == 0)
        {
            throw new InvalidOperationException($"No grading bands have been configured for {normalizedLevel}.");
        }

        var band = bands.FirstOrDefault(x => normalizedScore >= x.MinScore && normalizedScore <= x.MaxScore);
        if (band is null)
        {
            throw new InvalidOperationException($"Score {normalizedScore:0.0} is outside the configured grading bands for {normalizedLevel}.");
        }

        return band.Grade;
    }

    public async Task EnsureDefaultsAsync(int schoolId, CancellationToken cancellationToken = default)
    {
        var hasBands = await _dbContext.SchoolGradingBands.AsNoTracking().AnyAsync(x => x.SchoolId == schoolId, cancellationToken);
        if (hasBands)
        {
            return;
        }

        _dbContext.SchoolGradingBands.AddRange(DefaultBands.Select(band => new SchoolGradingBand
        {
            SchoolId = schoolId,
            Level = band.Level,
            Grade = band.Grade,
            MinScore = band.MinScore,
            MaxScore = band.MaxScore
        }));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(schoolId, "Created", "GradingScheme", schoolId.ToString(), "Seeded default grading bands.", cancellationToken);
    }

    private async Task<SchoolResponse> LoadSchoolAsync(int schoolId, CancellationToken cancellationToken)
    {
        return await _dbContext.Schools.AsNoTracking()
            .Where(x => x.Id == schoolId)
            .Select(x => new SchoolResponse(x.Id, x.SchoolCode, x.Name, x.Address, x.AdminContactEmail, x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("School was not found.");
    }

    private async Task<IReadOnlyList<SchoolGradingBand>> LoadBandsAsync(int schoolId, CancellationToken cancellationToken)
    {
        var bands = await _dbContext.SchoolGradingBands.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .OrderBy(x => x.Level)
            .ThenByDescending(x => x.MaxScore)
            .ToListAsync(cancellationToken);

        return bands;
    }

    private async Task<IReadOnlyList<SchoolGradingBand>> LoadBandsForLevelAsync(int schoolId, string level, CancellationToken cancellationToken)
    {
        return await _dbContext.SchoolGradingBands.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.Level == level)
            .OrderBy(x => x.MinScore)
            .ToListAsync(cancellationToken);
    }

    private static GradingSchemeResponse BuildResponse(SchoolResponse school, IReadOnlyList<SchoolGradingBand> bands)
    {
        var levels = ConfiguredLevels.Select(level => new GradingLevelResponse(
            level,
            bands.Where(x => x.Level == level)
                .OrderBy(x => Array.IndexOf(DisplayGrades, x.Grade))
                .Select(x => new GradingBandResponse(x.Grade, x.MinScore, x.MaxScore))
                .ToList())).ToList();

        return new GradingSchemeResponse(school.Id, school.Name, levels);
    }

    private static IReadOnlyList<SchoolGradingBand> NormalizeAndValidate(IReadOnlyList<SaveGradingBandRequest> bands)
    {
        if (bands.Count == 0)
        {
            throw new InvalidOperationException("At least one grading band is required.");
        }

        var normalizedBands = bands.Select(band => new SchoolGradingBand
        {
            Level = NormalizeLevel(band.Level),
            Grade = NormalizeGrade(band.Grade),
            MinScore = RoundScore(band.MinScore),
            MaxScore = RoundScore(band.MaxScore)
        }).ToList();

        foreach (var group in normalizedBands.GroupBy(x => x.Level))
        {
            ValidateLevelBands(group.Key, group.ToList());
        }

        foreach (var level in ConfiguredLevels)
        {
            if (!normalizedBands.Any(x => x.Level == level))
            {
                throw new InvalidOperationException($"Grading bands are required for {level}.");
            }
        }

        return normalizedBands;
    }

    private static void ValidateLevelBands(string level, IReadOnlyList<SchoolGradingBand> bands)
    {
        if (bands.Count != ValidationGrades.Length)
        {
            throw new InvalidOperationException($"{level} must define exactly {ValidationGrades.Length} grading bands.");
        }

        var grades = bands.Select(x => x.Grade).ToArray();
        if (!grades.OrderBy(x => Array.IndexOf(ValidationGrades, x)).SequenceEqual(ValidationGrades))
        {
            throw new InvalidOperationException($"{level} must use the grade order F, D, C, B, A.");
        }

        if (bands.Any(x => x.MinScore < 0m || x.MaxScore > 100m))
        {
            throw new InvalidOperationException($"{level} bands must stay within 0 to 100.");
        }

        if (bands.Any(x => x.MinScore > x.MaxScore))
        {
            throw new InvalidOperationException($"{level} contains a band where the minimum exceeds the maximum.");
        }

        if (bands.Any(x => !HasOneDecimalPlace(x.MinScore) || !HasOneDecimalPlace(x.MaxScore)))
        {
            throw new InvalidOperationException($"{level} bands must use one decimal place precision.");
        }

        var ordered = bands.OrderBy(x => x.MinScore).ToList();
        if (ordered[0].MinScore != 0m)
        {
            throw new InvalidOperationException($"{level} must start at 0.0.");
        }

        if (ordered[^1].MaxScore != 100m)
        {
            throw new InvalidOperationException($"{level} must end at 100.0.");
        }

        for (var index = 1; index < ordered.Count; index++)
        {
            var previous = ordered[index - 1];
            var current = ordered[index];

            if (current.MinScore != previous.MaxScore + 0.1m)
            {
                throw new InvalidOperationException($"{level} bands must be contiguous without gaps or overlaps.");
            }
        }
    }

    private int ResolveManagedSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Select a school before managing grading bands.");
        }

        if (_currentUserContext.Role != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Only school admins can manage grading bands.");
        }

        var resolvedSchoolId = _currentUserContext.SchoolId
            ?? throw new UnauthorizedAccessException("A school-scoped user is required.");

        if (schoolId is not null && schoolId != resolvedSchoolId)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return resolvedSchoolId;
    }

    private static string NormalizeLevel(string value)
    {
        var normalized = SchoolLevelCatalog.NormalizeLevel(value);
        if (!ConfiguredLevels.Contains(normalized, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unsupported grading level '{value}'.");
        }

        return normalized;
    }

    private static string NormalizeGrade(string value)
    {
        var grade = value.Trim().ToUpperInvariant();
        if (!DisplayGrades.Contains(grade, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unsupported grade '{value}'.");
        }

        return grade;
    }

    private static decimal RoundScore(decimal score) => Math.Round(score, 1, MidpointRounding.AwayFromZero);

    private static bool HasOneDecimalPlace(decimal value) => decimal.Round(value, 1, MidpointRounding.AwayFromZero) == value;

    private sealed record DefaultBandTemplate(string Level, string Grade, decimal MinScore, decimal MaxScore);
}
