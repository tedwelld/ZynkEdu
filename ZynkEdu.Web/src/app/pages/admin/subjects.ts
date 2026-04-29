import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    DashboardResponse,
    ImportSubjectsResultResponse,
    PlatformSubjectCatalogResponse,
    SchoolResponse,
    SubjectResponse
} from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { SCHOOL_LEVEL_OPTIONS, SchoolLevel, normalizeSchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type SubjectViewMode = 'school' | 'catalog';
type CatalogDialogMode = 'create' | 'edit';
type ImportTargetMode = 'catalog' | 'school';

@Component({
    standalone: true,
    selector: 'app-admin-subjects',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, MultiSelectModule, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="space-y-2">
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Subjects</p>
                    <h1 class="text-3xl font-display font-bold m-0">
                        {{ isPlatformAdmin && viewMode === 'catalog' ? 'Platform subject catalog' : 'Subject library with performance context' }}
                    </h1>
                    <p class="text-muted-color max-w-2xl">
                        {{ isPlatformAdmin && viewMode === 'catalog'
                            ? 'Maintain a shared subject source and publish it into any school without changing routes.'
                            : 'Keep subjects tidy and see how they compare against current averages in the dashboard.' }}
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown [options]="levelOptions" [(ngModel)]="selectedLevelFilter" optionLabel="label" optionValue="value" class="w-48" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels"></app-dropdown>

                    <app-dropdown
                        *ngIf="isPlatformAdmin"
                        [options]="schoolOptions"
                        [(ngModel)]="selectedSchoolId"
                        optionLabel="label"
                        optionValue="value"
                        class="w-64"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        filterPlaceholder="Search schools"
                        (opened)="loadData()"
                        (ngModelChange)="onSchoolChange($event)"
                    ></app-dropdown>

                    <div *ngIf="isPlatformAdmin" class="flex rounded-2xl bg-surface-100 dark:bg-surface-900 p-1">
                        <button
                            type="button"
                            class="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                            [ngClass]="viewMode === 'school' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                            (click)="switchView('school')"
                        >
                            School subjects
                        </button>
                        <button
                            type="button"
                            class="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                            [ngClass]="viewMode === 'catalog' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                            (click)="switchView('catalog')"
                        >
                            Platform catalog
                        </button>
                    </div>

                    <button pButton type="button" [label]="addButtonLabel" icon="pi pi-plus" (click)="openCreate()"></button>

                    <button
                        *ngIf="isPlatformAdmin && viewMode === 'catalog'"
                        pButton
                        type="button"
                        label="Import subjects"
                        icon="pi pi-upload"
                        severity="secondary"
                        (click)="openImportDialog()"
                    ></button>

                    <button
                        *ngIf="isPlatformAdmin && viewMode === 'catalog'"
                        pButton
                        type="button"
                        label="Add all to school"
                        icon="pi pi-clone"
                        severity="secondary"
                        (click)="publishAllCatalogSubjectsToSelectedSchool()"
                    ></button>

                    <button
                        *ngIf="isPlatformAdmin && viewMode === 'catalog'"
                        pButton
                        type="button"
                        label="Add all to all schools"
                        icon="pi pi-sitemap"
                        severity="secondary"
                        (click)="publishAllCatalogSubjectsToAllSchools()"
                    ></button>

                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section *ngIf="viewMode === 'school' || !isPlatformAdmin" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Subjects" [value]="subjectCount" delta="Subject set" hint="Live records" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Strong" [value]="strongCount" delta="Above target" hint="75%+" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Watch" [value]="watchCount" delta="Below target" hint="Under 65%" icon="pi pi-exclamation-triangle" tone="orange"></app-metric-card>
                <app-metric-card label="Coverage" [value]="coverageText" delta="Tracked subjects" hint="With averages" icon="pi pi-chart-bar" tone="purple"></app-metric-card>
            </section>

            <section *ngIf="isPlatformAdmin && viewMode === 'catalog'" class="grid gap-4 md:grid-cols-3">
                <app-metric-card label="Catalog" [value]="catalogCount" delta="Shared subjects" hint="Platform-owned" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Sources" [value]="catalogSourceCount" delta="Schools imported from" hint="Origin schools" icon="pi pi-building" tone="green"></app-metric-card>
                <app-metric-card label="Levels" [value]="catalogLevelCount" delta="Tracked levels" hint="Grade bands" icon="pi pi-tag" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">{{ viewMode === 'catalog' && isPlatformAdmin ? 'Platform catalog' : 'Subjects' }}</h2>
                        <p class="text-sm text-muted-color">
                            {{ viewMode === 'catalog' && isPlatformAdmin ? 'Subject templates available for import into any school.' : 'Each row aligns with the latest subject performance.' }}
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <input pInputText [(ngModel)]="searchTerm" class="w-72 max-w-full" placeholder="Search subjects" />
                        <span class="text-sm text-muted-color">{{ visibleSubjectCount }} visible</span>
                    </div>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <ng-container *ngIf="!loading && (viewMode === 'school' || !isPlatformAdmin)">
                    <p-table [value]="filteredSubjects" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Code</th>
                                <th>Subject</th>
                                <th>Grade level</th>
                                <th>Weekly load</th>
                                <th>Average</th>
                                <th>Band</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-subject>
                            <tr>
                                <td class="font-semibold">{{ subject.code }}</td>
                                <td class="font-semibold">{{ subject.name }}</td>
                                <td><p-tag [value]="levelLabelFor(subject.gradeLevel)" [severity]="severityForLevel(subject.gradeLevel)"></p-tag></td>
                                <td>{{ subject.weeklyLoad }}</td>
                                <td>{{ averageFor(subject.name) }}%</td>
                                <td>
                                    <p-tag [value]="bandFor(subject.name)" [severity]="severityFor(subject.name)"></p-tag>
                                </td>
                                <td class="text-right">
                                    <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEditSchoolSubject(subject)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteSchoolSubject(subject)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </ng-container>

                <ng-container *ngIf="!loading && isPlatformAdmin && viewMode === 'catalog'">
                    <p-table [value]="filteredCatalogSubjects" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Code</th>
                                <th>Subject</th>
                                <th>Grade level</th>
                                <th>Weekly load</th>
                                <th>Source school</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-subject>
                            <tr>
                                <td class="font-semibold">{{ subject.code }}</td>
                                <td class="font-semibold">{{ subject.name }}</td>
                                <td><p-tag [value]="levelLabelFor(subject.gradeLevel)" [severity]="severityForLevel(subject.gradeLevel)"></p-tag></td>
                                <td>{{ subject.weeklyLoad }}</td>
                                <td class="text-sm text-muted-color">
                                    {{ subject.sourceSchoolName ?? (subject.sourceSchoolId ? schoolNameFor(subject.sourceSchoolId) : 'Manual catalog entry') }}
                                </td>
                                <td class="text-right">
                                    <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEditCatalogSubject(subject)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteCatalogSubject(subject)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </ng-container>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="drawerMode === 'create' ? 'Add subject' : 'Edit subject'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="isPlatformAdmin" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        {{ schoolNameFor(draft.schoolId ?? 0) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject code</label>
                        <input pInputText [(ngModel)]="draft.code" class="w-full" placeholder="Auto generated if left blank" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject name</label>
                        <input pInputText [(ngModel)]="draft.name" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Grade level</label>
                        <app-dropdown [options]="levelOptionsForEdit" [(ngModel)]="draft.gradeLevel" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Weekly load</label>
                        <input pInputText type="number" min="1" max="9" [(ngModel)]="draft.weeklyLoad" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                        <button pButton type="button" [label]="drawerMode === 'create' ? 'Save subject' : 'Update subject'" icon="pi pi-check" (click)="saveSchoolSubject()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="catalogDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="catalogDrawerMode === 'create' ? 'Add catalog subject' : 'Edit catalog subject'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="catalogDraft.sourceSchoolId" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        Imported from {{ schoolNameFor(catalogDraft.sourceSchoolId) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject code</label>
                        <input pInputText [(ngModel)]="catalogDraft.code" class="w-full" placeholder="Auto generated if left blank" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject name</label>
                        <input pInputText [(ngModel)]="catalogDraft.name" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Grade level</label>
                        <app-dropdown [options]="levelOptionsForEdit" [(ngModel)]="catalogDraft.gradeLevel" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Weekly load</label>
                        <input pInputText type="number" min="1" max="9" [(ngModel)]="catalogDraft.weeklyLoad" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="catalogDrawerVisible = false"></button>
                        <button pButton type="button" [label]="catalogDrawerMode === 'create' ? 'Save catalog subject' : 'Update catalog subject'" icon="pi pi-check" (click)="saveCatalogSubject()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="importDialogVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(52rem, 96vw)' }" header="Import subjects" appendTo="body">
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Source school</label>
                            <app-dropdown
                                [options]="schoolOptions"
                                [(ngModel)]="importSourceSchoolId"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                appendTo="body"
                                [filter]="true"
                                filterBy="label"
                                filterPlaceholder="Search schools"
                                (ngModelChange)="onImportSourceSchoolChange($event)"
                            ></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Import target</label>
                            <div class="flex rounded-2xl bg-surface-100 dark:bg-surface-900 p-1">
                                <button
                                    type="button"
                                    class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                                    [ngClass]="importTargetMode === 'catalog' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                                    (click)="importTargetMode = 'catalog'"
                                >
                                    Catalog
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                                    [ngClass]="importTargetMode === 'school' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                                    (click)="importTargetMode = 'school'"
                                >
                                    School
                                </button>
                            </div>
                        </div>
                    </div>

                    <div *ngIf="importTargetMode === 'school'" class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Target school</label>
                            <app-dropdown
                                [options]="schoolOptions"
                                [(ngModel)]="importTargetSchoolId"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                appendTo="body"
                                [filter]="true"
                                filterBy="label"
                                filterPlaceholder="Search schools"
                            ></app-dropdown>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                            Duplicate subjects are skipped automatically. Imported subjects keep their grade level.
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Subjects from source school</label>
                        <p-multiSelect
                            [options]="importSourceSubjectOptions"
                            [(ngModel)]="importSelectedSubjectIds"
                            optionLabel="label"
                            optionValue="value"
                            [showToggleAll]="true"
                            [filter]="true"
                            filterBy="label"
                            defaultLabel="Choose subjects"
                            selectedItemsLabel="{0} selected"
                            display="chip"
                            styleClass="w-full"
                            appendTo="body"
                        >
                        </p-multiSelect>
                    </div>

                    <div class="flex justify-end gap-3 pt-2">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="importDialogVisible = false"></button>
                        <button pButton type="button" label="Import subjects" icon="pi pi-upload" [loading]="importLoading" [disabled]="importLoading" (click)="importSelectedSubjects()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminSubjects implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly confirmation = inject(ConfirmationService);
    private readonly messages = inject(MessageService);

    loading = true;
    viewMode: SubjectViewMode = 'school';
    subjects: SubjectResponse[] = [];
    catalogSubjects: PlatformSubjectCatalogResponse[] = [];
    dashboard: DashboardResponse | null = null;
    schools: SchoolResponse[] = [];
    searchTerm = '';
    selectedLevelFilter: SchoolLevel = 'General';
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    pendingFocusSubjectId: number | null = null;
    pendingCreateSubject = false;
    draft: { id?: number; schoolId: number | null; code: string; name: string; gradeLevel: string; weeklyLoad: number } = { schoolId: null, code: '', name: '', gradeLevel: 'General', weeklyLoad: 1 };

    catalogDrawerVisible = false;
    catalogDrawerMode: CatalogDialogMode = 'create';
    catalogDraft: { id?: number; code: string; name: string; gradeLevel: string; weeklyLoad: number; sourceSchoolId?: number | null } = {
        code: '',
        name: '',
        gradeLevel: 'General',
        weeklyLoad: 1,
        sourceSchoolId: null
    };

    importDialogVisible = false;
    importTargetMode: ImportTargetMode = 'catalog';
    importSourceSchoolId: number | null = null;
    importTargetSchoolId: number | null = null;
    importSelectedSubjectIds: number[] = [];
    importSourceSubjects: SubjectResponse[] = [];
    importLoading = false;

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get addButtonLabel(): string {
        if (this.isPlatformAdmin && this.viewMode === 'catalog') {
            return 'Add catalog subject';
        }

        return 'Add Subject';
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

        const focusText = this.route.snapshot.queryParamMap.get('focus');
        const focusId = focusText ? Number(focusText) : null;
        if (Number.isFinite(focusId)) {
            this.pendingFocusSubjectId = focusId;
        }

        const createFlag = this.route.snapshot.queryParamMap.get('create');
        this.pendingCreateSubject = createFlag === '1' || createFlag?.toLowerCase() === 'true';
    }

    loadData(): void {
        this.loading = true;

        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.api.getSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    this.selectedSchoolId = schools[0]?.id ?? null;
                    this.importTargetSchoolId = this.selectedSchoolId;

                    if (!this.selectedSchoolId) {
                        this.loading = false;
                        this.messages.add({ severity: 'warn', summary: 'No school selected', detail: 'Choose a school before loading subjects.' });
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

        if (this.isPlatformAdmin && this.viewMode === 'catalog') {
            forkJoin({
                catalogSubjects: this.api.getPlatformSubjectCatalog(),
                schools: this.api.getSchools()
            }).subscribe({
                next: ({ catalogSubjects, schools }) => {
                    this.catalogSubjects = catalogSubjects;
                    this.schools = schools;
                    this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
                    if (!this.importDialogVisible) {
                        this.importTargetSchoolId = this.importTargetSchoolId ?? this.selectedSchoolId;
                    }
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                }
            });
            return;
        }

        forkJoin({
            subjects: this.api.getSubjects(this.selectedSchoolId),
            dashboard: this.api.getAdminDashboard(this.selectedSchoolId),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ subjects, dashboard, schools }) => {
                this.subjects = subjects;
                this.dashboard = dashboard;
                this.schools = schools;
                this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
                if (!this.importDialogVisible) {
                    this.importTargetSchoolId = this.importTargetSchoolId ?? this.selectedSchoolId;
                }
                this.openPendingCreateSubject();
                this.openPendingSubjectFocus();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    switchView(mode: SubjectViewMode): void {
        if (!this.isPlatformAdmin) {
            return;
        }

        this.viewMode = mode;
        this.loadData();
    }

    private openPendingSubjectFocus(): void {
        if (!this.pendingFocusSubjectId) {
            return;
        }

        const subject = this.subjects.find((entry) => entry.id === this.pendingFocusSubjectId);
        this.pendingFocusSubjectId = null;
        if (subject) {
            this.openEditSchoolSubject(subject);
        }
    }

    private openPendingCreateSubject(): void {
        if (!this.pendingCreateSubject) {
            return;
        }

        this.pendingCreateSubject = false;
        this.openCreateSchoolSubject();
    }

    get filteredSubjects(): SubjectResponse[] {
        const query = this.searchTerm.trim().toLowerCase();
        const selectedLevel = normalizeSchoolLevel(this.selectedLevelFilter);
        return this.subjects.filter((subject) => {
            const matchesSearch = !query || `${subject.code} ${subject.name} ${subject.gradeLevel}`.toLowerCase().includes(query);
            const matchesSchool = !this.isPlatformAdmin || !this.selectedSchoolId || subject.schoolId === this.selectedSchoolId;
            const matchesLevel = selectedLevel === 'General' || normalizeSchoolLevel(subject.gradeLevel) === selectedLevel;
            return matchesSearch && matchesSchool && matchesLevel;
        });
    }

    get filteredCatalogSubjects(): PlatformSubjectCatalogResponse[] {
        const query = this.searchTerm.trim().toLowerCase();
        const selectedLevel = normalizeSchoolLevel(this.selectedLevelFilter);
        return this.catalogSubjects.filter((subject) => {
            const matchesSearch = !query || `${subject.code} ${subject.name} ${subject.gradeLevel} ${subject.sourceSchoolName ?? ''}`.toLowerCase().includes(query);
            const matchesLevel = selectedLevel === 'General' || normalizeSchoolLevel(subject.gradeLevel) === selectedLevel;
            return matchesSearch && matchesLevel;
        });
    }

    get visibleSubjectCount(): number {
        return this.viewMode === 'catalog' && this.isPlatformAdmin ? this.filteredCatalogSubjects.length : this.filteredSubjects.length;
    }

    get levelOptions(): { label: string; value: SchoolLevel }[] {
        return SCHOOL_LEVEL_OPTIONS;
    }

    get levelOptionsForEdit(): { label: string; value: SchoolLevel }[] {
        return [
            { label: 'General', value: 'General' },
            { label: 'ZGC Level', value: 'ZGC Level' },
            { label: "O'Level", value: "O'Level" },
            { label: "A'Level", value: "A'Level" }
        ];
    }

    get subjectCount(): string {
        return this.subjects.length.toString();
    }

    get catalogCount(): string {
        return this.catalogSubjects.length.toString();
    }

    get catalogSourceCount(): string {
        return new Set(this.catalogSubjects.filter((subject) => subject.sourceSchoolId).map((subject) => subject.sourceSchoolId)).size.toString();
    }

    get catalogLevelCount(): string {
        return new Set(this.catalogSubjects.map((subject) => normalizeSchoolLevel(subject.gradeLevel))).size.toString();
    }

    get strongCount(): string {
        return (this.dashboard?.subjectPerformance.filter((subject) => subject.averageScore >= 75).length ?? 0).toString();
    }

    get watchCount(): string {
        return (this.dashboard?.subjectPerformance.filter((subject) => subject.averageScore < 65).length ?? 0).toString();
    }

    get coverageText(): string {
        return `${this.dashboard?.subjectPerformance.length ?? 0} tracked`;
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get importSourceSubjectOptions(): { label: string; value: number }[] {
        return this.importSourceSubjects.map((subject) => ({
            label: `${subject.name} (${subject.code || 'auto'}) · ${normalizeSchoolLevel(subject.gradeLevel)}`,
            value: subject.id
        }));
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    averageFor(name: string): number {
        return this.dashboard?.subjectPerformance.find((subject) => subject.subject === name)?.averageScore ?? 0;
    }

    bandFor(name: string): string {
        const score = this.averageFor(name);
        if (score >= 75) {
            return 'Strong';
        }

        if (score >= 65) {
            return 'Stable';
        }

        return 'Watch';
    }

    severityFor(name: string): 'success' | 'warning' | 'danger' {
        const score = this.averageFor(name);
        if (score >= 75) {
            return 'success';
        }

        if (score >= 65) {
            return 'warning';
        }

        return 'danger';
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

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.importTargetSchoolId = this.importTargetSchoolId ?? schoolId;

        if (this.viewMode === 'school') {
            this.loadData();
            return;
        }

        if (this.importTargetMode === 'school') {
            this.importTargetSchoolId = schoolId;
        }
    }

    openCreate(): void {
        if (this.isPlatformAdmin && this.viewMode === 'catalog') {
            this.openCreateCatalogSubject();
            return;
        }

        this.openCreateSchoolSubject();
    }

    openCreateSchoolSubject(): void {
        this.drawerMode = 'create';
        this.draft = {
            schoolId: this.isPlatformAdmin ? null : this.auth.schoolId(),
            code: '',
            name: '',
            gradeLevel: '' as SchoolLevel,
            weeklyLoad: 1
        };
        this.drawerVisible = true;
    }

    openEditSchoolSubject(subject: SubjectResponse): void {
        this.drawerMode = 'edit';
        this.draft = { id: subject.id, schoolId: subject.schoolId, code: subject.code, name: subject.name, gradeLevel: normalizeSchoolLevel(subject.gradeLevel), weeklyLoad: subject.weeklyLoad };
        this.drawerVisible = true;
    }

    openCreateCatalogSubject(): void {
        this.catalogDrawerMode = 'create';
        this.catalogDraft = {
            code: '',
            name: '',
            gradeLevel: '' as SchoolLevel,
            weeklyLoad: 1,
            sourceSchoolId: null
        };
        this.catalogDrawerVisible = true;
    }

    openEditCatalogSubject(subject: PlatformSubjectCatalogResponse): void {
        this.catalogDrawerMode = 'edit';
        this.catalogDraft = {
            id: subject.id,
            code: subject.code,
            name: subject.name,
            gradeLevel: normalizeSchoolLevel(subject.gradeLevel),
            weeklyLoad: subject.weeklyLoad,
            sourceSchoolId: subject.sourceSchoolId ?? null
        };
        this.catalogDrawerVisible = true;
    }

    saveSchoolSubject(): void {
        if (this.drawerMode === 'create') {
            if (this.isPlatformAdmin && !this.draft.schoolId) {
                this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose the school before saving the subject.' });
                return;
            }

            if (!this.draft.gradeLevel) {
                this.messages.add({ severity: 'warn', summary: 'Missing level', detail: 'Choose a level before saving the subject.' });
                return;
            }

            this.api.createSubject({ name: this.draft.name, code: this.draft.code || null, gradeLevel: this.draft.gradeLevel || null, weeklyLoad: this.draft.weeklyLoad || 1 }, this.draft.schoolId).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Subject saved', detail: `${this.draft.name} added.` });
                    this.drawerVisible = false;
                    this.loadData();
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The subject could not be saved.') });
                }
            });
            return;
        }

        if (!this.draft.id) {
            return;
        }

        this.api.updateSubject(this.draft.id, { name: this.draft.name, code: this.draft.code || null, gradeLevel: this.draft.gradeLevel || null, weeklyLoad: this.draft.weeklyLoad || 1 }, this.draft.schoolId).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Subject updated', detail: `${this.draft.name} saved.` });
                this.drawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The subject could not be updated.') });
            }
        });
    }

    saveCatalogSubject(): void {
        if (this.catalogDrawerMode === 'create') {
            if (!this.catalogDraft.gradeLevel) {
                this.messages.add({ severity: 'warn', summary: 'Missing level', detail: 'Choose a level before saving the catalog subject.' });
                return;
            }

            this.api.createPlatformSubjectCatalog({ name: this.catalogDraft.name, code: this.catalogDraft.code || null, gradeLevel: this.catalogDraft.gradeLevel || null, weeklyLoad: this.catalogDraft.weeklyLoad || 1 }).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Catalog saved', detail: `${this.catalogDraft.name} added to the platform catalog.` });
                    this.catalogDrawerVisible = false;
                    this.loadData();
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The catalog subject could not be saved.') });
                }
            });
            return;
        }

        if (!this.catalogDraft.id) {
            return;
        }

        this.api.updatePlatformSubjectCatalog(this.catalogDraft.id, { name: this.catalogDraft.name, code: this.catalogDraft.code || null, gradeLevel: this.catalogDraft.gradeLevel || null, weeklyLoad: this.catalogDraft.weeklyLoad || 1 }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Catalog updated', detail: `${this.catalogDraft.name} saved.` });
                this.catalogDrawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The catalog subject could not be updated.') });
            }
        });
    }

    deleteSchoolSubject(subject: SubjectResponse): void {
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

    deleteCatalogSubject(subject: PlatformSubjectCatalogResponse): void {
        this.confirmation.confirm({
            message: `Delete ${subject.name} from the catalog?`,
            header: 'Delete catalog subject',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deletePlatformSubjectCatalog(subject.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Catalog subject deleted', detail: `${subject.name} removed from the platform catalog.` });
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: this.readErrorMessage(error, 'The catalog subject could not be deleted.') });
                    }
                })
        });
    }

    openImportDialog(): void {
        this.importDialogVisible = true;
        this.importTargetMode = 'catalog';
        this.importSourceSchoolId = null;
        this.importTargetSchoolId = null;
        this.importSelectedSubjectIds = [];
        this.importSourceSubjects = [];
    }

    onImportSourceSchoolChange(schoolId: number | null): void {
        this.importSourceSchoolId = schoolId;
        this.importSelectedSubjectIds = [];
        this.loadImportSourceSubjects();
    }

    private loadImportSourceSubjects(): void {
        if (!this.importSourceSchoolId) {
            this.importSourceSubjects = [];
            return;
        }

        this.api.getSubjects(this.importSourceSchoolId).subscribe({
            next: (subjects) => {
                this.importSourceSubjects = subjects;
            },
            error: () => {
                this.importSourceSubjects = [];
            }
        });
    }

    importSelectedSubjects(): void {
        if (!this.importSourceSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Missing source school', detail: 'Choose the source school first.' });
            return;
        }

        if (this.importSelectedSubjectIds.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'No subjects selected', detail: 'Choose at least one subject to import.' });
            return;
        }

        if (this.importTargetMode === 'school' && !this.importTargetSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Missing target school', detail: 'Choose the target school before importing.' });
            return;
        }

        this.importLoading = true;
        const request = {
            sourceSchoolId: this.importSourceSchoolId,
            subjectIds: this.importSelectedSubjectIds
        };

        const request$ = this.importTargetMode === 'catalog'
            ? this.api.importSchoolSubjectsToCatalog(request)
            : this.api.importSchoolSubjectsToSchool(this.importTargetSchoolId!, request);

        request$.subscribe({
            next: (result) => {
                this.importLoading = false;
                this.importDialogVisible = false;
                this.messages.add({
                    severity: 'success',
                    summary: 'Import complete',
                    detail: this.importSummaryMessage(result)
                });
                this.loadData();
            },
            error: (error) => {
                this.importLoading = false;
                this.messages.add({ severity: 'error', summary: 'Import failed', detail: this.readErrorMessage(error, 'The subjects could not be imported.') });
            }
        });
    }

    publishAllCatalogSubjectsToSelectedSchool(): void {
        if (!this.selectedSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose a school before publishing the catalog.' });
            return;
        }

        this.api.publishAllCatalogSubjectsToSchool(this.selectedSchoolId).subscribe({
            next: (result) => {
                this.messages.add({
                    severity: 'success',
                    summary: 'Catalog published',
                    detail: this.importSummaryMessage(result)
                });
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Publish failed', detail: this.readErrorMessage(error, 'The catalog subjects could not be published.') });
            }
            });
    }

    publishAllCatalogSubjectsToAllSchools(): void {
        this.api.publishAllCatalogSubjectsToAllSchools().subscribe({
            next: (result) => {
                this.messages.add({
                    severity: 'success',
                    summary: 'Catalog published',
                    detail: `Published ${result.importedCount} subjects across all schools with ${result.skippedCount} duplicates skipped.`
                });
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Publish failed', detail: this.readErrorMessage(error, 'The catalog subjects could not be published to all schools.') });
            }
        });
    }

    private importSummaryMessage(result: ImportSubjectsResultResponse): string {
        const createdText = result.importedCount === 1 ? '1 subject imported' : `${result.importedCount} subjects imported`;
        const skippedText = result.skippedCount === 1 ? '1 duplicate skipped' : `${result.skippedCount} duplicates skipped`;
        return `${createdText}, ${skippedText}.`;
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
