import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    CreateDisciplineIncidentRequest,
    DisciplineIncidentResponse,
    StudentResponse,
    UpdateDisciplineIncidentRequest
} from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { extractApiErrorMessage } from '../../core/api/api-error';

interface IncidentDraft {
    studentId: number | null;
    incidentType: string;
    severity: string;
    incidentDate: string;
    description: string;
    actionTaken: string;
    isResolved: boolean;
}

const SEVERITY_OPTIONS = [
    { label: 'Minor', value: 'Minor' },
    { label: 'Moderate', value: 'Moderate' },
    { label: 'Serious', value: 'Serious' },
    { label: 'Critical', value: 'Critical' }
];

@Component({
    standalone: true,
    selector: 'app-admin-discipline',
    imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, SkeletonModule, TableModule, TagModule, TextareaModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Student Welfare</p>
                    <h1 class="text-3xl font-display font-bold m-0">Discipline Log</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Record and manage student disciplinary incidents. Track severity, actions taken, and resolution status.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Log incident" icon="pi pi-plus" severity="danger" (click)="openAddDialog()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Total" [value]="incidents.length.toString()" delta="All incidents" hint="Recorded incidents" icon="pi pi-exclamation-triangle" tone="orange"></app-metric-card>
                <app-metric-card label="Open" [value]="openCount" delta="Unresolved" hint="Pending resolution" icon="pi pi-clock" tone="red"></app-metric-card>
                <app-metric-card label="Resolved" [value]="resolvedCount" delta="Closed" hint="Resolved incidents" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Students" [value]="studentCount" delta="Involved" hint="Distinct students" icon="pi pi-users" tone="blue"></app-metric-card>
            </section>

            <article class="workspace-card flex flex-wrap items-center gap-4">
                <app-dropdown
                    [options]="studentFilterOptions"
                    [(ngModel)]="studentFilter"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="All students"
                    class="w-56"
                    appendTo="body"
                    [filter]="true"
                    filterBy="label"
                    [showClear]="true"
                    (ngModelChange)="loadData()"
                ></app-dropdown>
                <app-dropdown
                    [options]="resolvedFilterOptions"
                    [(ngModel)]="resolvedFilter"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="All statuses"
                    class="w-48"
                    appendTo="body"
                    [showClear]="true"
                    (ngModelChange)="loadData()"
                ></app-dropdown>
            </article>

            <div *ngIf="loading" class="space-y-3">
                <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
            </div>

            <article *ngIf="!loading" class="workspace-card">
                <p-table [value]="incidents" styleClass="p-datatable-sm" [paginator]="incidents.length > 20" [rows]="20">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Recorded by</th>
                            <th>Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-i>
                        <tr>
                            <td class="font-semibold text-sm">{{ i.incidentDate | date:'mediumDate' }}</td>
                            <td>{{ i.studentName }}</td>
                            <td class="text-muted-color text-sm">{{ i.studentClass }}</td>
                            <td>{{ i.incidentType }}</td>
                            <td><p-tag [value]="i.severity" [severity]="severitySeverity(i.severity)"></p-tag></td>
                            <td><p-tag [value]="i.isResolved ? 'Resolved' : 'Open'" [severity]="i.isResolved ? 'success' : 'warn'"></p-tag></td>
                            <td class="text-sm text-muted-color">{{ i.recordedByName }}</td>
                            <td>
                                <div class="flex gap-2">
                                    <button pButton type="button" icon="pi pi-eye" severity="secondary" size="small" class="p-button-text" (click)="openViewDialog(i)"></button>
                                    <button pButton type="button" icon="pi pi-pencil" severity="secondary" size="small" class="p-button-text" (click)="openEditDialog(i)"></button>
                                    <button pButton type="button" icon="pi pi-trash" severity="danger" size="small" class="p-button-text" (click)="deleteIncident(i.id)"></button>
                                </div>
                            </td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr><td colspan="8" class="text-center text-muted-color py-8">No incidents recorded. Use "Log incident" to add one.</td></tr>
                    </ng-template>
                </p-table>
            </article>
        </section>

        <!-- View dialog -->
        <p-dialog [(visible)]="viewDialogVisible" [modal]="true" [style]="{width:'600px'}" header="Incident details" [closable]="true">
            <div *ngIf="viewingIncident" class="space-y-4 p-2">
                <div class="grid gap-3 md:grid-cols-2">
                    <div><span class="text-xs text-muted-color uppercase font-semibold">Student</span><div class="font-semibold mt-1">{{ viewingIncident.studentName }} ({{ viewingIncident.studentClass }})</div></div>
                    <div><span class="text-xs text-muted-color uppercase font-semibold">Date</span><div class="font-semibold mt-1">{{ viewingIncident.incidentDate | date:'longDate' }}</div></div>
                    <div><span class="text-xs text-muted-color uppercase font-semibold">Type</span><div class="mt-1">{{ viewingIncident.incidentType }}</div></div>
                    <div><span class="text-xs text-muted-color uppercase font-semibold">Severity</span><div class="mt-1"><p-tag [value]="viewingIncident.severity" [severity]="severitySeverity(viewingIncident.severity)"></p-tag></div></div>
                </div>
                <div><span class="text-xs text-muted-color uppercase font-semibold">Description</span><p class="mt-1 text-sm">{{ viewingIncident.description }}</p></div>
                <div *ngIf="viewingIncident.actionTaken"><span class="text-xs text-muted-color uppercase font-semibold">Action taken</span><p class="mt-1 text-sm">{{ viewingIncident.actionTaken }}</p></div>
                <div class="flex items-center gap-4 text-sm text-muted-color">
                    <span>Recorded by: <strong class="text-color">{{ viewingIncident.recordedByName }}</strong></span>
                    <p-tag [value]="viewingIncident.isResolved ? 'Resolved' : 'Open'" [severity]="viewingIncident.isResolved ? 'success' : 'warn'"></p-tag>
                </div>
            </div>
        </p-dialog>

        <!-- Add / Edit dialog -->
        <p-dialog [(visible)]="editDialogVisible" [modal]="true" [style]="{width:'620px'}" [header]="editingId ? 'Edit incident' : 'Log incident'" [closable]="!saving">
            <div class="grid gap-4 p-2">
                <label *ngIf="!editingId" class="block">
                    <span class="text-sm font-medium text-muted-color">Student</span>
                    <app-dropdown
                        [options]="studentDropdownOptions"
                        [(ngModel)]="draft.studentId"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select student"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        [showClear]="false"
                    ></app-dropdown>
                </label>
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Incident type</span>
                        <input pInputText type="text" [(ngModel)]="draft.incidentType" placeholder="e.g. Fighting, Late attendance..." class="mt-1 w-full" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Severity</span>
                        <app-dropdown
                            [options]="severityOptions"
                            [(ngModel)]="draft.severity"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                            [showClear]="false"
                        ></app-dropdown>
                    </label>
                </div>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Incident date</span>
                    <input type="date" [(ngModel)]="draft.incidentDate" class="mt-1 w-full rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Description</span>
                    <textarea pTextarea [(ngModel)]="draft.description" rows="3" placeholder="Describe the incident in detail..." class="mt-1 w-full"></textarea>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Action taken (optional)</span>
                    <textarea pTextarea [(ngModel)]="draft.actionTaken" rows="2" placeholder="What action was taken or is planned?" class="mt-1 w-full"></textarea>
                </label>
                <label *ngIf="editingId" class="flex items-center gap-2 cursor-pointer">
                    <p-checkbox [(ngModel)]="draft.isResolved" [binary]="true"></p-checkbox>
                    <span class="text-sm">Mark as resolved</span>
                </label>
            </div>
            <ng-template pTemplate="footer">
                <button pButton type="button" label="Cancel" severity="secondary" (click)="editDialogVisible = false" [disabled]="saving"></button>
                <button pButton type="button" [label]="editingId ? 'Save changes' : 'Log incident'" icon="pi pi-check" (click)="saveIncident()" [disabled]="saving || !canSave"></button>
            </ng-template>
        </p-dialog>
    `
})
export class AdminDiscipline implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    saving = false;
    incidents: DisciplineIncidentResponse[] = [];
    students: StudentResponse[] = [];
    studentFilter: number | null = null;
    resolvedFilter: boolean | null = null;
    skeletonRows = Array.from({ length: 5 });

    editDialogVisible = false;
    viewDialogVisible = false;
    editingId: number | null = null;
    viewingIncident: DisciplineIncidentResponse | null = null;
    severityOptions = SEVERITY_OPTIONS;

    draft: IncidentDraft = this.emptyDraft();

    ngOnInit(): void {
        void this.loadInitial();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get openCount(): string {
        return this.incidents.filter(i => !i.isResolved).length.toString();
    }

    get resolvedCount(): string {
        return this.incidents.filter(i => i.isResolved).length.toString();
    }

    get studentCount(): string {
        return new Set(this.incidents.map(i => i.studentId)).size.toString();
    }

    get studentFilterOptions(): { label: string; value: number }[] {
        return this.students.map(s => ({ label: `${s.fullName} (${s.class})`, value: s.id }));
    }

    get studentDropdownOptions(): { label: string; value: number }[] {
        return this.students.map(s => ({ label: `${s.fullName} (${s.class})`, value: s.id }));
    }

    get resolvedFilterOptions(): { label: string; value: boolean }[] {
        return [
            { label: 'Open', value: false },
            { label: 'Resolved', value: true }
        ];
    }

    get canSave(): boolean {
        return !!this.draft.incidentType && !!this.draft.severity && !!this.draft.incidentDate && !!this.draft.description && (!!this.editingId || !!this.draft.studentId);
    }

    severitySeverity(severity: string): 'success' | 'warn' | 'danger' | 'secondary' {
        switch (severity) {
            case 'Minor': return 'secondary';
            case 'Moderate': return 'warn';
            case 'Serious': return 'danger';
            case 'Critical': return 'danger';
            default: return 'secondary';
        }
    }

    async loadInitial(): Promise<void> {
        try {
            this.students = await firstValueFrom(this.api.getStudents());
        } catch {
            // Non-critical
        }
        await this.loadData();
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            this.incidents = await firstValueFrom(this.api.getDisciplineIncidents(null, this.studentFilter, this.resolvedFilter));
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'Could not load discipline incidents.') });
        } finally {
            this.loading = false;
        }
    }

    openAddDialog(): void {
        this.editingId = null;
        this.draft = this.emptyDraft();
        this.editDialogVisible = true;
    }

    openEditDialog(i: DisciplineIncidentResponse): void {
        this.editingId = i.id;
        this.draft = {
            studentId: i.studentId,
            incidentType: i.incidentType,
            severity: i.severity,
            incidentDate: i.incidentDate.split('T')[0],
            description: i.description,
            actionTaken: i.actionTaken ?? '',
            isResolved: i.isResolved
        };
        this.editDialogVisible = true;
    }

    openViewDialog(i: DisciplineIncidentResponse): void {
        this.viewingIncident = i;
        this.viewDialogVisible = true;
    }

    async saveIncident(): Promise<void> {
        if (!this.canSave || this.draft.studentId == null && !this.editingId) return;
        this.saving = true;
        try {
            if (this.editingId) {
                const payload: UpdateDisciplineIncidentRequest = {
                    incidentType: this.draft.incidentType,
                    severity: this.draft.severity,
                    incidentDate: this.draft.incidentDate,
                    description: this.draft.description,
                    actionTaken: this.draft.actionTaken || null,
                    isResolved: this.draft.isResolved
                };
                const updated = await firstValueFrom(this.api.updateDisciplineIncident(this.editingId, payload));
                this.incidents = this.incidents.map(i => i.id === updated.id ? updated : i);
            } else if (this.draft.studentId) {
                const payload: CreateDisciplineIncidentRequest = {
                    studentId: this.draft.studentId,
                    incidentType: this.draft.incidentType,
                    severity: this.draft.severity,
                    incidentDate: this.draft.incidentDate,
                    description: this.draft.description,
                    actionTaken: this.draft.actionTaken || null
                };
                const created = await firstValueFrom(this.api.createDisciplineIncident(payload));
                this.incidents = [created, ...this.incidents];
            }

            this.editDialogVisible = false;
            this.messages.add({ severity: 'success', summary: 'Saved', detail: 'Incident saved.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save incident.') });
        } finally {
            this.saving = false;
        }
    }

    async deleteIncident(id: number): Promise<void> {
        try {
            await firstValueFrom(this.api.deleteDisciplineIncident(id));
            this.incidents = this.incidents.filter(i => i.id !== id);
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'Incident removed.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete incident.') });
        }
    }

    private emptyDraft(): IncidentDraft {
        return {
            studentId: null,
            incidentType: '',
            severity: 'Minor',
            incidentDate: new Date().toISOString().split('T')[0],
            description: '',
            actionTaken: '',
            isResolved: false
        };
    }
}
