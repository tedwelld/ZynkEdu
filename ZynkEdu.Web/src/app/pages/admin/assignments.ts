import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    AcademicTermResponse,
    CreateTeacherAssignmentsBatchRequest,
    SchoolClassResponse,
    SchoolResponse,
    SubjectResponse,
    TeacherAssignmentBatchResponse,
    TeacherAssignmentResponse,
    UserResponse
} from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { normalizeSchoolLevel, SchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface AssignmentDraft {
    teacherId: number | null;
    teacherName: string;
    subjectIds: number[];
    classes: string[];
}

@Component({
    standalone: true,
    selector: 'app-admin-assignments',
    imports: [CommonModule, FormsModule, ButtonModule, DrawerModule, InputTextModule, AppDropdownComponent, MultiSelectModule, SkeletonModule, TagModule, TooltipModule, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Assignments</p>
                    <h1 class="text-3xl font-display font-bold m-0">Teacher-to-class assignment</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Choose the teacher, subject(s), and class(es). Subjects are limited to those already attached to the selected classes.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="refreshLookups()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (opened)="refreshLookups()"></app-dropdown>
                    <button pButton type="button" label="Generate timetable" icon="pi pi-calendar-plus" severity="help" (click)="generateTimetable()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Teachers" [value]="visibleTeachers.length.toString()" delta="Available roster" hint="Selected school" icon="pi pi-id-card" tone="blue"></app-metric-card>
                <app-metric-card label="Subjects" [value]="visibleSubjects.length.toString()" delta="Available roster" hint="Selected school" icon="pi pi-book" tone="green"></app-metric-card>
                <app-metric-card label="Classes" [value]="visibleClasses.length.toString()" delta="Class registry" hint="Teaching ready" icon="pi pi-sitemap" tone="purple"></app-metric-card>
                <app-metric-card label="Assignments" [value]="visibleAssignments.length.toString()" delta="Live links" hint="Current mappings" icon="pi pi-link" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Create mapping</h2>
                        <p class="text-sm text-muted-color">Use the class registry to keep subject selection aligned to the selected level.</p>
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
                        <p-multiSelect [options]="subjectOptions" [(ngModel)]="draft.subjectIds" optionLabel="label" optionValue="value" display="chip" class="w-full" [filter]="true" filterPlaceholder="Search subjects" appendTo="body" [disabled]="subjectOptions.length === 0" placeholder="Select subjects" (onClick)="refreshLookups()"></p-multiSelect>
                        <div *ngIf="draft.classes.length > 0 && subjectOptions.length === 0" class="mt-2 text-sm text-red-500">
                            The selected class has no shared subjects yet.
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Classes</label>
                        <p-multiSelect [options]="classOptions" [(ngModel)]="draft.classes" optionLabel="label" optionValue="value" display="chip" class="w-full" [filter]="true" filterPlaceholder="Search classes" appendTo="body" [disabled]="classOptions.length === 0" placeholder="Select classes" (onClick)="refreshLookups()" (ngModelChange)="onClassesChange($event)"></p-multiSelect>
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

    loading = true;
    schools: SchoolResponse[] = [];
    teachers: UserResponse[] = [];
    subjects: SubjectResponse[] = [];
    classes: SchoolClassResponse[] = [];
    assignments: TeacherAssignmentResponse[] = [];
    terms: AcademicTermResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    selectedTermId: number | null = null;
    draft: AssignmentDraft = { teacherId: null, teacherName: '', subjectIds: [], classes: [] };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get termOptions(): { label: string; value: number }[] {
        return this.terms.map((term) => ({ label: term.name, value: term.id }));
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select school', value: null },
            ...this.schools.map((school) => ({ label: school.name, value: school.id }))
        ];
    }

    get teacherOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select teacher', value: null },
            ...this.visibleTeachers.map((teacher) => ({ label: `${teacher.displayName} (${teacher.username})`, value: teacher.id }))
        ];
    }

    get classOptions(): { label: string; value: string }[] {
        return this.visibleClasses.map((schoolClass) => ({
            label: `${schoolClass.className} (${schoolClass.subjectNames.length} subjects) · ${schoolClass.isReadyForTeaching ? 'Ready' : 'Setup needed'} · ${normalizeSchoolLevel(schoolClass.gradeLevel)}`,
            value: schoolClass.className
        }));
    }

    get subjectOptions(): { label: string; value: number }[] {
        const allowedSubjectIds = this.allowedSubjectIdsForClasses(this.draft.classes);
        if (this.draft.classes.length > 0 && allowedSubjectIds.size === 0) {
            return [];
        }

        return this.visibleSubjects
            .filter((subject) => allowedSubjectIds.size === 0 || allowedSubjectIds.has(subject.id))
            .map((subject) => ({ label: `${subject.name} (${normalizeSchoolLevel(subject.gradeLevel)})`, value: subject.id }));
    }

    get selectedClassLevel(): SchoolLevel | null {
        const levels = this.draft.classes
            .map((className) => this.classes.find((entry) => entry.className === className))
            .filter((entry): entry is SchoolClassResponse => !!entry)
            .map((entry) => normalizeSchoolLevel(entry.gradeLevel))
            .filter((level): level is Exclude<SchoolLevel, 'General'> => level !== 'General');

        if (levels.length === 0) {
            return null;
        }

        const distinct = Array.from(new Set(levels));
        return distinct.length === 1 ? distinct[0] : null;
    }

    get visibleTeachers(): UserResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.teachers.filter((teacher) => teacher.schoolId === this.selectedSchoolId) : this.teachers;
    }

    get visibleSubjects(): SubjectResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.subjects.filter((subject) => subject.schoolId === this.selectedSchoolId) : this.subjects;
    }

    get visibleClasses(): SchoolClassResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.classes.filter((schoolClass) => schoolClass.schoolId === this.selectedSchoolId) : this.classes;
    }

    get visibleAssignments(): TeacherAssignmentResponse[] {
        return this.isPlatformAdmin && this.selectedSchoolId ? this.assignments.filter((assignment) => assignment.schoolId === this.selectedSchoolId) : this.assignments;
    }

    ngOnInit(): void {
        this.applySchoolScopeFromQuery();
        this.loadData();
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

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        forkJoin({
            teachers: this.api.getTeachers(schoolId),
            subjects: this.api.getSubjects(schoolId),
            classes: this.api.getClasses(schoolId),
            assignments: this.api.getAssignments(schoolId),
            terms: this.api.getAcademicTerms(schoolId),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ teachers, subjects, classes, assignments, terms, schools }) => {
                this.teachers = teachers;
                this.subjects = subjects;
                this.classes = classes;
                this.assignments = assignments;
                this.terms = terms;
                this.schools = schools;
                this.selectedSchoolId = this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId();
                this.selectedTermId = this.terms.some((term) => term.id === this.selectedTermId) ? this.selectedTermId : this.terms[0]?.id ?? null;
                this.draft.teacherId = this.visibleTeachers.some((teacher) => teacher.id === this.draft.teacherId) ? this.draft.teacherId : this.visibleTeachers[0]?.id ?? null;
                this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.visibleSubjects.some((subject) => subject.id === subjectId));
                this.draft.classes = this.draft.classes.filter((className) => this.classOptions.some((option) => option.value === className));

                if (this.draft.subjectIds.length === 0 && this.subjectOptions[0]?.value) {
                    this.draft.subjectIds = [this.subjectOptions[0].value];
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

    onTeacherChange(teacherId: number | null): void {
        this.draft.teacherId = teacherId;
        const teacher = this.teachers.find((entry) => entry.id === teacherId);
        this.draft.teacherName = teacher?.displayName ?? '';
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    refreshLookups(): void {
        this.loadData();
    }

    onClassesChange(classes: string[]): void {
        this.draft.classes = classes;
        const allowedSubjectIds = this.allowedSubjectIdsForClasses(classes);

        if (allowedSubjectIds.size === 0) {
            this.draft.subjectIds = [];
            return;
        }

        this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => allowedSubjectIds.has(subjectId));
        if (this.draft.subjectIds.length === 0) {
            const firstSubjectId = this.subjectOptions[0]?.value ?? null;
            this.draft.subjectIds = firstSubjectId ? [firstSubjectId] : [];
        }
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
                this.draft = { teacherId: null, teacherName: '', subjectIds: [], classes: [] };
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The assignment could not be saved.') });
            }
        });
    }

    levelLabelFor(level: string): string {
        return normalizeSchoolLevel(level);
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

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    private allowedSubjectIdsForClasses(classNames: string[]): Set<number> {
        const selectedClasses = classNames
            .map((className) => this.classes.find((entry) => entry.className === className))
            .filter((entry): entry is SchoolClassResponse => !!entry);

        if (selectedClasses.length === 0) {
            return new Set<number>();
        }

        const levels = Array.from(new Set(selectedClasses.map((entry) => normalizeSchoolLevel(entry.gradeLevel))));
        if (levels.length > 1) {
            return new Set<number>();
        }

        const allowed = new Set(selectedClasses[0]?.subjectIds ?? []);
        for (const schoolClass of selectedClasses.slice(1)) {
            const classSubjects = new Set(schoolClass.subjectIds);
            for (const subjectId of Array.from(allowed)) {
                if (!classSubjects.has(subjectId)) {
                    allowed.delete(subjectId);
                }
            }
        }

        return allowed;
    }

    private applySchoolScopeFromQuery(): void {
        const schoolIdText = this.route.snapshot.queryParamMap.get('schoolId');
        const schoolId = schoolIdText ? Number(schoolIdText) : null;
        if (Number.isFinite(schoolId)) {
            this.selectedSchoolId = schoolId;
        }
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
