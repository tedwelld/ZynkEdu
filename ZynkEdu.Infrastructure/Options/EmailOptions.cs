namespace ZynkEdu.Infrastructure.Options;

public sealed class EmailOptions
{
    public string RefLink { get; set; } = string.Empty;
    public string EmailHost { get; set; } = string.Empty;
    public int EmailPort { get; set; } = 587;
    public string EmailUsername { get; set; } = string.Empty;
    public string EmailPassword { get; set; } = string.Empty;
    public string FromDisplayName { get; set; } = "Zynk Education";
    public bool EnableSsl { get; set; } = true;
}
