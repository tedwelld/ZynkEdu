import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { ResultResponse, TeacherAssignmentResponse } from '../../core/api/api.models';

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
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teaching Workspace</p>
                    <h1 class="text-3xl font-display font-bold m-0">Your class control room</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">View the classes you teach, the subjects behind them, and the pass-rate trend across your load.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="secondary" routerLink="/teacher/attendance"></button>
                    <button pButton type="button" label="Enter results" icon="pi pi-table" routerLink="/teacher/results"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                    <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="help" routerLink="/teacher/profile"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Classes" [value]="classCount" delta="Assigned load" hint="Classes taught" icon="pi pi-sitemap" tone="blue"></app-metric-card>
                <app-metric-card label="Subjects" [value]="subjectCount" delta="School scope" hint="Subjects covered" icon="pi pi-book" tone="purple"></app-metric-card>
                <app-metric-card label="Average pass rate" [value]="averagePassRate" delta="Current term" hint="Across classes" icon="pi pi-chart-line" tone="green"></app-metric-card>
                <app-metric-card label="Results reviewed" [value]="resultCount" delta="Live data" hint="Loaded rows" icon="pi pi-check-circle" tone="orange"></app-metric-card>
            </section>

            <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-stretch">
                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Classes you teach</h2>
                            <p class="text-sm text-muted-color">Each card shows the class, subjects, and current result coverage.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ classInsights.length }} classes</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="grid gap-3 md:grid-cols-2">
                        <article *ngFor="let item of classInsights" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Class</div>
                                    <div class="text-xl font-display font-bold">{{ item.className }}</div>
                                </div>
                                <p-tag [value]="percentLabel(item.passRate)" [severity]="item.passRate >= 75 ? 'success' : item.passRate >= 60 ? 'warning' : 'danger'"></p-tag>
                            </div>
                            <div class="mt-3 text-sm text-muted-color">
                                {{ item.subjectNames.join(', ') }}
                            </div>
                            <div class="mt-3 flex items-center justify-between text-sm">
                                <span class="text-muted-color">{{ item.resultCount }} results</span>
                                <button pButton type="button" label="Open" icon="pi pi-arrow-right" class="p-button-text p-button-sm" [routerLink]="['/teacher/classes']" [queryParams]="{ class: item.className }"></button>
                            </div>
                        </article>
                    </div>
                </article>

                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Average pass rate line</h2>
                            <p class="text-sm text-muted-color">A simple trend view of the pass rate across your classes.</p>
                        </div>
                        <span class="text-sm text-muted-color">Current term</span>
                    </div>

                    <div *ngIf="loading" class="flex-1">
                        <p-skeleton height="24rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="chart-canvas-wrap flex-1 min-h-[24rem]">
                        <p-chart type="line" [data]="chartData" [options]="chartOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>
            </section>
        </section>
    `
})
export class TeacherDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    assignments: TeacherAssignmentResponse[] = [];
    classInsights: TeacherClassInsight[] = [];
    skeletonRows = Array.from({ length: 4 });
    chartData!: ChartData<'line'>;
    chartOptions!: ChartOptions<'line'>;

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const request = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();

        request.subscribe({
            next: (assignments) => {
                this.assignments = assignments;
                const classNames = Array.from(new Set(assignments.map((assignment) => assignment.class)));
                if (classNames.length === 0) {
                    this.loading = false;
                    this.buildChart([]);
                    return;
                }

                forkJoin(classNames.map((className) => this.api.getResultsByClass(className))).subscribe({
                    next: (resultsByClass) => {
                        this.classInsights = classNames.map((className, index) => this.buildInsight(className, resultsByClass[index]));
                        this.buildChart(this.classInsights);
                        this.loading = false;
                    },
                    error: () => {
                        this.loading = false;
                    }
                });
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get classCount(): string {
        return new Set(this.assignments.map((assignment) => assignment.class)).size.toString();
    }

    get subjectCount(): string {
        return new Set(this.assignments.map((assignment) => assignment.subjectName)).size.toString();
    }

    get averagePassRate(): string {
        if (this.classInsights.length === 0) {
            return '0%';
        }

        const average = this.classInsights.reduce((total, item) => total + item.passRate, 0) / this.classInsights.length;
        return `${average.toFixed(1)}%`;
    }

    get resultCount(): string {
        return this.classInsights.reduce((total, item) => total + item.resultCount, 0).toString();
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

    private buildChart(insights: TeacherClassInsight[]): void {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color-secondary').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-border').trim();

        this.chartData = {
            labels: insights.map((item) => item.className),
            datasets: [
                {
                    label: 'Pass rate',
                    data: insights.map((item) => item.passRate),
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.16)',
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'Average score',
                    data: insights.map((item) => item.averageScore),
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
}
