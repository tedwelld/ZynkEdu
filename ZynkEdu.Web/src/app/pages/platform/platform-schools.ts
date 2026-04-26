import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api/api.service';
import { DashboardResponse, SchoolResponse } from '../../core/api/api.models';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-platform-schools',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, SkeletonModule, TableModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Platform</p>
                    <h1 class="text-3xl font-display font-bold m-0">Schools</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Open any school to view its own performance cards, then edit or remove schools from here.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Add School" icon="pi pi-building" (click)="openSchoolCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Schools" [value]="schoolCount" delta="Platform scope" hint="Registered schools" icon="pi pi-building" tone="blue"></app-metric-card>
                <app-metric-card label="Selected avg" [value]="selectedAverage" delta="Selected school" hint="Performance" icon="pi pi-chart-line" tone="green"></app-metric-card>
                <app-metric-card label="Selected pass" [value]="selectedPassRate" delta="Selected school" hint="Pass rate" icon="pi pi-check-circle" tone="purple"></app-metric-card>
                <app-metric-card label="Watchlist" [value]="selectedWatchCount" delta="Selected school" hint="At-risk students" icon="pi pi-exclamation-triangle" tone="orange" direction="down"></app-metric-card>
            </section>

            <section class="grid gap-6">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">School list</h2>
                            <p class="text-sm text-muted-color">Pick a school to inspect its cards.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ schools.length }} total</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <p-table *ngIf="!loading" [value]="schools" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>School</th>
                                <th>Address</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-school>
                            <tr class="cursor-pointer" [ngClass]="selectedSchool?.id === school.id ? 'bg-surface-50 dark:bg-surface-900/60' : ''" (click)="selectSchool(school)">
                                <td class="font-semibold">{{ school.name }}</td>
                                <td class="text-sm text-muted-color">{{ school.address }}</td>
                                <td class="text-right">
                                    <button pButton type="button" label="View" class="p-button-text p-button-sm" (click)="selectSchool(school)"></button>
                                    <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openSchoolEdit(school)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteSchool(school)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </article>
            </section>

            <p-dialog [(visible)]="schoolDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="schoolDrawerMode === 'create' ? 'Add school' : 'Edit school'" appendTo="body">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Name</label>
                        <input pInputText [(ngModel)]="schoolDraft.name" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Address</label>
                        <input pInputText [(ngModel)]="schoolDraft.address" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Admin contact email</label>
                        <input pInputText [(ngModel)]="schoolDraft.adminContactEmail" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="schoolDrawerVisible = false"></button>
                        <button pButton type="button" [label]="schoolDrawerMode === 'create' ? 'Save school' : 'Update school'" icon="pi pi-check" (click)="saveSchool()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="schoolModalVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(54rem, 96vw)' }" header="School view" appendTo="body">
                <div *ngIf="selectedSchool && !loadingSchool" class="space-y-5">
                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <div class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">Selected school</div>
                                <div class="text-2xl font-display font-bold mt-1">{{ selectedSchool.name }}</div>
                                <div class="text-sm text-muted-color mt-1">{{ selectedSchool.address }}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm text-muted-color">Average</div>
                                <div class="text-2xl font-bold">{{ selectedAverage }}</div>
                            </div>
                        </div>
                    </div>

                    <div *ngIf="selectedDashboard" class="grid gap-4 md:grid-cols-2">
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h3 class="text-lg font-display font-bold mb-1">At-risk students</h3>
                                    <p class="text-sm text-muted-color">Students who need support.</p>
                                </div>
                                <span class="text-xs uppercase tracking-[0.2em] text-rose-500 font-semibold">{{ selectedDashboard.bottomStudents.length }} watchlist</span>
                            </div>
                            <div class="space-y-3">
                                <div *ngFor="let student of selectedDashboard.bottomStudents" class="flex items-start justify-between gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                    <div>
                                        <div class="font-semibold">{{ student.studentName }}</div>
                                        <div class="text-sm text-muted-color">{{ student.studentNumber }}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="font-bold text-rose-600">{{ student.averageScore | number: '1.0-1' }}%</div>
                                        <div class="text-xs text-muted-color">Average</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h3 class="text-lg font-display font-bold mb-1">Top classes</h3>
                                    <p class="text-sm text-muted-color">Best-performing classes in this school.</p>
                                </div>
                                <i class="pi pi-trophy text-2xl text-amber-500"></i>
                            </div>
                            <div class="space-y-3">
                                <div *ngFor="let classRow of topClasses; let i = index" class="rounded-2xl p-3 bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700">
                                    <div class="flex items-center justify-between mb-1">
                                        <div class="font-semibold">{{ i + 1 }}. {{ classRow.class }}</div>
                                        <div class="font-bold">{{ classRow.averageScore | number: '1.0-1' }}%</div>
                                    </div>
                                    <div class="text-xs text-muted-color">{{ classRow.passRate | number: '1.0-1' }}% pass rate</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div *ngIf="loadingSchool" class="space-y-3">
                        <p-skeleton height="6rem" borderRadius="1.5rem"></p-skeleton>
                        <div class="grid gap-4 md:grid-cols-2">
                            <p-skeleton height="18rem" borderRadius="1.5rem"></p-skeleton>
                            <p-skeleton height="18rem" borderRadius="1.5rem"></p-skeleton>
                        </div>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class PlatformSchools implements OnInit {
    private readonly api = inject(ApiService);
    private readonly route = inject(ActivatedRoute);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    loadingSchool = false;
    schools: SchoolResponse[] = [];
    selectedSchool: SchoolResponse | null = null;
    selectedDashboard: DashboardResponse | null = null;
    skeletonRows = Array.from({ length: 4 });
    schoolDrawerVisible = false;
    schoolModalVisible = false;
    schoolDrawerMode: 'create' | 'edit' = 'create';
    schoolDraft: { id?: number; name: string; address: string; adminContactEmail: string } = { name: '', address: '', adminContactEmail: '' };

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.api.getPlatformSchools().subscribe({
            next: (schools) => {
                this.schools = schools;
                this.loading = false;
                const focusId = Number(this.route.snapshot.queryParamMap.get('focus'));
                const selected = Number.isFinite(focusId) ? this.schools.find((school) => school.id === focusId) ?? this.schools[0] : this.schools[0];
                if (selected) {
                    this.selectedSchool = selected;
                    this.loadSchoolDashboard(selected, false);
                } else {
                    this.selectedSchool = null;
                    this.selectedDashboard = null;
                    this.loadingSchool = false;
                }
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get schoolCount(): string {
        return this.schools.length.toString();
    }

    get selectedAverage(): string {
        return this.selectedDashboard ? `${this.selectedDashboard.overallAverageScore.toFixed(1)}%` : '0%';
    }

    get selectedPassRate(): string {
        return this.selectedDashboard ? `${this.selectedDashboard.passRate.toFixed(1)}%` : '0%';
    }

    get selectedWatchCount(): string {
        return this.selectedDashboard ? this.selectedDashboard.bottomStudents.length.toString() : '0';
    }

    get topClasses(): DashboardResponse['classPerformance'] {
        return [...(this.selectedDashboard?.classPerformance ?? [])].sort((a, b) => b.averageScore - a.averageScore);
    }

    selectSchool(school: SchoolResponse): void {
        this.selectedSchool = school;
        this.schoolModalVisible = true;
        this.loadSchoolDashboard(school, true);
    }

    private loadSchoolDashboard(school: SchoolResponse, openModal: boolean): void {
        this.loadingSchool = true;
        if (openModal) {
            this.schoolModalVisible = true;
        }
        this.api.getAdminDashboard(school.id).subscribe({
            next: (dashboard) => {
                this.selectedDashboard = dashboard;
                this.loadingSchool = false;
            },
            error: () => {
                this.selectedDashboard = null;
                this.loadingSchool = false;
            }
        });
    }

    openSchoolCreate(): void {
        this.schoolDrawerMode = 'create';
        this.schoolDraft = { name: '', address: '', adminContactEmail: '' };
        this.schoolDrawerVisible = true;
    }

    openSchoolEdit(school: SchoolResponse): void {
        this.schoolDrawerMode = 'edit';
        this.schoolDraft = { id: school.id, name: school.name, address: school.address, adminContactEmail: school.adminContactEmail ?? '' };
        this.schoolDrawerVisible = true;
    }

    saveSchool(): void {
        if (this.schoolDrawerMode === 'create') {
            if (!this.schoolDraft.name.trim() || !this.schoolDraft.address.trim() || !this.schoolDraft.adminContactEmail.trim()) {
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Fill in the school details before saving.' });
                return;
            }

            this.api.createSchool({ name: this.schoolDraft.name, address: this.schoolDraft.address, adminContactEmail: this.schoolDraft.adminContactEmail }).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'School saved', detail: `${this.schoolDraft.name} added.` });
                    this.schoolDrawerVisible = false;
                    this.loadData();
                }
            });
            return;
        }

        if (!this.schoolDraft.id) {
            return;
        }

        if (!this.schoolDraft.name.trim() || !this.schoolDraft.address.trim() || !this.schoolDraft.adminContactEmail.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Fill in the school details before updating.' });
            return;
        }

        this.api.updateSchool(this.schoolDraft.id, { name: this.schoolDraft.name, address: this.schoolDraft.address, adminContactEmail: this.schoolDraft.adminContactEmail }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'School updated', detail: `${this.schoolDraft.name} saved.` });
                this.schoolDrawerVisible = false;
                this.loadData();
            }
        });
    }

    deleteSchool(school: SchoolResponse): void {
        this.confirmation.confirm({
            message: `Delete ${school.name}?`,
            header: 'Delete school',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteSchool(school.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'School deleted', detail: `${school.name} removed.` });
                        if (this.selectedSchool?.id === school.id) {
                            this.selectedSchool = null;
                            this.selectedDashboard = null;
                        }
                        this.loadData();
                    }
                })
        });
    }
}
