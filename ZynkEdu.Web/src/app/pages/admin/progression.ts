import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
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

type MovementAction = 'Promote' | 'Reshuffle' | 'Exit' | 'TransferOut' | 'ReAdmit';

interface RowDraft {
    student: StudentResponse;
    action: MovementAction;
    targetClass: string;
    targetSchoolId: number | null;
    reason: string;
    notes: string;
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
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Academics</p>
                    <h1 class="text-3xl font-display font-bold m-0">Transfers and progression</h1>
                    <p class="text-muted-color mt-2 max-w-3xl">
                        Manage inbound and outbound transfers, year-end promotion, reshuffles, exits, and limited re-admission into Form 5.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Commit run" icon="pi pi-save" severity="info" (click)="commitRun()" [disabled]="loading || saving || batchRows.length === 0"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Visible placements" [value]="students.length.toString()" delta="Loaded rows" hint="Active + archived" icon="pi pi-users" tone="blue"></app-metric-card>
                <app-metric-card label="Active" [value]="activeCount.toString()" delta="Current placements" hint="Ready to move" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Archived" [value]="archivedCount.toString()" delta="Past placements" hint="Available for re-admit" icon="pi pi-folder-open" tone="orange"></app-metric-card>
                <app-metric-card label="Pending moves" [value]="batchRows.length.toString()" delta="Selected actions" hint="Promotion batch" icon="pi pi-sliders-h" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h2 class="text-xl font-display font-bold mb-1">School scope</h2>
                    <p class="text-sm text-muted-color">Select the school whose placements you want to manage.</p>
                </div>
                <div class="flex flex-wrap items-end gap-3">
                    <app-dropdown
                        *ngIf="isPlatformAdmin"
                        [options]="schoolOptions"
                        [(ngModel)]="selectedSchoolId"
                        optionLabel="label"
                        optionValue="value"
                        class="w-80"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        filterPlaceholder="Search schools"
                        (ngModelChange)="onSchoolChange($event)"
                    ></app-dropdown>
                    <div>
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Academic year</label>
                        <input pInputText type="text" [(ngModel)]="academicYearLabel" class="w-72" placeholder="Academic year label" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-2 uppercase tracking-[0.18em] text-muted-color">Effective date</label>
                        <input pInputText type="date" [(ngModel)]="batchEffectiveDate" class="w-56" />
                    </div>
                    <button pButton type="button" [label]="includeInactive ? 'Hide archived placements' : 'Show archived placements'" severity="secondary" (click)="toggleInactive()"></button>
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

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Promotion batch</h2>
                        <p class="text-sm text-muted-color">Promote, reshuffle, exit, or re-admit placements from one auditable batch run.</p>
                    </div>
                    <p-tag [value]="includeInactive ? 'Includes archived' : 'Active only'" [severity]="includeInactive ? 'warning' : 'success'"></p-tag>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="batchRows" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Student</th>
                            <th>Current placement</th>
                            <th>Action</th>
                            <th>Target class</th>
                            <th>Target school</th>
                            <th>Reason</th>
                            <th>Notes</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ row.student.fullName }}</div>
                                <div class="text-xs text-muted-color">{{ row.student.studentNumber }}</div>
                                <div class="text-xs mt-1 text-muted-color">{{ row.student.profileKey }}</div>
                            </td>
                            <td>
                                <div class="text-sm font-semibold">{{ row.student.class }}</div>
                                <div class="text-xs text-muted-color">{{ row.student.level }} - {{ row.student.status }}</div>
                            </td>
                            <td class="min-w-44">
                                <app-dropdown [options]="actionOptionsForRow(row)" [(ngModel)]="row.action" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (ngModelChange)="onActionChange(row)"></app-dropdown>
                            </td>
                            <td class="min-w-56">
                                <app-dropdown [options]="targetClassOptionsForRow(row)" [(ngModel)]="row.targetClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [disabled]="!requiresTargetClass(row.action)"></app-dropdown>
                            </td>
                            <td class="min-w-56">
                                <app-dropdown *ngIf="isPlatformAdmin && row.action === 'TransferOut'" [options]="destinationSchoolOptions" [(ngModel)]="row.targetSchoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [showClear]="true"></app-dropdown>
                                <span *ngIf="!isPlatformAdmin || row.action !== 'TransferOut'" class="text-sm text-muted-color">-</span>
                            </td>
                            <td class="min-w-44">
                                <input pInputText type="text" [(ngModel)]="row.reason" class="w-full" placeholder="Optional reason" />
                            </td>
                            <td class="min-w-44">
                                <input pInputText type="text" [(ngModel)]="row.notes" class="w-full" placeholder="Optional notes" />
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
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
    academicYearLabel = `${new Date().getFullYear()} / ${new Date().getFullYear() + 1}`;
    batchEffectiveDate = new Date().toISOString().slice(0, 10);
    batchRows: RowDraft[] = [];
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

    get activeCount(): number {
        return this.students.filter((student) => this.isActivePlacement(student)).length;
    }

    get archivedCount(): number {
        return this.students.filter((student) => !this.isActivePlacement(student)).length;
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
                this.batchRows = [];
                return;
            }

            await this.loadSchoolClasses(this.selectedSchoolId);
            this.students = await firstValueFrom(this.api.getStudents(undefined, this.selectedSchoolId, this.includeInactive));
            this.buildBatchRows();
            await this.syncTransferDraft();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'The progression workspace could not be loaded.') });
        } finally {
            this.loading = false;
        }
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        void this.loadData();
    }

    toggleInactive(): void {
        this.includeInactive = !this.includeInactive;
        void this.loadData();
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

    onActionChange(row: RowDraft): void {
        if (!this.requiresTargetClass(row.action)) {
            row.targetClass = '';
        }

        if (row.action !== 'TransferOut') {
            row.targetSchoolId = null;
        }

        if (this.requiresTargetClass(row.action) && !row.targetClass) {
            row.targetClass = this.defaultTargetClass(row.student, row.action);
        }
    }

    async transferStudent(): Promise<void> {
        if (!this.selectedSchoolId || !this.canTransfer) {
            return;
        }

        this.saving = true;
        try {
            const response = await firstValueFrom(this.api.transferStudent({
                studentId: this.transferDraft.studentId as number,
                action: 'Transfer',
                targetSchoolId: this.transferDraft.targetSchoolId,
                targetClass: this.transferDraft.targetClass,
                reason: this.transferDraft.reason || null,
                notes: this.transferDraft.notes || null,
                effectiveDate: this.transferDraft.effectiveDate,
                copySubjects: this.transferDraft.copySubjects
            } satisfies StudentMovementRequest, this.selectedSchoolId));

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

    async commitRun(): Promise<void> {
        if (!this.academicYearLabel.trim() || !this.selectedSchoolId) {
            return;
        }

        const invalidRow = this.batchRows.find((row) => this.requiresTargetClass(row.action) && !row.targetClass.trim());
        if (invalidRow) {
            this.messages.add({
                severity: 'warn',
                summary: 'Missing target class',
                detail: `Choose a target class for ${invalidRow.student.fullName} before committing the run.`
            });
            return;
        }

        const items = this.batchRows.map((row) => ({
            studentId: row.student.id,
            action: row.action,
            targetSchoolId: row.action === 'TransferOut' ? null : row.targetSchoolId,
            targetClass: this.requiresTargetClass(row.action) ? row.targetClass || null : null,
            targetLevel: null,
            reason: row.reason.trim() || null,
            notes: row.notes.trim() || null,
            effectiveDate: this.batchEffectiveDate,
            copySubjects: true
        }));

        if (items.length === 0) {
            return;
        }

        this.saving = true;
        try {
            this.currentRun = await firstValueFrom(this.api.commitPromotionRun({
                academicYearLabel: this.academicYearLabel.trim(),
                notes: null,
                items
            } satisfies StudentPromotionRunRequest, this.selectedSchoolId));

            this.messages.add({ severity: 'success', summary: 'Committed', detail: `Saved promotion run ${this.currentRun.runId}.` });
            await this.loadData();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Commit failed', detail: extractApiErrorMessage(error, 'The promotion run could not be committed.') });
        } finally {
            this.saving = false;
        }
    }

    actionOptionsForRow(row: RowDraft): { label: string; value: MovementAction }[] {
        if (!this.isActivePlacement(row.student)) {
            return [{ label: 'Re-admit to Form 5', value: 'ReAdmit' }];
        }

        return [
            { label: 'Promote', value: 'Promote' },
            { label: 'Reshuffle', value: 'Reshuffle' },
            { label: 'Exit school', value: 'Exit' },
            { label: 'Transfer out', value: 'TransferOut' }
        ];
    }

    targetClassOptionsForRow(row: RowDraft): { label: string; value: string }[] {
        if (!this.selectedSchoolId || !this.requiresTargetClass(row.action)) {
            return [];
        }

        if (row.action === 'ReAdmit') {
            return this.formOptionsForSchool(this.selectedSchoolId, 5);
        }

        if (row.action === 'Reshuffle') {
            return this.sameFormOptionsForSchool(this.selectedSchoolId, row.student.class).filter((option) => option.value.toLowerCase() !== row.student.class.toLowerCase());
        }

        if (row.action === 'Promote') {
            return this.nextFormOptionsForSchool(this.selectedSchoolId, row.student.class);
        }

        return [];
    }

    requiresTargetClass(action: MovementAction): boolean {
        return action === 'Promote' || action === 'Reshuffle' || action === 'ReAdmit';
    }

    private buildBatchRows(): void {
        this.batchRows = this.students.map((student) => {
            const active = this.isActivePlacement(student);
            const action = active ? this.defaultActionForStudent(student) : 'ReAdmit';
            return {
                student,
                action,
                targetClass: this.defaultTargetClass(student, action),
                targetSchoolId: null,
                reason: '',
                notes: ''
            };
        });
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

    private defaultActionForStudent(student: StudentResponse): MovementAction {
        const formNumber = this.getFormNumber(student.class);
        if (formNumber === 4 || formNumber === 6 || formNumber == null) {
            return 'Exit';
        }

        const nextCandidates = this.nextFormOptionsForSchool(this.selectedSchoolId ?? student.schoolId, student.class);
        return nextCandidates.length > 0 ? 'Promote' : 'Exit';
    }

    private defaultTargetClass(student: StudentResponse, action: MovementAction): string {
        if (!this.selectedSchoolId) {
            return '';
        }

        if (action === 'ReAdmit') {
            return this.formOptionsForSchool(this.selectedSchoolId, 5)[0]?.value ?? '';
        }

        if (action === 'Reshuffle') {
            return this.sameFormOptionsForSchool(this.selectedSchoolId, student.class).find((option) => option.value.toLowerCase() !== student.class.toLowerCase())?.value ?? '';
        }

        if (action === 'Promote') {
            return this.nextFormOptionsForSchool(this.selectedSchoolId, student.class)[0]?.value ?? '';
        }

        return '';
    }

    private nextFormOptionsForSchool(schoolId: number, currentClass: string): { label: string; value: string }[] {
        const nextFormNumber = this.nextFormNumber(currentClass);
        if (nextFormNumber == null) {
            return [];
        }

        return this.formOptionsForSchool(schoolId, nextFormNumber);
    }

    private sameFormOptionsForSchool(schoolId: number, currentClass: string): { label: string; value: string }[] {
        const formNumber = this.getFormNumber(currentClass);
        if (formNumber == null) {
            return [];
        }

        return this.formOptionsForSchool(schoolId, formNumber);
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
            .sort((a, b) => a.className.localeCompare(b.className))
            .map((schoolClass) => ({ label: `${schoolClass.className} - ${schoolClass.gradeLevel}`, value: schoolClass.className }));
    }

    private isActivePlacement(student: StudentResponse): boolean {
        return student.status === 'Active' || student.status === 'Suspended';
    }
}
