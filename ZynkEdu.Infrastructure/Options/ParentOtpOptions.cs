namespace ZynkEdu.Infrastructure.Options;

public sealed class ParentOtpOptions
{
    public int ExpirationMinutes { get; set; } = 10;
    public int MaxAttempts { get; set; } = 5;
}
