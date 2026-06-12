using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Options;

namespace ZynkEdu.Infrastructure.Messaging;

/// <summary>
/// Sends SMS via the Africa's Talking SMS API.
/// Falls back to logging when API credentials are not configured.
/// Set Sms:Provider=AfricasTalking, Sms:ApiKey, and Sms:Username in app config or env vars.
/// </summary>
public sealed class AfricasTalkingSmsSender : ISmsSender
{
    private readonly SmsOptions _options;
    private readonly ILogger<AfricasTalkingSmsSender> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private const string SandboxUrl = "https://api.sandbox.africastalking.com/version1/messaging";
    private const string ProductionUrl = "https://api.africastalking.com/version1/messaging";

    public AfricasTalkingSmsSender(
        IOptions<SmsOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<AfricasTalkingSmsSender> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendAsync(string destination, string message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.Username))
        {
            _logger.LogInformation("[SMS-STUB] To {Destination}: {Message}", destination, message);
            return;
        }

        var url = string.Equals(_options.Environment, "sandbox", StringComparison.OrdinalIgnoreCase)
            ? SandboxUrl
            : ProductionUrl;

        try
        {
            var client = _httpClientFactory.CreateClient("AfricasTalking");
            client.DefaultRequestHeaders.Accept.Clear();
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            client.DefaultRequestHeaders.Add("apiKey", _options.ApiKey);

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["username"] = _options.Username,
                ["to"] = destination,
                ["message"] = message
            });

            var response = await client.PostAsync(url, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("SMS to {Destination} failed ({Status}): {Body}", destination, response.StatusCode, body);
            }
            else
            {
                _logger.LogInformation("SMS to {Destination} dispatched via Africa's Talking.", destination);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMS to {Destination} could not be sent. Message: {Message}", destination, message);
        }
    }
}
