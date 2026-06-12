namespace ZynkEdu.Infrastructure.Options;

public sealed class FileStoreOptions
{
    public string BasePath { get; set; } = "uploads";
    public long MaxFileSizeBytes { get; set; } = 10 * 1024 * 1024; // 10 MB default
}
