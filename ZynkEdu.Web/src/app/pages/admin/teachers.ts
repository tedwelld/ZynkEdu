import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardResponse, SchoolClassResponse, SchoolResponse, SubjectResponse, TeacherPerformanceDto, UserResponse } from '../../core/api/api.models';
import { normalizeSchoolLevel, SchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-teachers',
    imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, MultiSelectModule, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teachers</p>
                    <h1 class="text-3xl font-display font-bold m-0">Teacher management with performance context</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Create, edit, and review teachers with live school performance snapshots and full class/subject coverage.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="refreshData()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
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
                            (opened)="refreshData()"
                        ></app-dropdown>
                    </div>
                    <div *ngIf="drawerMode === 'create'">
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
                            (onClick)="refreshData()"
                        ></p-multiSelect>
                    </div>
                    <div *ngIf="drawerMode === 'create'">
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
                            (onClick)="refreshData()"
                            (ngModelChange)="onClassesChange($event)"
                        ></p-multiSelect>
                        <div *ngIf="draft.classes.length > 0 && !selectedClassLevel" class="mt-2 text-sm text-red-500">
                            Choose classes from the same level before saving.
                        </div>
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
    private readonly route = inject(ActivatedRoute);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    teachers: UserResponse[] = [];
    dashboard: DashboardResponse | null = null;
    schools: SchoolResponse[] = [];
    subjects: SubjectResponse[] = [];
    classes: SchoolClassResponse[] = [];
    selectedSchoolId: number | null = null;
    pendingFocusTeacherId: number | null = null;
    searchTerm = '';
    statusFilter = '';
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    skeletonRows = Array.from({ length: 5 });
    draft: { id?: number; username: string; displayName: string; password: string; isActive: boolean; schoolId: number | null; subjectIds: number[]; classes: string[] } = {
        username: '',
        displayName: '',
        password: '',
        isActive: true,
        schoolId: null,
        subjectIds: [],
        classes: []
    };

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

        const focusText = this.route.snapshot.queryParamMap.get('focus');
        const focusId = focusText ? Number(focusText) : null;
        if (Number.isFinite(focusId)) {
            this.pendingFocusTeacherId = focusId;
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
            subjects: this.api.getSubjects(schoolId),
            classes: this.api.getClasses(schoolId)
        }).subscribe({
            next: ({ teachers, dashboard, schools, subjects, classes }) => {
                this.teachers = teachers;
                this.dashboard = dashboard;
                this.schools = this.isPlatformAdmin ? schools : schools.filter((school) => school.id === this.auth.schoolId());
                this.subjects = subjects;
                this.classes = classes;
                this.selectedSchoolId = this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId();
                this.draft.schoolId = this.isPlatformAdmin ? this.draft.schoolId ?? this.selectedSchoolId : this.auth.schoolId();
                this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.subjects.some((subject) => subject.id === subjectId));
                this.draft.classes = this.draft.classes.filter((className) => this.classOptions.some((option) => option.value === className));
                if (this.draft.subjectIds.length === 0 && this.subjectOptions[0]?.value !== null) {
                    const firstSubject = this.subjectOptions.find((option) => option.value !== null)?.value;
                    this.draft.subjectIds = firstSubject ? [firstSubject] : [];
                }
                if (this.draft.classes.length === 0 && this.classOptions[0]?.value) {
                    this.draft.classes = [this.classOptions[0].value];
                }
                this.onClassesChange(this.draft.classes);
                this.openPendingTeacherFocus();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    private openPendingTeacherFocus(): void {
        if (!this.pendingFocusTeacherId) {
            return;
        }

        const teacher = this.teachers.find((entry) => entry.id === this.pendingFocusTeacherId);
        this.pendingFocusTeacherId = null;
        if (teacher) {
            this.openEdit(teacher);
        }
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
        const allowedSubjectIds = this.allowedSubjectIdsForClasses(this.draft.classes);
        if (this.draft.classes.length > 0 && allowedSubjectIds.size === 0) {
            return [];
        }

        return [
            { label: 'Select subject', value: null },
            ...this.subjects
                .filter((subject) => allowedSubjectIds.size === 0 || allowedSubjectIds.has(subject.id))
                .map((subject) => ({ label: `${subject.name} (${normalizeSchoolLevel(subject.gradeLevel)})`, value: subject.id }))
        ];
    }

    get classOptions(): { label: string; value: string }[] {
        return this.classes.map((item) => {
            const readiness = item.isReadyForTeaching ? 'Ready' : 'Setup needed';
            return { label: `${item.className} (${item.subjectNames.length} subjects) · ${readiness} · ${normalizeSchoolLevel(item.gradeLevel)}`, value: item.className };
        });
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

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    refreshData(): void {
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
        const firstSubjectId = this.subjects[0]?.id ?? null;
        const firstClass = this.classOptions[0]?.value ?? '';
        this.draft = {
            username: '',
            displayName: '',
            password: '',
            isActive: true,
            schoolId: this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId(),
            subjectIds: firstSubjectId ? [firstSubjectId] : [],
            classes: firstClass ? [firstClass] : []
        };
        this.onClassesChange(this.draft.classes);
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
            subjectIds: [],
            classes: []
        };
        this.drawerVisible = true;
    }

    saveTeacher(): void {
        if (this.drawerMode === 'create') {
            if (!this.draft.schoolId || this.draft.subjectIds.length === 0 || this.draft.classes.length === 0 || !this.selectedClassLevel || !this.draft.username.trim() || !this.draft.displayName.trim() || !this.draft.password.trim()) {
                const detail = this.draft.classes.length > 0 && !this.selectedClassLevel
                    ? 'Choose classes from the same level before saving the teacher.'
                    : 'Choose a school, subject(s), and class(es) before saving the teacher.';
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail });
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
                subjectIds: [...new Set(this.draft.subjectIds)],
                classes: [...new Set(this.draft.classes.map((value) => value.trim()).filter(Boolean))]
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

    onClassesChange(classes: string[]): void {
        this.draft.classes = classes;
        const allowedSubjectIds = this.allowedSubjectIdsForClasses(classes);
        if (allowedSubjectIds.size === 0) {
            this.draft.subjectIds = [];
            return;
        }

        this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => allowedSubjectIds.has(subjectId));
        if (this.draft.subjectIds.length === 0) {
            const firstSubjectId = this.subjectOptions.find((option) => option.value !== null)?.value ?? null;
            this.draft.subjectIds = firstSubjectId ? [firstSubjectId] : [];
        }
    }

    private allowedSubjectIdsForClasses(classNames: string[]): Set<number> {
        const selectedClasses = classNames
            .map((className) => this.classes.find((entry) => entry.className === className))
            .filter((entry): entry is SchoolClassResponse => !!entry);

        if (selectedClasses.length === 0) {
            return new Set<number>();
        }

        const distinctLevels = Array.from(new Set(selectedClasses.map((entry) => normalizeSchoolLevel(entry.gradeLevel))));
        if (distinctLevels.length > 1) {
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
