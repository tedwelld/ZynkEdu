import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { DashboardResponse, ResultResponse, SchoolPerformanceDto } from '../../core/api/api.models';
import { LayoutService } from '../../layout/service/layout.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface SchoolComparisonRow extends SchoolPerformanceDto {
    rank: number;
}

@Component({
    standalone: true,
    selector: 'app-admin-results',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, ChartModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Academics</p>
                    <h1 class="text-3xl font-display font-bold m-0">School results comparison</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Compare every school in the system with the same chart layout, side by side, from one clean view and approve the submitted result rows below.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Open Reports" icon="pi pi-file-pdf" severity="contrast" routerLink="/admin/reports"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Schools compared" [value]="schoolsCompared" delta="System-wide" hint="Comparison set" icon="pi pi-building" tone="blue" direction="up" routerLink="/platform/schools"></app-metric-card>
                <app-metric-card label="Overall average" [value]="overallAverage" delta="Across schools" hint="Mean score" icon="pi pi-chart-bar" tone="purple" direction="up" routerLink="/admin/dashboard"></app-metric-card>
                <app-metric-card label="Best school" [value]="bestSchoolScore" [delta]="bestSchoolName" hint="Top average" icon="pi pi-trophy" tone="green" direction="up" routerLink="/platform/schools"></app-metric-card>
                <app-metric-card label="Results counted" [value]="resultCountTotal" delta="All rows" hint="Available results" icon="pi pi-list" tone="orange" direction="up" routerLink="/admin/reports"></app-metric-card>
            </section>

            <section class="grid gap-5 xl:grid-cols-2 items-stretch">
                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Line comparison</h2>
                            <p class="text-sm text-muted-color">Average score and pass rate for every school.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ schoolsCompared }} schools</span>
                    </div>

                    <div *ngIf="loading" class="flex-1">
                        <p-skeleton height="18rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="chart-canvas-wrap flex-1 min-h-[14rem]">
                        <p-chart type="line" [data]="lineData" [options]="lineOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>

                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Result share</h2>
                            <p class="text-sm text-muted-color">How the total result count is distributed across schools.</p>
                        </div>
                        <span class="text-sm text-muted-color">Shared view</span>
                    </div>

                    <div *ngIf="loading" class="flex-1">
                        <p-skeleton height="18rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="chart-canvas-wrap flex-1 min-h-[14rem] flex items-center justify-center">
                        <p-chart type="pie" [data]="pieData" [options]="pieOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">School comparison table</h2>
                        <p class="text-sm text-muted-color">Ranked by average score for quick review.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ comparisonRows.length }} rows</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="comparisonRows" [rows]="10" [paginator]="true" [rowHover]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Rank</th>
                            <th>School</th>
                            <th>Average score</th>
                            <th>Pass rate</th>
                            <th>Results</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                        <tr>
                            <td class="font-semibold">{{ row.rank }}</td>
                            <td>{{ row.schoolName }}</td>
                            <td>{{ row.averageScore | number : '1.0-1' }}%</td>
                            <td>
                                <p-tag [value]="percentLabel(row.passRate)" [severity]="row.passRate >= 75 ? 'success' : row.passRate >= 60 ? 'warning' : 'danger'"></p-tag>
                            </td>
                            <td>{{ row.resultCount }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Result oversight</h2>
                        <p class="text-sm text-muted-color">Filter all submitted results and approve, reject, reopen, or lock records.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ filteredResults.length }} rows</span>
                </div>

                <div class="grid gap-4 xl:grid-cols-4 mb-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject</label>
                        <app-dropdown [options]="subjectOptions" [(ngModel)]="selectedSubject" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Term</label>
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTerm" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Approval</label>
                        <app-dropdown [options]="approvalOptions" [(ngModel)]="selectedApproval" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                    </div>
                </div>

                <p-table [value]="filteredResults" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Score</th>
                            <th>Term</th>
                            <th>Approval</th>
                            <th>Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-result>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ result.studentName }}</div>
                                <div class="text-xs text-muted-color">{{ result.studentNumber }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ classForResult(result) }}</td>
                            <td>{{ result.subjectName }}</td>
                            <td class="font-semibold">{{ result.score | number : '1.0-1' }}%</td>
                            <td>{{ result.term }}</td>
                            <td>
                                <p-tag [value]="result.approvalStatus" [severity]="approvalSeverity(result.approvalStatus)"></p-tag>
                            </td>
                            <td>
                                <p-tag [value]="result.isLocked ? 'Locked' : 'Open'" [severity]="result.isLocked ? 'success' : 'warning'"></p-tag>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-check" class="p-button-text p-button-sm" (click)="approve(result)" [disabled]="result.isLocked && result.approvalStatus === 'Approved'"></button>
                                <button pButton type="button" icon="pi pi-times" class="p-button-text p-button-sm p-button-danger" (click)="reject(result)" [disabled]="result.isLocked && result.approvalStatus === 'Rejected'"></button>
                                <button pButton type="button" icon="pi pi-lock-open" class="p-button-text p-button-sm" (click)="reopen(result)" [disabled]="!result.isLocked"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>
        </section>
    `
})
export class AdminResults implements OnInit {
    private readonly api = inject(ApiService);
    private readonly layout = inject(LayoutService);
    private readonly route = inject(ActivatedRoute);

    dashboard: DashboardResponse | null = null;
    results: ResultResponse[] = [];
    selectedSchoolId: number | null = null;
    loading = true;
    skeletonRows = Array.from({ length: 4 });
    comparisonRows: SchoolComparisonRow[] = [];
    selectedClass = 'All';
    selectedSubject = 'All';
    selectedTerm = 'All';
    selectedApproval = 'All';
    classOptions: { label: string; value: string }[] = [{ label: 'All classes', value: 'All' }];
    subjectOptions: { label: string; value: string }[] = [{ label: 'All subjects', value: 'All' }];
    termOptions: { label: string; value: string }[] = [{ label: 'All terms', value: 'All' }];
    approvalOptions: { label: string; value: string }[] = [
        { label: 'All approvals', value: 'All' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Rejected', value: 'Rejected' }
    ];
    lineData!: ChartData<'line'>;
    lineOptions!: ChartOptions<'line'>;
    pieData!: ChartData<'pie'>;
    pieOptions!: ChartOptions<'pie'>;
    schoolsCompared = '0';
    overallAverage = '0%';
    bestSchoolName = 'No data yet';
    bestSchoolScore = '0%';
    resultCountTotal = '0';

    constructor() {
        this.layout.configUpdate$.subscribe(() => {
            if (this.dashboard) {
                this.buildCharts();
            }
        });
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
        forkJoin({
            dashboard: this.api.getAdminDashboard(this.selectedSchoolId),
            results: this.api.getResults()
        }).subscribe({
            next: ({ dashboard, results }) => {
                this.dashboard = dashboard;
                this.results = results;
                this.comparisonRows = this.filteredSchoolPerformance(dashboard.schoolPerformance)
                    .map((row, index) => ({
                        ...row,
                        rank: index + 1
                    }))
                    .sort((a, b) => b.averageScore - a.averageScore)
                    .map((row, index) => ({
                        ...row,
                        rank: index + 1
                    }));
                this.schoolsCompared = this.comparisonRows.length.toString();
                this.overallAverage = `${dashboard.overallAverageScore.toFixed(1)}%`;
                this.bestSchoolName = this.comparisonRows[0]?.schoolName ?? 'No data yet';
                this.bestSchoolScore = `${this.comparisonRows[0]?.averageScore.toFixed(1) ?? '0.0'}%`;
                this.resultCountTotal = this.comparisonRows.reduce((total, row) => total + row.resultCount, 0).toString();
                this.classOptions = [{ label: 'All classes', value: 'All' }, ...Array.from(new Set(this.filteredResultsSource().map((result) => this.classForResult(result)))).sort().map((value) => ({ label: value, value }))];
                this.subjectOptions = [{ label: 'All subjects', value: 'All' }, ...Array.from(new Set(this.filteredResultsSource().map((result) => result.subjectName))).sort().map((value) => ({ label: value, value }))];
                this.termOptions = [{ label: 'All terms', value: 'All' }, ...Array.from(new Set(this.filteredResultsSource().map((result) => result.term))).sort().map((value) => ({ label: value, value }))];
                this.buildCharts();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get filteredResults(): ResultResponse[] {
        return this.filteredResultsSource().filter((result) => {
            const matchesClass = this.selectedClass === 'All' || this.classForResult(result) === this.selectedClass;
            const matchesSubject = this.selectedSubject === 'All' || result.subjectName === this.selectedSubject;
            const matchesTerm = this.selectedTerm === 'All' || result.term === this.selectedTerm;
            const matchesApproval = this.selectedApproval === 'All' || result.approvalStatus === this.selectedApproval;
            return matchesClass && matchesSubject && matchesTerm && matchesApproval;
        });
    }

    private filteredResultsSource(): ResultResponse[] {
        if (!this.selectedSchoolId) {
            return this.results;
        }

        return this.results.filter((result) => result.schoolId === this.selectedSchoolId);
    }

    private filteredSchoolPerformance(rows: SchoolPerformanceDto[]): SchoolPerformanceDto[] {
        return this.selectedSchoolId ? rows.filter((row) => row.schoolId === this.selectedSchoolId) : rows;
    }

    percentLabel(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    approvalSeverity(status: string): 'success' | 'warning' | 'danger' | 'secondary' {
        if (status === 'Approved') {
            return 'success';
        }

        if (status === 'Rejected') {
            return 'danger';
        }

        if (status === 'Pending') {
            return 'warning';
        }

        return 'secondary';
    }

    classForResult(result: ResultResponse): string {
        return result.studentClass || 'Unassigned';
    }

    approve(result: ResultResponse): void {
        this.api.approveResult(result.id).subscribe({
            next: (updated) => {
                this.results = this.results.map((item) => (item.id === updated.id ? updated : item));
                this.loading = false;
            }
        });
    }

    reject(result: ResultResponse): void {
        this.api.rejectResult(result.id).subscribe({
            next: (updated) => {
                this.results = this.results.map((item) => (item.id === updated.id ? updated : item));
                this.loading = false;
            }
        });
    }

    reopen(result: ResultResponse): void {
        this.api.reopenResult(result.id).subscribe({
            next: (updated) => {
                this.results = this.results.map((item) => (item.id === updated.id ? updated : item));
                this.loading = false;
            }
        });
    }

    private buildCharts(): void {
        if (!this.dashboard) {
            return;
        }

        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color-secondary').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-border').trim();
        const palette = ['#2563eb', '#7c3aed', '#0f766e', '#ea580c', '#db2777', '#16a34a', '#e11d48', '#0284c7'];
        const schoolLabels = this.comparisonRows.map((row) => row.schoolName);

        this.lineData = {
            labels: schoolLabels,
            datasets: [
                {
                    label: 'Average score',
                    data: this.comparisonRows.map((row) => row.averageScore),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'Pass rate',
                    data: this.comparisonRows.map((row) => row.passRate),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.15)',
                    fill: true,
                    tension: 0.35
                }
            ]
        };

        this.lineOptions = {
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
                        color: mutedColor
                    },
                    grid: {
                        color: 'transparent'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: mutedColor
                    },
                    grid: {
                        color: borderColor
                    }
                }
            }
        };

        this.pieData = {
            labels: schoolLabels,
            datasets: [
                {
                    data: this.comparisonRows.map((row) => row.resultCount),
                    backgroundColor: schoolLabels.map((_, index) => palette[index % palette.length]),
                    borderColor: palette.map(() => '#ffffff'),
                    borderWidth: 2
                }
            ]
        };

        this.pieOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        usePointStyle: true
                    }
                }
            }
        };
    }
}
