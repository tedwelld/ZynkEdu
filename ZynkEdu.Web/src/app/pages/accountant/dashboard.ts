import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { AgingReportResponse, CollectionReportResponse, DefaulterReportResponse, RevenueByClassReportResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';

type AgingChartSlice = {
    bucket: string;
    amount: number;
    invoiceCount: number;
    color: string;
    percentage: number;
};

@Component({
    standalone: true,
    imports: [CommonModule],
    styles: [`
        .aging-chart-shell {
            position: relative;
            width: min(100%, 28rem);
            aspect-ratio: 1 / 1;
            margin-inline: auto;
            filter: drop-shadow(0 22px 30px rgba(15, 23, 42, 0.20));
        }

        .aging-chart-depth,
        .aging-chart-face,
        .aging-chart-glow,
        .aging-chart-hole {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
        }

        .aging-chart-depth {
            transform: translateY(1.35rem);
            opacity: 0.92;
            filter: brightness(0.72) saturate(0.9);
        }

        .aging-chart-face {
            box-shadow:
                inset 0 2px 0 rgba(255, 255, 255, 0.48),
                inset 0 -16px 28px rgba(15, 23, 42, 0.20);
        }

        .aging-chart-glow {
            inset: 8%;
            background: radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.5), transparent 42%);
            mix-blend-mode: screen;
            pointer-events: none;
        }

        .aging-chart-hole {
            inset: 26%;
            background:
                radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.1) 32%, transparent 33%),
                linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(226, 232, 240, 0.94));
            box-shadow:
                inset 0 8px 20px rgba(255, 255, 255, 0.9),
                inset 0 -12px 24px rgba(148, 163, 184, 0.3),
                0 12px 28px rgba(15, 23, 42, 0.16);
            display: grid;
            place-items: center;
            text-align: center;
            padding: 1rem;
        }
    `],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Accounting workspace</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Finance dashboard</h1>
                <p class="text-muted-color mt-2">A quick view of collection health, overdue balances, and class-level revenue.</p>
                <div class="mt-4 text-sm text-muted-color">Scope: <span class="font-semibold text-color">{{ schoolLabel }}</span></div>
            </header>

            <div class="grid md:grid-cols-4 gap-4">
                <article class="workspace-card p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Billed</div>
                    <div class="text-3xl font-bold mt-2">{{ (collection?.totalBilled || 0) | number:'1.0-2' }}</div>
                </article>
                <article class="workspace-card p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Collected</div>
                    <div class="text-3xl font-bold mt-2">{{ (collection?.totalCollected || 0) | number:'1.0-2' }}</div>
                </article>
                <article class="workspace-card p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Outstanding</div>
                    <div class="text-3xl font-bold mt-2">{{ (collection?.outstanding || 0) | number:'1.0-2' }}</div>
                </article>
                <article class="workspace-card p-5">
                    <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Defaulters</div>
                    <div class="text-3xl font-bold mt-2">{{ defaulters?.students?.length || 0 }}</div>
                </article>
            </div>

            <section class="workspace-card p-6">
                <div class="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 class="text-xl font-semibold">Aging Pie Chart</h2>
                        <p class="text-sm text-muted-color mt-1">4D aging pie chart showing outstanding balances by receivable bucket as of {{ agingAsOfLabel }}.</p>
                    </div>
                    <div class="text-right">
                        <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Total overdue exposure</div>
                        <div class="text-2xl font-bold mt-2">{{ agingTotal | number:'1.0-2' }}</div>
                    </div>
                </div>

                <div class="mt-6 grid gap-8 xl:grid-cols-[minmax(20rem,28rem)_1fr] items-center">
                    <div class="aging-chart-shell">
                        <div class="aging-chart-depth" [style.background]="agingChartBackground"></div>
                        <div class="aging-chart-face" [style.background]="agingChartBackground"></div>
                        <div class="aging-chart-glow"></div>
                        <div class="aging-chart-hole">
                            <div>
                                <div class="text-xs uppercase tracking-[0.24em] text-muted-color">Aging mix</div>
                                <div class="text-2xl font-bold mt-2">{{ agingTotal | number:'1.0-2' }}</div>
                                <div class="text-sm text-muted-color mt-2">{{ aging?.buckets?.length || 0 }} clearly labelled bucket(s)</div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-3">
                        <article *ngFor="let slice of agingChartSlices" class="rounded-2xl border border-surface-200 dark:border-surface-700 px-4 py-4">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="mt-1 h-3.5 w-3.5 rounded-full shrink-0" [style.background]="slice.color"></span>
                                    <div class="min-w-0">
                                        <div class="font-semibold">{{ slice.bucket }}</div>
                                        <div class="text-sm text-muted-color mt-1">{{ slice.invoiceCount }} invoice(s) in this bucket</div>
                                    </div>
                                </div>
                                <div class="text-right shrink-0">
                                    <div class="font-semibold">{{ slice.amount | number:'1.0-2' }}</div>
                                    <div class="text-sm text-muted-color mt-1">{{ slice.percentage | number:'1.0-1' }}%</div>
                                </div>
                            </div>
                        </article>

                        <div *ngIf="agingChartSlices.length === 0" class="rounded-2xl border border-dashed border-surface-300 px-4 py-6 text-sm text-muted-color">
                            No aging balances are available for the selected school scope.
                        </div>
                    </div>
                </div>
            </section>

            <section class="workspace-card p-6">
                <h2 class="text-xl font-semibold mb-4">Revenue by class</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">Class</th>
                                <th class="py-3 pr-4">Grade</th>
                                <th class="py-3 pr-4">Billed</th>
                                <th class="py-3 pr-4">Collected</th>
                                <th class="py-3">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of (revenue?.classes || [])" class="border-t border-surface-200 dark:border-surface-700">
                                <td class="py-3 pr-4 font-medium">{{ row.className }}</td>
                                <td class="py-3 pr-4">{{ row.gradeLevel }}</td>
                                <td class="py-3 pr-4">{{ row.billed | number:'1.0-2' }}</td>
                                <td class="py-3 pr-4">{{ row.collected | number:'1.0-2' }}</td>
                                <td class="py-3">{{ row.outstanding | number:'1.0-2' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    `
})
export class AccountantDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly agingPalette = ['#0f766e', '#0284c7', '#f59e0b', '#dc2626', '#7c3aed', '#475569'];

    collection: CollectionReportResponse | null = null;
    aging: AgingReportResponse | null = null;
    revenue: RevenueByClassReportResponse | null = null;
    defaulters: DefaulterReportResponse | null = null;

    get schoolLabel(): string {
        return this.auth.schoolId() ? `School ${this.auth.schoolId()}` : 'All schools';
    }

    get agingAsOfLabel(): string {
        return this.aging?.asOf ? new Date(this.aging.asOf).toLocaleDateString() : 'today';
    }

    get agingTotal(): number {
        return (this.aging?.buckets ?? []).reduce((sum, bucket) => sum + bucket.amount, 0);
    }

    get agingChartSlices(): AgingChartSlice[] {
        const total = this.agingTotal;
        return (this.aging?.buckets ?? []).map((bucket, index) => ({
            bucket: bucket.bucket,
            amount: bucket.amount,
            invoiceCount: bucket.invoiceCount,
            color: this.agingPalette[index % this.agingPalette.length],
            percentage: total > 0 ? (bucket.amount / total) * 100 : 0
        }));
    }

    get agingChartBackground(): string {
        const slices = this.agingChartSlices.filter((slice) => slice.amount > 0);
        if (slices.length === 0) {
            return 'conic-gradient(#cbd5e1 0deg 360deg)';
        }

        let currentAngle = 0;
        const segments = slices.map((slice) => {
            const sweep = (slice.percentage / 100) * 360;
            const start = currentAngle;
            const end = currentAngle + sweep;
            currentAngle = end;
            return `${slice.color} ${start}deg ${end}deg`;
        });

        const lastSlice = segments.pop();
        if (!lastSlice) {
            return 'conic-gradient(#cbd5e1 0deg 360deg)';
        }

        segments.push(lastSlice.replace(/ \d+(\.\d+)?deg$/, ' 360deg'));
        return `conic-gradient(${segments.join(', ')})`;
    }

    ngOnInit(): void {
        const schoolId = this.auth.schoolId();
        this.api.getCollectionReport(schoolId).subscribe((response) => (this.collection = response));
        this.api.getAgingReport(schoolId).subscribe((response) => (this.aging = response));
        this.api.getRevenueByClassReport(schoolId).subscribe((response) => (this.revenue = response));
        this.api.getDefaulters(schoolId).subscribe((response) => (this.defaulters = response));
    }
}
