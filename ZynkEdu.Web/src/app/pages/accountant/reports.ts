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
    FinancialStatementPeriodMode,
    FinancialStatementResponse,
    FinancialStatementRowResponse,
    FinancialStatementType,
    RevenueByClassReportResponse
} from '../../core/api/api.models';
import {
    buildAgingBucketsPdf,
    buildCollectionReportPdf,
    buildDailyCashPdf,
    buildDefaultersPdf,
    buildFinancialStatementPdf,
    buildRevenueByClassPdf
} from '../../shared/report/report-pdf';
import { AuthService } from '../../core/auth/auth.service';

type ReportFilterMode = 'none' | 'date' | 'range' | 'month' | 'year';
type AgingSearchField = 'bucket' | 'amount' | 'invoiceCount';
type DefaulterSearchField = 'student' | 'class' | 'grade' | 'balance';
type StatementField = FinancialStatementType;

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
                <div class="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Financial statements</p>
                        <h2 class="text-2xl font-semibold mt-2">{{ statement?.title || 'Statement grid' }}</h2>
                        <p class="text-sm text-muted-color mt-1">Structured rows with period comparisons, subtotals, and bracketed negatives.</p>
                    </div>
                    <div class="flex gap-3 flex-wrap">
                        <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="refreshStatement()">Refresh statement</button>
                        <button class="rounded-xl bg-primary text-white px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed" type="button" (click)="exportStatementPdf()" [disabled]="!statement">
                            Export PDF
                        </button>
                    </div>
                </div>

                <div class="mt-5 grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
                    <div class="space-y-4">
                        <label class="block">
                            <span class="text-sm text-muted-color">Statement type</span>
                            <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="selectedStatementType" name="statementType" (ngModelChange)="loadStatement()">
                                <option *ngFor="let option of statementTypeOptions" [ngValue]="option.value">{{ option.label }}</option>
                            </select>
                        </label>

                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.22em] text-muted-color">Report basis</div>
                            <div class="mt-2 text-sm text-color">
                                <div><span class="font-semibold">Period:</span> {{ statement?.periodLabel || 'Current snapshot' }}</div>
                                <div class="mt-1"><span class="font-semibold">Comparison:</span> {{ statement?.comparisonLabel || 'Prior period' }}</div>
                            </div>
                        </div>
                    </div>

                    <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end" (ngSubmit)="refreshStatement()">
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

                        <div class="flex gap-3 xl:col-span-5">
                            <button class="rounded-xl border border-surface-300 px-4 py-3 font-semibold" type="button" (click)="clearFilters()">Clear filters</button>
                            <button class="rounded-xl bg-surface-900 text-white px-4 py-3 font-semibold" type="submit">Apply filters</button>
                        </div>
                    </form>
                </div>

                <div class="grid gap-4 md:grid-cols-4 mt-6" *ngIf="statementSummaryRow as summary">
                    <article class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Actual</div>
                        <div class="text-2xl font-bold mt-2">{{ formatStatementValue(summary.actual) }}</div>
                    </article>
                    <article class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Prior period</div>
                        <div class="text-2xl font-bold mt-2">{{ formatStatementValue(summary.priorPeriod) }}</div>
                    </article>
                    <article class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Variance</div>
                        <div class="text-2xl font-bold mt-2">{{ formatStatementValue(summary.variance) }}</div>
                    </article>
                    <article class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Variance %</div>
                        <div class="text-2xl font-bold mt-2">{{ formatStatementPercent(summary.variancePct) }}</div>
                    </article>
                </div>

                <div class="mt-6 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">Line item</th>
                                <th *ngFor="let column of (statement?.columns || [])" class="py-3 pr-4">{{ column.label }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                *ngFor="let row of (statement?.rows || [])"
                                class="border-t border-surface-200 dark:border-surface-700"
                                [ngClass]="statementRowClass(row)"
                            >
                                <td class="py-3 pr-4" [style.paddingLeft.px]="row.level * 18">
                                    <span [class.font-semibold]="row.kind !== 'LineItem'">{{ row.label }}</span>
                                </td>
                                <td class="py-3 pr-4" *ngFor="let column of (statement?.columns || [])">
                                    {{ formatStatementCell(row, column.key) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div *ngIf="!statement" class="mt-4 text-sm text-muted-color">Load a statement to see the grid.</div>
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

    readonly statementTypeOptions: { label: string; value: StatementField }[] = [
        { label: 'Income Statement', value: 'IncomeStatement' },
        { label: 'Balance Sheet', value: 'BalanceSheet' },
        { label: 'Cash Flow Statement', value: 'CashFlowStatement' }
    ];

    collection: CollectionReportResponse | null = null;
    aging: AgingReportResponse | null = null;
    dailyCash: DailyCashReportResponse | null = null;
    revenue: RevenueByClassReportResponse | null = null;
    defaulters: DefaulterReportResponse | null = null;
    statement: FinancialStatementResponse | null = null;
    selectedStatementType: StatementField = 'IncomeStatement';
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
        this.loadStatement();
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
        this.loadStatement();
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

    refreshStatement(): void {
        this.loadStatement();
    }

    loadStatement(): void {
        const schoolId = this.auth.schoolId();
        this.api.getFinancialStatement(this.selectedStatementType, schoolId, this.buildStatementRequest()).subscribe((statement) => {
            this.statement = statement;
        });
    }

    exportStatementPdf(): void {
        if (!this.statement) {
            return;
        }

        buildFinancialStatementPdf(this.schoolLabel, new Date(), this.statement, `financial-statement-${this.fileStamp()}.pdf`);
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

    formatStatementValue(value?: number | null): string {
        if (value == null) {
            return '-';
        }

        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(value));

        return value < 0 ? `(${formatted})` : formatted;
    }

    formatStatementPercent(value?: number | null): string {
        if (value == null) {
            return '-';
        }

        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(Math.abs(value * 100));

        return value < 0 ? `(${formatted}%)` : `${formatted}%`;
    }

    formatStatementCell(row: FinancialStatementRowResponse, columnKey: string): string {
        switch (columnKey) {
            case 'priorPeriod':
                return this.formatStatementValue(row.priorPeriod);
            case 'variance':
                return this.formatStatementValue(row.variance);
            case 'variancePct':
                return this.formatStatementPercent(row.variancePct);
            case 'budget':
                return this.formatStatementValue(row.budget);
            default:
                return this.formatStatementValue(row.actual);
        }
    }

    statementRowClass(row: FinancialStatementRowResponse): string {
        if (row.kind === 'Total') {
            return 'bg-surface-100/70 dark:bg-surface-800/70';
        }

        if (row.kind === 'Subtotal') {
            return 'bg-surface-50/70 dark:bg-surface-900/40';
        }

        return '';
    }

    private loadReports(): void {
        const schoolId = this.auth.schoolId();
        forkJoin({
            collection: this.api.getCollectionReport(schoolId),
            aging: this.api.getAgingReport(schoolId, this.resolveAsOfDate()),
            dailyCash: this.api.getDailyCashReport(schoolId, this.resolveDailyCashDate()),
            revenue: this.api.getRevenueByClassReport(schoolId),
            defaulters: this.api.getDefaulters(schoolId)
        }).subscribe(({ collection, aging, dailyCash, revenue, defaulters }) => {
            this.collection = collection;
            this.aging = aging;
            this.dailyCash = dailyCash;
            this.revenue = revenue;
            this.defaulters = defaulters;
        });
    }

    private buildStatementRequest(): {
        statementType: StatementField;
        periodMode: FinancialStatementPeriodMode;
        startDate?: string | null;
        endDate?: string | null;
        date?: string | null;
        month?: string | null;
        year?: number | null;
    } {
        switch (this.filter.mode) {
            case 'date':
                return {
                    statementType: this.selectedStatementType,
                    periodMode: 'Date',
                    date: this.filter.date || this.todayIsoDate()
                };
            case 'range':
                return {
                    statementType: this.selectedStatementType,
                    periodMode: 'Range',
                    startDate: this.filter.startDate || this.todayIsoDate(),
                    endDate: this.filter.endDate || this.filter.startDate || this.todayIsoDate()
                };
            case 'month':
                return {
                    statementType: this.selectedStatementType,
                    periodMode: 'Month',
                    month: this.filter.month || this.currentMonthValue(),
                    year: this.filter.year
                };
            case 'year':
                return {
                    statementType: this.selectedStatementType,
                    periodMode: 'Year',
                    year: this.filter.year
                };
            default:
                return {
                    statementType: this.selectedStatementType,
                    periodMode: 'None'
                };
        }
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

    get statementSummaryRow(): FinancialStatementRowResponse | null {
        if (!this.statement?.rows.length) {
            return null;
        }

        return this.statement.rows[this.statement.rows.length - 1] ?? null;
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

    private todayIsoDate(): string {
        return new Date().toISOString().slice(0, 10);
    }

    private currentMonthValue(): string {
        return new Date().toISOString().slice(0, 7);
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
