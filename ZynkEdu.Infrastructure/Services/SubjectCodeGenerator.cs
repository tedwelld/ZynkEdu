using System.Text;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class SubjectCodeGenerator : ISubjectCodeGenerator
{
    private readonly ZynkEduDbContext _dbContext;

    public SubjectCodeGenerator(ZynkEduDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> GenerateAsync(string subjectName, int schoolId, string gradeLevel, int? excludeSubjectId = null, CancellationToken cancellationToken = default)
    {
        var baseCode = BuildBaseCode(subjectName);
        var normalizedGradeLevel = SchoolLevelCatalog.NormalizeLevel(gradeLevel);
        var existingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var code in await _dbContext.Subjects.AsNoTracking()
                     .Where(x => x.SchoolId == schoolId && x.GradeLevel == normalizedGradeLevel && x.Code != null && x.Code != string.Empty && (!excludeSubjectId.HasValue || x.Id != excludeSubjectId.Value))
                     .Select(x => x.Code!)
                     .ToListAsync(cancellationToken))
        {
            existingCodes.Add(code);
        }

        foreach (var code in GetTrackedCodes(schoolId, normalizedGradeLevel, excludeSubjectId))
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

        var builder = new StringBuilder(letters.Length);
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

    private IReadOnlyCollection<string> GetTrackedCodes(int schoolId, string gradeLevel, int? excludeSubjectId)
    {
        return _dbContext.ChangeTracker.Entries<Subject>()
            .Where(entry =>
                entry.State != EntityState.Deleted &&
                entry.Entity.SchoolId == schoolId &&
                entry.Entity.GradeLevel == gradeLevel &&
                entry.Entity.Code != null &&
                entry.Entity.Code != string.Empty &&
                (!excludeSubjectId.HasValue || entry.Entity.Id != excludeSubjectId.Value))
            .Select(entry => entry.Entity.Code!)
            .ToList();
    }
}
