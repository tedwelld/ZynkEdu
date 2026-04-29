import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import {
    BulkStudentSubjectEnrollmentResponse,
    CreateStudentRequest,
    DashboardResponse,
    ResultResponse,
    SchoolResponse,
    StudentResponse,
    SubjectResponse,
    UpdateStudentStatusRequest,
    UpdateStudentRequest
} from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type PerformanceBand = 'Excellent' | 'Stable' | 'At risk';
type StudentDrawerMode = 'view' | 'create' | 'edit';

const LEVEL_CLASS_MAP: Record<string, string[]> = {
    'ZGC Level': ['Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C'],
    "O'Level": ['Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts'],
    "A'Level": ['Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences']
};

const LEVEL_OPTIONS = [
    { label: 'ZGC Level', value: 'ZGC Level' },
    { label: "O'Level", value: "O'Level" },
    { label: "A'Level", value: "A'Level" }
];

const PERFORMANCE_OPTIONS = [
    { label: 'All levels', value: 'All' },
    { label: 'Excellent', value: 'Excellent' },
    { label: 'Stable', value: 'Stable' },
    { label: 'At risk', value: 'At risk' }
];

const STATUS_OPTIONS = [
    { label: 'All statuses', value: 'All' },
    { label: 'Active', value: 'Active' },
    { label: 'Suspended', value: 'Suspended' },
    { label: 'Archived', value: 'Archived' }
];

const ALL_CLASS_LEVELS = [...new Set(Object.values(LEVEL_CLASS_MAP).flat())];

interface StudentDraft {
    schoolId: number | null;
    fullName: string;
    class: string;
    level: string;
    enrollmentYear: number | null;
    subjectIds: number[];
    parentEmail: string;
    parentPhone: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-students',
    imports: [CommonModule, FormsModule, ButtonModule, ChartModule, DialogModule, InputTextModule, MetricCardComponent, MultiSelectModule, ProgressBarModule, AppDropdownComponent, SkeletonModule, TableModule, TagModule, TooltipModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Students</p>
                    <h1 class="text-3xl font-display font-bold m-0">Searchable student workspace</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Instant search, class filters, performance tags, and a profile drawer with results trend and parent contact details.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="loadData()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <ng-container *ngIf="isPlatformAdmin; else schoolBulkAction">
                        <button pButton type="button" label="Enroll selected school" icon="pi pi-users" severity="secondary" [disabled]="!selectedSchoolId || bulkEnrollmentLoading" (click)="confirmEnrollAllSubjects(false)"></button>
                        <button pButton type="button" label="Enroll all schools" icon="pi pi-globe" severity="secondary" [disabled]="bulkEnrollmentLoading" (click)="confirmEnrollAllSubjects(true)"></button>
                    </ng-container>
                    <ng-template #schoolBulkAction>
                        <button pButton type="button" label="Enroll all students" icon="pi pi-users" severity="secondary" [disabled]="bulkEnrollmentLoading" (click)="confirmEnrollAllSubjects(false)"></button>
                    </ng-template>
                    <button pButton type="button" label="Add Student" icon="pi pi-user-plus" (click)="openCreateDrawer()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Roster" [value]="studentCount" delta="Live list" hint="All students" icon="pi pi-users" tone="blue" direction="up"></app-metric-card>
                <app-metric-card label="Excellent" [value]="excellentCount" delta="Top performers" hint="In focus" icon="pi pi-star" tone="green" direction="up"></app-metric-card>
                <app-metric-card label="At Risk" [value]="riskCount" delta="Needs attention" hint="Watchlist" icon="pi pi-exclamation-triangle" tone="red" direction="down"></app-metric-card>
                <app-metric-card label="Classes" [value]="classCount" delta="Distinct groups" hint="School-wide" icon="pi pi-sitemap" tone="purple" direction="up"></app-metric-card>
            </section>

            <div class="workspace-card">
                <div class="grid gap-4 xl:grid-cols-[1.1fr_0.4fr_0.4fr] items-end">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Search</label>
                        <input pInputText [(ngModel)]="searchTerm" placeholder="Student name or number" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes" (opened)="loadData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Performance</label>
                        <app-dropdown [options]="performanceOptions" [(ngModel)]="selectedPerformance" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search performance" (opened)="loadData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <app-dropdown [options]="statusOptions" [(ngModel)]="selectedStatus" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                    </div>
                </div>
            </div>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Student directory</h2>
                        <p class="text-sm text-muted-color">Click a row to open the profile drawer.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ filteredStudents.length }} visible</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="filteredStudents" [rows]="10" [paginator]="true" [rowHover]="true" dataKey="id" styleClass="p-datatable-sm" selectionMode="single" (onRowSelect)="openStudent($event.data)">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Level</th>
                            <th>Status</th>
                            <th>Subjects</th>
                            <th>Performance</th>
                            <th>Parent contact</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-student>
                        <tr [pSelectableRow]="student">
                            <td>
                                <div class="font-semibold">{{ student.fullName }}</div>
                                <div class="text-xs text-muted-color">{{ student.studentNumber }}</div>
                            </td>
                            <td>{{ student.class }}</td>
                            <td>{{ student.level }}</td>
                            <td>
                                <p-tag [value]="student.status" [severity]="statusSeverity(student.status)"></p-tag>
                            </td>
                            <td class="text-sm text-muted-color">{{ student.subjects?.length ? student.subjects.join(', ') : '-' }}</td>
                            <td>
                                <p-tag [value]="bandFor(student.id)" [severity]="bandSeverity(bandFor(student.id))"></p-tag>
                            </td>
                            <td>
                                <div class="text-sm">{{ student.parentEmail }}</div>
                                <div class="text-xs text-muted-color">{{ student.parentPhone }}</div>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-eye" class="p-button-text p-button-sm" (click)="openStudent(student)"></button>
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEditDrawer(student)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="askDelete(student)"></button>
                            </td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr>
                            <td colspan="8">
                                <div class="py-8 text-center text-muted-color">No results yet. Teachers will add soon.</div>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(46rem, 96vw)' }" [header]="drawerHeader" appendTo="body">
                <ng-container *ngIf="drawerMode === 'create' || drawerMode === 'edit'; else viewMode">
                    <div class="space-y-4">
                        <div *ngIf="isPlatformAdmin">
                            <label class="block text-sm font-semibold mb-2">School</label>
                            <app-dropdown
                                [options]="schoolOptions"
                                [(ngModel)]="draft.schoolId"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                appendTo="body"
                                [filter]="true"
                                filterBy="label"
                                filterPlaceholder="Search schools"
                                (ngModelChange)="onSchoolChange($event)"
                            ></app-dropdown>
                        </div>

                        <div *ngIf="!isPlatformAdmin" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                            School fixed to {{ schoolNameFor(draft.schoolId ?? authSchoolId ?? 0) }}.
                        </div>

                        <div>
                            <label class="block text-sm font-semibold mb-2">Full name</label>
                            <input pInputText [(ngModel)]="draft.fullName" class="w-full" />
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-semibold mb-2">Level</label>
                                <app-dropdown [options]="levelOptions" [(ngModel)]="draft.level" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels" (ngModelChange)="onLevelChange($event)"></app-dropdown>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold mb-2">Class</label>
                                <app-dropdown [options]="classOptionsForDraft" [(ngModel)]="draft.class" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes"></app-dropdown>
                            </div>
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-semibold mb-2">Enrollment year</label>
                                <app-dropdown [options]="yearOptions" [(ngModel)]="draft.enrollmentYear" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search years"></app-dropdown>
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
                                ></p-multiSelect>
                            </div>
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-semibold mb-2">Parent email</label>
                                <input pInputText [(ngModel)]="draft.parentEmail" class="w-full" />
                            </div>
                            <div>
                                <label class="block text-sm font-semibold mb-2">Parent phone</label>
                                <input pInputText [(ngModel)]="draft.parentPhone" class="w-full" />
                            </div>
                        </div>

                        <div class="flex justify-end gap-3 pt-3">
                            <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                            <button pButton type="button" [label]="drawerMode === 'create' ? 'Save student' : 'Update student'" icon="pi pi-check" (click)="saveStudent()"></button>
                        </div>
                    </div>
                </ng-container>

                <ng-template #viewMode>
                    <div *ngIf="selectedStudent; else emptyDrawer" class="space-y-6">
                        <div class="workspace-card metric-gradient">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Profile</p>
                                    <h2 class="text-2xl font-display font-bold mb-1">{{ selectedStudent.fullName }}</h2>
                                    <p class="text-muted-color">{{ selectedStudent.studentNumber }} - {{ selectedStudent.class }}</p>
                                </div>
                                <div class="flex gap-2">
                                    <button pButton type="button" icon="pi pi-pencil" label="Edit" class="p-button-sm" (click)="openEditDrawer(selectedStudent)"></button>
                                    <button pButton type="button" icon="pi pi-arrow-up-right" label="Promote" class="p-button-sm p-button-secondary" (click)="promoteSelectedStudent()"></button>
                                    <button pButton type="button" icon="pi pi-times" class="p-button-rounded p-button-text" (click)="drawerVisible = false"></button>
                                </div>
                            </div>

                            <div class="grid gap-3 md:grid-cols-2 mt-4 text-sm">
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">School</div>
                                    <div class="font-semibold">{{ schoolNameFor(selectedStudent.schoolId) }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Level</div>
                                    <div class="font-semibold">{{ selectedStudent.level }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Status</div>
                                    <div class="font-semibold">{{ selectedStudent.status }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Enrollment year</div>
                                    <div class="font-semibold">{{ selectedStudent.enrollmentYear }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Subjects</div>
                                    <div class="font-semibold">{{ selectedStudent.subjects.length ? selectedStudent.subjects.join(', ') : 'None' }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Parent email</div>
                                    <div class="font-semibold">{{ selectedStudent.parentEmail }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Parent phone</div>
                                    <div class="font-semibold">{{ selectedStudent.parentPhone }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="workspace-card">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-display font-bold mb-0">Performance trend</h3>
                                <span class="text-sm text-muted-color">{{ studentResults.length }} results</span>
                            </div>
                            <div class="chart-canvas-wrap">
                                <p-chart type="line" [data]="studentChartData" [options]="studentChartOptions"></p-chart>
                            </div>
                        </div>

                        <div class="workspace-card">
                            <h3 class="font-display font-bold mb-4">Comment timeline</h3>
                            <div class="space-y-3">
                                <div *ngFor="let result of studentResults" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="font-semibold">{{ result.subjectName }}</div>
                                        <p-tag [value]="result.grade" [severity]="result.score >= 75 ? 'success' : result.score >= 60 ? 'warning' : 'danger'"></p-tag>
                                    </div>
                                    <div class="text-sm text-muted-color mt-1">{{ result.term }} - {{ result.comment || 'No comment yet.' }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="workspace-card">
                            <div class="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 class="font-display font-bold mb-1">Lifecycle</h3>
                                    <p class="text-sm text-muted-color">Suspend, archive, or reactivate from the admin desk.</p>
                                </div>
                                <p-tag [value]="selectedStudent.status" [severity]="statusSeverity(selectedStudent.status)"></p-tag>
                            </div>
                            <div class="grid gap-3 md:grid-cols-3">
                                <button pButton type="button" label="Reactivate" icon="pi pi-play" severity="success" [disabled]="selectedStudent.status === 'Active'" (click)="setSelectedStudentStatus('Active')"></button>
                                <button pButton type="button" label="Suspend" icon="pi pi-pause" severity="secondary" [disabled]="selectedStudent.status === 'Suspended'" (click)="setSelectedStudentStatus('Suspended')"></button>
                                <button pButton type="button" label="Archive" icon="pi pi-box" severity="danger" [disabled]="selectedStudent.status === 'Archived'" (click)="setSelectedStudentStatus('Archived')"></button>
                            </div>
                        </div>
                    </div>
                    <ng-template #emptyDrawer>
                        <div class="h-full flex items-center justify-center text-muted-color">Pick a student to view the detailed drawer.</div>
                    </ng-template>
                </ng-template>
            </p-dialog>
        </section>
    `
})
export class AdminStudents implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly confirmation = inject(ConfirmationService);
    private readonly messages = inject(MessageService);

    loading = true;
    students: StudentResponse[] = [];
    dashboard: DashboardResponse | null = null;
    schools: SchoolResponse[] = [];
    subjects: SubjectResponse[] = [];
    selectedSchoolId: number | null = null;
    searchTerm = '';
    selectedClass = 'All';
    selectedPerformance = 'All';
    selectedStatus = 'All';
    drawerVisible = false;
    drawerMode: StudentDrawerMode = 'view';
    selectedStudent: StudentResponse | null = null;
    editStudentId: number | null = null;
    pendingFocusStudentId: number | null = null;
    studentResults: ResultResponse[] = [];
    studentChartData!: ChartData<'line'>;
    studentChartOptions!: ChartOptions<'line'>;
    skeletonRows = Array.from({ length: 5 });
    bulkEnrollmentLoading = false;
    draft: StudentDraft = this.createEmptyDraft();

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get authSchoolId(): number | null {
        return this.auth.schoolId();
    }

    get drawerHeader(): string {
        if (this.drawerMode === 'create') {
            return 'Add student';
        }

        if (this.drawerMode === 'edit') {
            return 'Edit student';
        }

        return 'Student profile';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((school) => ({ label: school.name, value: school.id }));
    }

    get levelOptions(): { label: string; value: string }[] {
        return LEVEL_OPTIONS;
    }

    get performanceOptions(): { label: string; value: string }[] {
        return PERFORMANCE_OPTIONS;
    }

    get statusOptions(): { label: string; value: string }[] {
        return STATUS_OPTIONS;
    }

    get classOptions(): { label: string; value: string }[] {
        const classes = new Set<string>(ALL_CLASS_LEVELS);
        this.students.forEach((student) => classes.add(student.class));

        return [
            { label: 'All classes', value: 'All' },
            ...Array.from(classes).sort().map((value) => ({ label: value, value }))
        ];
    }

    get classOptionsForDraft(): { label: string; value: string }[] {
        const level = this.normalizeLevel(this.draft.level);
        return LEVEL_CLASS_MAP[level].map((value) => ({ label: value, value }));
    }

    get subjectOptions(): { label: string; value: number }[] {
        const schoolId = this.draft.schoolId ?? this.authSchoolId;
        if (schoolId == null) {
            return [];
        }

        return this.subjects
            .filter((subject) => subject.schoolId === schoolId)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((subject) => ({ label: subject.name, value: subject.id }));
    }

    get yearOptions(): { label: string; value: number }[] {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 7 }, (_, index) => {
            const value = currentYear - 2 + index;
            return { label: value.toString(), value };
        });
    }

    get filteredStudents(): StudentResponse[] {
        return this.students.filter((student) => {
            const query = `${student.fullName} ${student.studentNumber} ${student.level} ${student.class} ${student.subjects.join(' ')}`.toLowerCase();
            const matchesSearch = query.includes(this.searchTerm.trim().toLowerCase());
            const matchesClass = this.selectedClass === 'All' || student.class === this.selectedClass;
            const performance = this.bandFor(student.id);
            const matchesPerformance = this.selectedPerformance === 'All' || performance === this.selectedPerformance;
            const matchesStatus = this.selectedStatus === 'All' || student.status === this.selectedStatus;
            return matchesSearch && matchesClass && matchesPerformance && matchesStatus;
        });
    }

    get studentCount(): string {
        return this.students.length.toString();
    }

    get classCount(): string {
        return new Set(this.students.map((student) => student.class)).size.toString();
    }

    get excellentCount(): string {
        return this.students.filter((student) => this.bandFor(student.id) === 'Excellent').length.toString();
    }

    get riskCount(): string {
        return this.students.filter((student) => this.bandFor(student.id) === 'At risk').length.toString();
    }

    ngOnInit(): void {
        this.applyQueryScope();
        this.loadData();
    }

    private applyQueryScope(): void {
        const schoolIdText = this.route.snapshot.queryParamMap.get('schoolId');
        const schoolId = schoolIdText ? Number(schoolIdText) : null;
        if (Number.isFinite(schoolId)) {
            this.selectedSchoolId = schoolId;
        }

        const focusText = this.route.snapshot.queryParamMap.get('focus');
        const focusId = focusText ? Number(focusText) : null;
        if (Number.isFinite(focusId)) {
            this.pendingFocusStudentId = focusId;
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
                        this.messages.add({ severity: 'warn', summary: 'No school selected', detail: 'Choose a school before loading students.' });
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

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.authSchoolId;
        const schoolsSource = this.isPlatformAdmin ? this.api.getPlatformSchools() : this.api.getSchools();

        forkJoin({
            students: this.api.getStudents(undefined, schoolId),
            dashboard: this.api.getAdminDashboard(schoolId),
            schools: schoolsSource,
            subjects: this.api.getSubjects(schoolId)
        }).subscribe({
            next: ({ students, dashboard, schools, subjects }) => {
                this.students = students;
                this.dashboard = dashboard;
                this.schools = schools;
                this.subjects = subjects;
                if (!this.isPlatformAdmin && this.authSchoolId && !this.draft.schoolId) {
                    this.draft.schoolId = this.authSchoolId;
                }
                this.openPendingStudentFocus();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    private openPendingStudentFocus(): void {
        if (!this.pendingFocusStudentId) {
            return;
        }

        const student = this.students.find((entry) => entry.id === this.pendingFocusStudentId);
        this.pendingFocusStudentId = null;
        if (student) {
            this.openStudent(student);
        }
    }

    bandFor(studentId: number): PerformanceBand {
        const excellentIds = new Set(this.dashboard?.topStudents.map((student) => student.studentId));
        const riskIds = new Set(this.dashboard?.bottomStudents.map((student) => student.studentId));

        if (excellentIds.has(studentId)) {
            return 'Excellent';
        }

        if (riskIds.has(studentId)) {
            return 'At risk';
        }

        return 'Stable';
    }

    bandSeverity(band: PerformanceBand): 'success' | 'warning' | 'danger' {
        if (band === 'Excellent') {
            return 'success';
        }

        if (band === 'At risk') {
            return 'danger';
        }

        return 'warning';
    }

    openCreateDrawer(): void {
        this.drawerMode = 'create';
        this.selectedStudent = null;
        this.editStudentId = null;
        this.draft = this.createEmptyDraft(this.isPlatformAdmin ? null : this.authSchoolId);
        this.drawerVisible = true;
    }

    openEditDrawer(student: StudentResponse): void {
        this.drawerMode = 'edit';
        this.selectedStudent = student;
        this.editStudentId = student.id;
        this.draft = {
            schoolId: student.schoolId,
            fullName: student.fullName,
            class: student.class,
            level: this.normalizeLevel(student.level),
            enrollmentYear: student.enrollmentYear,
            subjectIds: [...student.subjectIds],
            parentEmail: student.parentEmail,
            parentPhone: student.parentPhone
        };
        this.drawerVisible = true;
    }

    openStudent(student: StudentResponse | StudentResponse[] | undefined): void {
        if (!student || Array.isArray(student)) {
            return;
        }

        this.drawerMode = 'view';
        this.selectedStudent = student;
        this.editStudentId = null;
        this.drawerVisible = true;
        this.api.getResultsByStudent(student.id).subscribe({
            next: (results) => {
                this.studentResults = results;
                this.buildChart(results);
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.draft.schoolId = schoolId;
        this.draft.subjectIds = [];
        this.loadData();
    }

    onLevelChange(level: string): void {
        const normalized = this.normalizeLevel(level);
        this.draft.level = normalized;
        this.draft.class = '';
    }

    saveStudent(): void {
        const request = this.buildStudentRequest();
        if (!request) {
            return;
        }

        const action =
            this.drawerMode === 'edit' && this.editStudentId
            ? this.api.updateStudent(this.editStudentId, request as UpdateStudentRequest)
                : this.api.createStudent(request as CreateStudentRequest, this.isPlatformAdmin ? this.draft.schoolId : null);

        action.subscribe({
            next: (student) => {
                this.messages.add({
                    severity: 'success',
                    summary: 'Student saved',
                    detail: `${student.fullName} was saved successfully.`
                });
                this.drawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({
                    severity: 'error',
                    summary: 'Save failed',
                    detail: this.readErrorMessage(error, 'The student could not be saved.')
                });
            }
        });
    }

    askDelete(student: StudentResponse): void {
        this.confirmation.confirm({
            message: `Delete ${student.fullName}?`,
            header: 'Remove student',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteStudent(student.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Deleted', detail: `${student.fullName} was removed.` });
                        this.loadData();
                    }
                })
        });
    }

    confirmEnrollAllSubjects(enrollAllSchools: boolean): void {
        const targetSchoolId = this.isPlatformAdmin
            ? enrollAllSchools
                ? null
                : this.selectedSchoolId
            : this.authSchoolId;

        if (!this.isPlatformAdmin && targetSchoolId == null) {
            this.messages.add({ severity: 'warn', summary: 'School required', detail: 'A school scope is required before bulk enrolling subjects.' });
            return;
        }

        if (this.isPlatformAdmin && !enrollAllSchools && targetSchoolId == null) {
            this.messages.add({ severity: 'warn', summary: 'School required', detail: 'Choose a school before bulk enrolling subjects.' });
            return;
        }

        const message = enrollAllSchools
            ? 'Enrol every student in every school into that school\'s registered subjects?'
            : 'Enrol every student in this school into all registered subjects?';

        this.confirmation.confirm({
            message,
            header: 'Bulk subject enrollment',
            icon: 'pi pi-users',
            acceptButtonStyleClass: 'p-button-primary',
            accept: () => this.runEnrollAllSubjects(targetSchoolId)
        });
    }

    private runEnrollAllSubjects(schoolId: number | null): void {
        this.bulkEnrollmentLoading = true;
        this.api.enrollAllStudentsInAllSubjects(schoolId).subscribe({
            next: (result: BulkStudentSubjectEnrollmentResponse) => {
                this.bulkEnrollmentLoading = false;
                this.messages.add({
                    severity: 'success',
                    summary: 'Subjects enrolled',
                    detail: `${result.studentCount} student(s) were enrolled in ${result.subjectCount} subject(s) across ${result.schoolCount} school(s).`
                });
                this.loadData();
            },
            error: (error) => {
                this.bulkEnrollmentLoading = false;
                this.messages.add({
                    severity: 'error',
                    summary: 'Enrollment failed',
                    detail: this.readErrorMessage(error, 'The students could not be enrolled in all subjects.')
                });
            }
        });
    }

    promoteSelectedStudent(): void {
        if (!this.selectedStudent) {
            return;
        }

        const next = this.promoteStudent(this.selectedStudent);
        if (!next) {
            this.messages.add({ severity: 'warn', summary: 'Cannot promote', detail: 'This student is already on the highest available class path.' });
            return;
        }

        this.api.updateStudent(this.selectedStudent.id, next).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Promoted', detail: `${this.selectedStudent?.fullName} moved to the next class.` });
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Promotion failed', detail: this.readErrorMessage(error, 'The student could not be promoted.') });
            }
        });
    }

    setSelectedStudentStatus(status: string): void {
        if (!this.selectedStudent) {
            return;
        }

        const request: UpdateStudentStatusRequest = { status };
        this.api.updateStudentStatus(this.selectedStudent.id, request).subscribe({
            next: (updated) => {
                this.selectedStudent = updated;
                this.students = this.students.map((student) => (student.id === updated.id ? updated : student));
                this.messages.add({ severity: 'success', summary: 'Status updated', detail: `${updated.fullName} is now ${updated.status}.` });
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Status update failed', detail: this.readErrorMessage(error, 'The student status could not be updated.') });
            }
        });
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'secondary' {
        if (status === 'Active') {
            return 'success';
        }

        if (status === 'Suspended') {
            return 'warning';
        }

        if (status === 'Archived') {
            return 'danger';
        }

        return 'secondary';
    }

    private createEmptyDraft(schoolId: number | null = null): StudentDraft {
        return {
            schoolId,
            fullName: '',
            class: '',
            level: '',
            enrollmentYear: new Date().getFullYear(),
            subjectIds: [],
            parentEmail: '',
            parentPhone: ''
        };
    }

    private buildStudentRequest(): CreateStudentRequest | UpdateStudentRequest | null {
        const schoolId = this.isPlatformAdmin ? this.draft.schoolId : this.authSchoolId;
        if (schoolId == null) {
            this.messages.add({ severity: 'warn', summary: 'School required', detail: 'Choose a school before saving the student.' });
            return null;
        }

        const fullName = this.draft.fullName.trim();
        if (fullName.length < 2) {
            this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Enter the student full name.' });
            return null;
        }

        if (!this.draft.level.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Level required', detail: 'Choose a level before saving the student.' });
            return null;
        }

        const level = this.normalizeLevel(this.draft.level);
        const className = this.draft.class.trim();
        if (!LEVEL_CLASS_MAP[level].includes(className)) {
            this.messages.add({ severity: 'warn', summary: 'Class required', detail: 'Choose a class that matches the selected level.' });
            return null;
        }

        if (!this.draft.subjectIds.length) {
            this.messages.add({ severity: 'warn', summary: 'Subjects required', detail: 'Select at least one subject for the student.' });
            return null;
        }

        if (!this.isValidEmail(this.draft.parentEmail.trim())) {
            this.messages.add({ severity: 'warn', summary: 'Email required', detail: 'Enter a valid parent email address.' });
            return null;
        }

        if (this.draft.parentPhone.trim().length < 7) {
            this.messages.add({ severity: 'warn', summary: 'Phone required', detail: 'Enter a parent phone number with at least 7 characters.' });
            return null;
        }

        const enrollmentYear = this.draft.enrollmentYear ?? new Date().getFullYear();

        return {
            fullName,
            class: className,
            level,
            enrollmentYear,
            subjectIds: [...this.draft.subjectIds],
            parentEmail: this.draft.parentEmail.trim(),
            parentPhone: this.draft.parentPhone.trim()
        };
    }

    private normalizeLevel(level: string): string {
        const value = level.trim();
        if (value === 'ZGC' || value === 'ZGC Level') {
            return 'ZGC Level';
        }

        if (value === 'OLevel' || value === "O'Level" || value === 'O Level') {
            return "O'Level";
        }

        if (value === 'ALevel' || value === "A'Level" || value === 'A Level') {
            return "A'Level";
        }

        return value in LEVEL_CLASS_MAP ? value : 'ZGC Level';
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        return extractApiErrorMessage(error, fallback);
    }

    private isValidEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    private buildChart(results: ResultResponse[]): void {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-color-secondary').trim();
        const border = getComputedStyle(document.documentElement).getPropertyValue('--surface-border').trim();

        this.studentChartData = {
            labels: results.map((result) => result.subjectName),
            datasets: [
                {
                    label: 'Score',
                    data: results.map((result) => result.score),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.18)',
                    fill: true,
                    tension: 0.35
                }
            ]
        };

        this.studentChartOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: muted
                    },
                    grid: {
                        color: 'transparent'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: muted
                    },
                    grid: {
                        color: border
                    }
                }
            }
        };
    }

    private promoteStudent(student: StudentResponse): UpdateStudentRequest | null {
        const classSequence = [
            'Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C',
            'Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts',
            'Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences'
        ];
        const index = classSequence.findIndex((value) => value === student.class);
        if (index < 0 || index === classSequence.length - 1) {
            return null;
        }

        const nextClass = classSequence[index + 1];
        const level = nextClass.startsWith('Form 1') || nextClass.startsWith('Form 2')
            ? 'ZGC Level'
            : nextClass.startsWith('Form 3') || nextClass.startsWith('Form 4')
                ? "O'Level"
                : "A'Level";

        return {
            fullName: student.fullName,
            class: nextClass,
            level,
            enrollmentYear: student.enrollmentYear,
            subjectIds: [...student.subjectIds],
            parentEmail: student.parentEmail,
            parentPhone: student.parentPhone
        };
    }
}
