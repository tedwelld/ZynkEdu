import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DailyCashReportResponse, RevenueByClassReportResponse, SchoolResponse } from '../../core/api/api.models';
import { ReportSchoolInfo, buildDailyCashPdf, buildRevenueByClassPdf } from '../../shared/report/report-pdf';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <section class="grid gap-6">
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Reporting</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Finance analytics</h1>
                <p class="text-muted-color mt-2">Revenue breakdown by class and daily cash receipts for the active school.</p>

                <div class="mt-5 flex flex-wrap gap-4 items-end">
                    <label class="block min-w-[9rem]">
                        <span class="text-sm text-muted-color">Cash date</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="cashDate" name="cashDate" />
                    </label>
                    <button class="rounded-xl bg-surface-900 text-white px-4 py-2 font-semibold" type="button" (click)="reload()">Refresh</button>
                </div>
            </header>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h2 class="text-xl font-semibold">Revenue by class</h2>
                        <p class="text-sm text-muted-color mt-1">Billed, collected, and outstanding amounts per class.</p>
                    </div>
                    <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold text-sm" type="button" (click)="exportRevenuePdf()" [disabled]="!revenue">Export PDF</button>
                </div>

                <div *ngIf="loading" class="space-y-2">
                    <div *ngFor="let _ of skeletonRows" class="h-10 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse"></div>
                </div>

                <div *ngIf="!loading" class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">#</th>
                                <th class="py-3 pr-4">Class</th>
                                <th class="py-3 pr-4">Grade</th>
                                <th class="py-3 pr-4">Billed</th>
                                <th class="py-3 pr-4">Collected</th>
                                <th class="py-3">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of (revenue?.classes || []); let i = index" class="border-t border-surface-200 dark:border-surface-700">
                                <td class="py-3 pr-4 text-muted-color text-xs">{{ i + 1 }}</td>
                                <td class="py-3 pr-4 font-medium">{{ row.className }}</td>
                                <td class="py-3 pr-4">{{ row.gradeLevel }}</td>
                                <td class="py-3 pr-4">{{ row.billed | number:'1.0-2' }}</td>
                                <td class="py-3 pr-4">{{ row.collected | number:'1.0-2' }}</td>
                                <td class="py-3" [ngClass]="row.outstanding > 0 ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''">{{ row.outstanding | number:'1.0-2' }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div *ngIf="!revenue?.classes?.length" class="mt-4 rounded-2xl border border-dashed border-surface-300 px-4 py-6 text-sm text-muted-color">
                        No revenue data is available for the current school scope.
                    </div>
                </div>
            </section>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h2 class="text-xl font-semibold">Daily cash receipts</h2>
                        <p class="text-sm text-muted-color mt-1">Payment method breakdown for {{ cashDate || 'today' }}.</p>
                    </div>
                    <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold text-sm" type="button" (click)="exportDailyCashPdf()" [disabled]="!dailyCash">Export PDF</button>
                </div>

                <div *ngIf="loading" class="grid md:grid-cols-3 gap-4">
                    <div *ngFor="let _ of skeletonRows.slice(0, 3)" class="h-20 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse"></div>
                </div>

                <div *ngIf="!loading" class="grid md:grid-cols-3 gap-4">
                    <article class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Total amount</div>
                        <div class="text-2xl font-bold mt-2">{{ (dailyCash?.totalAmount || 0) | number:'1.0-2' }}</div>
                    </article>
                    <article *ngFor="let method of (dailyCash?.methods || [])" class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ method.method }}</div>
                        <div class="text-2xl font-bold mt-2">{{ method.amount | number:'1.0-2' }}</div>
                        <div class="text-sm text-muted-color">{{ method.paymentCount }} payment(s)</div>
                    </article>
                    <div *ngIf="!dailyCash?.methods?.length" class="rounded-2xl border border-dashed border-surface-300 px-4 py-6 text-sm text-muted-color col-span-3">
                        No cash receipts recorded for the selected date.
                    </div>
                </div>
            </section>
        </section>
    `
})
export class AccountantAnalytics implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    revenue: RevenueByClassReportResponse | null = null;
    dailyCash: DailyCashReportResponse | null = null;
    schools: SchoolResponse[] = [];
    loading = true;
    errorMessage = '';
    cashDate = new Date().toISOString().slice(0, 10);
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        this.api.getSchools().subscribe({ next: s => this.schools = s });
        this.reload();
    }

    reload(): void {
        this.loading = true;
        const schoolId = this.auth.schoolId();
        forkJoin({
            revenue: this.api.getRevenueByClassReport(schoolId).pipe(catchError(() => of(null as RevenueByClassReportResponse | null))),
            dailyCash: this.api.getDailyCashReport(schoolId, this.cashDate || null).pipe(catchError(() => of(null as DailyCashReportResponse | null)))
        }).subscribe({
            next: ({ revenue, dailyCash }) => {
                this.revenue = revenue;
                this.dailyCash = dailyCash;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Analytics data could not be loaded. Please refresh or check your connection.';
            }
        });
    }

    exportRevenuePdf(): void {
        this.api.getRevenueByClassReport(this.auth.schoolId()).subscribe((revenue) => {
            buildRevenueByClassPdf(this.schoolInfo, new Date(), this.cashDate || 'Current period', revenue, 'revenue-by-class.pdf');
        });
    }

    exportDailyCashPdf(): void {
        this.api.getDailyCashReport(this.auth.schoolId(), this.cashDate || null).subscribe((dailyCash) => {
            buildDailyCashPdf(this.schoolInfo, new Date(), this.cashDate || 'Today', dailyCash, 'daily-cash.pdf');
        });
    }

    private get schoolInfo(): ReportSchoolInfo {
        const id = this.auth.schoolId();
        const school = this.schools.find(s => s.id === id);
        return { name: school?.name ?? (id ? `School ${id}` : 'All schools'), address: school?.address ?? null };
    }
}
