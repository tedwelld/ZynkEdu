using System.Collections.Concurrent;

namespace ZynkEdu.Infrastructure.Persistence;

internal static class SchoolNumberLock
{
    private static readonly ConcurrentDictionary<int, SemaphoreSlim> Locks = new();

    public static async Task<IDisposable> AcquireAsync(int schoolId, CancellationToken cancellationToken)
    {
        var gate = Locks.GetOrAdd(schoolId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        return new Releaser(gate);
    }

    private sealed class Releaser(SemaphoreSlim gate) : IDisposable
    {
        public void Dispose() => gate.Release();
    }
}
