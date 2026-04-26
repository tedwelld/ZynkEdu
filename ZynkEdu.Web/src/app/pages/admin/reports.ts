import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    AcademicTermResponse,
    DashboardResponse,
    NotificationResponse,
    ResultResponse,
    SubjectPerformanceDto
} from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type ReportKind = 'school-summary' | 'school-comparison' | 'student-performance' | 'teacher-performance' | 'academic-summary' | 'notifications';
type PeriodKind = 'term' | 'date-range' | 'month' | 'week' | 'day';

interface ReportOption {
    label: string;
    value: ReportKind;
    description: string;
}

interface PeriodOption {
    label: string;
    value: PeriodKind;
}

interface PreviewRow {
    studentName: string;
    subjectName: string;
    score: string;
    term: string;
    date: string;
}

interface NotificationPreviewRow {
    title: string;
    type: string;
    message: string;
    date: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-reports',
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Reports</p>
                    <h1 class="text-3xl font-display font-bold m-0">Report generator</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Choose a report type, pick a term or date window, and export a clean PDF from the current system data.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Generate PDF" icon="pi pi-file-pdf" (click)="generateReport()" [disabled]="loading || !hasAnyData"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Report types" [value]="reportOptions.length.toString()" delta="Templates" hint="PDF exports" icon="pi pi-file-pdf" tone="blue" direction="up"></app-metric-card>
                <app-metric-card label="Results in scope" [value]="filteredResults.length.toString()" delta="Filtered view" hint="Matching rows" icon="pi pi-chart-line" tone="green" direction="up"></app-metric-card>
                <app-metric-card label="Notifications" [value]="filteredNotifications.length.toString()" delta="Filtered view" hint="Message rows" icon="pi pi-bell" tone="purple" direction="up"></app-metric-card>
                <app-metric-card label="Terms" [value]="terms.length.toString()" delta="School calendar" hint="Selectable periods" icon="pi pi-calendar" tone="orange" direction="up"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Report filters</h2>
                        <p class="text-sm text-muted-color">Pick the report and the time window to include in the export.</p>
                    </div>
                    <p-tag [value]="selectedPeriodLabel"></p-tag>
                </div>

                <div class="grid gap-4 xl:grid-cols-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Report type</label>
                        <app-dropdown [options]="reportOptions" [(ngModel)]="selectedReport" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Period</label>
                        <app-dropdown [options]="periodOptions" [(ngModel)]="selectedPeriodKind" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
                    </div>

                    <div *ngIf="selectedPeriodKind === 'term'">
                        <label class="block text-sm font-semibold mb-2">Term</label>
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
                    </div>

                    <div *ngIf="selectedPeriodKind === 'date-range'" class="grid gap-4 md:grid-cols-2 xl:col-span-2">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Start date</label>
                            <p-datepicker [(ngModel)]="dateRangeStart" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full"></p-datepicker>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">End date</label>
                            <p-datepicker [(ngModel)]="dateRangeEnd" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full"></p-datepicker>
                        </div>
                    </div>

                    <div *ngIf="selectedPeriodKind === 'month' || selectedPeriodKind === 'week' || selectedPeriodKind === 'day'">
                        <label class="block text-sm font-semibold mb-2">Anchor date</label>
                        <p-datepicker [(ngModel)]="anchorDate" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full"></p-datepicker>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3 pt-4">
                    <button pButton type="button" label="Generate PDF" icon="pi pi-download" (click)="generateReport()" [disabled]="loading || !hasAnyData"></button>
                    <button pButton type="button" label="Reset filters" severity="secondary" (click)="resetFilters()"></button>
                </div>
            </article>

            <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Preview</h2>
                            <p class="text-sm text-muted-color">This is the data that will go into the PDF.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ previewCountLabel }}</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="3.5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="18rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <ng-container *ngIf="!loading">
                        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Report</div>
                                <div class="text-lg font-display font-bold mt-1">{{ selectedReportLabel }}</div>
                            </div>
                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Period</div>
                                <div class="text-lg font-display font-bold mt-1">{{ selectedPeriodLabel }}</div>
                            </div>
                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Results</div>
                                <div class="text-lg font-display font-bold mt-1">{{ filteredResults.length }}</div>
                            </div>
                            <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Messages</div>
                                <div class="text-lg font-display font-bold mt-1">{{ filteredNotifications.length }}</div>
                            </div>
                        </div>

                        <div class="mt-5">
                            <p-table *ngIf="selectedReport !== 'notifications'" [value]="previewResults" styleClass="p-datatable-sm">
                                <ng-template pTemplate="header">
                                    <tr>
                                        <th>Student</th>
                                        <th>Subject</th>
                                        <th>Score</th>
                                        <th>Term</th>
                                        <th>Date</th>
                                    </tr>
                                </ng-template>
                                <ng-template pTemplate="body" let-row>
                                    <tr>
                                        <td class="font-semibold">{{ row.studentName }}</td>
                                        <td>{{ row.subjectName }}</td>
                                        <td>{{ row.score }}</td>
                                        <td>{{ row.term }}</td>
                                        <td class="text-sm text-muted-color">{{ row.date }}</td>
                                    </tr>
                                </ng-template>
                            </p-table>

                            <p-table *ngIf="selectedReport === 'notifications'" [value]="previewNotifications" styleClass="p-datatable-sm">
                                <ng-template pTemplate="header">
                                    <tr>
                                        <th>Title</th>
                                        <th>Type</th>
                                        <th>Message</th>
                                        <th>Date</th>
                                    </tr>
                                </ng-template>
                                <ng-template pTemplate="body" let-row>
                                    <tr>
                                        <td class="font-semibold">{{ row.title }}</td>
                                        <td>{{ row.type }}</td>
                                        <td>{{ row.message }}</td>
                                        <td class="text-sm text-muted-color">{{ row.date }}</td>
                                    </tr>
                                </ng-template>
                            </p-table>
                        </div>
                    </ng-container>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Report notes</h2>
                            <p class="text-sm text-muted-color">What each report includes.</p>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div *ngFor="let report of reportOptions" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4" [ngClass]="selectedReport === report.value ? 'bg-surface-50 dark:bg-surface-900/50' : ''">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold">{{ report.label }}</div>
                                    <div class="text-sm text-muted-color mt-1">{{ report.description }}</div>
                                </div>
                                <p-tag [value]="selectedReport === report.value ? 'Selected' : 'Ready'" [severity]="selectedReport === report.value ? 'success' : 'secondary'"></p-tag>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class AdminReports implements OnInit {
    private readonly api = inject(ApiService);

    loading = true;
    dashboard: DashboardResponse | null = null;
    results: ResultResponse[] = [];
    notifications: NotificationResponse[] = [];
    terms: AcademicTermResponse[] = [];

    selectedReport: ReportKind = 'school-summary';
    selectedPeriodKind: PeriodKind = 'term';
    selectedTermId: number | null = null;
    dateRangeStart: Date | null = null;
    dateRangeEnd: Date | null = null;
    anchorDate: Date = new Date();

    reportOptions: ReportOption[] = [
        {
            label: 'School summary',
            value: 'school-summary',
            description: 'Overview of the current school snapshot.'
        },
        {
            label: 'School comparison',
            value: 'school-comparison',
            description: 'Ranks schools by average score and pass rate.'
        },
        {
            label: 'Student performance',
            value: 'student-performance',
            description: 'Highlights the strongest and weakest students.'
        },
        {
            label: 'Teacher performance',
            value: 'teacher-performance',
            description: 'Shows the average score for each teacher.'
        },
        {
            label: 'Academic summary',
            value: 'academic-summary',
            description: 'Breaks results down by subject and class.'
        },
        {
            label: 'Notifications',
            value: 'notifications',
            description: 'Exports message activity for the selected period.'
        }
    ];

    periodOptions: PeriodOption[] = [
        { label: 'Term', value: 'term' },
        { label: 'Date range', value: 'date-range' },
        { label: 'Month', value: 'month' },
        { label: 'Week', value: 'week' },
        { label: 'Day', value: 'day' }
    ];

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            dashboard: this.api.getAdminDashboard(),
            results: this.api.getResults(),
            notifications: this.api.getNotifications(),
            terms: this.api.getAcademicTerms()
        }).subscribe({
            next: ({ dashboard, results, notifications, terms }) => {
                this.dashboard = dashboard;
                this.results = results;
                this.notifications = notifications;
                this.terms = terms;
                if (this.selectedTermId === null && terms.length > 0) {
                    this.selectedTermId = terms[0].id;
                }
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    resetFilters(): void {
        this.selectedReport = 'school-summary';
        this.selectedPeriodKind = 'term';
        this.selectedTermId = this.terms[0]?.id ?? null;
        this.dateRangeStart = null;
        this.dateRangeEnd = null;
        this.anchorDate = new Date();
    }

    generateReport(): void {
        if (!this.dashboard) {
            return;
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const reportTitle = this.selectedReportLabel;
        const reportDescription = this.reportOptions.find((report) => report.value === this.selectedReport)?.description ?? '';
        const periodLabel = this.selectedPeriodLabel;

        let y = this.writeHeader(doc, reportTitle, reportDescription, periodLabel, margin, pageWidth);
        y = this.writeSummaryBlock(doc, margin, y);

        switch (this.selectedReport) {
            case 'school-summary':
                this.writeTableSection(doc, 'Result snapshot', ['Metric', 'Value'], this.buildSchoolSummaryRows(), margin, y);
                break;
            case 'school-comparison':
                this.writeTableSection(doc, 'School comparison', ['School', 'Average score', 'Pass rate', 'Results'], this.buildSchoolComparisonRows(), margin, y);
                break;
            case 'student-performance':
                this.writeTableSection(doc, 'Student performance', ['Student', 'Average score', 'Results', 'Term'], this.buildStudentRows(), margin, y);
                break;
            case 'teacher-performance':
                this.writeTableSection(doc, 'Teacher performance', ['Teacher', 'Subject', 'Class', 'Average score'], this.buildTeacherRows(), margin, y);
                break;
            case 'academic-summary':
                this.writeTableSection(doc, 'Subject performance', ['Subject', 'Average score'], this.buildSubjectRows(), margin, y);
                this.writeTableSection(doc, 'Class performance', ['Class', 'Average score', 'Pass rate'], this.buildClassRows(), margin, this.nextY(doc, y));
                break;
            case 'notifications':
                this.writeTableSection(doc, 'Notifications', ['Title', 'Type', 'Message', 'Date'], this.buildNotificationRows(), margin, y);
                break;
        }

        doc.save(this.fileNameForReport());
    }

    get hasAnyData(): boolean {
        return this.results.length > 0 || this.notifications.length > 0;
    }

    get previewCountLabel(): string {
        return `${this.selectedReport === 'notifications' ? this.filteredNotifications.length : this.previewResults.length} row(s)`;
    }

    get selectedReportLabel(): string {
        return this.reportOptions.find((report) => report.value === this.selectedReport)?.label ?? 'Report';
    }

    get selectedPeriodLabel(): string {
        const range = this.periodRange();
        if (!range) {
            return 'No period selected';
        }

        return range.label;
    }

    get termOptions(): { label: string; value: number }[] {
        return this.terms.map((term) => ({ label: term.name || `Term ${term.termNumber}`, value: term.id }));
    }

    get filteredResults(): ResultResponse[] {
        const range = this.periodRange();
        if (!range) {
            return [...this.results];
        }

        return this.results.filter((result) => {
            const createdAt = new Date(result.createdAt);
            return createdAt >= range.start && createdAt <= range.end && this.matchesTerm(result.term);
        });
    }

    get filteredNotifications(): NotificationResponse[] {
        const range = this.periodRange();
        if (!range) {
            return [...this.notifications];
        }

        return this.notifications.filter((notification) => {
            const createdAt = new Date(notification.createdAt);
            return createdAt >= range.start && createdAt <= range.end;
        });
    }

    get previewResults(): PreviewRow[] {
        return this.filteredResults.slice(0, 10).map((result) => ({
            studentName: `${result.studentName} (${result.studentNumber})`,
            subjectName: result.subjectName,
            score: `${result.score.toFixed(1)}%`,
            term: result.term,
            date: this.formatDate(result.createdAt)
        }));
    }

    get previewNotifications(): NotificationPreviewRow[] {
        return this.filteredNotifications.slice(0, 10).map((notification) => ({
            title: notification.title,
            type: notification.type,
            message: notification.message,
            date: this.formatDate(notification.createdAt)
        }));
    }

    private periodRange(): { start: Date; end: Date; label: string } | null {
        if (this.selectedPeriodKind === 'term') {
            const term = this.terms.find((item) => item.id === this.selectedTermId) ?? this.terms[0];
            if (!term) {
                return null;
            }

            const start = term.startDate ? this.startOfDay(new Date(term.startDate)) : new Date(0);
            const end = term.endDate ? this.endOfDay(new Date(term.endDate)) : new Date();
            return {
                start,
                end,
                label: term.startDate && term.endDate ? `${term.name} - ${this.formatDateRange(start, end)}` : term.name || `Term ${term.termNumber}`
            };
        }

        if (this.selectedPeriodKind === 'date-range') {
            if (!this.dateRangeStart || !this.dateRangeEnd) {
                return null;
            }

            const start = this.startOfDay(this.dateRangeStart);
            const end = this.endOfDay(this.dateRangeEnd);
            return {
                start,
                end,
                label: `${this.formatDate(start)} to ${this.formatDate(end)}`
            };
        }

        const anchor = this.anchorDate ? new Date(this.anchorDate) : new Date();
        if (this.selectedPeriodKind === 'month') {
            const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
            const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
            return {
                start,
                end,
                label: `${anchor.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`
            };
        }

        if (this.selectedPeriodKind === 'week') {
            const day = anchor.getDay();
            const offsetToMonday = (day + 6) % 7;
            const start = this.startOfDay(new Date(anchor));
            start.setDate(anchor.getDate() - offsetToMonday);
            const end = this.endOfDay(new Date(start));
            end.setDate(start.getDate() + 6);
            return {
                start,
                end,
                label: `Week of ${this.formatDate(start)}`
            };
        }

        const start = this.startOfDay(anchor);
        const end = this.endOfDay(anchor);
        return {
            start,
            end,
            label: this.formatDate(anchor)
        };
    }

    private matchesTerm(resultTerm: string): boolean {
        if (this.selectedPeriodKind !== 'term') {
            return true;
        }

        const term = this.terms.find((item) => item.id === this.selectedTermId) ?? this.terms[0];
        if (!term) {
            return true;
        }

        const termText = resultTerm.trim().toLowerCase();
        const candidates = [term.name, `term ${term.termNumber}`, `${term.termNumber}`]
            .filter((value): value is string => Boolean(value))
            .map((value) => value.toLowerCase());

        return candidates.some((candidate) => termText.includes(candidate));
    }

    private buildSchoolSummaryRows(): string[][] {
        const rows = [
            ['Period', this.selectedPeriodLabel],
            ['Results in scope', this.filteredResults.length.toString()],
            ['Notifications in scope', this.filteredNotifications.length.toString()]
        ];

        if (this.filteredResults.length === 0) {
            rows.push(['Average score', 'No results available']);
            rows.push(['Pass rate', 'No results available']);
            return rows;
        }

        const average = this.filteredResults.reduce((sum, result) => sum + Number(result.score), 0) / this.filteredResults.length;
        const passRate = (this.filteredResults.filter((result) => result.score >= 50).length * 100) / this.filteredResults.length;
        const topStudent = this.groupByStudent(this.filteredResults)[0];

        rows.push(['Average score', `${average.toFixed(1)}%`]);
        rows.push(['Pass rate', `${passRate.toFixed(1)}%`]);
        rows.push(['Top student', topStudent ? `${topStudent.studentName} (${topStudent.average.toFixed(1)}%)` : 'No data']);
        return rows;
    }

    private buildSchoolComparisonRows(): string[][] {
        const schoolRows = this.dashboard?.schoolPerformance ?? [];
        if (schoolRows.length === 0) {
            return [['No data', 'Nothing to compare', '0%', '0']];
        }

        return schoolRows.map((row) => [
            row.schoolName,
            `${row.averageScore.toFixed(1)}%`,
            `${row.passRate.toFixed(1)}%`,
            row.resultCount.toString()
        ]);
    }

    private buildStudentRows(): string[][] {
        return this.groupByStudent(this.filteredResults).slice(0, 12).map((row) => [
            row.studentName,
            `${row.average.toFixed(1)}%`,
            row.count.toString(),
            row.term
        ]);
    }

    private buildTeacherRows(): string[][] {
        const rows = this.groupByTeacher(this.filteredResults);
        return rows.map((row) => [
            row.teacherName,
            row.subject,
            row.className,
            `${row.average.toFixed(1)}%`
        ]);
    }

    private buildSubjectRows(): string[][] {
        const rows = this.groupBySubject(this.filteredResults);
        return rows.map((row) => [row.subject, `${row.averageScore.toFixed(1)}%`]);
    }

    private buildClassRows(): string[][] {
        const rows = this.groupByClass(this.filteredResults);
        return rows.map((row) => [row.className, `${row.average.toFixed(1)}%`, `${row.passRate.toFixed(1)}%`]);
    }

    private buildNotificationRows(): string[][] {
        if (this.filteredNotifications.length === 0) {
            return [['No notifications', 'No data', 'Nothing was sent in this period.', this.selectedPeriodLabel]];
        }

        return this.filteredNotifications.map((notification) => [
            notification.title,
            notification.type,
            notification.message,
            this.formatDate(notification.createdAt)
        ]);
    }

    private groupByStudent(results: ResultResponse[]): { studentName: string; average: number; count: number; term: string }[] {
        const map = new Map<string, { studentName: string; scores: number[]; term: string }>();

        for (const result of results) {
            const key = `${result.studentId}-${result.studentName}`;
            const entry = map.get(key) ?? { studentName: `${result.studentName} (${result.studentNumber})`, scores: [], term: result.term };
            entry.scores.push(Number(result.score));
            entry.term = result.term;
            map.set(key, entry);
        }

        return Array.from(map.values())
            .map((entry) => ({
                studentName: entry.studentName,
                average: entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length,
                count: entry.scores.length,
                term: entry.term
            }))
            .sort((a, b) => b.average - a.average);
    }

    private groupByTeacher(results: ResultResponse[]): { teacherName: string; subject: string; className: string; average: number }[] {
        const map = new Map<string, { teacherName: string; subject: string; className: string; scores: number[] }>();

        for (const result of results) {
            const key = `${result.teacherId}-${result.subjectId}-${result.term}`;
            const entry = map.get(key) ?? { teacherName: result.teacherName, subject: result.subjectName, className: this.classForResult(result), scores: [] };
            entry.scores.push(Number(result.score));
            map.set(key, entry);
        }

        return Array.from(map.values())
            .map((entry) => ({
                teacherName: entry.teacherName,
                subject: entry.subject,
                className: entry.className,
                average: entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length
            }))
            .sort((a, b) => b.average - a.average);
    }

    private groupBySubject(results: ResultResponse[]): SubjectPerformanceDto[] {
        const map = new Map<string, number[]>();

        for (const result of results) {
            const scores = map.get(result.subjectName) ?? [];
            scores.push(Number(result.score));
            map.set(result.subjectName, scores);
        }

        return Array.from(map.entries())
            .map(([subject, scores]) => ({
                subject,
                averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
            }))
            .sort((a, b) => b.averageScore - a.averageScore);
    }

    private groupByClass(results: ResultResponse[]): { className: string; average: number; passRate: number }[] {
        const map = new Map<string, number[]>();

        for (const result of results) {
            const className = this.classForResult(result);
            const scores = map.get(className) ?? [];
            scores.push(Number(result.score));
            map.set(className, scores);
        }

        return Array.from(map.entries())
            .map(([className, scores]) => ({
                className,
                average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
                passRate: (scores.filter((score) => score >= 50).length * 100) / scores.length
            }))
            .sort((a, b) => b.average - a.average);
    }

    private classForResult(result: ResultResponse): string {
        const assignment = this.dashboard?.teacherPerformance.find((item) => item.teacherId === result.teacherId && item.subject === result.subjectName);
        return assignment?.class ?? 'Unassigned';
    }

    private fileNameForReport(): string {
        return `${this.selectedReport}-${this.selectedPeriodKind}.pdf`;
    }

    private writeHeader(doc: jsPDF, title: string, description: string, period: string, margin: number, pageWidth: number): number {
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(title, margin, 46);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(description, margin, 64, { maxWidth: pageWidth - margin * 2 });
        doc.text(`Period: ${period}`, margin, 82);
        doc.text(`Generated: ${this.formatDate(new Date())}`, margin, 96);
        doc.setTextColor(17, 24, 39);
        return 112;
    }

    private writeSummaryBlock(doc: jsPDF, margin: number, y: number): number {
        autoTable(doc, {
            startY: y,
            head: [['Metric', 'Value']],
            body: [
                ['Results in scope', this.filteredResults.length.toString()],
                ['Notifications in scope', this.filteredNotifications.length.toString()],
                ['Term options', this.terms.length.toString()]
            ],
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 6
            },
            headStyles: {
                fillColor: [37, 99, 235]
            }
        });

        return this.nextY(doc, y);
    }

    private writeTableSection(doc: jsPDF, title: string, headers: string[], rows: string[][], margin: number, y: number): void {
        this.writeSectionTitle(doc, title, margin, y);

        autoTable(doc, {
            startY: y + 14,
            head: [headers],
            body: rows.length > 0 ? rows : [headers.map(() => 'No data')],
            theme: 'striped',
            styles: {
                fontSize: 8.5,
                cellPadding: 5
            },
            headStyles: {
                fillColor: [124, 58, 237]
            },
            margin: {
                left: margin,
                right: margin
            }
        });
    }

    private writeSectionTitle(doc: jsPDF, title: string, margin: number, y: number): void {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(title, margin, y);
    }

    private nextY(doc: jsPDF, fallback: number): number {
        const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
        return (lastTable?.finalY ?? fallback) + 14;
    }

    private startOfDay(value: Date): Date {
        const date = new Date(value);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private endOfDay(value: Date): Date {
        const date = new Date(value);
        date.setHours(23, 59, 59, 999);
        return date;
    }

    private formatDate(value: string | Date): string {
        return new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'medium'
        }).format(new Date(value));
    }

    private formatDateRange(start: Date, end: Date): string {
        return `${this.formatDate(start)} - ${this.formatDate(end)}`;
    }
}
