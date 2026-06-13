import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { AttendanceDailySummaryResponse, ResultResponse, TeacherAssignmentResponse } from '../../core/api/api.models';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface TeacherClassInsight {
    className: string;
    subjectNames: string[];
    averageScore: number;
    passRate: number;
    resultCount: number;
}

@Component({
    standalone: true,
    selector: 'app-teacher-dashboard',
    imports: [CommonModule, RouterLink, ButtonModule, ChartModule, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

            <header class="workspace-card overflow-hidden relative">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_left,rgba(124,58,237,0.12),transparent_30%)]"></div>
                <div class="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div class="space-y-3 max-w-3xl">
                        <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teaching workspace</p>
                        <h1 class="text-3xl md:text-4xl font-display font-bold m-0">Your classroom control center</h1>
                        <p class="text-muted-color max-w-2xl">
                            Today&apos;s at-a-glance view of your classes, student attendance, and performance trends.
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="info" routerLink="/teacher/attendance"></button>
                        <button pButton type="button" label="Results" icon="pi pi-table" routerLink="/teacher/results"></button>
                        <button pButton type="button" label="Classes" icon="pi pi-users" severity="info" routerLink="/teacher/classes"></button>
                        <button pButton type="button" label="Settings" icon="pi pi-cog" severity="info" routerLink="/account/settings"></button>
                    </div>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card
                    *ngFor="let card of quickCards"
                    [label]="card.label"
                    [value]="card.value"
                    [delta]="card.delta"
                    [hint]="card.hint"
                    [icon]="card.icon"
                    [tone]="card.tone"
                    [direction]="card.direction"
                    [routerLink]="card.route"
                    [queryParams]="card.queryParams ?? null"
                ></app-metric-card>
            </section>

            <article class="workspace-card h-full flex flex-col">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Performance trend</h2>
                        <p class="text-sm text-muted-color">Average score and pass rate across your classes.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ classInsights.length }} class(es)</span>
                </div>

                <div *ngIf="loading" class="flex-1">
                    <p-skeleton height="16rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && classInsights.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No class results are available yet. Enter results in the Results page to populate this chart.
                </div>

                <div *ngIf="!loading && classInsights.length > 0" class="chart-canvas-wrap flex-1 min-h-[16rem]">
                    <p-chart type="line" [data]="chartData" [options]="chartOptions" class="w-full h-full"></p-chart>
                </div>
            </article>
        </section>
    `
})
export class TeacherDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    errorMessage = '';
    assignments: TeacherAssignmentResponse[] = [];
    classInsights: TeacherClassInsight[] = [];
    attendanceSummaries: AttendanceDailySummaryResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    chartData!: ChartData<'line'>;
    chartOptions!: ChartOptions<'line'>;

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const schoolId = this.auth.schoolId() ?? undefined;
        const assignmentSource = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();

        assignmentSource.pipe(
            catchError(() => of([] as TeacherAssignmentResponse[])),
            switchMap((assignments) => {
                this.assignments = assignments;
                const classNames = Array.from(new Set(assignments.map((a) => a.class)));
                return forkJoin({
                    resultsByClass: classNames.length > 0
                        ? forkJoin(classNames.map((cn) => this.api.getResultsByClass(cn).pipe(catchError(() => of([] as ResultResponse[])))))
                        : of([] as ResultResponse[][]),
                    attendanceSummaries: this.api.getAttendanceDailySummaries(this.serializeDate(new Date()), schoolId).pipe(
                        catchError(() => of([] as AttendanceDailySummaryResponse[]))
                    )
                });
            })
        ).subscribe({
            next: ({ resultsByClass, attendanceSummaries }) => {
                const classNames = Array.from(new Set(this.assignments.map((a) => a.class)));
                this.attendanceSummaries = attendanceSummaries;
                this.classInsights = classNames.map((className, index) => this.buildInsight(className, resultsByClass[index] ?? []));
                this.buildChart();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get quickCards(): Array<{ label: string; value: string; delta: string; hint: string; icon: string; tone: 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red'; route: string; queryParams?: Record<string, unknown>; direction: 'up' | 'down' | 'flat' }> {
        return [
            {
                label: 'Students',
                value: this.studentCount,
                delta: 'Assigned learners',
                hint: 'Across your classes',
                icon: 'pi pi-users',
                tone: 'blue',
                route: '/teacher/classes',
                direction: 'up'
            },
            {
                label: 'Classes',
                value: this.classCount,
                delta: 'Teaching load',
                hint: 'Current timetable',
                icon: 'pi pi-sitemap',
                tone: 'purple',
                route: '/teacher/classes',
                direction: 'up'
            },
            {
                label: 'Attendance',
                value: this.attendanceRate,
                delta: 'Today',
                hint: 'Latest register',
                icon: 'pi pi-check-circle',
                tone: 'green',
                route: '/teacher/attendance',
                direction: 'up'
            },
            {
                label: 'Pending results',
                value: this.pendingResultsCount,
                delta: 'Needs attention',
                hint: 'Classes with no results',
                icon: 'pi pi-clock',
                tone: 'orange',
                route: '/teacher/results',
                direction: this.pendingResultsCount === '0' ? 'flat' : 'down'
            }
        ];
    }

    get classCount(): string {
        return new Set(this.assignments.map((assignment) => assignment.class)).size.toString();
    }

    get subjectCount(): string {
        return new Set(this.assignments.map((assignment) => assignment.subjectName)).size.toString();
    }

    get studentCount(): string {
        return this.attendanceSummaries.reduce((total, summary) => total + summary.studentCount, 0).toString();
    }

    get attendanceRate(): string {
        if (this.attendanceSummaries.length === 0) {
            return '0%';
        }

        const totalStudents = this.attendanceSummaries.reduce((total, summary) => total + summary.studentCount, 0);
        const totalPresent = this.attendanceSummaries.reduce((total, summary) => total + summary.presentCount, 0);
        if (totalStudents === 0) {
            return '0%';
        }

        return `${((totalPresent / totalStudents) * 100).toFixed(1)}%`;
    }

    get pendingResultsCount(): string {
        return this.classInsights.filter((item) => item.resultCount === 0).length.toString();
    }

    percentLabel(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    private buildInsight(className: string, results: ResultResponse[]): TeacherClassInsight {
        const uniqueSubjects = Array.from(new Set(results.map((result) => result.subjectName)));
        const passRate = results.length === 0 ? 0 : (results.filter((result) => result.score >= 50).length / results.length) * 100;
        const averageScore = results.length === 0 ? 0 : results.reduce((total, result) => total + result.score, 0) / results.length;

        return {
            className,
            subjectNames: uniqueSubjects,
            averageScore,
            passRate,
            resultCount: results.length
        };
    }

    private buildChart(): void {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color-secondary').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-border').trim();

        this.chartData = {
            labels: this.classInsights.map((item) => item.className),
            datasets: [
                {
                    label: 'Pass rate',
                    data: this.classInsights.map((item) => item.passRate),
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.16)',
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'Average score',
                    data: this.classInsights.map((item) => item.averageScore),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.16)',
                    fill: true,
                    tension: 0.35
                }
            ]
        };

        this.chartOptions = {
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
    }

    private serializeDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }
}
