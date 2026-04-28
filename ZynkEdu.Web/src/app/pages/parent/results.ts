import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { ParentPreviewReportResponse } from '../../core/api/api.models';
import { buildParentPreviewReportPdf } from '../../shared/report/report-pdf';

type ReportChart = {
    data: any;
    options: any;
};

@Component({
    standalone: true,
    selector: 'app-parent-results',
    imports: [CommonModule, ButtonModule, ChartModule, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card">
                <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Parent report</p>
                <h1 class="text-3xl font-display font-bold m-0">Preview report</h1>
                <p class="text-muted-color mt-2 max-w-3xl">
                    View the report summary your child receives from the school. Each report shows the student details, subject marks,
                    grades, teacher comments, and the overall average.
                </p>
            </div>

            <div *ngIf="loading" class="space-y-6">
                <article *ngFor="let _ of skeletonCards" class="workspace-card space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <div class="space-y-2">
                            <p-skeleton width="12rem" height="1.4rem" borderRadius="0.75rem"></p-skeleton>
                            <p-skeleton width="18rem" height="1rem" borderRadius="0.75rem"></p-skeleton>
                        </div>
                        <p-skeleton width="9rem" height="2.5rem" borderRadius="999px"></p-skeleton>
                    </div>
                    <div class="grid gap-3 md:grid-cols-4">
                        <p-skeleton *ngFor="let _ of summarySkeleton" height="4.5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <p-skeleton height="18rem" borderRadius="1.25rem"></p-skeleton>
                </article>
            </div>

            <div *ngIf="!loading && reports.length === 0" class="workspace-card">
                <h2 class="text-xl font-display font-bold">No report preview available</h2>
                <p class="mt-2 text-muted-color">There are no results yet for your parent account.</p>
            </div>

            <div *ngIf="!loading" class="space-y-6">
                <article *ngFor="let report of reports; let index = index" class="workspace-card space-y-6">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div class="space-y-2">
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="text-2xl font-display font-bold m-0">{{ report.studentName }}</h2>
                                <p-tag severity="info" [value]="report.schoolName"></p-tag>
                            </div>
                            <p class="text-muted-color">
                                Student number {{ report.studentNumber }} · {{ report.class }} · {{ report.level }} · {{ report.enrollmentYear }}
                            </p>
                        </div>
                        <div class="flex flex-col gap-3 sm:min-w-[18rem]">
                            <button
                                pButton
                                type="button"
                                label="Download PDF"
                                icon="pi pi-file-pdf"
                                severity="contrast"
                                class="w-full"
                                (click)="exportReportPdf(report)"
                            ></button>
                            <div class="grid min-w-full gap-3 sm:min-w-[22rem] sm:grid-cols-2">
                                <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Overall average</p>
                                    <p class="mt-2 text-2xl font-display font-bold m-0">{{ report.overallAverageMark | number : '1.0-1' }}%</p>
                                </div>
                                <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Subjects</p>
                                    <p class="mt-2 text-2xl font-display font-bold m-0">{{ report.subjects.length }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <div class="border-b border-surface-200 dark:border-surface-700 px-5 py-4">
                                <h3 class="text-lg font-display font-bold m-0">Subject marks</h3>
                            </div>
                            <div class="divide-y divide-surface-200 dark:divide-surface-700">
                                <div
                                    *ngFor="let subject of report.subjects"
                                    class="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.5fr_1fr_1.2fr]"
                                >
                                    <div>
                                        <div class="font-semibold">{{ subject.subjectName }}</div>
                                        <div class="text-xs text-muted-color">{{ subject.term || 'Term not recorded' }}</div>
                                    </div>
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Average</div>
                                        <div class="mt-1 font-semibold">{{ subject.averageMark | number : '1.0-1' }}%</div>
                                    </div>
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Actual</div>
                                        <div class="mt-1 font-semibold">{{ (subject.actualMark ?? 0) | number : '1.0-1' }}%</div>
                                    </div>
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Grade</div>
                                        <p-tag
                                            class="mt-1"
                                            [severity]="gradeSeverity(subject.actualMark ?? subject.averageMark)"
                                            [value]="subject.grade || 'N/A'"
                                        ></p-tag>
                                    </div>
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Teacher</div>
                                        <div class="mt-1 font-semibold">{{ subject.teacherName || 'Not set' }}</div>
                                    </div>
                                    <div>
                                        <div class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Comment</div>
                                        <div class="mt-1 text-sm text-muted-color leading-6">
                                            {{ subject.teacherComment || 'No teacher comment yet.' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 overflow-hidden h-full">
                                <div class="border-b border-surface-200 dark:border-surface-700 px-5 py-4">
                                    <h3 class="text-lg font-display font-bold m-0">Performance comparison</h3>
                                </div>
                                <div class="p-4 chart-canvas-wrap" *ngIf="reportCharts[index]">
                                    <p-chart type="line" [data]="reportCharts[index].data" [options]="reportCharts[index].options"></p-chart>
                                </div>
                            </div>

                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-5">
                                <h3 class="text-lg font-display font-bold m-0">Student details</h3>
                                <dl class="mt-4 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Name</dt>
                                        <dd class="mt-1 font-semibold">{{ report.studentName }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Number</dt>
                                        <dd class="mt-1 font-semibold">{{ report.studentNumber }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Class</dt>
                                        <dd class="mt-1 font-semibold">{{ report.class }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.16em] text-muted-color font-semibold">Level</dt>
                                        <dd class="mt-1 font-semibold">{{ report.level }}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class ParentResults implements OnInit {
    private readonly api = inject(ApiService);
    loading = true;
    reports: ParentPreviewReportResponse[] = [];
    reportCharts: ReportChart[] = [];
    skeletonCards = Array.from({ length: 2 });
    summarySkeleton = Array.from({ length: 4 });

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.api.getParentReportPreview().subscribe({
            next: (reports) => {
                this.reports = reports;
                this.reportCharts = reports.map((report) => this.buildChart(report));
                this.loading = false;
            },
            error: () => {
                this.reports = [];
                this.reportCharts = [];
                this.loading = false;
            }
        });
    }

    exportReportPdf(report: ParentPreviewReportResponse): void {
        const doc = buildParentPreviewReportPdf(report);
        doc.save(`parent-preview-${report.studentNumber}.pdf`);
    }

    gradeSeverity(score: number): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
        if (score >= 80) {
            return 'success';
        }

        if (score >= 70) {
            return 'info';
        }

        if (score >= 60) {
            return 'warning';
        }

        return 'danger';
    }

    private buildChart(report: ParentPreviewReportResponse): ReportChart {
        const labels = report.subjects.map((subject) => subject.subjectName);
        return {
            data: {
                labels,
                datasets: [
                    {
                        label: 'Average mark',
                        data: report.subjects.map((subject) => subject.averageMark),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: 'Actual mark',
                        data: report.subjects.map((subject) => subject.actualMark ?? null),
                        borderColor: '#16a34a',
                        backgroundColor: 'rgba(22, 163, 74, 0.12)',
                        fill: false,
                        tension: 0.35
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value: number) => `${value}%`
                        }
                    }
                }
            }
        };
    }
}
