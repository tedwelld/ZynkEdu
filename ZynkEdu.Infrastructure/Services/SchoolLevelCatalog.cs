namespace ZynkEdu.Infrastructure.Services;

internal static class SchoolLevelCatalog
{
    public const string General = "General";
    public const string ZgcLevel = "ZGC Level";
    public const string OLevel = "O'Level";
    public const string ALevel = "A'Level";

    private static readonly IReadOnlyDictionary<string, string[]> LevelClasses = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        [ZgcLevel] = new[] { "Form 1A", "Form 1B", "Form 1C", "Form 2A", "Form 2B", "Form 2C" },
        [OLevel] = new[] { "Form 3A Sciences", "Form 3B Commercials", "Form 3C Arts", "Form 4A Sciences", "Form 4B Commercials", "Form 4C Arts" },
        [ALevel] = new[] { "Form 5 Arts", "Form 5 Commercials", "Form 5 Sciences", "Form 6 Arts", "Form 6 Commercials", "Form 6 Sciences" }
    };

    public static IReadOnlyList<string> SupportedLevels { get; } = new[] { ZgcLevel, OLevel, ALevel, General };

    public static string NormalizeLevel(string? value)
    {
        var trimmed = string.IsNullOrWhiteSpace(value) ? General : value.Trim();

        if (trimmed.Equals("ZGC", StringComparison.OrdinalIgnoreCase) || trimmed.Equals(ZgcLevel, StringComparison.OrdinalIgnoreCase))
        {
            return ZgcLevel;
        }

        if (trimmed.Equals("Form 1", StringComparison.OrdinalIgnoreCase) || trimmed.Equals("Form 2", StringComparison.OrdinalIgnoreCase))
        {
            return ZgcLevel;
        }

        if (trimmed.Equals("OLevel", StringComparison.OrdinalIgnoreCase) || trimmed.Equals("O Level", StringComparison.OrdinalIgnoreCase) || trimmed.Equals(OLevel, StringComparison.OrdinalIgnoreCase))
        {
            return OLevel;
        }

        if (trimmed.Equals("Form 3", StringComparison.OrdinalIgnoreCase) || trimmed.Equals("Form 4", StringComparison.OrdinalIgnoreCase))
        {
            return OLevel;
        }

        if (trimmed.Equals("ALevel", StringComparison.OrdinalIgnoreCase) || trimmed.Equals("A Level", StringComparison.OrdinalIgnoreCase) || trimmed.Equals(ALevel, StringComparison.OrdinalIgnoreCase))
        {
            return ALevel;
        }

        if (trimmed.Equals("Form 5", StringComparison.OrdinalIgnoreCase) || trimmed.Equals("Form 6", StringComparison.OrdinalIgnoreCase))
        {
            return ALevel;
        }

        if (trimmed.Equals(General, StringComparison.OrdinalIgnoreCase))
        {
            return General;
        }

        return trimmed.Length > 100 ? trimmed[..100] : trimmed;
    }

    public static bool TryGetClassLevel(string className, out string level)
    {
        var trimmedClass = className.Trim();
        foreach (var pair in LevelClasses)
        {
            if (pair.Value.Any(value => string.Equals(value, trimmedClass, StringComparison.OrdinalIgnoreCase)))
            {
                level = pair.Key;
                return true;
            }
        }

        level = string.Empty;
        return false;
    }

    public static IReadOnlyList<string> GetClassesForLevel(string level)
    {
        return LevelClasses.TryGetValue(NormalizeLevel(level), out var classes)
            ? classes
            : Array.Empty<string>();
    }

    public static bool IsKnownLevel(string level)
    {
        var normalized = NormalizeLevel(level);
        return normalized == General || LevelClasses.ContainsKey(normalized);
    }
}
