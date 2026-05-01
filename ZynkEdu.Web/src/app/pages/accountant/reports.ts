import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    AgingReportResponse,
    CollectionReportResponse,
    DailyCashReportResponse,
    DefaulterReportResponse,
    RevenueByClassReportResponse
} from '../../core/api/api.models';
import {
    buildAccountingReportsPdf,
    buildAgingBucketsPdf,
    buildCollectionReportPdf,
    buildDailyCashPdf,
    buildDefaultersPdf,
    buildRevenueByClassPdf
} from '../../shared/report/report-pdf';
import { AuthService } from '../../core/auth/auth.service';

type ReportFilterMode = 'none' | 'date' | 'range' | 'month' | 'year';
type ReportExportType = 'combined' | 'collection' | 'aging' | 'defaulters' | 'revenue' | 'dailyCash';
type AgingSearchField = 'bucket' | 'amount' | 'invoiceCount';
type DefaulterSearchField = 'student' | 'class' | 'grade' | 'balance';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, DialogModule, TableModule],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Reporting</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Accounting reports</h1>
                <p class="text-muted-color mt-2">Collection, aging, defaulter, revenue, and daily cash views for the current school scope.</p>

                <div class="mt-5 grid gap-4 md:grid-cols-2">
                    <button
                        class="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-blue-900/40 dark:from-blue-950/40 dark:via-surface-900 dark:to-cyan-950/40"
                        type="button"
                        (click)="openAgingModal()"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <div class="text-xs uppercase tracking-[0.25em] text-blue-700 dark:text-blue-300 font-semibold">Report card</div>
                                <h2 class="text-xl font-semibold mt-2">View aging buckets</h2>
                                <p class="text-sm text-muted-color mt-2">Open a searchable modal for bucket analysis and aging totals.</p>
                            </div>
                            <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                                <i class="pi pi-chart-bar"></i>
                            </span>
                        </div>
                    </button>

                    <button
                        class="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-amber-900/40 dark:from-amber-950/40 dark:via-surface-900 dark:to-rose-950/40"
                        type="button"
                        (click)="openDefaultersModal()"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <div class="text-xs uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300 font-semibold">Report card</div>
                                <h2 class="text-xl font-semibold mt-2">View defaulters</h2>
                                <p class="text-sm text-muted-color mt-2">Search outstanding balances while keeping the full list visible.</p>
                            </div>
                            <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm">
                                <i class="pi pi-exclamation-triangle"></i>
                            </span>
                        </div>
                    </button>
                </div>
            </header>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 class="text-xl font-semibold">PDF exports</h2>
                        <p class="text-sm text-muted-color mt-1">Choose an optional period filter, select the report type, then export it as a PDF.</p>
                    </div>
                </div>

                <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mt-5 items-end" (ngSubmit)="noop()">
                    <label class="block">
                        <span class="text-sm text-muted-color">Filter mode</span>
                        <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="filter.mode" name="mode">
                            <option value="none">Current snapshot</option>
                            <option value="date">Single date</option>
                            <option value="range">Date range</option>
                            <option value="month">Month</option>
                            <option value="year">Year</option>
                        </select>
                    </label>

                    <label class="block" *ngIf="filter.mode === 'date' || filter.mode === 'range'">
                        <span class="text-sm text-muted-color">Start date</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="filter.startDate" name="startDate" />
                    </label>

                    <label class="block" *ngIf="filter.mode === 'range'">
                        <span class="text-sm text-muted-color">End date</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="filter.endDate" name="endDate" />
                    </label>

                    <label class="block" *ngIf="filter.mode === 'date'">
                        <span class="text-sm text-muted-color">Date</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="filter.date" name="date" />
                    </label>

                    <label class="block" *ngIf="filter.mode === 'month'">
                        <span class="text-sm text-muted-color">Month</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="month" [(ngModel)]="filter.month" name="month" />
                    </label>

                    <label class="block" *ngIf="filter.mode === 'year'">
                        <span class="text-sm text-muted-color">Year</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="number" min="2000" max="2100" [(ngModel)]="filter.year" name="year" />
                    </label>

                    <button class="rounded-xl border border-surface-300 px-4 py-3 font-semibold" type="button" (click)="clearFilters()">Clear filters</button>
                </form>

                <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] items-end">
                    <label class="block">
                        <span class="text-sm text-muted-color">Report type</span>
                        <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="selectedReportType" name="reportType">
                            <option value="combined">Financial statement</option>
                            <option value="collection">Collection summary</option>
                            <option value="aging">Aging buckets</option>
                            <option value="defaulters">Defaulters list</option>
                            <option value="revenue">Revenue by class</option>
                            <option value="dailyCash">Daily cash report</option>
                        </select>
                    </label>

                    <button class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="button" (click)="exportSelectedPdf()">Export PDF</button>
                </div>
            </section>

            <div class="grid md:grid-cols-3 gap-4">
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
            </div>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <h2 class="text-xl font-semibold">Revenue by class</h2>
                    <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="exportRevenuePdf()">Export PDF</button>
                </div>
                <div class="overflow-x-auto mt-4">
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

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <h2 class="text-xl font-semibold">Daily cash</h2>
                    <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="exportDailyCashPdf()">Export PDF</button>
                </div>
                <div class="grid md:grid-cols-3 gap-4 mt-4">
                    <article class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Total amount</div>
                        <div class="text-2xl font-bold mt-2">{{ (dailyCash?.totalAmount || 0) | number:'1.0-2' }}</div>
                    </article>
                    <article *ngFor="let method of (dailyCash?.methods || [])" class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ method.method }}</div>
                        <div class="text-2xl font-bold mt-2">{{ method.amount | number:'1.0-2' }}</div>
                        <div class="text-sm text-muted-color">{{ method.paymentCount }} payment(s)</div>
                    </article>
                </div>
            </section>

            <p-dialog [(visible)]="agingModalVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(72rem, 96vw)' }" appendTo="body" header="Aging buckets" (onHide)="closeAgingModal()">
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] items-end">
                        <label class="block">
                            <span class="text-sm font-semibold">Search aging data</span>
                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="agingSearch.term" name="agingSearchTerm" placeholder="Search bucket, amount, or invoice count" />
                        </label>
                        <label class="block">
                            <span class="text-sm font-semibold">Search by</span>
                            <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="agingSearch.field" name="agingSearchField">
                                <option value="bucket">Bucket name</option>
                                <option value="amount">Amount</option>
                                <option value="invoiceCount">Invoice count</option>
                            </select>
                        </label>
                    </div>

                    <div class="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-color">
                        <span>Showing {{ filteredAgingBuckets.length }} of {{ aging?.buckets?.length || 0 }} bucket(s)</span>
                        <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="exportAgingPdf()">Export PDF</button>
                    </div>

                    <div class="overflow-x-auto">
                        <p-table [value]="filteredAgingBuckets" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Bucket</th>
                                    <th>Amount</th>
                                    <th>Invoice count</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-bucket>
                                <tr>
                                    <td class="font-medium">{{ bucket.bucket }}</td>
                                    <td>{{ bucket.amount | number:'1.0-2' }}</td>
                                    <td>{{ bucket.invoiceCount }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="defaultersModalVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(80rem, 96vw)' }" appendTo="body" header="Defaulters" (onHide)="closeDefaultersModal()">
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] items-end">
                        <label class="block">
                            <span class="text-sm font-semibold">Search defaulters</span>
                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="defaulterSearch.term" name="defaulterSearchTerm" placeholder="Search student, class, grade, or balance" />
                        </label>
                        <label class="block">
                            <span class="text-sm font-semibold">Search by</span>
                            <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="defaulterSearch.field" name="defaulterSearchField">
                                <option value="student">Student</option>
                                <option value="class">Class</option>
                                <option value="grade">Grade</option>
                                <option value="balance">Balance</option>
                            </select>
                        </label>
                    </div>

                    <div class="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-color">
                        <span>Showing {{ filteredDefaulters.length }} of {{ defaulters?.students?.length || 0 }} student(s)</span>
                        <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="exportDefaultersPdf()">Export PDF</button>
                    </div>

                    <div class="overflow-x-auto">
                        <p-table [value]="filteredDefaulters" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Student</th>
                                    <th>Class</th>
                                    <th>Grade</th>
                                    <th>Balance</th>
                                    <th>Last payment</th>
                                    <th>Last invoice</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-student>
                                <tr>
                                    <td class="font-medium">{{ student.studentName }}</td>
                                    <td>{{ student.className }}</td>
                                    <td>{{ student.gradeLevel }}</td>
                                    <td>{{ student.balance | number:'1.0-2' }}</td>
                                    <td>{{ student.lastPaymentAt | date:'mediumDate' }}</td>
                                    <td>{{ student.lastInvoiceAt | date:'mediumDate' }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AccountantReports implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    collection: CollectionReportResponse | null = null;
    aging: AgingReportResponse | null = null;
    dailyCash: DailyCashReportResponse | null = null;
    revenue: RevenueByClassReportResponse | null = null;
    defaulters: DefaulterReportResponse | null = null;
    selectedReportType: ReportExportType = 'combined';
    agingModalVisible = false;
    defaultersModalVisible = false;
    agingSearch: { field: AgingSearchField; term: string } = {
        field: 'bucket',
        term: ''
    };
    defaulterSearch: { field: DefaulterSearchField; term: string } = {
        field: 'student',
        term: ''
    };

    filter: {
        mode: ReportFilterMode;
        startDate: string;
        endDate: string;
        date: string;
        month: string;
        year: number;
    } = {
        mode: 'none',
        startDate: '',
        endDate: '',
        date: '',
        month: '',
        year: new Date().getFullYear()
    };

    ngOnInit(): void {
        this.loadReports();
    }

    noop(): void {
        // Intentionally empty. The filter form is used by the PDF exports.
    }

    clearFilters(): void {
        this.filter = {
            mode: 'none',
            startDate: '',
            endDate: '',
            date: '',
            month: '',
            year: new Date().getFullYear()
        };
    }

    openAgingModal(): void {
        this.agingModalVisible = true;
    }

    closeAgingModal(): void {
        this.agingModalVisible = false;
    }

    openDefaultersModal(): void {
        this.defaultersModalVisible = true;
    }

    closeDefaultersModal(): void {
        this.defaultersModalVisible = false;
    }

    exportCombinedPdf(): void {
        this.fetchExportData().subscribe(({ collection, aging, revenue, defaulters, dailyCash }) => {
            buildAccountingReportsPdf(
                this.schoolLabel,
                new Date(),
                this.periodLabel,
                collection,
                aging,
                revenue,
                defaulters,
                dailyCash,
                `financial-statement-${this.fileStamp()}.pdf`
            );
        });
    }

    exportSelectedPdf(): void {
        switch (this.selectedReportType) {
            case 'collection':
                this.exportCollectionPdf();
                return;
            case 'aging':
                this.exportAgingPdf();
                return;
            case 'defaulters':
                this.exportDefaultersPdf();
                return;
            case 'revenue':
                this.exportRevenuePdf();
                return;
            case 'dailyCash':
                this.exportDailyCashPdf();
                return;
            default:
                this.exportCombinedPdf();
        }
    }

    exportCollectionPdf(): void {
        this.api.getCollectionReport(this.auth.schoolId()).subscribe((collection) => {
            buildCollectionReportPdf(this.schoolLabel, new Date(), this.periodLabel, collection, `collection-report-${this.fileStamp()}.pdf`);
        });
    }

    exportAgingPdf(): void {
        this.api.getAgingReport(this.auth.schoolId(), this.resolveAsOfDate()).subscribe((aging) => {
            buildAgingBucketsPdf(this.schoolLabel, new Date(), this.periodLabel, aging, `aging-buckets-${this.fileStamp()}.pdf`);
        });
    }

    exportDefaultersPdf(): void {
        this.api.getDefaulters(this.auth.schoolId()).subscribe((defaulters) => {
            buildDefaultersPdf(this.schoolLabel, new Date(), this.periodLabel, defaulters, `defaulters-${this.fileStamp()}.pdf`);
        });
    }

    exportRevenuePdf(): void {
        this.api.getRevenueByClassReport(this.auth.schoolId()).subscribe((revenue) => {
            buildRevenueByClassPdf(this.schoolLabel, new Date(), this.periodLabel, revenue, `revenue-by-class-${this.fileStamp()}.pdf`);
        });
    }

    exportDailyCashPdf(): void {
        this.api.getDailyCashReport(this.auth.schoolId(), this.resolveDailyCashDate()).subscribe((dailyCash) => {
            buildDailyCashPdf(this.schoolLabel, new Date(), this.periodLabel, dailyCash, `daily-cash-${this.fileStamp()}.pdf`);
        });
    }

    private loadReports(): void {
        const schoolId = this.auth.schoolId();
        this.api.getCollectionReport(schoolId).subscribe((response) => (this.collection = response));
        this.api.getAgingReport(schoolId, this.resolveAsOfDate()).subscribe((response) => (this.aging = response));
        this.api.getDailyCashReport(schoolId, this.resolveDailyCashDate()).subscribe((response) => (this.dailyCash = response));
        this.api.getRevenueByClassReport(schoolId).subscribe((response) => (this.revenue = response));
        this.api.getDefaulters(schoolId).subscribe((response) => (this.defaulters = response));
    }

    private fetchExportData() {
        const schoolId = this.auth.schoolId();
        return forkJoin({
            collection: this.api.getCollectionReport(schoolId),
            aging: this.api.getAgingReport(schoolId, this.resolveAsOfDate()),
            dailyCash: this.api.getDailyCashReport(schoolId, this.resolveDailyCashDate()),
            revenue: this.api.getRevenueByClassReport(schoolId),
            defaulters: this.api.getDefaulters(schoolId)
        });
    }

    get filteredAgingBuckets() {
        const buckets = this.aging?.buckets ?? [];
        const term = this.agingSearch.term.trim().toLowerCase();
        if (!term) {
            return buckets;
        }

        return buckets.filter((bucket) => {
            switch (this.agingSearch.field) {
                case 'amount':
                    return bucket.amount.toFixed(2).toLowerCase().includes(term);
                case 'invoiceCount':
                    return bucket.invoiceCount.toString().includes(term);
                default:
                    return bucket.bucket.toLowerCase().includes(term);
            }
        });
    }

    get filteredDefaulters() {
        const students = this.defaulters?.students ?? [];
        const term = this.defaulterSearch.term.trim().toLowerCase();
        if (!term) {
            return students;
        }

        return students.filter((student) => {
            switch (this.defaulterSearch.field) {
                case 'class':
                    return student.className.toLowerCase().includes(term);
                case 'grade':
                    return student.gradeLevel.toLowerCase().includes(term);
                case 'balance':
                    return student.balance.toFixed(2).toLowerCase().includes(term);
                default:
                    return student.studentName.toLowerCase().includes(term);
            }
        });
    }

    private resolveAsOfDate(): string | null {
        switch (this.filter.mode) {
            case 'date':
                return this.filter.date || null;
            case 'range':
                return this.filter.endDate || this.filter.startDate || null;
            case 'month':
                return this.filter.month ? this.endOfMonth(this.filter.month) : null;
            case 'year':
                return this.filter.year ? `${this.filter.year}-12-31` : null;
            default:
                return null;
        }
    }

    private resolveDailyCashDate(): string | null {
        switch (this.filter.mode) {
            case 'date':
                return this.filter.date || null;
            case 'range':
                return this.filter.endDate || this.filter.startDate || null;
            case 'month':
                return this.filter.month ? this.endOfMonth(this.filter.month) : null;
            case 'year':
                return this.filter.year ? `${this.filter.year}-12-31` : null;
            default:
                return null;
        }
    }

    private endOfMonth(monthValue: string): string {
        const [yearText, monthText] = monthValue.split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        if (!year || !month) {
            return monthValue;
        }

        const end = new Date(year, month, 0);
        const yyyy = end.getFullYear();
        const mm = String(end.getMonth() + 1).padStart(2, '0');
        const dd = String(end.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    private get schoolLabel(): string {
        return this.auth.schoolId() ? `School ${this.auth.schoolId()}` : 'All schools';
    }

    private get periodLabel(): string {
        switch (this.filter.mode) {
            case 'date':
                return this.filter.date || 'Current snapshot';
            case 'range':
                return this.filter.startDate && this.filter.endDate
                    ? `${this.filter.startDate} to ${this.filter.endDate}`
                    : this.filter.startDate || this.filter.endDate || 'Current snapshot';
            case 'month':
                return this.filter.month || 'Current snapshot';
            case 'year':
                return this.filter.year ? `${this.filter.year}` : 'Current snapshot';
            default:
                return 'Current snapshot';
        }
    }

    private fileStamp(): string {
        const period = this.periodLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
        return period || new Date().toISOString().slice(0, 10);
    }
}
