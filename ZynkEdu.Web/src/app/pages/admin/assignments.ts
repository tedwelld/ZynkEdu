import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { normalizeSchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface AssignmentDraft {
    teacherId: number | null;
    teacherName: string;
    subjectIds: number[];
    classes: string[];
}

interface MissingCoverageEntry {
    className: string;
    subjectName: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-assignments',
    imports: [CommonModule, FormsModule, ButtonModule, DrawerModule, InputTextModule, AppDropdownComponent, MultiSelectModule, SkeletonModule, TableModule, TagModule, TooltipModule, MetricCardComponent],
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

            <div *ngIf="pendingCoverage.length > 0" class="workspace-card border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p class="text-sm uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300 font-semibold">Timetable coverage needed</p>
                        <h2 class="text-xl font-display font-bold mb-2">Prefilled from timetable gaps</h2>
                        <p class="text-sm text-muted-color max-w-3xl">
                            These class-subject pairs must be assigned to teachers before the timetable can be generated. Choose a teacher, then save the assignment.
                        </p>
                    </div>
                    <button pButton type="button" label="Clear prefill" severity="secondary" icon="pi pi-times" (click)="clearPendingCoverage()"></button>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                    <p-tag *ngFor="let item of pendingCoverage" [value]="coverageLabelFor(item)" severity="warning"></p-tag>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="xl:col-span-2">
                    <app-metric-card label="Subjects" [value]="visibleSubjects.length.toString()" delta="Available roster" hint="Selected school" icon="pi pi-book" tone="green"></app-metric-card>
                </div>
                <app-metric-card label="Classes" [value]="visibleClasses.length.toString()" delta="Class registry" hint="Teaching ready" icon="pi pi-sitemap" tone="purple"></app-metric-card>
                <article class="workspace-card metric-gradient h-full flex flex-col justify-between gap-3">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <span class="block text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Current assignments</span>
                            <h3 class="text-3xl font-bold mt-2 mb-0 font-display">{{ visibleAssignments.length.toString() }}</h3>
                            <p class="mt-2 text-sm text-muted-color">View and export the active teacher links.</p>
                        </div>
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white soft-shadow bg-gradient-to-br from-orange-500 to-amber-500">
                            <i class="pi pi-link text-xl"></i>
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <button pButton type="button" label="View current assignments" icon="pi pi-table" severity="secondary" class="w-full" (click)="assignmentsDrawerVisible = true"></button>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" class="w-full" (click)="exportAssignmentsPdf()"></button>
                    </div>
                </article>
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
                        <label class="block text-sm font-semibold mb-2">Classes</label>
                        <p-multiSelect [options]="classOptions" [(ngModel)]="draft.classes" optionLabel="label" optionValue="value" display="chip" class="w-full" [filter]="true" filterPlaceholder="Search classes" appendTo="body" [disabled]="classOptions.length === 0" placeholder="Select classes" (onClick)="refreshLookups()" (ngModelChange)="onClassesChange($event)"></p-multiSelect>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subjects</label>
                        <p-multiSelect [options]="subjectOptions" [(ngModel)]="draft.subjectIds" optionLabel="label" optionValue="value" display="chip" class="w-full" [filter]="true" filterPlaceholder="Search subjects" appendTo="body" [disabled]="subjectOptions.length === 0" placeholder="Select subjects" (onClick)="refreshLookups()"></p-multiSelect>
                        <div *ngIf="draft.classes.length > 0 && subjectOptions.length === 0" class="mt-2 text-sm text-red-500">
                            The selected classes have no available subjects yet.
                        </div>
                    </div>
                    <div class="flex items-end">
                        <button pButton type="button" label="Save assignment" icon="pi pi-check" class="w-full" [disabled]="!canSave()" (click)="saveAssignment()"></button>
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
                <p-table *ngIf="!loading" [value]="visibleSubjects" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Subject</th>
                            <th>Level</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-subject>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ subject.name }}</div>
                                <div class="text-xs text-muted-color">{{ subject.code }}</div>
                            </td>
                            <td>
                                <p-tag [value]="levelLabelFor(subject.gradeLevel)" [severity]="severityForLevel(subject.gradeLevel)"></p-tag>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openSubjectEditor(subject)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteSubject(subject)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 dark:border-surface-700 pt-4">
                    <p class="text-sm text-muted-color">Manage subjects directly or jump to the full subject library.</p>
                    <div class="flex flex-wrap gap-2">
                        <button pButton type="button" label="Add subject" icon="pi pi-plus" (click)="openSubjectCreator()"></button>
                        <button pButton type="button" label="View all subjects" icon="pi pi-book" severity="secondary" (click)="openSubjectsLibrary()"></button>
                    </div>
                </div>
                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>
            </article>

            <p-drawer [(visible)]="assignmentsDrawerVisible" position="right" [modal]="true" [dismissible]="true" [style]="{ width: 'min(78rem, 96vw)' }" appendTo="body" header="Current assignments">
                <div class="space-y-4">
                    <div class="flex items-center justify-between text-sm text-muted-color">
                        <span>{{ visibleAssignments.length }} total</span>
                        <span>{{ selectedSchoolId ? schoolNameFor(selectedSchoolId) : 'All schools' }}</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <p-table *ngIf="!loading" [value]="visibleAssignments" [rows]="12" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Teacher</th>
                                <th>Subject</th>
                                <th>Class</th>
                                <th>Level</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-assignment>
                            <tr>
                                <td>
                                    <div class="font-semibold">{{ assignment.teacherName }}</div>
                                    <div class="text-xs text-muted-color">ID {{ assignment.teacherId }}</div>
                                </td>
                                <td>
                                    <div class="font-semibold">{{ assignment.subjectName }}</div>
                                    <div class="text-xs text-muted-color">Subject ID {{ assignment.subjectId }}</div>
                                </td>
                                <td><p-tag [value]="assignment.class" severity="success"></p-tag></td>
                                <td><p-tag [value]="levelLabelFor(assignment.gradeLevel)" [severity]="severityForLevel(assignment.gradeLevel)"></p-tag></td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </p-drawer>
        </section>
    `
})
export class AdminAssignments implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly messages = inject(MessageService);
    private readonly router = inject(Router);
    private readonly confirmation = inject(ConfirmationService);

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
    assignmentsDrawerVisible = false;
    pendingCoverage: MissingCoverageEntry[] = [];
    coveragePrefillApplied = false;
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
                this.draft.teacherId = this.visibleTeachers.some((teacher) => teacher.id === this.draft.teacherId) ? this.draft.teacherId : null;
                this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.visibleSubjects.some((subject) => subject.id === subjectId));
                this.draft.classes = this.draft.classes.filter((className) => this.classOptions.some((option) => option.value === className));
                this.onClassesChange(this.draft.classes);
                this.onTeacherChange(this.draft.teacherId);
                this.applyPendingCoveragePrefill();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    generateTimetable(): void {
        const selectedTerm = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'Term 1';
        this.api.generateTimetable(selectedTerm, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Timetable generated', detail: `${selectedTerm} timetable has been rebuilt for this school.` });
                this.clearPendingCoverage();
            },
            error: (error) => {
                const missingCoverage = this.parseMissingCoverageFromMessage(this.readErrorMessage(error, 'The timetable could not be generated.'));
                if (missingCoverage.length > 0) {
                    this.pendingCoverage = missingCoverage;
                    this.coveragePrefillApplied = false;
                    this.applyPendingCoveragePrefill();
                    this.messages.add({
                        severity: 'warn',
                        summary: 'Teacher coverage missing',
                        detail: 'The missing class-subject pairs have been prefilled. Choose a teacher and save the assignment before generating the timetable again.'
                    });
                    return;
                }

                this.messages.add({ severity: 'error', summary: 'Generate failed', detail: this.readErrorMessage(error, 'The timetable could not be generated.') });
            }
        });
    }

    openSubjectCreator(): void {
        this.router.navigate(['/admin/subjects'], {
            queryParams: this.selectedSchoolId ? { schoolId: this.selectedSchoolId, create: 1 } : { create: 1 }
        });
    }

    openSubjectsLibrary(): void {
        this.router.navigate(['/admin/subjects'], {
            queryParams: this.selectedSchoolId ? { schoolId: this.selectedSchoolId } : undefined
        });
    }

    openSubjectEditor(subject: SubjectResponse): void {
        this.router.navigate(['/admin/subjects'], {
            queryParams: { schoolId: subject.schoolId, focus: subject.id }
        });
    }

    deleteSubject(subject: SubjectResponse): void {
        this.confirmation.confirm({
            message: `Delete ${subject.name}?`,
            header: 'Delete subject',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteSubject(subject.id, subject.schoolId).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Subject deleted', detail: `${subject.name} removed.` });
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: this.readErrorMessage(error, 'The subject could not be deleted.') });
                    }
                })
        });
    }

    exportAssignmentsPdf(): void {
        const assignments = [...this.visibleAssignments].sort((left, right) => {
            const teacherCompare = left.teacherName.localeCompare(right.teacherName);
            if (teacherCompare !== 0) {
                return teacherCompare;
            }

            const classCompare = left.class.localeCompare(right.class);
            if (classCompare !== 0) {
                return classCompare;
            }

            return left.subjectName.localeCompare(right.subjectName);
        });

        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;
        const schoolLabel = this.selectedSchoolId ? this.schoolNameFor(this.selectedSchoolId) : 'All schools';
        const fileName = `assigned-teachers-${this.slugify(schoolLabel)}.pdf`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Assigned teachers', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`School: ${schoolLabel}`, margin, 60);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 74);
        doc.text(`Assignments: ${assignments.length}`, margin, 88);

        if (assignments.length === 0) {
            doc.text('No assignments are available for export.', margin, 112);
            doc.save(fileName);
            return;
        }

        autoTable(doc, {
            startY: 104,
            head: [['Teacher', 'Subject', 'Class', 'Level']],
            body: assignments.map((assignment) => [
                assignment.teacherName,
                assignment.subjectName,
                assignment.class,
                this.levelLabelFor(assignment.gradeLevel)
            ]),
            theme: 'striped',
            styles: {
                fontSize: 8.5,
                cellPadding: 4
            },
            headStyles: {
                fillColor: [37, 99, 235]
            },
            margin: {
                left: margin,
                right: margin
            }
        });

        doc.save(fileName);
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
    }

    clearPendingCoverage(): void {
        this.pendingCoverage = [];
        this.coveragePrefillApplied = false;
    }

    coverageLabelFor(entry: MissingCoverageEntry): string {
        return `${entry.className} / ${entry.subjectName}`;
    }

    canSave(): boolean {
        return !!this.draft.teacherId && this.draft.subjectIds.length > 0 && this.draft.classes.length > 0;
    }

    saveAssignment(): void {
        if (!this.canSave() || !this.draft.teacherId) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a teacher, at least one subject, and at least one class before saving the assignment.' });
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

        const allowed = new Set<number>();
        for (const schoolClass of selectedClasses) {
            for (const subjectId of schoolClass.subjectIds) {
                allowed.add(subjectId);
            }
        }

        return allowed;
    }

    private applyPendingCoveragePrefill(): void {
        if (this.coveragePrefillApplied || this.pendingCoverage.length === 0) {
            return;
        }

        const selectedClasses: string[] = [...new Set(this.pendingCoverage.map((entry: MissingCoverageEntry) => entry.className))].filter((className) =>
            this.classOptions.some((option) => option.value === className)
        );

        if (selectedClasses.length === 0) {
            return;
        }

        const allowedSubjectIds = this.allowedSubjectIdsForClasses(selectedClasses);
        if (allowedSubjectIds.size === 0) {
            return;
        }

        const subjectIds: number[] = [...new Set(this.pendingCoverage.flatMap((entry: MissingCoverageEntry) => {
            const subject = this.visibleSubjects.find((item) => item.name.trim().toLowerCase() === entry.subjectName.trim().toLowerCase());
            return subject ? [subject.id] : [];
        }))].filter((subjectId) => allowedSubjectIds.has(subjectId));

        if (subjectIds.length === 0) {
            return;
        }

        this.draft.classes = selectedClasses;
        this.draft.subjectIds = subjectIds;
        this.coveragePrefillApplied = true;
        this.messages.add({
            severity: 'info',
            summary: 'Coverage prefilled',
            detail: 'The missing timetable coverage has been loaded into the assignment form.'
        });
    }

    private applySchoolScopeFromQuery(): void {
        const schoolIdText = this.route.snapshot.queryParamMap.get('schoolId');
        const schoolId = schoolIdText ? Number(schoolIdText) : null;
        if (Number.isFinite(schoolId)) {
            this.selectedSchoolId = schoolId;
        }

        this.pendingCoverage = this.parseCoverageQuery(this.route.snapshot.queryParamMap.get('coverage'));
        this.coveragePrefillApplied = false;
    }

    private parseCoverageQuery(coverageText: string | null): MissingCoverageEntry[] {
        if (!coverageText) {
            return [];
        }

        return coverageText
            .split(';')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const [classPart, subjectPart] = entry.split('|');
                if (!classPart || !subjectPart) {
                    return null;
                }

                try {
                    return <MissingCoverageEntry>{
                        className: decodeURIComponent(classPart),
                        subjectName: decodeURIComponent(subjectPart)
                    };
                } catch {
                    return null;
                }
            })
            .filter((entry): entry is MissingCoverageEntry => entry !== null);
    }

    private parseMissingCoverageFromMessage(errorMessage: string): MissingCoverageEntry[] {
        const match = errorMessage.match(/Missing:\s*(.+?)(?:\.|$)/i);
        if (!match) {
            return [];
        }

        return match[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const pieces = part.split('/').map((segment) => segment.trim());
                if (pieces.length < 2 || !pieces[0] || !pieces[1]) {
                    return null;
                }

                return <MissingCoverageEntry>{ className: pieces[0], subjectName: pieces[1] };
            })
            .filter((entry): entry is MissingCoverageEntry => entry !== null);
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'school';
    }
}
