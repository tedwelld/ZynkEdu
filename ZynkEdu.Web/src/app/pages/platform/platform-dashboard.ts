import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { DashboardResponse, SchoolPerformanceDto, SchoolResponse, UserResponse } from '../../core/api/api.models';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-platform-dashboard',
    imports: [CommonModule, RouterLink, ButtonModule, MetricCardComponent, SkeletonModule, TableModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Platform</p>
                    <h1 class="text-3xl font-display font-bold m-0">System overview</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">See the whole system at a glance and move into schools or admins when needed.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Schools" icon="pi pi-building" routerLink="/platform/schools"></button>
                    <button pButton type="button" label="Admins" icon="pi pi-user" severity="secondary" routerLink="/platform/admins"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Schools" [value]="schoolCount" delta="Platform scope" hint="Registered schools" icon="pi pi-building" tone="blue"></app-metric-card>
                <app-metric-card label="Admins" [value]="adminCount" delta="Platform scope" hint="School admins" icon="pi pi-user" tone="purple"></app-metric-card>
                <app-metric-card label="Avg score" [value]="averageScore" delta="Across schools" hint="Overall performance" icon="pi pi-chart-line" tone="green"></app-metric-card>
                <app-metric-card label="Pass rate" [value]="passRate" delta="Across schools" hint="System pass rate" icon="pi pi-check-circle" tone="orange"></app-metric-card>
            </section>

            <section class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">School performance</h2>
                            <p class="text-sm text-muted-color">All schools ranked by performance.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ schoolPerformance.length }} schools</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.25rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <p-table *ngIf="!loading" [value]="schoolPerformance" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>School</th>
                                <th>Average</th>
                                <th>Pass rate</th>
                                <th>Results</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-school>
                            <tr>
                                <td class="font-semibold">{{ school.schoolName }}</td>
                                <td>{{ school.averageScore | number: '1.0-1' }}%</td>
                                <td>{{ school.passRate | number: '1.0-1' }}%</td>
                                <td class="text-muted-color">{{ school.resultCount }}</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Quick links</h2>
                            <p class="text-sm text-muted-color">Jump straight to the area you need.</p>
                        </div>
                        <i class="pi pi-compass text-2xl text-primary"></i>
                    </div>
                    <div class="space-y-3">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="font-semibold mb-1">Schools</div>
                            <div class="text-sm text-muted-color">Open the school list and view performance cards per school.</div>
                            <button pButton type="button" label="Open Schools" class="mt-3 w-full justify-start" routerLink="/platform/schools"></button>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="font-semibold mb-1">School admins</div>
                            <div class="text-sm text-muted-color">Manage school admin accounts and access.</div>
                            <button pButton type="button" label="Open Admins" severity="secondary" class="mt-3 w-full justify-start" routerLink="/platform/admins"></button>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="font-semibold mb-1">Platform summary</div>
                            <div class="text-sm text-muted-color">Use the metrics above to see the full picture quickly.</div>
                        </div>
                    </div>
                </article>
            </section>
        </section>
    `
})
export class PlatformDashboard implements OnInit {
    private readonly api = inject(ApiService);

    loading = true;
    schools: SchoolResponse[] = [];
    admins: UserResponse[] = [];
    dashboard: DashboardResponse | null = null;
    skeletonRows = Array.from({ length: 5 });

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            schools: this.api.getPlatformSchools(),
            admins: this.api.getAdmins(),
            dashboard: this.api.getAdminDashboard()
        }).subscribe({
            next: ({ schools, admins, dashboard }) => {
                this.schools = schools;
                this.admins = admins;
                this.dashboard = dashboard;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get schoolCount(): string {
        return this.schools.length.toString();
    }

    get adminCount(): string {
        return this.admins.length.toString();
    }

    get averageScore(): string {
        return this.dashboard ? `${this.dashboard.overallAverageScore.toFixed(1)}%` : '0%';
    }

    get passRate(): string {
        return this.dashboard ? `${this.dashboard.passRate.toFixed(1)}%` : '0%';
    }

    get schoolPerformance(): SchoolPerformanceDto[] {
        return [...(this.dashboard?.schoolPerformance ?? [])].sort((a, b) => b.averageScore - a.averageScore);
    }
}
