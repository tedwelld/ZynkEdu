import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { StudentCommentResponse } from '../../core/api/api.models';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-parent-dashboard',
    imports: [CommonModule, ButtonModule, ChartModule, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Parent dashboard</p>
                    <h1 class="text-3xl font-display font-bold m-0">Mobile-first progress view</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Clear subject cards, progress feedback, and a quick view of the latest updates from school.</p>
                </div>
                <button pButton type="button" label="Refresh" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Subjects" [value]="subjectCount" delta="Current term" hint="From results" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Average" [value]="averageScore" delta="Overall progress" hint="Current score" icon="pi pi-chart-bar" tone="green"></app-metric-card>
                <app-metric-card label="Good" [value]="goodCount" delta="Positive cards" hint="Above 75%" icon="pi pi-smile" tone="purple"></app-metric-card>
                <app-metric-card label="Needs attention" [value]="watchCount" delta="Needs support" hint="Below 60%" icon="pi pi-exclamation-triangle" tone="orange" direction="down"></app-metric-card>
            </section>

            <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Subject progress</h2>
                            <p class="text-sm text-muted-color">Cards with emoji-based feedback for quick scanning.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ results.length }} results</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="5rem" borderRadius="1.2rem"></p-skeleton>
                    </div>
                    <div *ngIf="!loading" class="grid gap-3 md:grid-cols-2">
                        <div *ngFor="let subject of subjectCards" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4 bg-surface-50 dark:bg-surface-900/50">
                            <div class="flex items-center justify-between">
                                <div class="font-semibold">{{ subject.subjectName }}</div>
                                <span class="text-2xl">{{ emojiFor(subject.score) }}</span>
                            </div>
                            <div class="mt-2 text-3xl font-display font-bold">{{ subject.score | number: '1.0-0' }}%</div>
                            <div class="mt-2 text-sm text-muted-color">{{ subject.grade }} · {{ subject.term }}</div>
                            <div class="mt-3">
                                <div class="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-color mb-2">
                                    <span>Progress</span>
                                    <span>{{ subject.score | number: '1.0-0' }}%</span>
                                </div>
                                <div class="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                                    <div class="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600" [style.width.%]="subject.score"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Performance pulse</h2>
                            <p class="text-sm text-muted-color">A compact line chart for the current term.</p>
                        </div>
                    </div>
                    <div class="chart-canvas-wrap">
                        <p-chart type="line" [data]="chartData" [options]="chartOptions"></p-chart>
                    </div>

                    <div class="mt-6 space-y-3">
                        <div *ngFor="let item of topMessages" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                            <div class="text-sm text-muted-color">Teacher update</div>
                            <div class="font-semibold">{{ item.subjectName }}</div>
                            <div class="text-sm">{{ item.comment || 'Good progress so far.' }}</div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class ParentDashboard implements OnInit {
    private readonly api = inject(ApiService);

    loading = true;
    results: StudentCommentResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    subjectCards: StudentCommentResponse[] = [];
    topMessages: StudentCommentResponse[] = [];
    chartData: any;
    chartOptions: any;

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.api.getParentResults().subscribe({
            next: (results) => {
                this.results = results;
                this.subjectCards = results.slice(0, 4);
                this.topMessages = results.slice(0, 3);
                this.buildChart(results);
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get subjectCount(): string {
        return this.results.length.toString();
    }

    get averageScore(): string {
        if (!this.results.length) {
            return '0%';
        }

        const avg = this.results.reduce((sum, row) => sum + row.score, 0) / this.results.length;
        return `${avg.toFixed(0)}%`;
    }

    get goodCount(): string {
        return this.results.filter((row) => row.score >= 75).length.toString();
    }

    get watchCount(): string {
        return this.results.filter((row) => row.score < 60).length.toString();
    }

    emojiFor(score: number): string {
        if (score >= 75) {
            return '😊';
        }

        if (score >= 60) {
            return '😐';
        }

        return '⚠';
    }

    private buildChart(results: StudentCommentResponse[]): void {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        this.chartData = {
            labels: results.map((result) => result.subjectName),
            datasets: [
                {
                    label: 'Score',
                    data: results.map((result) => result.score),
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
            }
        };
    }
}
