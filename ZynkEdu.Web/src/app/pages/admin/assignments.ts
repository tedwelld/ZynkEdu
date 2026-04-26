import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import { AcademicTermResponse, CreateTeacherAssignmentRequest, SchoolResponse, SubjectResponse, TeacherAssignmentResponse, UserResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

const CLASS_OPTIONS = [
    'Form 1A',
    'Form 1B',
    'Form 1C',
    'Form 2A',
    'Form 2B',
    'Form 2C',
    'Form 3A Sciences',
    'Form 3B Commercials',
    'Form 3C Arts',
    'Form 4A Sciences',
    'Form 4B Commercials',
    'Form 4C Arts',
    'Form 5 Arts',
    'Form 5 Commercials',
    'Form 5 Sciences',
    'Form 6 Arts',
    'Form 6 Commercials',
    'Form 6 Sciences'
];

interface AssignmentDraft {
    teacherId: number | null;
    teacherName: string;
    subjectId: number | null;
    subjectName: string;
    class: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-assignments',
    imports: [CommonModule, FormsModule, ButtonModule, DrawerModule, InputTextModule, AppDropdownComponent, SkeletonModule, TagModule, TooltipModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Assignments</p>
                    <h1 class="text-3xl font-display font-bold m-0">Teacher-to-class assignment</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Choose the teacher, subject, class, and term from dropdowns, then save the mapping with one click.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms"></app-dropdown>
                    <button pButton type="button" label="Generate timetable" icon="pi pi-calendar-plus" severity="help" (click)="generateTimetable()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Create mapping</h2>
                        <p class="text-sm text-muted-color">Use the dropdowns to assign a teacher to a subject in a class lane.</p>
                    </div>
                    <span class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ classOptions.length }} classes</span>
                </div>

                <div class="grid gap-4 xl:grid-cols-4">
                    <div *ngIf="isPlatformAdmin" class="xl:col-span-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        {{ schoolNameFor(selectedSchoolId ?? 0) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Teacher</label>
                        <app-dropdown [options]="teacherOptions" [(ngModel)]="draft.teacherId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search teachers" (ngModelChange)="onTeacherChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject</label>
                        <app-dropdown [options]="subjectOptions" [(ngModel)]="draft.subjectId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search subjects" (ngModelChange)="onSubjectChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="draft.class" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes"></app-dropdown>
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
                            <div class="text-xs text-muted-color">Subject ID {{ subject.id }}</div>
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
                            <p-tag [value]="assignment.class" severity="success"></p-tag>
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
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    schools: SchoolResponse[] = [];
    teachers: UserResponse[] = [];
    subjects: SubjectResponse[] = [];
    assignments: TeacherAssignmentResponse[] = [];
    terms: AcademicTermResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    selectedTermId: number | null = null;
    draft: AssignmentDraft = {
        teacherId: null,
        teacherName: '',
        subjectId: null,
        subjectName: '',
        class: ''
    };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    ngOnInit(): void {
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

        const termSchoolId = this.isPlatformAdmin ? this.selectedSchoolId : null;
        forkJoin({
            teachers: this.api.getTeachers(termSchoolId),
            subjects: this.api.getSubjects(termSchoolId),
            assignments: this.api.getAssignments(termSchoolId),
            terms: this.api.getAcademicTerms(termSchoolId),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ teachers, subjects, assignments, terms, schools }) => {
                this.schools = schools;
                this.teachers = teachers;
                this.subjects = subjects;
                this.assignments = assignments;
                this.terms = terms;
                this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
                this.selectedTermId = this.terms.some((term) => term.id === this.selectedTermId) ? this.selectedTermId : this.terms[0]?.id ?? null;
                this.draft.teacherId = this.draft.teacherId ?? this.visibleTeachers[0]?.id ?? null;
                this.draft.subjectId = this.draft.subjectId ?? this.visibleSubjects[0]?.id ?? null;
                this.draft.class = this.draft.class || this.classOptions[0]?.value || '';
                this.onTeacherChange(this.draft.teacherId);
                this.onSubjectChange(this.draft.subjectId);
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
        return this.visibleSubjects.map((subject) => ({ label: subject.name, value: subject.id }));
    }

    get classOptions(): { label: string; value: string }[] {
        return CLASS_OPTIONS.map((value) => ({ label: value, value }));
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

    onSubjectChange(subjectId: number | null): void {
        this.draft.subjectId = subjectId;
        const subject = this.subjects.find((item) => item.id === subjectId);
        if (subject) {
            this.draft.subjectName = subject.name;
        }
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    canSave(): boolean {
        return !!this.draft.teacherId && !!this.draft.subjectId && !!this.draft.class;
    }

    saveAssignment(): void {
        if (!this.canSave() || !this.draft.teacherId || !this.draft.subjectId || !this.draft.class) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a teacher, subject, and class before saving the assignment.' });
            return;
        }

        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose the school before saving the assignment.' });
            return;
        }

        const payload: CreateTeacherAssignmentRequest = {
            teacherId: this.draft.teacherId,
            subjectId: this.draft.subjectId,
            class: this.draft.class
        };

        this.api.createAssignment(payload, this.selectedSchoolId).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Assignment saved', detail: `${this.draft.teacherName} mapped to ${this.draft.subjectName} in ${this.draft.class}.` });
                this.draft = { teacherId: null, teacherName: '', subjectId: null, subjectName: '', class: '' };
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The assignment could not be saved.') });
            }
        });
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
