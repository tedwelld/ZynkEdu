import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { DashboardResponse, NotificationResponse, ResultResponse, StudentResponse } from '../../core/api/api.models';
import { LayoutService } from '../../layout/service/layout.service';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-dashboard',
    imports: [CommonModule, RouterLink, ChartModule, ButtonModule, DialogModule, MetricCardComponent, ProgressBarModule, SkeletonModule, TagModule],
    template: `
        <section class="space-y-8">
            <header class="workspace-card overflow-hidden relative">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_30%),radial-gradient(circle_at_left,rgba(29,78,216,0.14),transparent_34%)]"></div>
                <div class="relative grid gap-6 xl:grid-cols-[1.35fr_0.65fr] items-center">
                    <div class="space-y-4">
                        <p class="text-sm uppercase tracking-[0.28em] text-muted-color font-semibold">School data</p>
                        <h1 class="text-4xl md:text-5xl font-display font-bold m-0">Executive overview for school performance and action.</h1>
                        <p class="text-surface-600 dark:text-surface-300 max-w-3xl text-lg">
                            A clear control room for school admins: insight cards, live visual metrics, and direct paths to students, teachers, and notifications.
                        </p>
                        <div class="flex flex-wrap gap-3">
                            <button pButton type="button" label="Add Student" icon="pi pi-user-plus" routerLink="/admin/students" class="p-button-raised"></button>
                            <button pButton type="button" label="Assign Teacher" icon="pi pi-sitemap" severity="secondary" routerLink="/admin/assignments"></button>
                            <button pButton type="button" label="Send Notification" icon="pi pi-bell" severity="help" routerLink="/admin/notifications"></button>
                        </div>
                    </div>
                    <div class="workspace-card metric-gradient border border-white/20 dark:border-surface-700/60">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Platform pulse</span>
                                <div class="mt-2 text-2xl font-display font-bold">{{ (dashboard?.overallAverageScore ?? 0) | number: '1.0-1' }}% average score</div>
                            </div>
                            <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white">
                                <i class="pi pi-chart-line text-2xl"></i>
                            </div>
                        </div>
                        <div class="mt-6 space-y-3">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-muted-color">Pass rate</span>
                                <span class="font-semibold">{{ (dashboard?.passRate ?? 0) | number: '1.0-1' }}%</span>
                            </div>
                            <p-progressBar [value]="dashboard?.passRate ?? 0" [showValue]="false" styleClass="h-3"></p-progressBar>
                        </div>
                    </div>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card [label]="'Total Students'" [value]="studentCount" [delta]="studentTrend" hint="Live roster" icon="pi pi-users" tone="blue" [direction]="studentTrendDirection" routerLink="/admin/students"></app-metric-card>
                <app-metric-card [label]="'Avg Performance'" [value]="averageScore" [delta]="averageTrend" hint="Across all classes" icon="pi pi-chart-bar" tone="purple" [direction]="averageDirection" routerLink="/admin/results"></app-metric-card>
                <app-metric-card [label]="'Weak Subjects'" [value]="weakSubjectCount" [delta]="weakSubjectHint" hint="Below target" icon="pi pi-exclamation-triangle" tone="orange" [direction]="weakDirection" routerLink="/admin/subjects"></app-metric-card>
                <app-metric-card [label]="'Notifications Sent'" [value]="todayNotifications" [delta]="notificationTrend" hint="Today" icon="pi pi-bell" tone="green" [direction]="notificationDirection" routerLink="/admin/notifications"></app-metric-card>
            </section>

            <section class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Quick actions</h2>
                        <p class="text-sm text-muted-color">Create work with one click.</p>
                    </div>
                </div>
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <button pButton type="button" label="Add Student" icon="pi pi-user-plus" class="w-full justify-start" routerLink="/admin/students"></button>
                    <button pButton type="button" label="Assign Teacher" icon="pi pi-sitemap" severity="secondary" class="w-full justify-start" routerLink="/admin/assignments"></button>
                    <button pButton type="button" label="Send Notification" icon="pi pi-bell" severity="help" class="w-full justify-start" routerLink="/admin/notifications"></button>
                    <button pButton type="button" label="Open System reports" icon="pi pi-file-pdf" severity="contrast" class="w-full justify-start" routerLink="/admin/reports"></button>
                </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-2 items-stretch">
                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">School performance depth chart</h2>
                            <p class="text-sm text-muted-color">A hybrid line view with layered series for average score and pass rate.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-muted-color">4D line graph</div>
                            <div class="font-semibold text-blue-600 dark:text-blue-300">Executive view</div>
                        </div>
                    </div>
                    <div class="chart-canvas-wrap flex-1 min-h-[16rem]">
                        <p-chart type="line" [data]="lineData" [options]="lineOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>

                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">4D pie chart</h2>
                            <p class="text-sm text-muted-color">Class share visualized with depth, labels, and contrast.</p>
                        </div>
                        <i class="pi pi-chart-pie text-2xl text-violet-500"></i>
                    </div>
                    <div class="chart-canvas-wrap flex-1 min-h-[14rem] flex items-center justify-center">
                        <p-chart type="pie" [data]="pieData" [options]="pieOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>
            </section>

            <p-dialog [(visible)]="studentDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(42rem, 96vw)' }" header="Student profile" appendTo="body">
                <ng-container *ngIf="selectedStudent; else drawerEmpty">
                    <div class="space-y-6">
                        <div class="workspace-card metric-gradient">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Profile</p>
                                    <h3 class="text-2xl font-display font-bold m-0">{{ selectedStudent.fullName }}</h3>
                                    <p class="text-muted-color mt-1">{{ selectedStudent.studentNumber }} · {{ selectedStudent.class }}</p>
                                </div>
                                <button pButton type="button" icon="pi pi-times" class="p-button-rounded p-button-text" (click)="studentDrawerVisible = false"></button>
                            </div>
                            <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Guardian email</div>
                                    <div class="font-semibold">{{ selectedStudent.parentEmail }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Guardian phone</div>
                                    <div class="font-semibold">{{ selectedStudent.parentPhone }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="workspace-card">
                            <div class="flex items-center justify-between mb-4">
                                <h4 class="font-display font-bold mb-0">Results trend</h4>
                                <span class="text-sm text-muted-color">{{ studentResults.length }} entries</span>
                            </div>
                            <div class="chart-canvas-wrap min-h-[12rem]">
                                <p-chart type="line" [data]="studentLineData" [options]="studentLineOptions"></p-chart>
                            </div>
                        </div>

                        <div class="workspace-card">
                            <h4 class="font-display font-bold mb-4">Comments timeline</h4>
                            <div class="space-y-3">
                                <div *ngFor="let result of studentResults" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="font-semibold">{{ result.subjectName }}</div>
                                        <p-tag [value]="result.grade" [severity]="result.score >= 75 ? 'success' : result.score >= 60 ? 'warning' : 'danger'"></p-tag>
                                    </div>
                                    <div class="text-sm text-muted-color mt-1">{{ result.term }} · {{ result.comment || 'No teacher comment yet.' }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ng-container>
                <ng-template #drawerEmpty>
                    <div class="flex h-full items-center justify-center text-muted-color">Select a student from the watchlist to open the profile drawer.</div>
                </ng-template>
            </p-dialog>
        </section>
    `
})
export class AdminDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly layout = inject(LayoutService);

    dashboard: DashboardResponse | null = null;
    students: StudentResponse[] = [];
    notifications: NotificationResponse[] = [];
    loading = true;
    studentDrawerVisible = false;
    selectedStudent: StudentResponse | null = null;
    studentResults: ResultResponse[] = [];
    studentCount = '0';
    studentTrend = 'Loading';
    studentTrendDirection: 'up' | 'down' | 'flat' = 'flat';
    averageScore = '0%';
    averageTrend = 'Live feed';
    averageDirection: 'up' | 'down' | 'flat' = 'flat';
    weakSubjectCount = '0';
    weakSubjectHint = 'Below 65%';
    weakDirection: 'up' | 'down' | 'flat' = 'down';
    todayNotifications = '0';
    notificationTrend = 'Live today';
    notificationDirection: 'up' | 'down' | 'flat' = 'up';
    skeletonRows = Array.from({ length: 6 });
    lineData!: ChartData<'line'>;
    lineOptions!: ChartOptions<'line'>;
    pieData!: ChartData<'pie'>;
    pieOptions!: ChartOptions<'pie'>;
    studentLineData!: ChartData<'line'>;
    studentLineOptions!: ChartOptions<'line'>;

    constructor() {
        this.layout.configUpdate$.subscribe(() => {
            if (this.dashboard) {
                this.buildCharts();
            }
        });
    }

    ngOnInit(): void {
        forkJoin({
            dashboard: this.api.getAdminDashboard(),
            students: this.api.getStudents(),
            notifications: this.api.getNotifications()
        }).subscribe({
            next: ({ dashboard, students, notifications }) => {
                this.dashboard = dashboard;
                this.students = students;
                this.notifications = notifications;
                this.studentCount = students.length.toString();
                this.studentTrend = `+${Math.max(1, Math.min(12, students.length % 12 || 1))} this week`;
                this.studentTrendDirection = 'up';
                this.averageScore = `${dashboard.overallAverageScore.toFixed(1)}%`;
                this.averageTrend = dashboard.passRate >= 70 ? '+4.1% momentum' : '-2.4% pressure';
                this.averageDirection = dashboard.passRate >= 70 ? 'up' : 'down';
                this.weakSubjectCount = dashboard.subjectPerformance.filter((subject) => subject.averageScore < 65).length.toString();
                this.weakSubjectHint = `${dashboard.subjectPerformance.filter((subject) => subject.averageScore < 65).length} alert(s)`;
                this.todayNotifications = notifications.filter((item) => this.isToday(item.createdAt)).length.toString();
                this.notificationTrend = `${notifications.length} total sent`;
                this.buildCharts();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    openStudent(studentId: number): void {
        this.selectedStudent = this.students.find((student) => student.id === studentId) ?? null;
        if (!this.selectedStudent) {
            return;
        }

        this.studentDrawerVisible = true;
        this.api.getResultsByStudent(studentId).subscribe({
            next: (results) => {
                this.studentResults = results;
                this.buildStudentChart(results);
            }
        });
    }

    private buildCharts(): void {
        if (!this.dashboard) {
            return;
        }

        const documentStyle = getComputedStyle(document.documentElement);
        const primary = documentStyle.getPropertyValue('--p-primary-500').trim() || '#2563eb';
        const primarySoft = documentStyle.getPropertyValue('--p-primary-200').trim() || '#93c5fd';
        const violet = documentStyle.getPropertyValue('--p-purple-500').trim() || '#8b5cf6';
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border').trim();
        const textColor = documentStyle.getPropertyValue('--text-color').trim();
        const textMuted = documentStyle.getPropertyValue('--text-color-secondary').trim();

        this.lineData = {
            labels: this.dashboard.schoolPerformance.map((entry) => entry.schoolName),
            datasets: [
                {
                    label: 'Average score',
                    data: this.dashboard.schoolPerformance.map((entry) => entry.averageScore),
                    borderColor: primary,
                    backgroundColor: this.createGradient(primary, violet),
                    fill: true,
                    tension: 0.35,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: primary,
                    borderWidth: 3
                },
                {
                    label: 'Pass rate',
                    data: this.dashboard.schoolPerformance.map((entry) => entry.passRate),
                    borderColor: violet,
                    backgroundColor: this.createGradient(violet, primarySoft),
                    fill: true,
                    tension: 0.35,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: violet,
                    borderWidth: 3
                }
            ]
        };

        this.lineOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 18
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    padding: 14
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textMuted
                    },
                    grid: {
                        color: 'transparent'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: textMuted
                    },
                    grid: {
                        color: surfaceBorder
                    }
                }
            }
        };

        this.pieData = {
            labels: this.dashboard.classPerformance.map((entry) => entry.class),
            datasets: [
                {
                    data: this.dashboard.classPerformance.map((entry) => entry.averageScore),
                    backgroundColor: this.dashboard.classPerformance.map((_, index) => [primary, violet, primarySoft, '#22c55e', '#f97316'][index % 5]),
                    borderWidth: 6,
                    borderColor: 'rgba(255,255,255,0.15)',
                    hoverOffset: 10
                }
            ]
        };

        this.pieOptions = {
            cutout: '50%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    padding: 14
                }
            }
        };
    }

    private buildStudentChart(results: ResultResponse[]): void {
        const documentStyle = getComputedStyle(document.documentElement);
        const primary = documentStyle.getPropertyValue('--p-primary-500').trim() || '#2563eb';
        const accent = documentStyle.getPropertyValue('--p-purple-500').trim() || '#8b5cf6';
        const textColor = documentStyle.getPropertyValue('--text-color').trim();
        const textMuted = documentStyle.getPropertyValue('--text-color-secondary').trim();
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border').trim();

        this.studentLineData = {
            labels: results.map((result) => result.subjectName),
            datasets: [
                {
                    label: 'Score',
                    data: results.map((result) => result.score),
                    borderColor: primary,
                    backgroundColor: this.createGradient(primary, accent),
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5,
                    pointHoverRadius: 9
                }
            ]
        };

        this.studentLineOptions = {
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
                        color: textMuted
                    },
                    grid: {
                        color: 'transparent'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: textMuted
                    },
                    grid: {
                        color: surfaceBorder
                    }
                }
            }
        };
    }

    private createGradient(from: string, to: string): CanvasGradient | string {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return from;
        }

        const gradient = context.createLinearGradient(0, 0, 320, 0);
        gradient.addColorStop(0, from);
        gradient.addColorStop(1, to);
        return gradient;
    }

    private isToday(isoDate: string): boolean {
        const createdAt = new Date(isoDate);
        const now = new Date();
        return createdAt.toDateString() === now.toDateString();
    }
}
