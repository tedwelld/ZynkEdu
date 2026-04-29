using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IPlatformSubjectCatalogService
{
    Task<IReadOnlyList<PlatformSubjectCatalogResponse>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PlatformSubjectCatalogResponse> CreateAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default);
    Task<PlatformSubjectCatalogResponse> UpdateAsync(int id, UpdateSubjectRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<ImportSubjectsResultResponse> ImportFromSchoolToCatalogAsync(ImportSchoolSubjectsRequest request, CancellationToken cancellationToken = default);
    Task<ImportSubjectsResultResponse> ImportFromSchoolToSchoolAsync(int targetSchoolId, ImportSchoolSubjectsRequest request, CancellationToken cancellationToken = default);
    Task<ImportSubjectsResultResponse> PublishAllCatalogToSchoolAsync(int targetSchoolId, CancellationToken cancellationToken = default);
    Task<ImportSubjectsResultResponse> PublishAllCatalogToAllSchoolsAsync(CancellationToken cancellationToken = default);
}
