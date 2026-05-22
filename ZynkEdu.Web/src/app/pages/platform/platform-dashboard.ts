import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { AttendanceDailySummaryResponse, DashboardResponse, SchoolResponse, StudentResponse, UserResponse } from '../../core/api/api.models';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface GrowthPoint {
    label: string;
    schools: number;
    students: number;
}

interface ActiveSchoolRow {
    schoolId: number;
    schoolName: string;
    score: number;
    passRate: number;
    results: number;
}

@Component({
    standalone: true,
    selector: 'app-platform-dashboard',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, ChartModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

        <section class="space-y-6">
            <header class="workspace-card overflow-hidden relative">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_30%),radial-gradient(circle_at_left,rgba(29,78,216,0.14),transparent_34%)]"></div>
                <div class="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr] items-center">
                    <div class="space-y-4">
                        <p class="text-sm uppercase tracking-[0.28em] text-muted-color font-semibold">Platform control tower</p>
                        <h1 class="text-4xl md:text-5xl font-display font-bold m-0">Global visibility across every school.</h1>
                        <p class="text-surface-600 dark:text-surface-300 max-w-3xl text-lg">
                            Monitor growth, attendance, performance, and activity from a single place, then drill into one school when you need a focused view.
                        </p>
                        <div class="flex flex-wrap gap-3">
                            <button pButton type="button" label="Schools" icon="pi pi-building" routerLink="/platform/schools"></button>
                            <button pButton type="button" label="Admins" icon="pi pi-user" severity="secondary" routerLink="/platform/admins"></button>
                            <button pButton type="button" label="System reports" icon="pi pi-file-pdf" severity="contrast" routerLink="/platform/reports"></button>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Filter school</label>
                            <app-dropdown
                                [options]="schoolOptions"
                                [(ngModel)]="selectedSchoolId"
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
                    </div>
                </div>
            </header>

            <section class="grid gap-4 sm:grid-cols-3">
                <app-metric-card
                    label="Schools"
                    [value]="schoolCount"
                    delta="Registered tenants"
                    hint="System-wide"
                    icon="pi pi-building"
                    tone="blue"
                    routerLink="/platform/schools"
                    [queryParams]="schoolDrilldownQuery"
                ></app-metric-card>
                <app-metric-card
                    label="Students"
                    [value]="studentCount"
                    delta="Across schools"
                    hint="Live directory"
                    icon="pi pi-users"
                    tone="green"
                    routerLink="/platform/students"
                    [queryParams]="schoolFocusQuery"
                ></app-metric-card>
                <app-metric-card
                    label="Attendance"
                    [value]="attendanceRate"
                    delta="All-time"
                    hint="Present rate"
                    icon="pi pi-check-circle"
                    tone="cyan"
                    routerLink="/platform/attendance"
                    [queryParams]="schoolFocusQuery"
                ></app-metric-card>
            </section>

            <article class="workspace-card flex flex-col">
                <div class="flex items-center justify-between gap-4 mb-5">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Growth analytics</h2>
                        <p class="text-sm text-muted-color">New schools and students added over the last six months.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ growthSeries.length }} months</span>
                </div>
                <div *ngIf="loading" class="flex-1">
                    <p-skeleton height="17rem" borderRadius="1rem"></p-skeleton>
                </div>
                <div *ngIf="!loading" class="chart-canvas-wrap flex-1 min-h-[17rem]">
                    <p-chart type="line" [data]="growthData" [options]="growthOptions" class="w-full h-full"></p-chart>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">All schools overview</h2>
                        <p class="text-sm text-muted-color">Every registered school with performance and activity data.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ activeSchools.length }} school(s)</span>
                </div>
                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>
                <p-table *ngIf="!loading" [value]="activeSchools" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>School</th>
                            <th>Results</th>
                            <th>Average</th>
                            <th>Pass rate</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-school>
                        <tr class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors" (click)="navigateToSchool(school.schoolId)">
                            <td class="font-semibold">{{ school.schoolName }}</td>
                            <td>{{ school.results }}</td>
                            <td>{{ school.score | number: '1.0-1' }}%</td>
                            <td>{{ school.passRate | number: '1.0-1' }}%</td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr>
                            <td colspan="4" class="text-center text-muted-color py-6">No schools registered yet.</td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>
        </section>
    `
})
export class PlatformDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly router = inject(Router);

    loading = true;
    errorMessage = '';
    schools: SchoolResponse[] = [];
    admins: UserResponse[] = [];
    students: StudentResponse[] = [];
    teachers: UserResponse[] = [];
    dashboard: DashboardResponse | null = null;
    attendanceSummaries: AttendanceDailySummaryResponse[] = [];
    growthSeries: GrowthPoint[] = [];
    activeSchools: ActiveSchoolRow[] = [];
    skeletonRows = Array.from({ length: 6 });
    selectedSchoolId: number | null = null;
    growthData!: ChartData<'line'>;
    growthOptions!: ChartOptions<'line'>;

    ngOnInit(): void {
        this.loadData();
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'All schools', value: null },
            ...this.schools
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((school) => ({ label: school.name, value: school.id }))
        ];
    }

    get schoolFocusQuery(): Record<string, unknown> | null {
        return this.selectedSchoolId ? { schoolId: this.selectedSchoolId } : null;
    }

    get schoolDrilldownQuery(): Record<string, unknown> | null {
        return this.selectedSchoolId ? { focus: this.selectedSchoolId } : null;
    }

    get schoolCount(): string {
        return this.schools.length.toString();
    }

    get studentCount(): string {
        return this.students.length.toString();
    }

    get attendanceRate(): string {
        const total = this.attendanceSummaries.reduce((sum, item) => sum + item.studentCount, 0);
        const present = this.attendanceSummaries.reduce((sum, item) => sum + item.presentCount, 0);
        return total > 0 ? `${((present * 100) / total).toFixed(1)}%` : '0%';
    }

    get systemHealthLabel(): string {
        const rate = this.attendanceRateValue;
        if (rate >= 85) {
            return 'Healthy';
        }

        if (rate >= 70) {
            return 'Watch';
        }

        return 'Needs attention';
    }

    get systemHealthSeverity(): 'success' | 'warning' | 'danger' {
        const rate = this.attendanceRateValue;
        if (rate >= 85) {
            return 'success';
        }

        if (rate >= 70) {
            return 'warning';
        }

        return 'danger';
    }

    get selectedSchoolLabel(): string {
        if (this.selectedSchoolId == null) {
            return 'All schools';
        }

        return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? `School ${this.selectedSchoolId}`;
    }

    navigateToSchool(schoolId: number): void {
        void this.router.navigate(['/platform/schools'], { queryParams: { focus: schoolId } });
    }

    loadData(): void {
        this.loading = true;
        this.errorMessage = '';
        forkJoin({
            schools: this.api.getPlatformSchools(),
            admins: this.api.getAdmins(this.selectedSchoolId),
            students: this.api.getStudents(undefined, this.selectedSchoolId),
            dashboard: this.api.getAdminDashboard(this.selectedSchoolId),
            attendance: this.api.getAttendanceDailySummaries(null, this.selectedSchoolId)
        }).subscribe({
            next: ({ schools, admins, students, dashboard, attendance }) => {
                this.schools = schools;
                this.admins = admins;
                this.students = students;
                this.dashboard = dashboard;
                this.attendanceSummaries = attendance;
                this.growthSeries = this.buildGrowthSeries();
                this.activeSchools = this.buildActiveSchools();
                this.buildCharts();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Failed to load data. Please refresh or check your connection.';
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    private buildGrowthSeries(): GrowthPoint[] {
        const months = this.getRecentMonths(6);
        return months.map((month) => ({
            label: month.label,
            schools: this.countCreatedInMonth(this.schools, month.date),
            students: this.countCreatedInMonth(this.students, month.date)
        }));
    }

    private buildActiveSchools(): ActiveSchoolRow[] {
        const perfMap = new Map((this.dashboard?.schoolPerformance ?? []).map((p) => [p.schoolId, p]));
        return this.schools
            .map((school) => {
                const perf = perfMap.get(school.id);
                return {
                    schoolId: school.id,
                    schoolName: school.name,
                    score: perf?.averageScore ?? 0,
                    passRate: perf?.passRate ?? 0,
                    results: perf?.resultCount ?? 0
                };
            })
            .sort((a, b) => b.results - a.results);
    }

    private buildCharts(): void {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color').trim();
        const mutedColor = documentStyle.getPropertyValue('--text-color-secondary').trim();
        const borderColor = documentStyle.getPropertyValue('--surface-border').trim();
        const growthLabels = this.growthSeries.map((entry) => entry.label);

        this.growthData = {
            labels: growthLabels,
            datasets: [
                {
                    label: 'New schools',
                    data: this.growthSeries.map((entry) => entry.schools),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.18)',
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'New students',
                    data: this.growthSeries.map((entry) => entry.students),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.18)',
                    fill: true,
                    tension: 0.35
                }
            ]
        };

        this.growthOptions = {
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
                    beginAtZero: true,
                    ticks: {
                        color: mutedColor,
                        precision: 0
                    },
                    grid: {
                        color: borderColor
                    }
                }
            }
        };

    }

    private getRecentMonths(count: number): { label: string; date: Date }[] {
        const months: { label: string; date: Date }[] = [];
        const current = new Date();
        current.setDate(1);

        for (let index = count - 1; index >= 0; index--) {
            const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
            months.push({
                date,
                label: date.toLocaleDateString('en-GB', { month: 'short' })
            });
        }

        return months;
    }

    private countCreatedInMonth<T extends { createdAt: string }>(items: T[], month: Date): number {
        return items.filter((item) => {
            const created = new Date(item.createdAt);
            return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
        }).length;
    }

    private get attendanceRateValue(): number {
        const total = this.attendanceSummaries.reduce((sum, item) => sum + item.studentCount, 0);
        const present = this.attendanceSummaries.reduce((sum, item) => sum + item.presentCount, 0);
        return total > 0 ? (present * 100) / total : 0;
    }
}
