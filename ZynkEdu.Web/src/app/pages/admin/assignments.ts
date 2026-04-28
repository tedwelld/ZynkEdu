import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import {
    AcademicTermResponse,
    AttendanceClassOptionResponse,
    CreateTeacherAssignmentsBatchRequest,
    SchoolResponse,
    SubjectResponse,
    TeacherAssignmentBatchResponse,
    TeacherAssignmentResponse,
    UserResponse
} from '../../core/api/api.models';
import { getClassLevel, normalizeSchoolLevel, SchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

interface AssignmentDraft {
    teacherId: number | null;
    teacherName: string;
    subjectIds: number[];
    classes: string[];
}

@Component({
    standalone: true,
    selector: 'app-admin-assignments',
    imports: [CommonModule, FormsModule, ButtonModule, DrawerModule, InputTextModule, AppDropdownComponent, MultiSelectModule, SkeletonModule, TagModule, TooltipModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Assignments</p>
                    <h1 class="text-3xl font-display font-bold m-0">Teacher-to-class assignment</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Choose the teacher, one or more subjects, and one or more classes, then save the mapping in one pass.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="refreshLookups()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (opened)="refreshLookups()"></app-dropdown>
                    <button pButton type="button" label="Generate timetable" icon="pi pi-calendar-plus" severity="help" (click)="generateTimetable()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Create mapping</h2>
                        <p class="text-sm text-muted-color">Use the dropdowns to assign a teacher to all required class and subject combinations at once.</p>
                    </div>
                        <span class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ classOptions.length }} classes</span>
                    </div>

                <div class="grid gap-4 xl:grid-cols-4">
                    <div *ngIf="isPlatformAdmin" class="xl:col-span-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        {{ schoolNameFor(selectedSchoolId ?? 0) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Teacher</label>
                        <app-dropdown [options]="teacherOptions" [(ngModel)]="draft.teacherId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search teachers" (opened)="refreshLookups()" (ngModelChange)="onTeacherChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subjects</label>
                        <p-multiSelect
                            [options]="subjectOptions"
                            [(ngModel)]="draft.subjectIds"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            class="w-full"
                            [filter]="true"
                            filterPlaceholder="Search subjects"
                            appendTo="body"
                            [disabled]="subjectOptions.length === 0"
                            placeholder="Select subjects"
                            (onClick)="refreshLookups()"
                        ></p-multiSelect>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Classes</label>
                        <p-multiSelect
                            [options]="classOptions"
                            [(ngModel)]="draft.classes"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            class="w-full"
                            [filter]="true"
                            filterPlaceholder="Search classes"
                            appendTo="body"
                            [disabled]="classOptions.length === 0"
                            placeholder="Select classes"
                            (onClick)="refreshLookups()"
                            (ngModelChange)="onClassesChange($event)"
                        ></p-multiSelect>
                        <div *ngIf="draft.classes.length > 0 && !selectedClassLevel" class="mt-2 text-sm text-red-500">
                            Choose classes from the same level before saving.
                        </div>
                    </div>
                    <div class="flex items-end">
                        <button pButton type="button" label="Save assignment" icon="pi pi-check" class="w-full" [disabled]="!canSave()" (click)="saveAssignment()"></button>
                    </div>
                </div>
            </article>

            <div class="grid gap-6 xl:grid-cols-[0.72fr_0.72fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Teachers</h2>
                            <p class="text-sm text-muted-color">Available teachers in the selected school.</p>
                        </div>
                        <span class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ visibleTeachers.length }}</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <div *ngIf="!loading" class="space-y-3">
                        <div *ngFor="let teacher of visibleTeachers" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                            <div class="font-semibold">{{ teacher.displayName }}</div>
                            <div class="text-xs text-muted-color">{{ teacher.username }}</div>
                        </div>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Subjects</h2>
                            <p class="text-sm text-muted-color">Available subjects in the selected school.</p>
                        </div>
                        <span class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ visibleSubjects.length }}</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                            <div *ngIf="!loading" class="space-y-3">
                        <div *ngFor="let subject of visibleSubjects" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                            <div class="font-semibold">{{ subject.name }}</div>
                            <div class="mt-1 text-xs text-muted-color">Subject ID {{ subject.id }}</div>
                            <p-tag class="mt-2 inline-flex" [value]="levelLabelFor(subject.gradeLevel)" [severity]="severityForLevel(subject.gradeLevel)"></p-tag>
                        </div>
                    </div>
                </article>
            </div>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Current assignments</h2>
                        <p class="text-sm text-muted-color">Existing mappings loaded from the live API.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ visibleAssignments.length }} total</span>
                </div>
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div *ngFor="let assignment of visibleAssignments" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold">{{ assignment.teacherName }}</div>
                                    <div class="text-sm text-muted-color">{{ assignment.subjectName }}</div>
                                </div>
                            <div class="flex flex-col items-end gap-2">
                                <p-tag [value]="assignment.class" severity="success"></p-tag>
                                <p-tag [value]="levelLabelFor(assignment.gradeLevel)" [severity]="severityForLevel(assignment.gradeLevel)"></p-tag>
                            </div>
                            </div>
                        </div>
                    </div>
                </article>
            </section>
    `
})
export class AdminAssignments implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    schools: SchoolResponse[] = [];
    teachers: UserResponse[] = [];
    subjects: SubjectResponse[] = [];
    attendanceClasses: AttendanceClassOptionResponse[] = [];
    assignments: TeacherAssignmentResponse[] = [];
    terms: AcademicTermResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    selectedTermId: number | null = null;
    draft: AssignmentDraft = {
        teacherId: null,
        teacherName: '',
        subjectIds: [],
        classes: []
    };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    ngOnInit(): void {
        this.applySchoolScopeFromQuery();
        this.loadData();
    }

    private applySchoolScopeFromQuery(): void {
        const schoolIdText = this.route.snapshot.queryParamMap.get('schoolId');
        const schoolId = schoolIdText ? Number(schoolIdText) : null;
        if (Number.isFinite(schoolId)) {
            this.selectedSchoolId = schoolId;
        }
    }

    loadData(): void {
        this.loading = true;
        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.api.getSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    this.selectedSchoolId = schools[0]?.id ?? null;

                    if (!this.selectedSchoolId) {
                        this.loading = false;
                        this.messages.add({ severity: 'warn', summary: 'No school selected', detail: 'Choose a school before loading assignments.' });
                        return;
                    }

                    this.loadData();
                },
                error: () => {
                    this.loading = false;
                }
            });
            return;
        }

        const termSchoolId = this.isPlatformAdmin ? this.selectedSchoolId : null;
        forkJoin({
            teachers: this.api.getTeachers(termSchoolId),
            subjects: this.api.getSubjects(termSchoolId),
            attendanceClasses: this.api.getAttendanceClasses(termSchoolId),
            assignments: this.api.getAssignments(termSchoolId),
            terms: this.api.getAcademicTerms(termSchoolId),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ teachers, subjects, attendanceClasses, assignments, terms, schools }) => {
                this.schools = schools;
                this.teachers = teachers;
                this.subjects = subjects;
                this.attendanceClasses = attendanceClasses;
                this.assignments = assignments;
                this.terms = terms;
                this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
                this.selectedTermId = this.terms.some((term) => term.id === this.selectedTermId) ? this.selectedTermId : this.terms[0]?.id ?? null;
                this.draft.teacherId = this.visibleTeachers.some((teacher) => teacher.id === this.draft.teacherId) ? this.draft.teacherId : this.visibleTeachers[0]?.id ?? null;
                this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.visibleSubjects.some((subject) => subject.id === subjectId));
                this.draft.classes = this.draft.classes.filter((className) => this.classOptions.some((option) => option.value === className));
                if (this.draft.subjectIds.length === 0 && this.visibleSubjects[0]?.id) {
                    this.draft.subjectIds = [this.visibleSubjects[0].id];
                }
                if (this.draft.classes.length === 0 && this.classOptions[0]?.value) {
                    this.draft.classes = [this.classOptions[0].value];
                }
                this.onClassesChange(this.draft.classes);
                this.onTeacherChange(this.draft.teacherId);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    generateTimetable(): void {
        const selectedTerm = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'Term 1';

        this.api.generateTimetable(selectedTerm).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Timetable generated', detail: `${selectedTerm} timetable has been rebuilt for this school.` });
            }
        });
    }

    get termOptions(): { label: string; value: number }[] {
        return this.terms.map((term) => ({ label: term.name, value: term.id }));
    }

    get teacherOptions(): { label: string; value: number }[] {
        return this.visibleTeachers.map((teacher) => ({ label: `${teacher.displayName} (${teacher.username})`, value: teacher.id }));
    }

    get subjectOptions(): { label: string; value: number }[] {
        if (this.draft.classes.length > 0 && !this.selectedClassLevel) {
            return [];
        }

        const selectedLevel = this.selectedClassLevel;
        return this.visibleSubjects
            .filter((subject) => !selectedLevel || normalizeSchoolLevel(subject.gradeLevel) === selectedLevel || normalizeSchoolLevel(subject.gradeLevel) === 'General')
            .map((subject) => ({ label: `${subject.name} (${normalizeSchoolLevel(subject.gradeLevel)})`, value: subject.id }));
    }

    get classOptions(): { label: string; value: string }[] {
        return this.visibleAttendanceClasses.map((classOption) => {
            const level = classOption.level ? ` · ${classOption.level}` : '';
            return { label: `${classOption.className} (${classOption.studentCount})${level}`, value: classOption.className };
        });
    }

    get selectedClassLevel(): SchoolLevel | null {
        const levels = this.draft.classes
            .map((className) => getClassLevel(className))
            .filter((level): level is Exclude<SchoolLevel, 'General'> => level !== null);

        if (levels.length === 0) {
            return null;
        }

        const distinct = Array.from(new Set(levels));
        return distinct.length === 1 ? distinct[0] : null;
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get visibleTeachers(): UserResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.teachers.filter((teacher) => teacher.schoolId === this.selectedSchoolId) : this.teachers;
    }

    get visibleSubjects(): SubjectResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.subjects.filter((subject) => subject.schoolId === this.selectedSchoolId) : this.subjects;
    }

    get visibleAttendanceClasses(): AttendanceClassOptionResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId
            ? this.attendanceClasses.filter((classOption) => classOption.className.length > 0)
            : this.attendanceClasses;
    }

    get visibleAssignments(): TeacherAssignmentResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.assignments.filter((assignment) => assignment.schoolId === this.selectedSchoolId) : this.assignments;
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    onTeacherChange(teacherId: number | null): void {
        this.draft.teacherId = teacherId;
        const teacher = this.teachers.find((item) => item.id === teacherId);
        if (teacher) {
            this.draft.teacherName = teacher.displayName;
        }
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    canSave(): boolean {
        return !!this.draft.teacherId && this.draft.subjectIds.length > 0 && this.draft.classes.length > 0 && !!this.selectedClassLevel;
    }

    saveAssignment(): void {
        if (!this.canSave() || !this.draft.teacherId) {
            const detail = this.draft.classes.length > 0 && !this.selectedClassLevel
                ? 'Choose classes from the same level before saving the assignment.'
                : 'Choose a teacher, at least one subject, and at least one class before saving the assignment.';
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail });
            return;
        }

        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose the school before saving the assignment.' });
            return;
        }

        const payload: CreateTeacherAssignmentsBatchRequest = {
            teacherId: this.draft.teacherId,
            subjectIds: [...new Set(this.draft.subjectIds)],
            classes: [...new Set(this.draft.classes.map((value) => value.trim()).filter(Boolean))]
        };

        this.api.createAssignmentsBatch(payload, this.selectedSchoolId).subscribe({
            next: (result: TeacherAssignmentBatchResponse) => {
                this.messages.add({
                    severity: 'success',
                    summary: 'Assignments saved',
                    detail: `${result.teacherName} linked to ${result.createdCount} new assignment(s) across ${result.requestedCount} requested combination(s).`
                });
                this.draft = {
                    teacherId: null,
                    teacherName: '',
                    subjectIds: [],
                    classes: []
                };
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The assignment could not be saved.') });
            }
        });
    }

    refreshLookups(): void {
        this.loadData();
    }

    onClassesChange(classes: string[]): void {
        this.draft.classes = classes;

        if (!this.selectedClassLevel) {
            return;
        }

        const allowedSubjectIds = new Set(
            this.visibleSubjects
                .filter((subject) => normalizeSchoolLevel(subject.gradeLevel) === this.selectedClassLevel || normalizeSchoolLevel(subject.gradeLevel) === 'General')
                .map((subject) => subject.id)
        );

        this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => allowedSubjectIds.has(subjectId));
        if (this.draft.subjectIds.length === 0) {
            const firstSubjectId = this.subjectOptions[0]?.value ?? null;
            this.draft.subjectIds = firstSubjectId ? [firstSubjectId] : [];
        }
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }

    severityForLevel(level: string): 'success' | 'warning' | 'info' | 'secondary' {
        const normalized = normalizeSchoolLevel(level);
        if (normalized === 'ZGC Level') {
            return 'success';
        }

        if (normalized === "O'Level") {
            return 'warning';
        }

        if (normalized === "A'Level") {
            return 'info';
        }

        return 'secondary';
    }

    levelLabelFor(level: string): string {
        return normalizeSchoolLevel(level);
    }
}
