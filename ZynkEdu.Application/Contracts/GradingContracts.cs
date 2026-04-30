using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record GradingBandResponse(
    string Grade,
    decimal MinScore,
    decimal MaxScore);

public sealed record GradingLevelResponse(
    string Level,
    IReadOnlyList<GradingBandResponse> Bands);

public sealed record GradingSchemeResponse(
    int SchoolId,
    string SchoolName,
    IReadOnlyList<GradingLevelResponse> Levels);

public sealed record SaveGradingBandRequest(
    [Required, MinLength(2)] string Level,
    [Required, MinLength(1)] string Grade,
    [Range(0, 100)] decimal MinScore,
    [Range(0, 100)] decimal MaxScore);

public sealed record SaveGradingSchemeRequest(
    [Required] IReadOnlyList<SaveGradingBandRequest> Bands);
