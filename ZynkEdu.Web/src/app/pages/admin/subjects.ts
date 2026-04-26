import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardResponse, SchoolResponse, SubjectResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-subjects',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Subjects</p>
                    <h1 class="text-3xl font-display font-bold m-0">Subject library with performance context</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Keep subjects tidy and see how they compare against current averages in the dashboard.</p>
                </div>
                <div class="flex gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <button pButton type="button" label="Add Subject" icon="pi pi-plus" (click)="openCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Subjects" [value]="subjectCount" delta="Subject set" hint="Live records" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Strong" [value]="strongCount" delta="Above target" hint="75%+" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Watch" [value]="watchCount" delta="Below target" hint="Under 65%" icon="pi pi-exclamation-triangle" tone="orange"></app-metric-card>
                <app-metric-card label="Coverage" [value]="coverageText" delta="Tracked subjects" hint="With averages" icon="pi pi-chart-bar" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Subjects</h2>
                        <p class="text-sm text-muted-color">Each row aligns with the latest subject performance.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ filteredSubjects.length }} visible</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="filteredSubjects" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Subject</th>
                            <th>Average</th>
                            <th>Band</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-subject>
                        <tr>
                            <td class="font-semibold">{{ subject.name }}</td>
                            <td>{{ averageFor(subject.name) }}%</td>
                            <td>
                                <p-tag [value]="bandFor(subject.name)" [severity]="severityFor(subject.name)"></p-tag>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEdit(subject)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteSubject(subject)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="drawerMode === 'create' ? 'Add subject' : 'Edit subject'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="isPlatformAdmin" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                        {{ schoolNameFor(draft.schoolId ?? 0) }}
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject name</label>
                        <input pInputText [(ngModel)]="draft.name" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                        <button pButton type="button" [label]="drawerMode === 'create' ? 'Save subject' : 'Update subject'" icon="pi pi-check" (click)="saveSubject()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminSubjects implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly confirmation = inject(ConfirmationService);
    private readonly messages = inject(MessageService);

    loading = true;
    subjects: SubjectResponse[] = [];
    dashboard: DashboardResponse | null = null;
    schools: SchoolResponse[] = [];
    searchTerm = '';
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    draft: { id?: number; schoolId: number | null; name: string } = { schoolId: null, name: '' };

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
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get filteredSubjects(): SubjectResponse[] {
        const query = this.searchTerm.trim().toLowerCase();
        return this.subjects.filter((subject) => {
            const matchesSearch = subject.name.toLowerCase().includes(query);
            const matchesSchool = !this.isPlatformAdmin || !this.selectedSchoolId || subject.schoolId === this.selectedSchoolId;
            return matchesSearch && matchesSchool;
        });
    }

    get subjectCount(): string {
        return this.subjects.length.toString();
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

    openCreate(): void {
        this.drawerMode = 'create';
        this.draft = { schoolId: this.selectedSchoolId ?? this.schools[0]?.id ?? null, name: '' };
        this.drawerVisible = true;
    }

    openEdit(subject: SubjectResponse): void {
        this.drawerMode = 'edit';
        this.draft = { id: subject.id, schoolId: subject.schoolId, name: subject.name };
        this.drawerVisible = true;
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        if (this.drawerVisible && this.drawerMode === 'create') {
            this.draft.schoolId = schoolId;
        }
        this.loadData();
    }

    saveSubject(): void {
        if (this.drawerMode === 'create') {
            if (this.isPlatformAdmin && !this.draft.schoolId) {
                this.messages.add({ severity: 'warn', summary: 'Missing school', detail: 'Choose the school before saving the subject.' });
                return;
            }

            this.api.createSubject({ name: this.draft.name }, this.draft.schoolId).subscribe({
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

        this.api.updateSubject(this.draft.id, { name: this.draft.name }, this.draft.schoolId).subscribe({
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

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
