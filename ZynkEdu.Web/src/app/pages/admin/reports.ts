import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import * as XLSX from 'xlsx';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { getClassLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { keepNullableSelection, keepSelection } from '../../shared/ui/list-filters';
import { BulkSlipSendResponse, ParentPreviewReportResponse, ReportCardResponse, ResultResponse, SchoolResponse, StudentResponse, UserResponse } from '../../core/api/api.models';
import { ReportSchoolInfo, buildAdminResultsReportPdf, buildParentPreviewReportPdf, buildReportCardPdf } from '../../shared/report/report-pdf';
import { buildStudentStatementPdf } from '../../shared/report/student-statement-pdf';

interface PreviewRow {
    year: number;
    className: string;
    studentName: string;
    subjectName: string;
    teacherName: string;
    score: string;
    grade: string;
    term: string;
    date: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-reports',
    imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">System reports</p>
                    <h1 class="text-3xl font-display font-bold m-0">System reports</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Generate exports by year, class, student name, and teacher name from the current live results data. Class-grouped PDFs and guardian slips keep the report flow safe and readable.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="info" (click)="loadData()"></button>
                    <button pButton type="button" label="Generate PDF" icon="pi pi-file-pdf" (click)="generateReport()" [disabled]="loading || filteredResults.length === 0"></button>
                    <button pButton type="button" label="Export Excel" icon="pi pi-file-excel" severity="success" (click)="exportExcel()" [disabled]="loading || filteredResults.length === 0"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Results in scope" [value]="filteredResults.length.toString()" delta="Live rows" hint="Current filters" icon="pi pi-chart-line" tone="blue" direction="up"></app-metric-card>
                <app-metric-card label="Students" [value]="studentCount.toString()" delta="Distinct students" hint="Filtered names" icon="pi pi-users" tone="green" direction="up"></app-metric-card>
                <app-metric-card label="Teachers" [value]="teacherCount.toString()" delta="Distinct teachers" hint="Assigned staff" icon="pi pi-id-card" tone="purple" direction="up"></app-metric-card>
                <app-metric-card label="Average score" [value]="averageScoreLabel" delta="Filtered average" hint="Current report" icon="pi pi-chart-bar" tone="orange" direction="up"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Report filters</h2>
                        <p class="text-sm text-muted-color">Each selection is validated against the latest data when opened.</p>
                    </div>
                    <p-tag [value]="selectedScopeLabel"></p-tag>
                </div>

                <div class="grid gap-4 xl:grid-cols-5">
                    <div *ngIf="isPlatformAdmin">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown
                            [options]="schoolOptions"
                            [(ngModel)]="selectedSchoolId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search schools"
                            [showClear]="true"
                            (opened)="loadData()"
                            (ngModelChange)="onSchoolChange($event)"
                        ></app-dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Year</label>
                        <app-dropdown
                            [options]="yearOptions"
                            [(ngModel)]="selectedYear"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search years"
                            [showClear]="true"
                            (opened)="loadData()"
                            (ngModelChange)="onFilterChange()"
                        ></app-dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown
                            [options]="classOptions"
                            [(ngModel)]="selectedClass"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search classes"
                            [showClear]="true"
                            (opened)="loadData()"
                            (ngModelChange)="onFilterChange()"
                        ></app-dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Student name</label>
                        <app-dropdown
                            [options]="studentOptions"
                            [(ngModel)]="selectedStudentId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search students"
                            [showClear]="true"
                            (opened)="loadData()"
                            (ngModelChange)="onFilterChange()"
                        ></app-dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Teacher name</label>
                        <app-dropdown
                            [options]="teacherOptions"
                            [(ngModel)]="selectedTeacherId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search teachers"
                            [showClear]="true"
                            (opened)="loadData()"
                            (ngModelChange)="onFilterChange()"
                        ></app-dropdown>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3 pt-4">
                    <button pButton type="button" label="Generate PDF" icon="pi pi-download" (click)="generateReport()" [disabled]="loading || filteredResults.length === 0"></button>
                    <button pButton type="button" label="Export Excel" icon="pi pi-file-excel" severity="success" (click)="exportExcel()" [disabled]="loading || filteredResults.length === 0"></button>
                    <button pButton type="button" label="Clear filters" severity="warn" (click)="resetFilters()"></button>
                </div>
            </article>

            <div class="grid gap-6 xl:grid-cols-1">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Preview</h2>
                            <p class="text-sm text-muted-color">The first rows of the filtered dataset.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ previewResults.length }} row(s)</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="3.5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="18rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <ng-container *ngIf="!loading">
                        <p-table [value]="previewResults" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th class="text-muted-color w-8">#</th>
                                    <th>Year</th>
                                    <th>Class</th>
                                    <th>Student</th>
                                    <th>Subject</th>
                                    <th>Teacher</th>
                                    <th>Score</th>
                                    <th>Term</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-row let-rowIndex="rowIndex">
                                <tr>
                                    <td class="text-sm text-muted-color">{{ rowIndex + 1 }}</td>
                                    <td>{{ row.year }}</td>
                                    <td class="font-semibold">{{ row.className }}</td>
                                    <td>{{ row.studentName }}</td>
                                    <td>{{ row.subjectName }}</td>
                                    <td>{{ row.teacherName }}</td>
                                    <td>{{ row.score }}</td>
                                    <td>{{ row.term }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </ng-container>

                    <div class="flex flex-wrap gap-3 pt-4">
                        <label class="block w-full lg:w-auto">
                            <span class="text-sm text-muted-color">Accounts newsletter PDF</span>
                            <input class="mt-2 block w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="file" accept="application/pdf" (change)="onNewsletterFileSelected($event)" />
                        </label>
                        <div class="flex items-center gap-2 w-full">
                            <p-checkbox [(ngModel)]="includeFinancialStatement" [binary]="true" inputId="includeStatement"></p-checkbox>
                            <label for="includeStatement" class="text-sm cursor-pointer select-none">Include financial statement</label>
                        </div>
                        <button pButton type="button" label="Send guardian reports" icon="pi pi-send" severity="info" (click)="sendGroupedGuardianReports()" [disabled]="loading || filteredResults.length === 0 || sendingGuardianReports"></button>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Bulk class dispatch</h2>
                            <p class="text-sm text-muted-color">Send result slips for all students in a class and term via email and/or SMS without generating PDFs one by one.</p>
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="block text-sm font-medium mb-1" for="bulkClass">Class</label>
                            <app-dropdown inputId="bulkClass" [(ngModel)]="bulkClassName" [options]="bulkClassOptions" placeholder="Select class"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1" for="bulkTerm">Term</label>
                            <app-dropdown inputId="bulkTerm" [(ngModel)]="bulkTerm" [options]="bulkTermOptions" placeholder="Select term"></app-dropdown>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-4 mt-4">
                        <div class="flex items-center gap-2">
                            <p-checkbox [(ngModel)]="bulkSendEmail" [binary]="true" inputId="bulkEmail"></p-checkbox>
                            <label for="bulkEmail" class="text-sm cursor-pointer select-none">Send email</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <p-checkbox [(ngModel)]="bulkSendSms" [binary]="true" inputId="bulkSms"></p-checkbox>
                            <label for="bulkSms" class="text-sm cursor-pointer select-none">Send SMS</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <p-checkbox [(ngModel)]="bulkIncludeStatement" [binary]="true" inputId="bulkStatement"></p-checkbox>
                            <label for="bulkStatement" class="text-sm cursor-pointer select-none">Include outstanding balance in email</label>
                        </div>
                    </div>

                    <div *ngIf="bulkSendResult" class="mt-4 rounded-2xl border p-4" [class.border-green-400]="bulkSendResult.failedCount === 0" [class.border-amber-400]="bulkSendResult.failedCount > 0">
                        <div class="font-semibold mb-1">{{ bulkSendResult.sentCount }} sent · {{ bulkSendResult.failedCount }} failed</div>
                        <ul *ngIf="bulkSendResult.failures.length > 0" class="text-sm text-muted-color list-disc pl-4 space-y-0.5">
                            <li *ngFor="let f of bulkSendResult.failures">{{ f }}</li>
                        </ul>
                    </div>

                    <div class="mt-4">
                        <button pButton type="button" label="Send class slips" icon="pi pi-send" severity="info"
                            (click)="sendTermSlips()"
                            [disabled]="!bulkClassName || !bulkTerm || sendingTermSlips || (!bulkSendEmail && !bulkSendSms)">
                        </button>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Report card</h2>
                            <p class="text-sm text-muted-color">Generate a consolidated report card for a single student and term.</p>
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="block text-sm font-medium mb-1" for="rcStudent">Student</label>
                            <app-dropdown inputId="rcStudent" [(ngModel)]="rcStudentId" [options]="studentOptions" placeholder="Select student"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1" for="rcTerm">Term</label>
                            <app-dropdown inputId="rcTerm" [(ngModel)]="rcTerm" [options]="bulkTermOptions" placeholder="Select term"></app-dropdown>
                        </div>
                    </div>

                    <div class="mt-4">
                        <button pButton type="button" label="Load report card" icon="pi pi-id-card" severity="info"
                            (click)="loadReportCard()" [disabled]="!rcStudentId || !rcTerm || loadingReportCard">
                        </button>
                    </div>

                    <ng-container *ngIf="reportCard">
                        <div class="mt-5 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div class="font-semibold">{{ reportCard.studentName }}</div>
                                    <div class="text-sm text-muted-color">{{ reportCard.studentClass }} · {{ reportCard.term }} · {{ reportCard.resultYear }}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-2xl font-bold text-primary">{{ reportCard.averageScore.toFixed(1) }}%</div>
                                    <div class="text-sm text-muted-color">Rank {{ reportCard.rank }}/{{ reportCard.totalStudents }}</div>
                                </div>
                            </div>
                            <p-table [value]="reportCard.subjects" styleClass="p-datatable-sm">
                                <ng-template pTemplate="header">
                                    <tr>
                                        <th>Subject</th>
                                        <th>Teacher</th>
                                        <th class="text-right">Score</th>
                                        <th>Grade</th>
                                        <th>Comment</th>
                                    </tr>
                                </ng-template>
                                <ng-template pTemplate="body" let-row>
                                    <tr>
                                        <td>{{ row.subjectName }}</td>
                                        <td class="text-sm text-muted-color">{{ row.teacherName }}</td>
                                        <td class="text-right font-mono">{{ row.score.toFixed(1) }}%</td>
                                        <td><p-tag [value]="row.grade" severity="info"></p-tag></td>
                                        <td class="text-sm text-muted-color">{{ row.comment || '—' }}</td>
                                    </tr>
                                </ng-template>
                            </p-table>
                            <div class="mt-3 flex gap-2">
                                <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="success" size="small" (click)="downloadReportCardPdf()"></button>
                            </div>
                        </div>
                    </ng-container>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Filter summary</h2>
                            <p class="text-sm text-muted-color">Report criteria and a quick view of the dataset.</p>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Scope</div>
                            <div class="text-lg font-display font-bold mt-1">{{ selectedScopeLabel }}</div>
                        </div>
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Year</div>
                            <div class="text-lg font-display font-bold mt-1">{{ selectedYear ?? 'All years' }}</div>
                        </div>
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">Class / Student / Teacher</div>
                            <div class="text-sm text-muted-color mt-1">
                                {{ selectedClass || 'All classes' }}<br />
                                {{ selectedStudentLabel }}<br />
                                {{ selectedTeacherLabel }}
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
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    errorMessage = '';
    sendingGuardianReports = false;
    accountsNewsletterFile: File | null = null;
    includeFinancialStatement = false;

    bulkClassName = '';
    bulkTerm = '';
    bulkSendEmail = true;
    bulkSendSms = true;
    bulkIncludeStatement = false;
    sendingTermSlips = false;
    bulkSendResult: BulkSlipSendResponse | null = null;

    rcStudentId: number | null = null;
    rcTerm = '';
    loadingReportCard = false;
    reportCard: ReportCardResponse | null = null;
    schools: SchoolResponse[] = [];
    results: ResultResponse[] = [];
    selectedSchoolId: number | null = null;
    selectedYear: number | null = null;
    selectedClass = '';
    selectedStudentId: number | null = null;
    selectedTeacherId: number | null = null;

    ngOnInit(): void {
        this.selectedSchoolId = this.auth.role() === 'PlatformAdmin' ? null : this.auth.schoolId();
        this.loadData();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [{ label: 'All schools', value: null }, ...this.schools.map((school) => ({ label: school.name, value: school.id }))];
    }

    get baseResults(): ResultResponse[] {
        return this.results.filter((result) => !this.selectedSchoolId || result.schoolId === this.selectedSchoolId);
    }

    get yearOptions(): { label: string; value: number | null }[] {
        const values = Array.from(new Set(this.baseResults.map((result) => result.resultYear))).sort((a, b) => b - a);
        return [{ label: 'All years', value: null }, ...values.map((value) => ({ label: value.toString(), value }))];
    }

    get classOptions(): { label: string; value: string }[] {
        const values = Array.from(new Set(this.resultsForYear().map((result) => result.studentClass).filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
        return [{ label: 'All classes', value: '' }, ...values.map((value) => ({ label: value, value }))];
    }

    get studentOptions(): { label: string; value: number | null }[] {
        const values = this.uniqueStudents(this.resultsForClass())
            .sort((a, b) => a.label.localeCompare(b.label));
        return [{ label: 'All students', value: null }, ...values];
    }

    get teacherOptions(): { label: string; value: number | null }[] {
        const source = this.selectedStudentId == null
            ? this.resultsForClass()
            : this.resultsForClass().filter((result) => result.studentId === this.selectedStudentId);
        const values = this.uniqueTeachers(source)
            .sort((a, b) => a.label.localeCompare(b.label));
        return [{ label: 'All teachers', value: null }, ...values];
    }

    get bulkClassOptions(): { label: string; value: string }[] {
        const values = Array.from(new Set(this.baseResults.map((r) => r.studentClass).filter((c) => c.trim().length > 0))).sort((a, b) => a.localeCompare(b));
        return [{ label: 'Select class', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
    }

    get bulkTermOptions(): { label: string; value: string }[] {
        const values = Array.from(new Set(this.baseResults.map((r) => r.term).filter((t) => t.trim().length > 0))).sort((a, b) => a.localeCompare(b));
        return [{ label: 'Select term', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
    }

    get filteredResults(): ResultResponse[] {
        return this.baseResults.filter((result) => {
            const matchesYear = this.selectedYear == null || result.resultYear === this.selectedYear;
            const matchesClass = !this.selectedClass || result.studentClass === this.selectedClass;
            const matchesStudent = this.selectedStudentId == null || result.studentId === this.selectedStudentId;
            const matchesTeacher = this.selectedTeacherId == null || result.teacherId === this.selectedTeacherId;
            return matchesYear && matchesClass && matchesStudent && matchesTeacher;
        });
    }

    get previewResults(): PreviewRow[] {
        return this.filteredResults.slice(0, 12).map((result) => ({
            year: result.resultYear,
            className: result.studentClass,
            studentName: `${result.studentName} (${result.studentNumber})`,
            subjectName: result.subjectName,
            teacherName: result.teacherName,
            score: `${result.score.toFixed(1)}%`,
            grade: result.grade,
            term: result.term,
            date: this.formatDate(result.createdAt)
        }));
    }

    get studentCount(): number {
        return new Set(this.filteredResults.map((result) => result.studentId)).size;
    }

    get teacherCount(): number {
        return new Set(this.filteredResults.map((result) => result.teacherId)).size;
    }

    get averageScoreLabel(): string {
        if (this.filteredResults.length === 0) {
            return '0%';
        }

        const average = this.filteredResults.reduce((sum, result) => sum + Number(result.score), 0) / this.filteredResults.length;
        return `${average.toFixed(1)}%`;
    }

    get selectedScopeLabel(): string {
        if (!this.isPlatformAdmin) {
            return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? 'Current school';
        }

        if (!this.selectedSchoolId) {
            return 'All schools';
        }

        return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? `School ${this.selectedSchoolId}`;
    }

    get selectedStudentLabel(): string {
        if (this.selectedStudentId == null) {
            return 'All students';
        }

        return this.baseResults.find((result) => result.studentId === this.selectedStudentId)?.studentName ?? 'Selected student';
    }

    get selectedTeacherLabel(): string {
        if (this.selectedTeacherId == null) {
            return 'All teachers';
        }

        return this.baseResults.find((result) => result.teacherId === this.selectedTeacherId)?.teacherName ?? 'Selected teacher';
    }

    get selectedStudentResults(): ResultResponse[] {
        if (this.selectedStudentId == null) {
            return [];
        }

        return this.filteredResults.filter((result) => result.studentId === this.selectedStudentId);
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            schools: this.isPlatformAdmin ? this.api.getPlatformSchools() : this.api.getSchools(),
            results: this.api.getResults()
        }).subscribe({
            next: ({ schools, results }) => {
                this.schools = schools;
                this.results = results;
                if (this.isPlatformAdmin && this.selectedSchoolId != null && !this.schools.some((school) => school.id === this.selectedSchoolId)) {
                    this.selectedSchoolId = null;
                }
                if (!this.isPlatformAdmin) {
                    this.selectedSchoolId = this.auth.schoolId();
                }
                this.syncFilters();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Failed to load reports. Please refresh or check your connection.';
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.syncFilters();
    }

    onFilterChange(): void {
        this.syncFilters();
    }

    resetFilters(): void {
        this.selectedYear = null;
        this.selectedClass = '';
        this.selectedStudentId = null;
        this.selectedTeacherId = null;
        this.syncFilters();
    }

    private resultsForYear(): ResultResponse[] {
        return this.baseResults.filter((result) => this.selectedYear == null || result.resultYear === this.selectedYear);
    }

    private resultsForClass(): ResultResponse[] {
        return this.resultsForYear().filter((result) => !this.selectedClass || result.studentClass === this.selectedClass);
    }

    generateReport(): void {
        if (this.filteredResults.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'No data', detail: 'There are no results to include in the PDF report.' });
            return;
        }

        try {
            buildAdminResultsReportPdf(
                this.schoolInfo,
                'Results report',
                'Filtered by year, class, student name, and teacher name. Grouped by school and class for easy review.',
                this.selectedScopeLabel,
                this.selectedFilterSummary(),
                new Date(),
                this.groupedResultsBySchoolAndClass(),
                this.fileNameForReport()
            );
            this.messages.add({ severity: 'success', summary: 'PDF ready', detail: 'The filtered report was generated successfully.' });
        } catch {
            this.messages.add({ severity: 'error', summary: 'PDF failed', detail: 'The PDF report could not be generated.' });
        }
    }

    async sendGroupedGuardianReports(): Promise<void> {
        const studentIds = Array.from(new Set(this.filteredResults.map((result) => result.studentId)));
        if (studentIds.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'No data', detail: 'There are no student results to send.' });
            return;
        }

        this.sendingGuardianReports = true;
        let sentCount = 0;
        const failedStudents: string[] = [];

        try {
            for (const studentId of studentIds) {
                try {
                    const student = await firstValueFrom(this.api.getStudentById(studentId));
                    const studentResults = this.filteredResults.filter((result) => result.studentId === studentId);
                    if (studentResults.length === 0) {
                        continue;
                    }

                    const report = this.guardianReportForStudent(student, studentResults);
                    const pdf = buildParentPreviewReportPdf(report);
                    const blob = pdf.output('blob');

                    let statementBlob: Blob | null = null;
                    if (this.includeFinancialStatement) {
                        try {
                            const statement = await firstValueFrom(this.api.getStudentStatement(studentId, student.schoolId));
                            const statementDoc = buildStudentStatementPdf(statement, this.schoolInfo, new Date(), `financial-statement-${student.studentNumber}.pdf`);
                            statementBlob = statementDoc.output('blob');
                        } catch {
                            // Statement not available; send slip without it
                        }
                    }

                    await firstValueFrom(
                        this.api.sendResultSlip(
                            studentId,
                            { sendEmail: true, sendSms: true },
                            blob,
                            student.schoolId,
                            this.accountsNewsletterFile,
                            statementBlob
                        )
                    );

                    sentCount++;
                } catch {
                    const studentName = this.filteredResults.find((result) => result.studentId === studentId)?.studentName ?? `Student ${studentId}`;
                    failedStudents.push(studentName);
                }
            }

            if (sentCount > 0 && failedStudents.length === 0) {
                this.messages.add({ severity: 'success', summary: 'Guardian reports sent', detail: `${sentCount} student report(s) were sent to guardians.` });
            } else if (sentCount > 0) {
                this.messages.add({
                    severity: 'warn',
                    summary: 'Partial send',
                    detail: `${sentCount} report(s) were sent. ${failedStudents.length} student(s) could not be sent: ${failedStudents.join(', ')}.`
                });
            } else {
                this.messages.add({ severity: 'error', summary: 'Send failed', detail: 'No guardian reports could be sent.' });
            }
        } finally {
            this.sendingGuardianReports = false;
        }
    }

    loadReportCard(): void {
        if (!this.rcStudentId || !this.rcTerm) return;
        this.loadingReportCard = true;
        this.reportCard = null;
        this.api.getReportCard(this.rcStudentId, this.rcTerm, this.selectedSchoolId).subscribe({
            next: (card) => {
                this.reportCard = card;
                this.loadingReportCard = false;
            },
            error: () => {
                this.messages.add({ severity: 'error', summary: 'Report card failed', detail: 'Could not load the report card. Ensure approved results exist for the selected student and term.' });
                this.loadingReportCard = false;
            }
        });
    }

    downloadReportCardPdf(): void {
        if (!this.reportCard) return;
        const doc = buildReportCardPdf(this.reportCard, this.schoolInfo);
        doc.save(`report-card-${this.reportCard.studentNumber}-${this.reportCard.term}.pdf`);
    }

    async sendTermSlips(): Promise<void> {
        if (!this.bulkClassName || !this.bulkTerm) {
            this.messages.add({ severity: 'warn', summary: 'Missing selection', detail: 'Please select a class and term before sending.' });
            return;
        }
        this.sendingTermSlips = true;
        this.bulkSendResult = null;
        try {
            const result = await firstValueFrom(
                this.api.sendTermSlips(this.bulkClassName, this.bulkTerm, {
                    includeStatement: this.bulkIncludeStatement,
                    sendEmail: this.bulkSendEmail,
                    sendSms: this.bulkSendSms,
                    schoolId: this.selectedSchoolId
                })
            );
            this.bulkSendResult = result;
            if (result.failedCount === 0) {
                this.messages.add({ severity: 'success', summary: 'Slips sent', detail: `${result.sentCount} student(s) notified for ${this.bulkClassName} — ${this.bulkTerm}.` });
            } else {
                this.messages.add({ severity: 'warn', summary: 'Partial dispatch', detail: `${result.sentCount} sent, ${result.failedCount} failed.` });
            }
        } catch {
            this.messages.add({ severity: 'error', summary: 'Dispatch failed', detail: 'The bulk send could not be completed. Please try again.' });
        } finally {
            this.sendingTermSlips = false;
        }
    }

    exportExcel(): void {
        try {
            const workbook = XLSX.utils.book_new();
            const summarySheet = XLSX.utils.aoa_to_sheet([
                ['Scope', this.selectedScopeLabel],
                ['Filters', this.selectedFilterSummary()],
                ['Results in scope', this.filteredResults.length.toString()],
                ['Students', this.studentCount.toString()],
                ['Teachers', this.teacherCount.toString()],
                ['Average score', this.averageScoreLabel]
            ]);

            const previewRows = this.filteredResults.map((result) => [
                result.resultYear,
                result.studentClass,
                result.studentName,
                result.studentNumber,
                result.subjectName,
                result.teacherName,
                Number(result.score),
                result.grade,
                result.term,
                this.formatDate(result.createdAt)
            ]);

            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Year', 'Class', 'Student', 'Number', 'Subject', 'Teacher', 'Score', 'Grade', 'Term', 'Date'], ...previewRows]), 'Results');
            XLSX.writeFile(workbook, this.fileNameForExcel());
            this.messages.add({ severity: 'success', summary: 'Excel ready', detail: 'The filtered spreadsheet was exported successfully.' });
        } catch {
            this.messages.add({ severity: 'error', summary: 'Excel failed', detail: 'The Excel report could not be exported.' });
        }
    }

    private syncFilters(): void {
        this.selectedYear = keepNullableSelection(this.selectedYear, this.yearOptions, null);
        this.selectedClass = keepSelection(this.selectedClass, this.classOptions, '');
        this.selectedStudentId = keepNullableSelection(this.selectedStudentId, this.studentOptions, null);
        this.selectedTeacherId = keepNullableSelection(this.selectedTeacherId, this.teacherOptions, null);
    }

    private groupedResultsBySchoolAndClass(): { schoolName: string; classes: { className: string; rows: ResultResponse[] }[] }[] {
        const schoolGroups = new Map<string, Map<string, ResultResponse[]>>();

        for (const result of this.filteredResults) {
            const schoolName = this.schoolNameForResult(result);
            const className = result.studentClass || 'Unassigned';
            if (!schoolGroups.has(schoolName)) {
                schoolGroups.set(schoolName, new Map<string, ResultResponse[]>());
            }

            const classes = schoolGroups.get(schoolName)!;
            if (!classes.has(className)) {
                classes.set(className, []);
            }

            classes.get(className)!.push(result);
        }

        return Array.from(schoolGroups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([schoolName, classes]) => ({
                schoolName,
                classes: Array.from(classes.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([className, rows]) => ({
                        className,
                        rows: rows
                            .slice()
                            .sort((left, right) =>
                                left.studentName.localeCompare(right.studentName) ||
                                left.subjectName.localeCompare(right.subjectName) ||
                                left.createdAt.localeCompare(right.createdAt))
                    }))
            }));
    }

    private uniqueStudents(results: ResultResponse[]): { label: string; value: number }[] {
        const map = new Map<number, string>();
        for (const result of results) {
            if (!map.has(result.studentId)) {
                map.set(result.studentId, `${result.studentName} (${result.studentNumber})`);
            }
        }

        return Array.from(map.entries()).map(([value, label]) => ({ label, value }));
    }

    private schoolNameForResult(result: ResultResponse): string {
        return this.schools.find((school) => school.id === result.schoolId)?.name ?? `School ${result.schoolId}`;
    }

    private guardianReportForStudent(student: StudentResponse, studentResults: ResultResponse[]): ParentPreviewReportResponse {
        const firstResult = studentResults[0];
        if (!firstResult) {
            throw new Error('No student results');
        }

        return {
            studentId: firstResult.studentId,
            studentName: firstResult.studentName,
            studentNumber: firstResult.studentNumber,
            class: student.class,
            level: student.level || (getClassLevel(firstResult.studentClass) ?? 'General'),
            enrollmentYear: student.enrollmentYear,
            schoolName: this.schoolNameForResult(firstResult),
            overallAverageMark: studentResults.length === 0 ? 0 : studentResults.reduce((sum, result) => sum + result.score, 0) / studentResults.length,
            subjects: studentResults
                .slice()
                .sort((left, right) => left.subjectName.localeCompare(right.subjectName))
                .map((result) => ({
                    subjectId: result.subjectId,
                    subjectName: result.subjectName,
                    averageMark: result.score,
                    actualMark: result.score,
                    grade: result.grade,
                    teacherName: result.teacherName,
                    teacherComment: result.comment,
                    term: result.term,
                    createdAt: result.createdAt
                }))
            } as ParentPreviewReportResponse;
    }

    private uniqueTeachers(results: ResultResponse[]): { label: string; value: number }[] {
        const map = new Map<number, string>();
        for (const result of results) {
            if (!map.has(result.teacherId)) {
                map.set(result.teacherId, result.teacherName);
            }
        }

        return Array.from(map.entries()).map(([value, label]) => ({ label, value }));
    }

    private selectedFilterSummary(): string {
        return [
            `Year: ${this.selectedYear ?? 'All'}`,
            `Class: ${this.selectedClass || 'All'}`,
            `Student: ${this.selectedStudentLabel}`,
            `Teacher: ${this.selectedTeacherLabel}`
        ].join(' | ');
    }

    private get schoolInfo(): ReportSchoolInfo {
        const id = this.auth.schoolId();
        const school = this.schools.find(s => s.id === id) ?? this.schools[0];
        return { name: school?.name ?? (id ? `School ${id}` : 'All schools'), address: school?.address ?? null };
    }

    private fileNameForReport(): string {
        const year = this.selectedYear ? `-${this.selectedYear}` : '';
        const cls = this.selectedClass ? `-${this.selectedClass.replace(/\s+/g, '-').toLowerCase()}` : '';
        return `results-report${year}${cls}.pdf`;
    }

    private fileNameForExcel(): string {
        const year = this.selectedYear ? `-${this.selectedYear}` : '';
        const cls = this.selectedClass ? `-${this.selectedClass.replace(/\s+/g, '-').toLowerCase()}` : '';
        return `results-report${year}${cls}.xlsx`;
    }

    onNewsletterFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        this.accountsNewsletterFile = input?.files?.[0] ?? null;
    }

    private formatDate(value: string | Date): string {
        return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
    }
}
