using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class TeacherAssignmentService : ITeacherAssignmentService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public TeacherAssignmentService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<TeacherAssignmentResponse> CreateAsync(CreateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (subject is null)
        {
            throw new InvalidOperationException("Subject was not found in this school.");
        }

        var assignment = new TeacherAssignment
        {
            SchoolId = resolvedSchoolId,
            TeacherId = request.TeacherId,
            SubjectId = request.SubjectId,
            Class = request.Class.Trim()
        };

        _dbContext.TeacherAssignments.Add(assignment);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TeacherAssignmentResponse(assignment.Id, resolvedSchoolId, teacher.Id, teacher.DisplayName, subject.Id, subject.Name, assignment.Class);
    }

    public async Task<IReadOnlyList<TeacherAssignmentResponse>> GetByTeacherAsync(int teacherId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.TeacherAssignments.AsNoTracking()
            : _dbContext.TeacherAssignments.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .Where(x => x.TeacherId == teacherId)
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .OrderBy(x => x.Class)
            .Select(x => new TeacherAssignmentResponse(x.Id, x.SchoolId, x.TeacherId, x.Teacher.DisplayName, x.SubjectId, x.Subject.Name, x.Class))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TeacherAssignmentResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.TeacherAssignments.AsNoTracking()
            : _dbContext.TeacherAssignments.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .OrderBy(x => x.Teacher.DisplayName)
            .Select(x => new TeacherAssignmentResponse(x.Id, x.SchoolId, x.TeacherId, x.Teacher.DisplayName, x.SubjectId, x.Subject.Name, x.Class))
            .ToListAsync(cancellationToken);
    }

    public async Task<TeacherAssignmentResponse> UpdateAsync(int id, UpdateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var assignment = await _dbContext.TeacherAssignments.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Teacher assignment was not found in this school.");

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (subject is null)
        {
            throw new InvalidOperationException("Subject was not found in this school.");
        }

        assignment.TeacherId = request.TeacherId;
        assignment.SubjectId = request.SubjectId;
        assignment.Class = request.Class.Trim();

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new TeacherAssignmentResponse(assignment.Id, resolvedSchoolId, teacher.Id, teacher.DisplayName, subject.Id, subject.Name, assignment.Class);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var assignment = await _dbContext.TeacherAssignments.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Teacher assignment was not found in this school.");

        _dbContext.TeacherAssignments.Remove(assignment);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving this assignment.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return resolvedSchoolId;
    }

    private int RequireSchoolId() => ResolveSchoolId(null);
}
