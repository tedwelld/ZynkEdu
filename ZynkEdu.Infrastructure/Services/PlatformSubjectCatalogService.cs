using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class PlatformSubjectCatalogService : IPlatformSubjectCatalogService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ISubjectCodeGenerator _subjectCodeGenerator;
    private readonly IAuditLogService _auditLogService;

    public PlatformSubjectCatalogService(ZynkEduDbContext dbContext, ISubjectCodeGenerator subjectCodeGenerator, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _subjectCodeGenerator = subjectCodeGenerator;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<PlatformSubjectCatalogResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var sources = await _dbContext.Schools.AsNoTracking()
            .Select(x => new { x.Id, x.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var catalog = await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
            .OrderBy(x => x.GradeLevel)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return catalog
            .Select(x => new PlatformSubjectCatalogResponse(
                x.Id,
                x.Code ?? string.Empty,
                x.Name,
                x.GradeLevel,
                x.WeeklyLoad,
                x.SourceSchoolId,
                x.SourceSchoolId is int schoolId && sources.TryGetValue(schoolId, out var sourceName) ? sourceName : null))
            .ToList();
    }

    public async Task<PlatformSubjectCatalogResponse> CreateAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        var name = NormalizeName(request.Name);
        var gradeLevel = NormalizeGradeLevel(request.GradeLevel);
        var weeklyLoad = NormalizeWeeklyLoad(request.WeeklyLoad);
        var code = string.IsNullOrWhiteSpace(request.Code)
            ? await GenerateCodeAsync(name, gradeLevel, null, cancellationToken)
            : NormalizeCode(request.Code);

        await EnsureCatalogSubjectIsUniqueAsync(name, gradeLevel, code, null, cancellationToken);

        var catalog = new PlatformSubjectCatalog
        {
            Code = code,
            Name = name,
            GradeLevel = gradeLevel,
            WeeklyLoad = weeklyLoad
        };

        _dbContext.PlatformSubjectCatalogs.Add(catalog);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(null, "Created", "PlatformSubjectCatalog", catalog.Id.ToString(), $"Created catalog subject {catalog.Name} ({catalog.Code}).", cancellationToken);
        return await MapAsync(catalog, cancellationToken);
    }

    public async Task<PlatformSubjectCatalogResponse> UpdateAsync(int id, UpdateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        var catalog = await _dbContext.PlatformSubjectCatalogs.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Catalog subject was not found.");

        var name = NormalizeName(request.Name);
        var gradeLevel = NormalizeGradeLevel(request.GradeLevel);
        var weeklyLoad = NormalizeWeeklyLoad(request.WeeklyLoad);
        var code = string.IsNullOrWhiteSpace(request.Code)
            ? await GenerateCodeAsync(name, gradeLevel, catalog.Id, cancellationToken)
            : NormalizeCode(request.Code);

        await EnsureCatalogSubjectIsUniqueAsync(name, gradeLevel, code, catalog.Id, cancellationToken);

        catalog.Name = name;
        catalog.GradeLevel = gradeLevel;
        catalog.Code = code;
        catalog.WeeklyLoad = weeklyLoad;

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(null, "Updated", "PlatformSubjectCatalog", catalog.Id.ToString(), $"Updated catalog subject {catalog.Name} ({catalog.Code}).", cancellationToken);
        return await MapAsync(catalog, cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var catalog = await _dbContext.PlatformSubjectCatalogs.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Catalog subject was not found.");

        _dbContext.PlatformSubjectCatalogs.Remove(catalog);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(null, "Deleted", "PlatformSubjectCatalog", catalog.Id.ToString(), $"Deleted catalog subject {catalog.Name} ({catalog.Code}).", cancellationToken);
    }

    public async Task<ImportSubjectsResultResponse> ImportFromSchoolToCatalogAsync(ImportSchoolSubjectsRequest request, CancellationToken cancellationToken = default)
    {
        var sourceSchoolId = request.SourceSchoolId;
        await EnsureSchoolExistsAsync(sourceSchoolId, cancellationToken);

        var subjectIds = request.SubjectIds.Where(subjectId => subjectId > 0).Distinct().ToArray();
        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("Choose at least one subject to import.");
        }

        var subjects = await _dbContext.Subjects.AsNoTracking()
            .Where(x => x.SchoolId == sourceSchoolId && subjectIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        if (subjects.Count != subjectIds.Length)
        {
            throw new InvalidOperationException("One or more subjects were not found in the source school.");
        }

        var existingNameKeys = await LoadCatalogNameKeysAsync(cancellationToken);
        var existingCodeKeys = await LoadCatalogCodeKeysAsync(cancellationToken);
        var created = 0;
        var skipped = 0;

        foreach (var subject in subjects)
        {
            var candidateName = NormalizeName(subject.Name);
            var candidateLevel = NormalizeGradeLevel(subject.GradeLevel);
            var sourceCode = NormalizeOptionalCode(subject.Code);
            var candidateNameKey = BuildNameKey(candidateName, candidateLevel);
            var shouldCheckCode = sourceCode is not null;
            var candidateCodeKey = shouldCheckCode ? BuildCodeKey(sourceCode!, candidateLevel) : null;

            if (existingNameKeys.Contains(candidateNameKey) || (candidateCodeKey is not null && existingCodeKeys.Contains(candidateCodeKey)))
            {
                skipped++;
                continue;
            }

            var code = sourceCode ?? await GenerateCodeAsync(candidateName, candidateLevel, null, cancellationToken);
            var catalog = new PlatformSubjectCatalog
            {
                Code = code,
                Name = candidateName,
                GradeLevel = candidateLevel,
                WeeklyLoad = NormalizeWeeklyLoad(subject.WeeklyLoad),
                SourceSchoolId = sourceSchoolId,
                SourceSubjectId = subject.Id
            };

            _dbContext.PlatformSubjectCatalogs.Add(catalog);
            existingNameKeys.Add(candidateNameKey);
            existingCodeKeys.Add(BuildCodeKey(code, candidateLevel));
            created++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(null, "Imported", "PlatformSubjectCatalog", sourceSchoolId.ToString(), $"Imported {created} subject(s) from school {sourceSchoolId} into the platform catalog. Skipped {skipped}.", cancellationToken);
        return new ImportSubjectsResultResponse(created, skipped);
    }

    public async Task<ImportSubjectsResultResponse> ImportFromSchoolToSchoolAsync(int targetSchoolId, ImportSchoolSubjectsRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureSchoolExistsAsync(request.SourceSchoolId, cancellationToken);
        await EnsureSchoolExistsAsync(targetSchoolId, cancellationToken);

        var subjectIds = request.SubjectIds.Where(subjectId => subjectId > 0).Distinct().ToArray();
        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("Choose at least one subject to import.");
        }

        var sourceSubjects = await _dbContext.Subjects.AsNoTracking()
            .Where(x => x.SchoolId == request.SourceSchoolId && subjectIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        if (sourceSubjects.Count != subjectIds.Length)
        {
            throw new InvalidOperationException("One or more subjects were not found in the source school.");
        }

        var existingNameKeys = await LoadSchoolNameKeysAsync(targetSchoolId, cancellationToken);
        var existingCodeKeys = await LoadSchoolCodeKeysAsync(targetSchoolId, cancellationToken);
        var created = 0;
        var skipped = 0;

        foreach (var subject in sourceSubjects)
        {
            var candidateName = NormalizeName(subject.Name);
            var candidateLevel = NormalizeGradeLevel(subject.GradeLevel);
            var sourceCode = NormalizeOptionalCode(subject.Code);
            var candidateNameKey = BuildNameKey(candidateName, candidateLevel);
            var candidateCodeKey = sourceCode is not null ? BuildCodeKey(sourceCode, candidateLevel) : null;

            if (existingNameKeys.Contains(candidateNameKey) || (candidateCodeKey is not null && existingCodeKeys.Contains(candidateCodeKey)))
            {
                skipped++;
                continue;
            }

            var code = sourceCode ?? await _subjectCodeGenerator.GenerateAsync(candidateName, targetSchoolId, candidateLevel, null, cancellationToken);
            var targetSubject = new Subject
            {
                SchoolId = targetSchoolId,
                Code = code,
                Name = candidateName,
                GradeLevel = candidateLevel,
                WeeklyLoad = NormalizeWeeklyLoad(subject.WeeklyLoad)
            };

            _dbContext.Subjects.Add(targetSubject);
            existingNameKeys.Add(candidateNameKey);
            existingCodeKeys.Add(BuildCodeKey(code, candidateLevel));
            created++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(targetSchoolId, "Imported", "Subject", targetSchoolId.ToString(), $"Imported {created} subject(s) from school {request.SourceSchoolId} into school {targetSchoolId}. Skipped {skipped}.", cancellationToken);
        return new ImportSubjectsResultResponse(created, skipped);
    }

    public async Task<ImportSubjectsResultResponse> PublishAllCatalogToSchoolAsync(int targetSchoolId, CancellationToken cancellationToken = default)
    {
        await EnsureSchoolExistsAsync(targetSchoolId, cancellationToken);

        var catalogSubjects = await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var result = await PublishCatalogToSchoolAsync(targetSchoolId, catalogSubjects, cancellationToken);
        await _auditLogService.LogAsync(targetSchoolId, "Published", "Subject", targetSchoolId.ToString(), $"Published {result.ImportedCount} catalog subject(s) into school {targetSchoolId}. Skipped {result.SkippedCount}.", cancellationToken);
        return result;
    }

    private async Task<ImportSubjectsResultResponse> PublishCatalogToSchoolAsync(int targetSchoolId, IReadOnlyList<PlatformSubjectCatalog> catalogSubjects, CancellationToken cancellationToken)
    {
        var existingNameKeys = await LoadSchoolNameKeysAsync(targetSchoolId, cancellationToken);
        var existingCodeKeys = await LoadSchoolCodeKeysAsync(targetSchoolId, cancellationToken);
        var created = 0;
        var skipped = 0;

        foreach (var catalogSubject in catalogSubjects)
        {
            var candidateName = NormalizeName(catalogSubject.Name);
            var candidateLevel = NormalizeGradeLevel(catalogSubject.GradeLevel);
            var sourceCode = NormalizeOptionalCode(catalogSubject.Code);
            var candidateNameKey = BuildNameKey(candidateName, candidateLevel);
            var candidateCodeKey = sourceCode is not null ? BuildCodeKey(sourceCode, candidateLevel) : null;

            if (existingNameKeys.Contains(candidateNameKey) || (candidateCodeKey is not null && existingCodeKeys.Contains(candidateCodeKey)))
            {
                skipped++;
                continue;
            }

            var code = sourceCode ?? await _subjectCodeGenerator.GenerateAsync(candidateName, targetSchoolId, candidateLevel, null, cancellationToken);
            var subject = new Subject
            {
                SchoolId = targetSchoolId,
                Code = code,
                Name = candidateName,
                GradeLevel = candidateLevel,
                WeeklyLoad = NormalizeWeeklyLoad(catalogSubject.WeeklyLoad)
            };

            _dbContext.Subjects.Add(subject);
            existingNameKeys.Add(candidateNameKey);
            existingCodeKeys.Add(BuildCodeKey(code, candidateLevel));
            created++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new ImportSubjectsResultResponse(created, skipped);
    }

    public async Task<ImportSubjectsResultResponse> PublishAllCatalogToAllSchoolsAsync(CancellationToken cancellationToken = default)
    {
        var schools = await _dbContext.Schools.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var catalogSubjects = await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var created = 0;
        var skipped = 0;

        foreach (var schoolId in schools)
        {
            var schoolResult = await PublishCatalogToSchoolAsync(schoolId, catalogSubjects, cancellationToken);
            created += schoolResult.ImportedCount;
            skipped += schoolResult.SkippedCount;
        }

        await _auditLogService.LogAsync(null, "Published", "Subject", "all-schools", $"Published {created} catalog subject(s) into all schools. Skipped {skipped}.", cancellationToken);
        return new ImportSubjectsResultResponse(created, skipped);
    }

    private async Task<PlatformSubjectCatalogResponse> MapAsync(PlatformSubjectCatalog catalog, CancellationToken cancellationToken)
    {
        string? sourceSchoolName = null;
        if (catalog.SourceSchoolId is int sourceSchoolId)
        {
            sourceSchoolName = await _dbContext.Schools.AsNoTracking()
                .Where(x => x.Id == sourceSchoolId)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return new PlatformSubjectCatalogResponse(
            catalog.Id,
            catalog.Code ?? string.Empty,
            catalog.Name,
            catalog.GradeLevel,
            catalog.WeeklyLoad,
            catalog.SourceSchoolId,
            sourceSchoolName);
    }

    private async Task EnsureSchoolExistsAsync(int schoolId, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.Schools.AsNoTracking().AnyAsync(x => x.Id == schoolId, cancellationToken);
        if (!exists)
        {
            throw new InvalidOperationException("The selected school was not found.");
        }
    }

    private async Task EnsureCatalogSubjectIsUniqueAsync(string name, string gradeLevel, string? code, int? excludeId, CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(name);
        var normalizedGradeLevel = NormalizeGradeLevel(gradeLevel);
        if (await _dbContext.PlatformSubjectCatalogs.AsNoTracking().AnyAsync(x => x.Id != excludeId && x.GradeLevel == normalizedGradeLevel && x.Name == normalizedName, cancellationToken))
        {
            throw new InvalidOperationException("A catalog subject with the same name already exists in this grade level.");
        }

        var normalizedCode = NormalizeOptionalCode(code);
        if (normalizedCode is not null && await _dbContext.PlatformSubjectCatalogs.AsNoTracking().AnyAsync(x => x.Id != excludeId && x.GradeLevel == normalizedGradeLevel && x.Code == normalizedCode, cancellationToken))
        {
            throw new InvalidOperationException("A catalog subject with the same code already exists in this grade level.");
        }
    }

    private async Task<string> GenerateCodeAsync(string subjectName, string gradeLevel, int? excludeCatalogId, CancellationToken cancellationToken)
    {
        var baseCode = BuildBaseCode(subjectName);
        var normalizedGradeLevel = NormalizeGradeLevel(gradeLevel);
        var existingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var code in await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
                     .Where(x => x.GradeLevel == normalizedGradeLevel && x.Code != null && x.Code != string.Empty && (!excludeCatalogId.HasValue || x.Id != excludeCatalogId.Value))
                     .Select(x => x.Code!)
                     .ToListAsync(cancellationToken))
        {
            existingCodes.Add(code);
        }

        foreach (var code in GetTrackedCatalogCodes(normalizedGradeLevel, excludeCatalogId))
        {
            existingCodes.Add(code);
        }

        if (!existingCodes.Contains(baseCode, StringComparer.OrdinalIgnoreCase))
        {
            return baseCode;
        }

        var suffix = 1;
        while (true)
        {
            var candidate = InsertDisambiguator(baseCode, suffix);
            if (!existingCodes.Contains(candidate, StringComparer.OrdinalIgnoreCase))
            {
                return candidate;
            }

            suffix++;
        }
    }

    private IReadOnlyCollection<string> GetTrackedCatalogCodes(string gradeLevel, int? excludeCatalogId)
    {
        return _dbContext.ChangeTracker.Entries<PlatformSubjectCatalog>()
            .Where(entry =>
                entry.State != EntityState.Deleted &&
                entry.Entity.GradeLevel == gradeLevel &&
                entry.Entity.Code != null &&
                entry.Entity.Code != string.Empty &&
                (!excludeCatalogId.HasValue || entry.Entity.Id != excludeCatalogId.Value))
            .Select(entry => entry.Entity.Code!)
            .ToList();
    }

    private async Task<HashSet<string>> LoadCatalogNameKeysAsync(CancellationToken cancellationToken)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
            .Select(x => new { x.Name, x.GradeLevel })
            .ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            keys.Add(BuildNameKey(NormalizeName(item.Name), NormalizeGradeLevel(item.GradeLevel)));
        }

        return keys;
    }

    private async Task<HashSet<string>> LoadCatalogCodeKeysAsync(CancellationToken cancellationToken)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = await _dbContext.PlatformSubjectCatalogs.AsNoTracking()
            .Where(x => x.Code != null && x.Code != string.Empty)
            .Select(x => new { x.Code, x.GradeLevel })
            .ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            keys.Add(BuildCodeKey(NormalizeOptionalCode(item.Code)!, NormalizeGradeLevel(item.GradeLevel)));
        }

        return keys;
    }

    private async Task<HashSet<string>> LoadSchoolNameKeysAsync(int schoolId, CancellationToken cancellationToken)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = await _dbContext.Subjects.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .Select(x => new { x.Name, x.GradeLevel })
            .ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            keys.Add(BuildNameKey(NormalizeName(item.Name), NormalizeGradeLevel(item.GradeLevel)));
        }

        return keys;
    }

    private async Task<HashSet<string>> LoadSchoolCodeKeysAsync(int schoolId, CancellationToken cancellationToken)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = await _dbContext.Subjects.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.Code != null && x.Code != string.Empty)
            .Select(x => new { x.Code, x.GradeLevel })
            .ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            keys.Add(BuildCodeKey(NormalizeOptionalCode(item.Code)!, NormalizeGradeLevel(item.GradeLevel)));
        }

        return keys;
    }

    private static string BuildNameKey(string name, string gradeLevel) => $"{NormalizeGradeLevel(gradeLevel)}|name|{NormalizeName(name)}";

    private static string BuildCodeKey(string code, string gradeLevel) => $"{NormalizeGradeLevel(gradeLevel)}|code|{NormalizeCode(code)}";

    private static string NormalizeName(string name) => name.Trim();

    private static string NormalizeCode(string code)
    {
        var value = code.Trim().ToUpperInvariant();
        return value.Length > 20 ? value[..20] : value;
    }

    private static string? NormalizeOptionalCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        return NormalizeCode(code);
    }

    private static string NormalizeGradeLevel(string? gradeLevel) => SchoolLevelCatalog.NormalizeLevel(gradeLevel);

    private static int NormalizeWeeklyLoad(int weeklyLoad)
    {
        if (weeklyLoad < 1 || weeklyLoad > 9)
        {
            throw new InvalidOperationException("The subject weekly load must be between 1 and 9.");
        }

        return weeklyLoad;
    }

    private static string BuildBaseCode(string value)
    {
        var parts = value.Trim()
            .Split(new[] { ' ', '\t', '-', '_' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var letters = parts
            .Select(part => part.FirstOrDefault(char.IsLetterOrDigit))
            .Where(character => character != default)
            .Select(character => char.ToUpperInvariant(character))
            .ToArray();

        if (letters.Length == 0)
        {
            return "SUB";
        }

        var builder = new System.Text.StringBuilder(letters.Length);
        foreach (var letter in letters)
        {
            builder.Append(letter);
        }

        var code = builder.ToString();
        return code.Length > 10 ? code[..10] : code;
    }

    private static string InsertDisambiguator(string baseCode, int suffix)
    {
        if (baseCode.Length <= 1)
        {
            return $"{baseCode}{suffix}";
        }

        return $"{baseCode[0]}{suffix}{baseCode[1..]}";
    }
}
