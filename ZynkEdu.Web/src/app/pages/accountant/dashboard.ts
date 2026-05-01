import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AgingReportResponse, CollectionReportResponse, DailyCashReportResponse, DefaulterReportResponse, RevenueByClassReportResponse } from '../../core/api/api.models';

@Component({
    standalone: true,
    imports: [CommonModule],
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

            <div class="grid lg:grid-cols-2 gap-6">
                <section class="workspace-card p-6">
                    <h2 class="text-xl font-semibold mb-4">Aging</h2>
                    <div class="space-y-3">
                        <div *ngFor="let bucket of (aging?.buckets || [])" class="flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
                            <span class="font-medium">{{ bucket.bucket }}</span>
                            <span class="text-muted-color">{{ bucket.amount | number:'1.0-2' }} across {{ bucket.invoiceCount }} invoice(s)</span>
                        </div>
                    </div>
                </section>

                <section class="workspace-card p-6">
                    <h2 class="text-xl font-semibold mb-4">Daily cash</h2>
                    <div class="space-y-3">
                        <div *ngFor="let method of (dailyCash?.methods || [])" class="flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
                            <span class="font-medium">{{ method.method }}</span>
                            <span class="text-muted-color">{{ method.amount | number:'1.0-2' }} across {{ method.paymentCount }} payment(s)</span>
                        </div>
                    </div>
                </section>
            </div>

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

    collection: CollectionReportResponse | null = null;
    aging: AgingReportResponse | null = null;
    dailyCash: DailyCashReportResponse | null = null;
    revenue: RevenueByClassReportResponse | null = null;
    defaulters: DefaulterReportResponse | null = null;

    get schoolLabel(): string {
        return this.auth.schoolId() ? `School ${this.auth.schoolId()}` : 'All schools';
    }

    ngOnInit(): void {
        const schoolId = this.auth.schoolId();
        this.api.getCollectionReport(schoolId).subscribe((response) => (this.collection = response));
        this.api.getAgingReport(schoolId).subscribe((response) => (this.aging = response));
        this.api.getDailyCashReport(schoolId).subscribe((response) => (this.dailyCash = response));
        this.api.getRevenueByClassReport(schoolId).subscribe((response) => (this.revenue = response));
        this.api.getDefaulters(schoolId).subscribe((response) => (this.defaulters = response));
    }
}
