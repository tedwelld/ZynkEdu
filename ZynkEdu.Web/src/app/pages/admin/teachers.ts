import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardResponse, SchoolResponse, SubjectResponse, TeacherPerformanceDto, UserResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

const TEACHER_CLASS_OPTIONS = [
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

@Component({
    standalone: true,
    selector: 'app-admin-teachers',
    imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teachers</p>
                    <h1 class="text-3xl font-display font-bold m-0">Teacher management with performance context</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Create, edit, and review teachers with live school performance snapshots.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <button pButton type="button" label="Add Teacher" icon="pi pi-plus" (click)="openCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Teachers" [value]="teacherCount" delta="Active roster" hint="School wide" icon="pi pi-id-card" tone="blue"></app-metric-card>
                <app-metric-card label="Top performers" [value]="topCount" delta="Above target" hint="Dashboard ranking" icon="pi pi-trophy" tone="green"></app-metric-card>
                <app-metric-card label="Watchlist" [value]="watchCount" delta="Needs support" hint="Declining classes" icon="pi pi-exclamation-circle" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Coverage" [value]="coverageText" delta="Assignments linked" hint="Teaching load" icon="pi pi-sitemap" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Search</label>
                        <input pInputText [(ngModel)]="searchTerm" class="w-full" placeholder="Teacher name or username" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <input pInputText [(ngModel)]="statusFilter" class="w-full" placeholder="All / Active / Inactive" />
                    </div>
                    <div class="flex items-end">
                        <button pButton type="button" label="Clear filters" severity="secondary" class="w-full" (click)="clearFilters()"></button>
                    </div>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Teacher directory</h2>
                        <p class="text-sm text-muted-color">Click edit to open a compact side drawer.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ filteredTeachers.length }} visible</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="filteredTeachers" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Teacher</th>
                            <th>School</th>
                            <th>Status</th>
                            <th>Performance</th>
                            <th>Created</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-teacher>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ teacher.displayName }}</div>
                                <div class="text-xs text-muted-color">{{ teacher.username }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ schoolNameFor(teacher.schoolId) }}</td>
                            <td>
                                <p-tag [value]="teacher.isActive ? 'Active' : 'Inactive'" [severity]="teacher.isActive ? 'success' : 'danger'"></p-tag>
                            </td>
                            <td>
                                <p-tag [value]="performanceFor(teacher.id).label" [severity]="performanceFor(teacher.id).severity"></p-tag>
                            </td>
                            <td class="text-sm text-muted-color">{{ teacher.createdAt | date: 'mediumDate' }}</td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEdit(teacher)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteTeacher(teacher)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="drawerMode === 'create' ? 'Add teacher' : 'Edit teacher'" appendTo="body">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Username</label>
                        <input pInputText [(ngModel)]="draft.username" class="w-full" [disabled]="drawerMode === 'edit'" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Display name</label>
                        <input pInputText [(ngModel)]="draft.displayName" class="w-full" />
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown
                            [options]="schoolOptions"
                            [(ngModel)]="draft.schoolId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            [disabled]="!isPlatformAdmin"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search schools"
                        ></app-dropdown>
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Subject</label>
                        <app-dropdown [options]="subjectOptions" [(ngModel)]="draft.subjectId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search subjects"></app-dropdown>
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="draft.class" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes"></app-dropdown>
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Password</label>
                        <input pInputText [(ngModel)]="draft.password" class="w-full" type="password" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <div class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 px-3 py-3">
                            <p-checkbox [(ngModel)]="draft.isActive" binary inputId="teacher-active"></p-checkbox>
                            <label for="teacher-active" class="text-sm font-medium">{{ draft.isActive ? 'Active' : 'Inactive' }}</label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                        <button pButton type="button" [label]="drawerMode === 'create' ? 'Save teacher' : 'Update teacher'" icon="pi pi-check" (click)="saveTeacher()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminTeachers implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    teachers: UserResponse[] = [];
    dashboard: DashboardResponse | null = null;
    schools: SchoolResponse[] = [];
    subjects: SubjectResponse[] = [];
    selectedSchoolId: number | null = null;
    searchTerm = '';
    statusFilter = '';
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    skeletonRows = Array.from({ length: 5 });
    draft: { id?: number; username: string; displayName: string; password: string; isActive: boolean; schoolId: number | null; subjectId: number | null; class: string } = {
        username: '',
        displayName: '',
        password: '',
        isActive: true,
        schoolId: null,
        subjectId: null,
        class: ''
    };

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
                        this.messages.add({ severity: 'warn', summary: 'No school selected', detail: 'Choose a school before loading teachers.' });
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
            dashboard: this.api.getAdminDashboard(schoolId),
            schools: this.api.getSchools(),
            subjects: this.api.getSubjects(schoolId)
        }).subscribe({
            next: ({ teachers, dashboard, schools, subjects }) => {
                this.teachers = teachers;
                this.dashboard = dashboard;
                this.schools = this.isPlatformAdmin ? schools : schools.filter((school) => school.id === this.auth.schoolId());
                this.subjects = subjects;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get filteredTeachers(): UserResponse[] {
        return this.teachers.filter((teacher) => {
            const matchesSearch = `${teacher.displayName} ${teacher.username}`.toLowerCase().includes(this.searchTerm.trim().toLowerCase());
            const matchesStatus = !this.statusFilter.trim() || (teacher.isActive ? 'active' : 'inactive').includes(this.statusFilter.trim().toLowerCase());
            return matchesSearch && matchesStatus;
        });
    }

    get teacherCount(): string {
        return this.teachers.length.toString();
    }

    get topCount(): string {
        return this.performanceRows('success').toString();
    }

    get watchCount(): string {
        return this.performanceRows('danger').toString();
    }

    get coverageText(): string {
        const assignments = this.dashboard?.teacherPerformance.length ?? 0;
        return `${assignments} active`;
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select school', value: null },
            ...this.schools.map((school) => ({ label: school.name, value: school.id }))
        ];
    }

    get subjectOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select subject', value: null },
            ...this.subjects.map((subject) => ({ label: subject.name, value: subject.id }))
        ];
    }

    get classOptions(): { label: string; value: string }[] {
        return TEACHER_CLASS_OPTIONS.map((value) => ({ label: value, value }));
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    performanceFor(id: number): { label: string; severity: 'success' | 'warning' | 'danger' } {
        const row = this.dashboard?.teacherPerformance.find((item) => item.teacherId === id);
        if (!row) {
            return { label: 'Review', severity: 'warning' };
        }

        if (row.averageScore >= 75) {
            return { label: `${row.averageScore.toFixed(1)}%`, severity: 'success' };
        }

        if (row.averageScore >= 60) {
            return { label: `${row.averageScore.toFixed(1)}%`, severity: 'warning' };
        }

        return { label: `${row.averageScore.toFixed(1)}%`, severity: 'danger' };
    }

    openCreate(): void {
        this.drawerMode = 'create';
            this.draft = {
                username: '',
                displayName: '',
                password: '',
                isActive: true,
                schoolId: this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId(),
                subjectId: this.subjects[0]?.id ?? null,
                class: this.classOptions[0]?.value ?? ''
            };
        this.drawerVisible = true;
    }

    openEdit(teacher: UserResponse): void {
        this.drawerMode = 'edit';
        this.draft = {
            id: teacher.id,
            username: teacher.username,
            displayName: teacher.displayName,
            password: '',
            isActive: teacher.isActive,
            schoolId: teacher.schoolId,
            subjectId: null,
            class: ''
        };
        this.drawerVisible = true;
    }

    saveTeacher(): void {
        if (this.drawerMode === 'create') {
            if (!this.draft.schoolId || !this.draft.subjectId || !this.draft.class.trim() || !this.draft.username.trim() || !this.draft.displayName.trim() || !this.draft.password.trim()) {
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a school, subject, and class before saving the teacher.' });
                return;
            }

            if (this.draft.username.trim().length < 3) {
                this.messages.add({ severity: 'warn', summary: 'Username required', detail: 'Teacher usernames must be at least 3 characters long.' });
                return;
            }

            if (this.draft.displayName.trim().length < 2) {
                this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Teacher display names must be at least 2 characters long.' });
                return;
            }

            if (this.draft.password.trim().length < 8) {
                this.messages.add({ severity: 'warn', summary: 'Password required', detail: 'Teacher passwords must be at least 8 characters long.' });
                return;
            }

            this.api.createTeacherWithAssignment({
                username: this.draft.username,
                displayName: this.draft.displayName,
                password: this.draft.password,
                subjectId: this.draft.subjectId,
                class: this.draft.class.trim()
            }, this.draft.schoolId ?? undefined).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Teacher created', detail: `${this.draft.displayName} added with an assignment.` });
                    this.drawerVisible = false;
                    this.loadData();
                },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The teacher could not be saved.') });
            }
        });
        return;
        }

        if (!this.draft.id) {
            return;
        }

        if (this.draft.displayName.trim().length < 2) {
            this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Teacher display names must be at least 2 characters long.' });
            return;
        }

        if (this.draft.password.trim().length > 0 && this.draft.password.trim().length < 8) {
            this.messages.add({ severity: 'warn', summary: 'Password required', detail: 'Teacher passwords must be at least 8 characters long.' });
            return;
        }

        this.api.updateTeacher(this.draft.id, { displayName: this.draft.displayName, password: this.draft.password || null, isActive: this.draft.isActive }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Teacher updated', detail: `${this.draft.displayName} saved.` });
                this.drawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The teacher could not be updated.') });
            }
        });
    }

    deleteTeacher(teacher: UserResponse): void {
        this.confirmation.confirm({
            message: `Delete ${teacher.displayName}?`,
            header: 'Delete teacher',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteTeacher(teacher.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Teacher removed', detail: `${teacher.displayName} deleted.` });
                        this.loadData();
                    }
                })
        });
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.statusFilter = '';
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        return extractApiErrorMessage(error, fallback);
    }

    private performanceRows(severity: 'success' | 'warning' | 'danger'): number {
        return (this.dashboard?.teacherPerformance ?? []).filter((teacher) => {
            if (severity === 'success') {
                return teacher.averageScore >= 75;
            }

            if (severity === 'warning') {
                return teacher.averageScore >= 60 && teacher.averageScore < 75;
            }

            return teacher.averageScore < 60;
        }).length;
    }
}
