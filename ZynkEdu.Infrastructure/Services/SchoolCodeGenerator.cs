using System.Text;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class SchoolCodeGenerator : ISchoolCodeGenerator
{
    private readonly ZynkEduDbContext _dbContext;

    public SchoolCodeGenerator(ZynkEduDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> GenerateAsync(string schoolName, int? excludeSchoolId = null, CancellationToken cancellationToken = default)
    {
        var baseCode = BuildBaseCode(schoolName);
        var existingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var code in await GetExistingCodesAsync(excludeSchoolId, cancellationToken))
        {
            existingCodes.Add(code);
        }

        foreach (var code in GetTrackedCodes(excludeSchoolId))
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

    public async Task<string> GetOrCreateAsync(int schoolId, CancellationToken cancellationToken = default)
    {
        var school = await _dbContext.Schools.FirstOrDefaultAsync(x => x.Id == schoolId, cancellationToken)
            ?? throw new InvalidOperationException("School was not found.");

        if (!string.IsNullOrWhiteSpace(school.SchoolCode))
        {
            return school.SchoolCode.Trim().ToUpperInvariant();
        }

        var code = await GenerateAsync(school.Name, school.Id, cancellationToken);
        school.SchoolCode = code;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return code;
    }

    private async Task<IReadOnlyCollection<string>> GetExistingCodesAsync(int? excludeSchoolId, CancellationToken cancellationToken)
    {
        return await _dbContext.Schools.AsNoTracking()
            .Where(x => x.SchoolCode != null && x.SchoolCode != string.Empty && (!excludeSchoolId.HasValue || x.Id != excludeSchoolId.Value))
            .Select(x => x.SchoolCode!)
            .ToListAsync(cancellationToken);
    }

    private IReadOnlyCollection<string> GetTrackedCodes(int? excludeSchoolId)
    {
        return _dbContext.ChangeTracker.Entries<School>()
            .Where(entry =>
                entry.State != EntityState.Deleted &&
                entry.Entity.SchoolCode != null &&
                entry.Entity.SchoolCode != string.Empty &&
                (!excludeSchoolId.HasValue || entry.Entity.Id != excludeSchoolId.Value))
            .Select(entry => entry.Entity.SchoolCode!)
            .ToList();
    }

    private static string BuildBaseCode(string schoolName)
    {
        var parts = schoolName
            .Trim()
            .Split(new[] { ' ', '\t', '-', '_' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var letters = parts
            .Select(part => part.FirstOrDefault(char.IsLetterOrDigit))
            .Where(character => character != default)
            .Select(character => char.ToUpperInvariant(character))
            .ToArray();

        if (letters.Length == 0)
        {
            return "SCH";
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
}
