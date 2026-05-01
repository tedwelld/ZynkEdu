import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import {
    SchoolClassResponse,
    SchoolResponse,
    StudentMovementRequest,
    StudentPromotionRunRequest,
    StudentPromotionRunResponse,
    StudentResponse
} from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface StudentGroup {
    level: string;
    className: string;
    students: StudentResponse[];
    activeCount: number;
    archivedCount: number;
}

interface TransferDraft {
    studentId: number | null;
    targetSchoolId: number | null;
    targetClass: string;
    reason: string;
    notes: string;
    effectiveDate: string;
    copySubjects: boolean;
}

@Component({
    standalone: true,
    selector: 'app-admin-progression',
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Academics</p>
                    <h1 class="text-3xl font-display font-bold m-0">Transfers and progression</h1>
                    <p class="text-muted-color mt-2 max-w-3xl">
                        Filter students by level and class, then promote the visible group in one auditable batch run.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Visible placements" [value]="visibleCount.toString()" delta="Current filter" hint="Level and class scope" icon="pi pi-users" tone="blue"></app-metric-card>
                <app-metric-card label="Active" [value]="activeCount.toString()" delta="Promotable rows" hint="Ready for the batch" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Archived" [value]="archivedCount.toString()" delta="Inactive rows" hint="Shown when enabled" icon="pi pi-folder-open" tone="orange"></app-metric-card>
                <app-metric-card label="Destination" [value]="selectedTargetClass || 'Unset'" delta="Target class" hint="Next promotion step" icon="pi pi-arrow-right" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card space-y-5">
                <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Promotion filters</h2>
                        <p class="text-sm text-muted-color">Choose the source level and class, then promote the filtered students into one destination class.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <p-tag [value]="promotionReadinessMessage" [severity]="canPromoteFilteredStudents ? 'success' : 'warning'"></p-tag>
                        <p-tag [value]="includeInactive ? 'Archived shown' : 'Active only'" [severity]="includeInactive ? 'warning' : 'success'"></p-tag>
                    </div>
                </div>

                <div class="grid gap-4 xl:grid-cols-12">
                    <div class="xl:col-span-3">
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Level</label>
                        <app-dropdown
                            [options]="sourceLevelOptions"
                            [(ngModel)]="selectedSourceLevel"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Choose a level"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search levels"
                            [showClear]="true"
                            (ngModelChange)="onSourceLevelChange($event)"
                        ></app-dropdown>
                    </div>
                    <div class="xl:col-span-3">
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Class</label>
                        <app-dropdown
                            [options]="sourceClassOptions"
                            [(ngModel)]="selectedSourceClass"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Choose a class"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search classes"
                            [showClear]="true"
                            (ngModelChange)="onSourceClassChange($event)"
                        ></app-dropdown>
                    </div>
                    <div class="xl:col-span-3">
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Destination class</label>
                        <app-dropdown
                            [options]="batchTargetClassOptions"
                            [(ngModel)]="selectedTargetClass"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Choose a destination"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search destination classes"
                            [showClear]="true"
                            [disabled]="batchTargetClassOptions.length === 0"
                            (ngModelChange)="onTargetClassChange($event)"
                        ></app-dropdown>
                    </div>
                    <div class="xl:col-span-3">
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Academic year</label>
                        <input pInputText type="text" [(ngModel)]="academicYearLabel" class="w-full" placeholder="Academic year label" />
                    </div>
                    <div class="xl:col-span-3">
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Effective date</label>
                        <input pInputText type="date" [(ngModel)]="batchEffectiveDate" class="w-full" />
                    </div>
                    <div class="xl:col-span-3 flex items-end">
                        <button pButton type="button" [label]="includeInactive ? 'Hide archived placements' : 'Show archived placements'" severity="secondary" class="w-full" (click)="toggleInactive()"></button>
                    </div>
                </div>

                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-3xl border border-surface-200 bg-surface-50/70 px-4 py-4 dark:border-surface-700 dark:bg-surface-900/50">
                    <div>
                        <div class="text-sm font-semibold">Promotion readiness</div>
                        <p class="text-sm text-muted-color">{{ promotionReadinessDetail }}</p>
                    </div>
                    <button
                        pButton
                        type="button"
                        icon="pi pi-check"
                        severity="info"
                        [label]="promotionButtonLabel"
                        [disabled]="!canPromoteFilteredStudents"
                        (click)="promoteFilteredStudents()"
                    ></button>
                </div>
            </article>

            <article class="workspace-card space-y-4">
                <div class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Filtered students</h2>
                        <p class="text-sm text-muted-color">Students are grouped by level and class. Archived placements stay visible when enabled, but only active students are promoted.</p>
                    </div>
                    <p-tag [value]="promotionScopeLabel" [severity]="promotionScopeStudents.length > 0 ? 'info' : 'secondary'"></p-tag>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="5rem" borderRadius="1.25rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && shouldShowPromotionPreview && groupedStudents.length === 0" class="rounded-3xl border border-dashed border-surface-300 bg-surface-50/80 p-6 text-sm text-muted-color dark:border-surface-700 dark:bg-surface-900/40">
                    No students match the selected level and class filters.
                </div>

                <div *ngIf="!loading && !shouldShowPromotionPreview" class="rounded-3xl border border-dashed border-surface-300 bg-surface-50/80 p-6 text-sm text-muted-color dark:border-surface-700 dark:bg-surface-900/40">
                    Choose a level to preview the promotion groups.
                </div>

                <div *ngIf="!loading && groupedStudents.length > 0" class="space-y-4">
                    <section *ngFor="let group of groupedStudents" class="rounded-3xl border border-surface-200 bg-surface-50/80 p-4 dark:border-surface-700 dark:bg-surface-900/40">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p class="text-xs uppercase tracking-[0.24em] text-muted-color font-semibold">{{ group.level }}</p>
                                <h3 class="text-xl font-display font-bold m-0">{{ group.className }}</h3>
                                <p class="text-sm text-muted-color mt-1">{{ group.students.length }} student(s) in this group</p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <p-tag [value]="group.activeCount + ' active'" severity="success"></p-tag>
                                <p-tag *ngIf="group.archivedCount > 0" [value]="group.archivedCount + ' archived'" severity="warning"></p-tag>
                            </div>
                        </div>

                        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div *ngFor="let student of group.students" class="rounded-2xl border border-surface-200 bg-surface-0/90 p-4 shadow-sm dark:border-surface-700 dark:bg-surface-950/70">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <div class="font-semibold leading-tight">{{ student.fullName }}</div>
                                        <div class="text-xs text-muted-color mt-1">{{ student.studentNumber }}</div>
                                    </div>
                                    <p-tag [value]="student.status" [severity]="studentStatusSeverity(student)"></p-tag>
                                </div>

                                <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                                    <div class="rounded-2xl bg-surface-50 px-3 py-2 dark:bg-surface-900/70">
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color">Level</div>
                                        <div class="font-medium mt-1">{{ student.level }}</div>
                                    </div>
                                    <div class="rounded-2xl bg-surface-50 px-3 py-2 dark:bg-surface-900/70">
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color">Class</div>
                                        <div class="font-medium mt-1">{{ student.class }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </article>

            <article *ngIf="isPlatformAdmin" class="workspace-card space-y-4">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Cross-school transfer</h2>
                        <p class="text-sm text-muted-color">Move an active student into another school and preserve the lineage link.</p>
                    </div>
                    <p-tag value="Platform only" severity="info"></p-tag>
                </div>

                <div class="grid gap-4 lg:grid-cols-3">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Student</label>
                        <app-dropdown [options]="activeStudentOptions" [(ngModel)]="transferDraft.studentId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search students" (ngModelChange)="onTransferStudentChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Destination school</label>
                        <app-dropdown [options]="destinationSchoolOptions" [(ngModel)]="transferDraft.targetSchoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onTransferSchoolChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Destination class</label>
                        <app-dropdown [options]="transferClassOptions" [(ngModel)]="transferDraft.targetClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes"></app-dropdown>
                    </div>
                </div>

                <div class="grid gap-4 lg:grid-cols-3">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Reason</label>
                        <input pInputText type="text" [(ngModel)]="transferDraft.reason" class="w-full" placeholder="Optional reason" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Notes</label>
                        <input pInputText type="text" [(ngModel)]="transferDraft.notes" class="w-full" placeholder="Optional notes" />
                    </div>
                    <div class="flex items-center gap-3 pt-7">
                        <button pButton type="button" [label]="transferDraft.copySubjects ? 'Copy subjects: yes' : 'Copy subjects: no'" severity="secondary" (click)="transferDraft.copySubjects = !transferDraft.copySubjects"></button>
                        <span class="text-sm text-muted-color">Copy subjects when the destination school shares the same curriculum.</span>
                    </div>
                </div>

                <div class="flex justify-end">
                    <button pButton type="button" label="Transfer student" icon="pi pi-arrow-right" severity="info" (click)="transferStudent()" [disabled]="saving || !canTransfer"></button>
                </div>
            </article>
        </section>
    `
})
export class AdminProgression implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    saving = false;
    includeInactive = false;
    schools: SchoolResponse[] = [];
    students: StudentResponse[] = [];
    schoolClasses: SchoolClassResponse[] = [];
    selectedSchoolId: number | null = null;
    selectedSourceLevel: string | null = null;
    selectedSourceClass: string | null = null;
    selectedTargetClass: string | null = null;
    academicYearLabel = `${new Date().getFullYear()} / ${new Date().getFullYear() + 1}`;
    batchEffectiveDate = new Date().toISOString().slice(0, 10);
    skeletonRows = Array.from({ length: 5 });
    transferDraft: TransferDraft = {
        studentId: null,
        targetSchoolId: null,
        targetClass: '',
        reason: '',
        notes: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        copySubjects: true
    };

    private readonly classCache = new Map<number, SchoolClassResponse[]>();
    private currentRun: StudentPromotionRunResponse | null = null;

    ngOnInit(): void {
        this.selectedSchoolId = this.isPlatformAdmin ? null : this.auth.schoolId();
        void this.loadData();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get selectedSchoolName(): string {
        return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? 'Selected school';
    }

    get sourceLevelOptions(): { label: string; value: string }[] {
        return this.uniqueStringOptions(this.students.map((student) => student.level));
    }

    get sourceClassOptions(): { label: string; value: string }[] {
        const sourceStudents = this.selectedSourceLevel
            ? this.students.filter((student) => student.level === this.selectedSourceLevel)
            : this.students;

        return this.uniqueStringOptions(sourceStudents.map((student) => student.class), (className) => {
            const level = this.inferLevelForClass(className);
            return level ? `${className} - ${level}` : className;
        });
    }

    get batchTargetClassOptions(): { label: string; value: string }[] {
        if (!this.selectedSchoolId || !this.selectedSourceClass) {
            return [];
        }

        return this.nextFormOptionsForSchool(this.selectedSchoolId, this.selectedSourceClass);
    }

    get promotionScopeStudents(): StudentResponse[] {
        let scopedStudents = this.students;

        if (this.selectedSourceLevel) {
            scopedStudents = scopedStudents.filter((student) => student.level === this.selectedSourceLevel);
        } else {
            return [];
        }

        if (this.selectedSourceClass) {
            scopedStudents = scopedStudents.filter((student) => student.class === this.selectedSourceClass);
        }

        return scopedStudents
            .slice()
            .sort((left, right) => this.compareStudents(left, right));
    }

    get groupedStudents(): StudentGroup[] {
        const groups = new Map<string, StudentGroup>();

        for (const student of this.promotionScopeStudents) {
            const key = `${student.level}::${student.class}`;
            const group = groups.get(key) ?? {
                level: student.level,
                className: student.class,
                students: [],
                activeCount: 0,
                archivedCount: 0
            };

            group.students.push(student);
            if (this.isActivePlacement(student)) {
                group.activeCount += 1;
            } else {
                group.archivedCount += 1;
            }

            groups.set(key, group);
        }

        return Array.from(groups.values()).sort((left, right) => {
            const levelCompare = left.level.localeCompare(right.level);
            return levelCompare !== 0 ? levelCompare : left.className.localeCompare(right.className);
        });
    }

    get visibleCount(): number {
        return this.promotionScopeStudents.length;
    }

    get activeCount(): number {
        return this.promotionScopeStudents.filter((student) => this.isActivePlacement(student)).length;
    }

    get archivedCount(): number {
        return this.promotionScopeStudents.filter((student) => !this.isActivePlacement(student)).length;
    }

    get activeFilteredStudents(): StudentResponse[] {
        return this.promotionScopeStudents.filter((student) => this.isActivePlacement(student));
    }

    get shouldShowPromotionPreview(): boolean {
        return !!this.selectedSourceLevel;
    }

    get promotionScopeLabel(): string {
        if (!this.selectedSourceLevel) {
            return 'Choose a level to start';
        }

        if (!this.selectedSourceClass) {
            return `${this.sourceLevelOptions.find((option) => option.value === this.selectedSourceLevel)?.label ?? this.selectedSourceLevel} selected`;
        }

        return `${this.promotionScopeStudents.length} student(s) in scope`;
    }

    get promotionReadinessMessage(): string {
        if (!this.selectedSourceLevel) {
            return 'Choose a level to group students.';
        }

        if (this.promotionScopeStudents.length === 0) {
            return 'No students match the selected level and class filters.';
        }

        if (!this.selectedSourceClass) {
            return 'Select a class to narrow the group before promoting.';
        }

        if (this.activeFilteredStudents.length === 0) {
            return 'This group has no active students to promote.';
        }

        if (!this.selectedTargetClass) {
            return 'Choose a destination class to enable the promotion run.';
        }

        return `${this.activeFilteredStudents.length} active student(s) are ready to promote.`;
    }

    get promotionReadinessDetail(): string {
        return this.promotionReadinessMessage;
    }

    get promotionButtonLabel(): string {
        const count = this.activeFilteredStudents.length;
        return count > 0 ? `Promote ${count} student${count === 1 ? '' : 's'}` : 'Promote filtered students';
    }

    get canPromoteFilteredStudents(): boolean {
        return !!this.selectedSchoolId && !!this.selectedSourceLevel && !!this.selectedSourceClass && !!this.selectedTargetClass && this.activeFilteredStudents.length > 0 && !this.saving;
    }

    get destinationSchoolOptions(): { label: string; value: number }[] {
        if (!this.isPlatformAdmin) {
            return [];
        }

        return this.schoolOptions;
    }

    get activeStudentOptions(): { label: string; value: number }[] {
        return this.students
            .filter((student) => this.isActivePlacement(student))
            .map((student) => ({ label: `${student.fullName} (${student.studentNumber})`, value: student.id }));
    }

    get canTransfer(): boolean {
        return !!this.transferDraft.studentId && !!this.transferDraft.targetSchoolId && !!this.transferDraft.targetClass;
    }

    get transferClassOptions(): { label: string; value: string }[] {
        if (!this.transferDraft.targetSchoolId) {
            return [];
        }

        return this.classOptionsForSchool(this.transferDraft.targetSchoolId);
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            this.schools = await firstValueFrom(this.isPlatformAdmin ? this.api.getPlatformSchools() : this.api.getSchools());

            if (!this.selectedSchoolId) {
                this.selectedSchoolId = this.schools[0]?.id ?? this.auth.schoolId();
            }

            if (this.selectedSchoolId == null) {
                this.students = [];
                this.schoolClasses = [];
                this.resetPromotionFilters();
                return;
            }

            await this.loadSchoolClasses(this.selectedSchoolId);
            this.students = await firstValueFrom(this.api.getStudents(undefined, this.selectedSchoolId, this.includeInactive));
            this.ensurePromotionFilterConsistency();
            await this.syncTransferDraft();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'The progression workspace could not be loaded.') });
        } finally {
            this.loading = false;
        }
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.resetPromotionFilters();
        void this.loadData();
    }

    toggleInactive(): void {
        this.includeInactive = !this.includeInactive;
        void this.loadData();
    }

    onSourceLevelChange(level: string | null): void {
        this.selectedSourceLevel = level?.trim() || null;

        if (!this.selectedSourceLevel) {
            this.selectedSourceClass = null;
            this.selectedTargetClass = null;
            return;
        }

        if (this.selectedSourceClass && !this.sourceClassOptions.some((option) => option.value === this.selectedSourceClass)) {
            this.selectedSourceClass = null;
            this.selectedTargetClass = null;
        }

        this.syncBatchTargetClassSelection();
    }

    onSourceClassChange(className: string | null): void {
        this.selectedSourceClass = className?.trim() || null;

        if (!this.selectedSourceClass) {
            this.selectedTargetClass = null;
            return;
        }

        const inferredLevel = this.inferLevelForClass(this.selectedSourceClass);
        if (inferredLevel) {
            this.selectedSourceLevel = inferredLevel;
        }

        this.syncBatchTargetClassSelection();
    }

    onTargetClassChange(className: string | null): void {
        this.selectedTargetClass = className?.trim() || null;
    }

    async onTransferStudentChange(studentId: number | null): Promise<void> {
        this.transferDraft.studentId = studentId;

        if (!this.isPlatformAdmin) {
            return;
        }

        if (!this.transferDraft.targetSchoolId || this.transferDraft.targetSchoolId === this.selectedSchoolId) {
            const destination = this.schoolOptions.find((option) => option.value !== this.selectedSchoolId) ?? this.schoolOptions[0] ?? null;
            this.transferDraft.targetSchoolId = destination?.value ?? null;
        }

        await this.onTransferSchoolChange(this.transferDraft.targetSchoolId);
    }

    async onTransferSchoolChange(schoolId: number | null): Promise<void> {
        this.transferDraft.targetSchoolId = schoolId;

        if (!schoolId) {
            this.transferDraft.targetClass = '';
            return;
        }

        await this.loadSchoolClasses(schoolId);
        const options = this.classOptionsForSchool(schoolId);
        this.transferDraft.targetClass = options[0]?.value ?? '';
    }

    async promoteFilteredStudents(): Promise<void> {
        if (!this.selectedSchoolId || !this.selectedSourceLevel || !this.selectedSourceClass) {
            return;
        }

        if (this.activeFilteredStudents.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'No students found', detail: 'Pick a level and class that still contains active students.' });
            return;
        }

        if (!this.selectedTargetClass) {
            this.messages.add({ severity: 'warn', summary: 'Missing destination', detail: 'Choose a destination class before promoting the filtered group.' });
            return;
        }

        this.saving = true;
        try {
            const items = this.activeFilteredStudents.map(
                (student): StudentMovementRequest => ({
                    studentId: student.id,
                    action: 'Promote',
                    targetSchoolId: null,
                    targetClass: this.selectedTargetClass,
                    targetLevel: null,
                    reason: null,
                    notes: null,
                    effectiveDate: this.batchEffectiveDate,
                    copySubjects: true
                })
            );

            this.currentRun = await firstValueFrom(
                this.api.commitPromotionRun(
                    {
                        academicYearLabel: this.academicYearLabel.trim(),
                        notes: null,
                        items
                    } satisfies StudentPromotionRunRequest,
                    this.selectedSchoolId
                )
            );

            this.messages.add({
                severity: 'success',
                summary: 'Promotion committed',
                detail: `Saved promotion run ${this.currentRun.runId} for ${this.currentRun.movements.length} student(s).`
            });

            await this.loadData();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Commit failed', detail: extractApiErrorMessage(error, 'The promotion run could not be committed.') });
        } finally {
            this.saving = false;
        }
    }

    async transferStudent(): Promise<void> {
        if (!this.selectedSchoolId || !this.canTransfer) {
            return;
        }

        this.saving = true;
        try {
            const response = await firstValueFrom(
                this.api.transferStudent(
                    {
                        studentId: this.transferDraft.studentId as number,
                        action: 'Transfer',
                        targetSchoolId: this.transferDraft.targetSchoolId,
                        targetClass: this.transferDraft.targetClass,
                        reason: this.transferDraft.reason || null,
                        notes: this.transferDraft.notes || null,
                        effectiveDate: this.transferDraft.effectiveDate,
                        copySubjects: this.transferDraft.copySubjects
                    } satisfies StudentMovementRequest,
                    this.selectedSchoolId
                )
            );

            this.messages.add({ severity: 'success', summary: 'Transferred', detail: `Created movement ${response.movementId}.` });
            this.transferDraft = {
                studentId: null,
                targetSchoolId: null,
                targetClass: '',
                reason: '',
                notes: '',
                effectiveDate: new Date().toISOString().slice(0, 10),
                copySubjects: true
            };
            await this.loadData();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Transfer failed', detail: extractApiErrorMessage(error, 'The student could not be transferred.') });
        } finally {
            this.saving = false;
        }
    }

    private resetPromotionFilters(): void {
        this.selectedSourceLevel = null;
        this.selectedSourceClass = null;
        this.selectedTargetClass = null;
    }

    private ensurePromotionFilterConsistency(): void {
        if (this.selectedSourceLevel && !this.sourceLevelOptions.some((option) => option.value === this.selectedSourceLevel)) {
            this.selectedSourceLevel = null;
        }

        if (this.selectedSourceClass && !this.sourceClassOptions.some((option) => option.value === this.selectedSourceClass)) {
            this.selectedSourceClass = null;
        }

        this.syncBatchTargetClassSelection();
    }

    private syncBatchTargetClassSelection(): void {
        if (!this.selectedTargetClass) {
            return;
        }

        if (!this.batchTargetClassOptions.some((option) => option.value === this.selectedTargetClass)) {
            this.selectedTargetClass = null;
        }
    }

    private uniqueStringOptions(values: (string | null | undefined)[], labelFactory?: (value: string) => string): { label: string; value: string }[] {
        const uniqueValues = Array.from(
            new Set(
                values
                    .map((value) => value?.trim())
                    .filter((value): value is string => !!value)
            )
        ).sort((left, right) => left.localeCompare(right));

        return uniqueValues.map((value) => ({
            label: labelFactory ? labelFactory(value) : value,
            value
        }));
    }

    private compareStudents(left: StudentResponse, right: StudentResponse): number {
        const levelCompare = left.level.localeCompare(right.level);
        if (levelCompare !== 0) {
            return levelCompare;
        }

        const classCompare = left.class.localeCompare(right.class);
        if (classCompare !== 0) {
            return classCompare;
        }

        const nameCompare = left.fullName.localeCompare(right.fullName);
        if (nameCompare !== 0) {
            return nameCompare;
        }

        return left.studentNumber.localeCompare(right.studentNumber);
    }

    private inferLevelForClass(className: string): string | null {
        return this.students.find((student) => student.class === className)?.level ?? null;
    }

    private async syncTransferDraft(): Promise<void> {
        if (!this.isPlatformAdmin || this.schoolOptions.length === 0) {
            return;
        }

        if (!this.transferDraft.targetSchoolId || this.transferDraft.targetSchoolId === this.selectedSchoolId) {
            const destination = this.schoolOptions.find((option) => option.value !== this.selectedSchoolId) ?? this.schoolOptions[0] ?? null;
            this.transferDraft.targetSchoolId = destination?.value ?? null;
        }

        if (this.transferDraft.targetSchoolId) {
            await this.loadSchoolClasses(this.transferDraft.targetSchoolId);
            const options = this.classOptionsForSchool(this.transferDraft.targetSchoolId);
            this.transferDraft.targetClass = options[0]?.value ?? '';
        }
    }

    private async loadSchoolClasses(schoolId: number): Promise<void> {
        if (this.classCache.has(schoolId)) {
            this.schoolClasses = this.classCache.get(schoolId) ?? [];
            return;
        }

        const classes = await firstValueFrom(this.api.getClasses(schoolId));
        this.classCache.set(schoolId, classes);
        this.schoolClasses = classes;
    }

    private classOptionsForSchool(schoolId: number): { label: string; value: string }[] {
        const classes = this.classCache.get(schoolId) ?? [];
        return classes
            .filter((schoolClass) => schoolClass.isActive)
            .sort((left, right) => left.className.localeCompare(right.className))
            .map((schoolClass) => ({ label: `${schoolClass.className} - ${schoolClass.gradeLevel}`, value: schoolClass.className }));
    }

    private nextFormOptionsForSchool(schoolId: number, currentClass: string): { label: string; value: string }[] {
        const nextFormNumber = this.nextFormNumber(currentClass);
        if (nextFormNumber == null) {
            return [];
        }

        return this.formOptionsForSchool(schoolId, nextFormNumber);
    }

    private formOptionsForSchool(schoolId: number, formNumber: number): { label: string; value: string }[] {
        const classes = this.classOptionsForSchool(schoolId);
        const prefix = `Form ${formNumber}`;
        return classes.filter((option) => option.value.toLowerCase().startsWith(prefix.toLowerCase()));
    }

    private nextFormNumber(className: string): number | null {
        const formNumber = this.getFormNumber(className);
        if (formNumber == null) {
            return null;
        }

        if (formNumber === 1) {
            return 2;
        }

        if (formNumber === 2) {
            return 3;
        }

        if (formNumber === 3) {
            return 4;
        }

        if (formNumber === 5) {
            return 6;
        }

        return null;
    }

    private getFormNumber(className: string): number | null {
        const match = className.trim().match(/^Form\s+(\d+)/i);
        if (!match) {
            return null;
        }

        const value = Number(match[1]);
        return Number.isFinite(value) ? value : null;
    }

    studentStatusSeverity(student: StudentResponse): 'success' | 'warning' | 'secondary' | 'info' | 'contrast' {
        const status = student.status.trim().toLowerCase();

        if (status === 'active') {
            return 'success';
        }

        if (status === 'suspended') {
            return 'warning';
        }

        if (status === 'archived' || status === 'inactive' || status === 'graduated' || status === 'withdrawn' || status === 'exited') {
            return 'secondary';
        }

        return 'info';
    }

    private isActivePlacement(student: StudentResponse): boolean {
        return student.status === 'Active' || student.status === 'Suspended';
    }
}
