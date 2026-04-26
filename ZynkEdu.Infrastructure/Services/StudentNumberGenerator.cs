using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class StudentNumberGenerator : IStudentNumberGenerator
{
    private readonly ZynkEduDbContext _dbContext;

    public StudentNumberGenerator(ZynkEduDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> GenerateAsync(int schoolId, CancellationToken cancellationToken = default)
    {
        if (_dbContext.Database.CurrentTransaction is not null)
        {
            return await GenerateCoreAsync(schoolId, cancellationToken);
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(() => GenerateWithTransactionAsync(schoolId, cancellationToken));
    }

    private async Task<string> GenerateWithTransactionAsync(int schoolId, CancellationToken cancellationToken)
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var number = await GenerateCoreAsync(schoolId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return number;
    }

    private async Task<string> GenerateCoreAsync(int schoolId, CancellationToken cancellationToken)
    {
        using var _ = await SchoolNumberLock.AcquireAsync(schoolId, cancellationToken);

        var counter = await _dbContext.StudentNumberCounters.FirstOrDefaultAsync(x => x.SchoolId == schoolId, cancellationToken);
        if (counter is null)
        {
            counter = new Domain.Entities.StudentNumberCounter
            {
                SchoolId = schoolId,
                LastNumber = 0
            };
            _dbContext.StudentNumberCounters.Add(counter);
        }

        counter.LastNumber++;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return $"SCH{schoolId:D3}-{counter.LastNumber:D4}";
    }
}
