namespace ZynkEdu.Infrastructure.Options;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "ZynkEdu";
    public string Audience { get; set; } = "ZynkEdu";
    public string SigningKey { get; set; } = "development-signing-key-change-me";
    public int ExpirationMinutes { get; set; } = 480;
    public int ParentExpirationMinutes { get; set; } = 30;
}
