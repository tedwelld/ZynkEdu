import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin, of } from 'rxjs';
import { AcademicTermResponse, AttendanceDailySummaryResponse, ResultResponse, SchoolCalendarEventResponse, TeacherAssignmentResponse } from '../../core/api/api.models';
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

interface TeacherFeedItem {
    title: string;
    detail: string;
    meta: string;
    icon: string;
    tone: 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red';
}

@Component({
    standalone: true,
    selector: 'app-teacher-dashboard',
    imports: [CommonModule, RouterLink, ButtonModule, ChartModule, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card overflow-hidden relative">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_left,rgba(124,58,237,0.12),transparent_30%)]"></div>
                <div class="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div class="space-y-3 max-w-3xl">
                        <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teaching workspace</p>
                        <h1 class="text-3xl md:text-4xl font-display font-bold m-0">Your classroom control center</h1>
                        <p class="text-muted-color max-w-2xl">
                            Today&apos;s schedule, recent activity, and the shortcuts you use most sit together here so the daily workflow stays quick.
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="secondary" routerLink="/teacher/attendance"></button>
                        <button pButton type="button" label="Results" icon="pi pi-table" routerLink="/teacher/results"></button>
                        <button pButton type="button" label="Classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                        <button pButton type="button" label="Settings" icon="pi pi-cog" severity="help" routerLink="/account/settings"></button>
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

            <section class="grid gap-6">
                <article class="workspace-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex items-center gap-4">
                        <div class="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
                            <i class="pi pi-bell text-2xl"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Announcements and alerts</h2>
                            <p class="text-sm text-muted-color">Open your school notices, deadlines, and timetable alerts in one place.</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-3">
                        <span class="rounded-full border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm text-muted-color">{{ announcements.length }} item(s)</span>
                        <button pButton type="button" label="Open alerts" icon="pi pi-arrow-right" routerLink="/teacher/notifications"></button>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Latest notices</h2>
                            <p class="text-sm text-muted-color">Recent announcements published by the school.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ announcements.length }} item(s)</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="4.5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading && announcements.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                        No announcements have been published for the current term yet.
                    </div>

                    <div *ngIf="!loading && announcements.length > 0" class="space-y-3">
                        <div *ngFor="let announcement of announcements" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold">{{ announcement.title }}</div>
                                    <div class="text-sm text-muted-color">{{ announcement.description || 'School announcement' }}</div>
                                </div>
                                <p-tag [value]="announcementTag(announcement)" [severity]="announcementTone(announcement)"></p-tag>
                            </div>
                            <div class="mt-2 text-xs text-muted-color">{{ announcement.eventDate | date : 'mediumDate' }}</div>
                        </div>
                    </div>
                </article>
            </section>

            <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] items-stretch">
                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Recent activity</h2>
                            <p class="text-sm text-muted-color">The latest marks, attendance, and school events.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ activityFeed.length }} updates</span>
                    </div>

                    <div class="space-y-3">
                        <div *ngFor="let item of activityFeed" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-start gap-3">
                                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white" [ngClass]="feedTone(item.tone)">
                                        <i [class]="item.icon"></i>
                                    </div>
                                    <div>
                                        <div class="font-semibold">{{ item.title }}</div>
                                        <div class="text-sm text-muted-color">{{ item.detail }}</div>
                                    </div>
                                </div>
                                <span class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ item.meta }}</span>
                            </div>
                        </div>
                    </div>
                </article>

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

                    <div *ngIf="!loading" class="chart-canvas-wrap flex-1 min-h-[16rem]">
                        <p-chart type="line" [data]="chartData" [options]="chartOptions" class="w-full h-full"></p-chart>
                    </div>
                </article>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Assigned classes</h2>
                        <p class="text-sm text-muted-color">Each card opens the class hub with the matching class selected.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ classInsights.length }} class card(s)</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <a
                        *ngFor="let item of classInsights"
                        class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
                        [routerLink]="['/teacher/classes']"
                        [queryParams]="{ class: item.className }"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Class</div>
                                <div class="text-xl font-display font-bold">{{ item.className }}</div>
                                <div class="mt-1 text-sm text-muted-color">{{ item.subjectNames.join(', ') || 'No subjects yet' }}</div>
                            </div>
                            <p-tag [value]="percentLabel(item.passRate)" [severity]="item.passRate >= 75 ? 'success' : item.passRate >= 60 ? 'warning' : 'danger'"></p-tag>
                        </div>
                        <div class="mt-3 flex items-center justify-between text-sm text-muted-color">
                            <span>{{ item.resultCount }} results</span>
                            <span>{{ item.averageScore.toFixed(1) }}% average</span>
                        </div>
                    </a>
                </div>
            </article>
        </section>
    `
})
export class TeacherDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    assignments: TeacherAssignmentResponse[] = [];
    classInsights: TeacherClassInsight[] = [];
    activityFeed: TeacherFeedItem[] = [];
    announcements: SchoolCalendarEventResponse[] = [];
    attendanceSummaries: AttendanceDailySummaryResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    chartData!: ChartData<'line'>;
    chartOptions!: ChartOptions<'line'>;

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const assignmentRequest = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();

        assignmentRequest.subscribe({
            next: (assignments) => {
                this.assignments = assignments;
                const classNames = Array.from(new Set(assignments.map((assignment) => assignment.class)));
                const schoolId = this.auth.schoolId() ?? undefined;

                this.api.getAcademicTerms(schoolId).subscribe({
                    next: (terms) => {
                        forkJoin({
                            resultsByClass: classNames.length > 0
                                ? forkJoin(classNames.map((className) => this.api.getResultsByClass(className)))
                                : of([] as ResultResponse[][]),
                            attendanceSummaries: this.api.getAttendanceDailySummaries(this.serializeDate(new Date()), schoolId),
                            announcements: this.api.getCalendarEvents(terms[0]?.id ?? null)
                        }).subscribe({
                            next: ({ resultsByClass, attendanceSummaries, announcements }) => {
                                this.attendanceSummaries = attendanceSummaries;
                                this.announcements = announcements;
                                this.classInsights = classNames.map((className, index) => this.buildInsight(className, resultsByClass[index] ?? []));
                                this.activityFeed = this.buildActivityFeed();
                                this.buildChart();
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

    announcementTag(event: SchoolCalendarEventResponse): string {
        if (/deadline|due|submit/i.test(event.title + ' ' + (event.description ?? ''))) {
            return 'Deadline';
        }

        if (/meeting|staff/i.test(event.title + ' ' + (event.description ?? ''))) {
            return 'Meeting';
        }

        return 'Announcement';
    }

    announcementTone(event: SchoolCalendarEventResponse): 'success' | 'warning' | 'info' | 'contrast' {
        const label = this.announcementTag(event);
        if (label === 'Deadline') {
            return 'warning';
        }

        if (label === 'Meeting') {
            return 'contrast';
        }

        return 'info';
    }

    feedTone(tone: TeacherFeedItem['tone']): string {
        return {
            blue: 'bg-gradient-to-br from-blue-600 to-cyan-500',
            cyan: 'bg-gradient-to-br from-cyan-500 to-blue-500',
            purple: 'bg-gradient-to-br from-violet-600 to-purple-500',
            green: 'bg-gradient-to-br from-emerald-600 to-green-500',
            orange: 'bg-gradient-to-br from-orange-500 to-amber-500',
            red: 'bg-gradient-to-br from-rose-600 to-red-500'
        }[tone];
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

    private buildActivityFeed(): TeacherFeedItem[] {
        const latestAttendance = this.attendanceSummaries[0];
        const latestClass = this.classInsights[0];
        const latestAnnouncement = this.announcements[0];

        return [
            {
                title: 'Attendance updated',
                detail: latestAttendance
                    ? `${latestAttendance.className} is at ${((latestAttendance.presentCount / Math.max(latestAttendance.studentCount, 1)) * 100).toFixed(1)}% present`
                    : 'No attendance summary loaded yet.',
                meta: latestAttendance ? latestAttendance.attendanceDate : 'Today',
                icon: 'pi pi-check-square',
                tone: 'green'
            },
            {
                title: 'Results reviewed',
                detail: latestClass
                    ? `${latestClass.className} has ${latestClass.resultCount} result row(s) with an average of ${latestClass.averageScore.toFixed(1)}%`
                    : 'No results loaded yet.',
                meta: latestClass ? latestClass.className : 'Results',
                icon: 'pi pi-table',
                tone: 'blue'
            },
            {
                title: 'School notice',
                detail: latestAnnouncement
                    ? latestAnnouncement.title
                    : 'No active announcement has been published yet.',
                meta: latestAnnouncement ? latestAnnouncement.termName : 'Notices',
                icon: 'pi pi-bell',
                tone: 'orange'
            }
        ];
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
