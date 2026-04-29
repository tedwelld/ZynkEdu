import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AssignClassSubjectsRequest, CreateSchoolClassRequest, SchoolClassResponse, SchoolResponse, SubjectResponse, UpdateSchoolClassRequest } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { getClassesForLevel, normalizeSchoolLevel, SCHOOL_LEVEL_OPTIONS, SchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-classes',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, MultiSelectModule, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Classes</p>
                    <h1 class="text-3xl font-display font-bold m-0">Class registry and subject readiness</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">
                        Create canonical classes for ZGC Level, O'Level, and A'Level, then assign subjects before teacher assignments can be saved.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
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
                    <button pButton type="button" label="Add class" icon="pi pi-plus" (click)="openCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Classes" [value]="classCount" delta="Class registry" hint="All levels" icon="pi pi-sitemap" tone="blue"></app-metric-card>
                <app-metric-card label="Ready" [value]="readyCount" delta="Teaching-ready" hint="Subjects assigned" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Waiting" [value]="waitingCount" delta="Needs setup" hint="No subject mapping" icon="pi pi-exclamation-triangle" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Levels" [value]="levelCount" delta="Canonical bands" hint="ZGC, O'Level, A'Level" icon="pi pi-tag" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Registered classes</h2>
                        <p class="text-sm text-muted-color">Classes created here become the source of truth for subject assignment and teacher setup.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <input pInputText [(ngModel)]="searchTerm" class="w-72 max-w-full rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3" placeholder="Search classes" />
                        <span class="text-sm text-muted-color">{{ visibleClasses.length }} visible</span>
                    </div>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="visibleClasses" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Class</th>
                            <th>Level</th>
                            <th>Subjects</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-schoolClass>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ schoolClass.className }}</div>
                                <div class="text-xs text-muted-color">ID {{ schoolClass.id }}</div>
                            </td>
                            <td><p-tag [value]="levelLabelFor(schoolClass.gradeLevel)" [severity]="severityForLevel(schoolClass.gradeLevel)"></p-tag></td>
                            <td>
                                <div class="flex flex-wrap gap-2">
                                    <p-tag *ngFor="let subject of schoolClass.subjectNames.slice(0, 4)" [value]="subject" severity="secondary"></p-tag>
                                    <span *ngIf="schoolClass.subjectNames.length === 0" class="text-sm text-muted-color">No subjects assigned</span>
                                </div>
                            </td>
                            <td>
                                <div class="flex flex-wrap gap-2">
                                    <p-tag [value]="schoolClass.isActive ? 'Active' : 'Inactive'" [severity]="schoolClass.isActive ? 'success' : 'danger'"></p-tag>
                                    <p-tag [value]="schoolClass.isReadyForTeaching ? 'Ready for teaching' : 'Not ready for teaching'" [severity]="schoolClass.isReadyForTeaching ? 'success' : 'warning'"></p-tag>
                                </div>
                            </td>
                            <td class="text-sm text-muted-color">{{ schoolClass.createdAt | date: 'mediumDate' }}</td>
                            <td class="text-right">
                                <button pButton type="button" label="Subjects" class="p-button-text p-button-sm" icon="pi pi-book" (click)="openAssignSubjects(schoolClass)"></button>
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEdit(schoolClass)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(36rem, 96vw)' }" [header]="drawerMode === 'create' ? 'Add class' : 'Edit class'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="isPlatformAdmin" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        {{ schoolNameFor(selectedSchoolId ?? 0) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Grade level</label>
                        <app-dropdown [options]="levelOptions" [(ngModel)]="draft.gradeLevel" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels" (ngModelChange)="onLevelChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subjects</label>
                        <p-multiSelect
                            [options]="subjectOptionsForDraft"
                            [(ngModel)]="draft.subjectIds"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            class="w-full"
                            [filter]="true"
                            filterPlaceholder="Search subjects"
                            appendTo="body"
                            [disabled]="subjectOptionsForDraft.length === 0 || !draft.isActive"
                            placeholder="Select subjects"
                        ></p-multiSelect>
                        <p class="mt-2 text-sm text-muted-color">Subjects are limited to the selected level and any general subjects.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class name</label>
                        <app-dropdown [options]="classNameOptions" [(ngModel)]="draft.className" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <div class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 px-3 py-3">
                            <input id="class-active" type="checkbox" [(ngModel)]="draft.isActive" />
                            <label for="class-active" class="text-sm font-medium">{{ draft.isActive ? 'Active' : 'Inactive' }}</label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                        <button pButton type="button" [label]="drawerMode === 'create' ? 'Save class' : 'Update class'" icon="pi pi-check" (click)="saveClass()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="subjectsVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(42rem, 96vw)' }" header="Assign subjects" appendTo="body">
                <div class="space-y-4" *ngIf="activeClass">
                    <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="font-semibold">{{ activeClass.className }}</div>
                        <div class="text-sm text-muted-color">{{ levelLabelFor(activeClass.gradeLevel) }} · {{ activeClass.isReadyForTeaching ? 'Ready' : 'Not ready yet' }}</div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subjects for this class</label>
                        <p-multiSelect
                            [options]="subjectOptionsForActiveClass"
                            [(ngModel)]="subjectDraft.subjectIds"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            class="w-full"
                            [filter]="true"
                            filterPlaceholder="Search subjects"
                            appendTo="body"
                            [disabled]="subjectOptionsForActiveClass.length === 0"
                            placeholder="Select subjects"
                        ></p-multiSelect>
                        <p class="mt-2 text-sm text-muted-color">Only subjects that belong to the same level can be assigned. General subjects are also allowed.</p>
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="subjectsVisible = false"></button>
                        <button pButton type="button" label="Save subjects" icon="pi pi-check" (click)="saveSubjects()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminClasses implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly messages = inject(MessageService);
    loading = true;
    schools: SchoolResponse[] = [];
    classes: SchoolClassResponse[] = [];
    subjects: SubjectResponse[] = [];
    selectedSchoolId: number | null = null;
    searchTerm = '';
    skeletonRows = Array.from({ length: 4 });
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    subjectsVisible = false;
    activeClass: SchoolClassResponse | null = null;
    draft: { id?: number; className: string; gradeLevel: SchoolLevel; isActive: boolean; subjectIds: number[] } = { className: '', gradeLevel: '' as SchoolLevel, isActive: true, subjectIds: [] };
    subjectDraft: { subjectIds: number[] } = { subjectIds: [] };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get levelOptions(): { label: string; value: SchoolLevel }[] {
        return SCHOOL_LEVEL_OPTIONS.filter((item) => item.value !== 'General');
    }

    get classCount(): string {
        return this.classes.length.toString();
    }

    get readyCount(): string {
        return this.classes.filter((entry) => entry.isReadyForTeaching).length.toString();
    }

    get waitingCount(): string {
        return this.classes.filter((entry) => !entry.isReadyForTeaching).length.toString();
    }

    get levelCount(): string {
        return new Set(this.classes.map((entry) => normalizeSchoolLevel(entry.gradeLevel))).size.toString();
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select school', value: null },
            ...this.schools.map((school) => ({ label: school.name, value: school.id }))
        ];
    }

    get classNameOptions(): { label: string; value: string }[] {
        return getClassesForLevel(this.draft.gradeLevel).map((value) => ({ label: value, value }));
    }

    get subjectOptionsForDraft(): { label: string; value: number }[] {
        if (!this.draft.gradeLevel) {
            return [];
        }

        const level = normalizeSchoolLevel(this.draft.gradeLevel);
        return this.subjects
            .filter((subject) => normalizeSchoolLevel(subject.gradeLevel) === level || normalizeSchoolLevel(subject.gradeLevel) === 'General')
            .map((subject) => ({ label: `${subject.name} (${normalizeSchoolLevel(subject.gradeLevel)})`, value: subject.id }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    get subjectOptionsForActiveClass(): { label: string; value: number }[] {
        if (!this.activeClass) {
            return [];
        }

        const level = normalizeSchoolLevel(this.activeClass.gradeLevel);
        return this.subjects
            .filter((subject) => normalizeSchoolLevel(subject.gradeLevel) === level || normalizeSchoolLevel(subject.gradeLevel) === 'General')
            .map((subject) => ({ label: `${subject.name} (${normalizeSchoolLevel(subject.gradeLevel)})`, value: subject.id }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    get visibleClasses(): SchoolClassResponse[] {
        const query = this.searchTerm.trim().toLowerCase();
        return this.classes.filter((entry) => !query || `${entry.className} ${entry.gradeLevel} ${entry.subjectNames.join(' ')}`.toLowerCase().includes(query));
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
                        this.messages.add({ severity: 'warn', summary: 'No school selected', detail: 'Choose a school before loading classes.' });
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
            classes: this.api.getClasses(schoolId),
            subjects: this.api.getSubjects(schoolId),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ classes, subjects, schools }) => {
                this.classes = classes;
                this.subjects = subjects;
                this.schools = this.isPlatformAdmin ? schools : schools.filter((school) => school.id === this.auth.schoolId());
                this.selectedSchoolId = this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    onLevelChange(level: SchoolLevel): void {
        this.draft.gradeLevel = normalizeSchoolLevel(level);
        this.draft.className = '';
        this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.subjectOptionsForDraft.some((option) => option.value === subjectId));
    }

    openCreate(): void {
        this.drawerMode = 'create';
        this.draft = {
            className: '',
            gradeLevel: '' as SchoolLevel,
            isActive: true,
            subjectIds: []
        };
        this.drawerVisible = true;
    }

    openEdit(schoolClass: SchoolClassResponse): void {
        this.drawerMode = 'edit';
        this.draft = {
            id: schoolClass.id,
            className: schoolClass.className,
            gradeLevel: normalizeSchoolLevel(schoolClass.gradeLevel),
            isActive: schoolClass.isActive,
            subjectIds: [...schoolClass.subjectIds]
        };
        this.draft.subjectIds = this.draft.subjectIds.filter((subjectId) => this.subjectOptionsForDraft.some((option) => option.value === subjectId));
        this.drawerVisible = true;
    }

    openAssignSubjects(schoolClass: SchoolClassResponse): void {
        this.activeClass = schoolClass;
        this.subjectDraft = { subjectIds: [...schoolClass.subjectIds].filter((subjectId) => this.subjectOptionsForActiveClass.some((option) => option.value === subjectId)) };
        this.subjectsVisible = true;
    }

    saveClass(): void {
        if (!this.selectedSchoolId && this.isPlatformAdmin) {
            this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose a school before saving the class.' });
            return;
        }

        if (!this.draft.gradeLevel) {
            this.messages.add({ severity: 'warn', summary: 'Missing level', detail: 'Choose a level before saving the class.' });
            return;
        }

        if (!this.draft.className.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Missing class', detail: 'Choose a canonical class name before saving.' });
            return;
        }

        if (this.drawerMode === 'create') {
            const payload: CreateSchoolClassRequest = {
                className: this.draft.className,
                gradeLevel: this.draft.gradeLevel
            };

            this.api.createClass(payload, this.selectedSchoolId ?? undefined).subscribe({
                next: (created) => {
                    this.syncClassSubjects(created.id, `${this.draft.className} added to the registry.`);
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The class could not be saved.') });
                }
            });
            return;
        }

        if (!this.draft.id) {
            return;
        }

        const payload: UpdateSchoolClassRequest = {
            className: this.draft.className,
            gradeLevel: this.draft.gradeLevel,
            isActive: this.draft.isActive
        };

        this.api.updateClass(this.draft.id, payload, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.syncClassSubjects(this.draft.id!, `${this.draft.className} saved.`);
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The class could not be updated.') });
            }
        });
    }

    private syncClassSubjects(classId: number, successDetail: string): void {
        if (!this.draft.isActive) {
            this.messages.add({ severity: 'success', summary: this.drawerMode === 'create' ? 'Class created' : 'Class updated', detail: successDetail });
            this.drawerVisible = false;
            this.loadData();
            return;
        }

        const subjectIds = [...new Set(this.draft.subjectIds)];
        if (subjectIds.length === 0) {
            this.messages.add({ severity: 'success', summary: this.drawerMode === 'create' ? 'Class created' : 'Class updated', detail: successDetail });
            this.drawerVisible = false;
            this.loadData();
            return;
        }

        this.api.assignClassSubjects(classId, { subjectIds }, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: this.drawerMode === 'create' ? 'Class created' : 'Class updated', detail: successDetail });
                this.drawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Subject assignment failed', detail: this.readErrorMessage(error, 'The class was saved, but its subjects could not be updated.') });
            }
        });
    }

    saveSubjects(): void {
        if (!this.activeClass) {
            return;
        }

        if (!this.activeClass.isActive) {
            this.messages.add({ severity: 'warn', summary: 'Inactive class', detail: 'Activate the class before assigning subjects.' });
            return;
        }

        const payload: AssignClassSubjectsRequest = {
            subjectIds: [...new Set(this.subjectDraft.subjectIds)]
        };

        this.api.assignClassSubjects(this.activeClass.id, payload, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Subjects saved', detail: `Subjects assigned to ${this.activeClass?.className}.` });
                this.subjectsVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Assignment failed', detail: this.readErrorMessage(error, 'The subject mapping could not be saved.') });
            }
        });
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
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

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
