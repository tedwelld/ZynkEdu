using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class StudentLifecycleService : IStudentLifecycleService
{
    private static readonly HashSet<string> ActivePlacementStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Active",
        "Suspended"
    };

    private static readonly HashSet<string> BatchActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "Promote",
        "Reshuffle",
        "Exit",
        "TransferOut",
        "ReAdmit"
    };

    private static readonly HashSet<string> TransferActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "Transfer",
        "TransferOut"
    };

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IStudentNumberGenerator _studentNumberGenerator;
    private readonly IAuditLogService _auditLogService;

    public StudentLifecycleService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IStudentNumberGenerator studentNumberGenerator,
        IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _studentNumberGenerator = studentNumberGenerator;
        _auditLogService = auditLogService;
    }

    public async Task<StudentMovementResponse> MoveAsync(StudentMovementRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSourceSchoolId = ResolveSchoolId(schoolId);
        var action = NormalizeAction(request.Action);

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var sourceStudent = await LoadStudentAsync(request.StudentId, resolvedSourceSchoolId, includeInactive: true, cancellationToken)
                ?? throw new InvalidOperationException("Student was not found in this school.");

            if (_currentUserContext.Role != UserRole.PlatformAdmin && sourceStudent.SchoolId != resolvedSourceSchoolId)
            {
                throw new UnauthorizedAccessException("Not allowed.");
            }

            var targetSchoolId = request.TargetSchoolId ?? (TransferActions.Contains(action) ? null : sourceStudent.SchoolId);
            if (TransferActions.Contains(action) && targetSchoolId is null)
            {
                throw new InvalidOperationException("Select a destination school for the transfer.");
            }

            if (targetSchoolId.HasValue && targetSchoolId.Value != sourceStudent.SchoolId && _currentUserContext.Role != UserRole.PlatformAdmin)
            {
                throw new UnauthorizedAccessException("Only platform admins can move students across schools.");
            }

            StudentMovementResponse response;
            if (string.Equals(action, "Promote", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(action, "Reshuffle", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(action, "ReAdmit", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(action, "Transfer", StringComparison.OrdinalIgnoreCase))
            {
                var resolvedTargetSchoolId = targetSchoolId ?? sourceStudent.SchoolId;
                var targetClass = ResolveTargetClass(request.TargetClass);
                var targetLevel = ResolveTargetLevel(request.TargetLevel, targetClass);
                await ValidateTargetPlacementAsync(resolvedTargetSchoolId, targetClass, targetLevel, cancellationToken);

                var copySubjects = request.CopySubjects && resolvedTargetSchoolId == sourceStudent.SchoolId;
                response = await ExecuteMoveAsync(sourceStudent, action, resolvedTargetSchoolId, targetClass, targetLevel, request.Reason, request.Notes, request.EffectiveDate, copySubjects, null, cancellationToken);
            }
            else if (string.Equals(action, "Exit", StringComparison.OrdinalIgnoreCase) || string.Equals(action, "TransferOut", StringComparison.OrdinalIgnoreCase))
            {
                response = await ExecuteMoveAsync(sourceStudent, action, targetSchoolId, null, null, request.Reason, request.Notes, request.EffectiveDate, false, null, cancellationToken);
            }
            else
            {
                throw new InvalidOperationException($"Unsupported movement action '{request.Action}'.");
            }

            await transaction.CommitAsync(cancellationToken);
            return response;
        });
    }

    public async Task<StudentPromotionRunResponse> CommitPromotionRunAsync(StudentPromotionRunRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var items = request.Items ?? Array.Empty<StudentMovementRequest>();
        if (items.Count == 0)
        {
            throw new InvalidOperationException("Add at least one student to the promotion run.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var run = new StudentProgressionRun
            {
                SchoolId = resolvedSchoolId,
                AcademicYearLabel = request.AcademicYearLabel.Trim(),
                Status = "Committed",
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CommittedAt = DateTime.UtcNow
            };
            _dbContext.StudentProgressionRuns.Add(run);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var movementResponses = new List<StudentMovementResponse>(items.Count);
            foreach (var item in items)
            {
                var action = NormalizeAction(item.Action);
                if (!BatchActions.Contains(action))
                {
                    throw new InvalidOperationException($"Unsupported promotion action '{item.Action}'.");
                }

                var moveResponse = await MovePromotionItemAsync(run, resolvedSchoolId, item, action, cancellationToken);
                movementResponses.Add(moveResponse);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await _auditLogService.LogAsync(
                resolvedSchoolId,
                "Committed",
                "StudentProgressionRun",
                run.Id.ToString(),
                $"Committed a promotion run with {movementResponses.Count} movement(s) for {request.AcademicYearLabel.Trim()}.",
                cancellationToken);

            return new StudentPromotionRunResponse(
                run.Id,
                run.SchoolId,
                run.AcademicYearLabel,
                run.Status,
                run.Notes,
                run.CreatedAt,
                run.CommittedAt,
                movementResponses);
        });
    }

    private async Task<StudentMovementResponse> MovePromotionItemAsync(StudentProgressionRun run, int schoolId, StudentMovementRequest item, string action, CancellationToken cancellationToken)
    {
        var sourceStudent = await LoadStudentAsync(item.StudentId, schoolId, includeInactive: true, cancellationToken)
            ?? throw new InvalidOperationException("One or more students were not found in this school.");

        if (sourceStudent.SchoolId != schoolId)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        if (!ActivePlacementStatuses.Contains(sourceStudent.Status) && !string.Equals(action, "ReAdmit", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only active student placements can be promoted or reshuffled.");
        }

        var copySubjects = string.Equals(action, "Promote", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(action, "Reshuffle", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(action, "ReAdmit", StringComparison.OrdinalIgnoreCase);

        if (string.Equals(action, "Exit", StringComparison.OrdinalIgnoreCase) || string.Equals(action, "TransferOut", StringComparison.OrdinalIgnoreCase))
        {
            return await ExecuteMoveAsync(sourceStudent, action, null, null, null, item.Reason, item.Notes, item.EffectiveDate, false, run.Id, cancellationToken);
        }

        var targetClass = ResolveTargetClass(item.TargetClass);
        var targetLevel = ResolveTargetLevel(item.TargetLevel, targetClass);
        await ValidateTargetPlacementAsync(schoolId, targetClass, targetLevel, cancellationToken);

        return await ExecuteMoveAsync(sourceStudent, action, schoolId, targetClass, targetLevel, item.Reason, item.Notes, item.EffectiveDate, copySubjects, run.Id, cancellationToken);
    }

    private async Task<StudentMovementResponse> ExecuteMoveAsync(
        Student sourceStudent,
        string action,
        int? targetSchoolId,
        string? targetClass,
        string? targetLevel,
        string? reason,
        string? notes,
        DateTime effectiveDate,
        bool copySubjects,
        int? promotionRunId,
        CancellationToken cancellationToken)
    {
        var sourceSchoolId = sourceStudent.SchoolId;
        var destinationSchoolId = targetSchoolId;
        Student? destinationStudent = null;
        var profileKey = EnsureProfileKey(sourceStudent);

        var archiveStatus = NormalizeArchiveStatus(action);
        sourceStudent.Status = archiveStatus;

        if (targetSchoolId.HasValue && (string.Equals(action, "Promote", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(action, "Reshuffle", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(action, "ReAdmit", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(action, "Transfer", StringComparison.OrdinalIgnoreCase)))
        {
            destinationStudent = new Student
            {
                SchoolId = targetSchoolId.Value,
                ProfileKey = profileKey,
                StudentNumber = await _studentNumberGenerator.GenerateAsync(targetSchoolId.Value, cancellationToken),
                FullName = sourceStudent.FullName,
                Class = targetClass ?? sourceStudent.Class,
                Level = targetLevel ?? sourceStudent.Level,
                Status = "Active",
                EnrollmentYear = sourceStudent.EnrollmentYear,
                ParentEmail = sourceStudent.ParentEmail,
                ParentPhone = sourceStudent.ParentPhone,
                ParentPasswordHash = sourceStudent.ParentPasswordHash,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Students.Add(destinationStudent);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await CopyGuardiansAsync(sourceStudent, destinationStudent, cancellationToken);
            if (copySubjects)
            {
                await CopySubjectsAsync(sourceStudent, destinationStudent, cancellationToken);
            }
        }

        var movement = new StudentMovement
        {
            SchoolId = sourceSchoolId,
            ProfileKey = profileKey,
            SourceStudentId = sourceStudent.Id,
            DestinationStudentId = destinationStudent?.Id,
            SourceSchoolId = sourceSchoolId,
            DestinationSchoolId = destinationSchoolId,
            Action = NormalizeMovementAction(action),
            SourceClass = sourceStudent.Class,
            SourceLevel = sourceStudent.Level,
            DestinationClass = destinationStudent?.Class ?? targetClass,
            DestinationLevel = destinationStudent?.Level ?? targetLevel,
            Reason = reason?.Trim(),
            Notes = notes?.Trim(),
            EffectiveDate = effectiveDate,
            PromotionRunId = promotionRunId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentMovements.Add(movement);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(
            sourceSchoolId,
            "Updated",
            "StudentMovement",
            movement.Id.ToString(),
            $"{sourceStudent.FullName} was moved via {movement.Action} from {movement.SourceClass} to {movement.DestinationClass ?? "exit"}.",
            cancellationToken);

        return new StudentMovementResponse(
            movement.Id,
            movement.SchoolId,
            movement.SourceStudentId,
            movement.DestinationStudentId,
            movement.ProfileKey,
            movement.Action,
            movement.SourceClass,
            movement.SourceLevel,
            movement.DestinationClass,
            movement.DestinationLevel,
            movement.SourceSchoolId,
            movement.DestinationSchoolId,
            movement.Reason,
            movement.Notes,
            movement.EffectiveDate,
            movement.CreatedAt);
    }

    private async Task CopyGuardiansAsync(Student sourceStudent, Student destinationStudent, CancellationToken cancellationToken)
    {
        var sourceGuardians = await _dbContext.Guardians.AsNoTracking()
            .Where(x => x.StudentId == sourceStudent.Id)
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        if (sourceGuardians.Count == 0)
        {
            return;
        }

        var clonedGuardians = sourceGuardians.Select((guardian, index) => new Guardian
        {
            SchoolId = destinationStudent.SchoolId,
            StudentId = destinationStudent.Id,
            DisplayName = guardian.DisplayName,
            Relationship = guardian.Relationship,
            ParentPhone = guardian.ParentPhone,
            ParentEmail = guardian.ParentEmail,
            Address = guardian.Address,
            IdentityDocumentType = guardian.IdentityDocumentType,
            IdentityDocumentNumber = guardian.IdentityDocumentNumber,
            BirthCertificateNumber = guardian.BirthCertificateNumber,
            IsPrimary = index == 0 || guardian.IsPrimary,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        if (clonedGuardians.Count > 0 && !clonedGuardians.Any(x => x.IsPrimary))
        {
            clonedGuardians[0].IsPrimary = true;
        }

        _dbContext.Guardians.AddRange(clonedGuardians);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var primaryGuardian = clonedGuardians.FirstOrDefault(x => x.IsPrimary) ?? clonedGuardians[0];
        destinationStudent.GuardianId = primaryGuardian.Id;
        destinationStudent.ParentEmail = primaryGuardian.ParentEmail;
        destinationStudent.ParentPhone = primaryGuardian.ParentPhone;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task CopySubjectsAsync(Student sourceStudent, Student destinationStudent, CancellationToken cancellationToken)
    {
        var subjectIds = await _dbContext.StudentSubjectEnrollments.AsNoTracking()
            .Where(x => x.StudentId == sourceStudent.Id)
            .Select(x => x.SubjectId)
            .ToArrayAsync(cancellationToken);

        if (subjectIds.Length == 0)
        {
            return;
        }

        var enrollments = subjectIds.Select(subjectId => new StudentSubjectEnrollment
        {
            SchoolId = destinationStudent.SchoolId,
            StudentId = destinationStudent.Id,
            SubjectId = subjectId
        }).ToList();

        _dbContext.StudentSubjectEnrollments.AddRange(enrollments);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<Student?> LoadStudentAsync(int studentId, int? schoolId, bool includeInactive, CancellationToken cancellationToken)
    {
        var query = _dbContext.Students.AsTracking();
        if (schoolId.HasValue)
        {
            query = query.Where(x => x.SchoolId == schoolId.Value);
        }

        if (!includeInactive)
        {
            query = query.Where(x => ActivePlacementStatuses.Contains(x.Status));
        }

        return await query
            .Include(x => x.Guardians)
            .Include(x => x.SubjectEnrollments)
            .FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
    }

    private async Task ValidateTargetPlacementAsync(int schoolId, string targetClass, string targetLevel, CancellationToken cancellationToken)
    {
        var schoolClass = await _dbContext.SchoolClasses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Name == targetClass, cancellationToken);

        if (schoolClass is null)
        {
            throw new InvalidOperationException("Create the destination class before moving the student.");
        }

        if (!schoolClass.IsActive)
        {
            throw new InvalidOperationException("The destination class is not active.");
        }

        var normalizedClassLevel = SchoolLevelCatalog.NormalizeLevel(schoolClass.GradeLevel);
        var normalizedTargetLevel = SchoolLevelCatalog.NormalizeLevel(targetLevel);
        if (!string.Equals(normalizedClassLevel, normalizedTargetLevel, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The target class does not match the selected level.");
        }
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before managing student progression.");
        }

        if (_currentUserContext.Role != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Only school admins can manage student progression.");
        }

        return _currentUserContext.SchoolId
            ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private static string NormalizeAction(string value)
    {
        var action = value.Trim();
        if (string.IsNullOrWhiteSpace(action))
        {
            throw new InvalidOperationException("Choose a movement action.");
        }

        if (TransferActions.Contains(action) || BatchActions.Contains(action))
        {
            return action switch
            {
                var normalized when normalized.Equals("Transfer", StringComparison.OrdinalIgnoreCase) => "Transfer",
                var normalized when normalized.Equals("TransferOut", StringComparison.OrdinalIgnoreCase) => "TransferOut",
                var normalized when normalized.Equals("Promote", StringComparison.OrdinalIgnoreCase) => "Promote",
                var normalized when normalized.Equals("Reshuffle", StringComparison.OrdinalIgnoreCase) => "Reshuffle",
                var normalized when normalized.Equals("Exit", StringComparison.OrdinalIgnoreCase) => "Exit",
                var normalized when normalized.Equals("ReAdmit", StringComparison.OrdinalIgnoreCase) => "ReAdmit",
                _ => action
            };
        }

        throw new InvalidOperationException($"Unsupported movement action '{value}'.");
    }

    private static string NormalizeMovementAction(string action)
    {
        return NormalizeAction(action);
    }

    private static string EnsureProfileKey(Student student)
    {
        if (!string.IsNullOrWhiteSpace(student.ProfileKey))
        {
            return student.ProfileKey;
        }

        student.ProfileKey = Guid.NewGuid().ToString("N");
        return student.ProfileKey;
    }

    private static string NormalizeArchiveStatus(string action)
    {
        return action switch
        {
            var value when value.Equals("Promote", StringComparison.OrdinalIgnoreCase) => "Promoted",
            var value when value.Equals("Reshuffle", StringComparison.OrdinalIgnoreCase) => "Reshuffled",
            var value when value.Equals("Transfer", StringComparison.OrdinalIgnoreCase) => "TransferredOut",
            var value when value.Equals("TransferOut", StringComparison.OrdinalIgnoreCase) => "TransferredOut",
            var value when value.Equals("ReAdmit", StringComparison.OrdinalIgnoreCase) => "Exited",
            var value when value.Equals("Exit", StringComparison.OrdinalIgnoreCase) => "Exited",
            _ => "Archived"
        };
    }

    private static string ResolveTargetClass(string? targetClass)
    {
        var value = targetClass?.Trim();
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        throw new InvalidOperationException("Select a destination class.");
    }

    private static string ResolveTargetLevel(string? targetLevel, string targetClass)
    {
        var explicitLevel = targetLevel?.Trim();
        if (!string.IsNullOrWhiteSpace(explicitLevel))
        {
            return SchoolLevelCatalog.NormalizeLevel(explicitLevel);
        }

        if (SchoolLevelCatalog.TryGetClassLevel(targetClass, out var inferredLevel))
        {
            return inferredLevel;
        }

        throw new InvalidOperationException("Select a destination level.");
    }
}
