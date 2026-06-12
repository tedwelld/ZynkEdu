namespace ZynkEdu.Infrastructure.Options;

public sealed class SmsOptions
{
    /// <summary>SMS provider to use. Supported: "AfricasTalking" (default). Leave empty to disable sending (log only).</summary>
    public string Provider { get; set; } = "AfricasTalking";

    /// <summary>Africa's Talking API key from the AT dashboard.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Africa's Talking username (application name on AT dashboard).</summary>
    public string? Username { get; set; }

    /// <summary>Set to "sandbox" for testing, "production" for live. Defaults to production.</summary>
    public string Environment { get; set; } = "production";
}
