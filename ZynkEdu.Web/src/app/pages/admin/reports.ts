import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { ResultResponse, SchoolResponse, UserResponse } from '../../core/api/api.models';

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
    imports: [CommonModule, FormsModule, ButtonModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Reports</p>
                    <h1 class="text-3xl font-display font-bold m-0">Filter-first reports</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Generate exports by year, class, student name, and teacher name from the current live results data. Class-grouped PDFs and parent-specific slips keep the report flow safe and readable.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Generate PDF" icon="pi pi-file-pdf" (click)="generateReport()" [disabled]="loading || filteredResults.length === 0"></button>
                    <button pButton type="button" label="Send parent slip" icon="pi pi-send" severity="info" (click)="sendParentSlip()" [disabled]="loading || !canSendParentSlip"></button>
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
                    <button pButton type="button" label="Clear filters" severity="secondary" (click)="resetFilters()"></button>
                </div>
            </article>

            <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                        <p-table [value]="previewResults" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Year</th>
                                    <th>Class</th>
                                    <th>Student</th>
                                    <th>Subject</th>
                                    <th>Teacher</th>
                                    <th>Score</th>
                                    <th>Term</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-row>
                                <tr>
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
        const values = Array.from(new Set(this.baseResults.map((result) => result.studentClass).filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
        return [{ label: 'All classes', value: '' }, ...values.map((value) => ({ label: value, value }))];
    }

    get studentOptions(): { label: string; value: number | null }[] {
        const values = this.uniqueStudents(this.baseResults)
            .sort((a, b) => a.label.localeCompare(b.label));
        return [{ label: 'All students', value: null }, ...values];
    }

    get teacherOptions(): { label: string; value: number | null }[] {
        const values = this.uniqueTeachers(this.baseResults)
            .sort((a, b) => a.label.localeCompare(b.label));
        return [{ label: 'All teachers', value: null }, ...values];
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

    get canSendParentSlip(): boolean {
        return this.selectedStudentId != null && this.selectedStudentResults.length > 0;
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
    }

    generateReport(): void {
        if (this.filteredResults.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'No data', detail: 'There are no results to include in the PDF report.' });
            return;
        }

        try {
            const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
            const margin = 40;
            const pageWidth = doc.internal.pageSize.getWidth();
            const title = 'Results report';
            const description = 'Filtered by year, class, student name, and teacher name. Grouped by school and class for easy review.';
            const scope = this.selectedScopeLabel;
            const filters = this.selectedFilterSummary();

            doc.setTextColor(17, 24, 39);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text(title, margin, 46);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(75, 85, 99);
            doc.text(description, margin, 64, { maxWidth: pageWidth - margin * 2 });
            doc.text(`Scope: ${scope}`, margin, 82);
            doc.text(`Filters: ${filters}`, margin, 96);
            doc.text(`Generated: ${this.formatDate(new Date())}`, margin, 110);

            let currentY = 126;
            for (const schoolGroup of this.groupedResultsBySchoolAndClass()) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(17, 24, 39);
                doc.text(schoolGroup.schoolName, margin, currentY);
                currentY += 14;

                for (const classGroup of schoolGroup.classes) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(37, 99, 235);
                    doc.text(`${classGroup.className} (${classGroup.rows.length} row(s))`, margin, currentY);
                    currentY += 10;

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Year', 'Student', 'Subject', 'Teacher', 'Score', 'Grade', 'Term', 'Date']],
                        body: classGroup.rows.map((result) => [
                            result.resultYear.toString(),
                            `${result.studentName} (${result.studentNumber})`,
                            result.subjectName,
                            result.teacherName,
                            `${result.score.toFixed(1)}%`,
                            result.grade,
                            result.term,
                            this.formatDate(result.createdAt)
                        ]),
                        theme: 'striped',
                        styles: {
                            fontSize: 8,
                            cellPadding: 4
                        },
                        headStyles: {
                            fillColor: [37, 99, 235]
                        },
                        margin: {
                            left: margin,
                            right: margin
                        }
                    });

                    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : currentY + 110;
                    if (currentY > doc.internal.pageSize.getHeight() - 120) {
                        doc.addPage();
                        currentY = 40;
                    }
                }
            }

            doc.save(this.fileNameForReport());
            this.messages.add({ severity: 'success', summary: 'PDF ready', detail: 'The filtered report was generated successfully.' });
        } catch {
            this.messages.add({ severity: 'error', summary: 'PDF failed', detail: 'The PDF report could not be generated.' });
        }
    }

    sendParentSlip(): void {
        if (this.selectedStudentId == null || this.selectedStudentResults.length === 0) {
            this.messages.add({ severity: 'warn', summary: 'Select a student', detail: 'Choose a student before sending a parent slip.' });
            return;
        }

        try {
            const pdf = this.buildStudentSlipPdf(this.selectedStudentResults);
            const blob = pdf.output('blob');
            this.api.sendResultSlip(
                this.selectedStudentId,
                { sendEmail: true, sendSms: true },
                blob,
                this.selectedSchoolId
            ).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Slip sent', detail: 'The selected student slip was sent to the registered parent contact.' });
                },
                error: () => {
                    this.messages.add({ severity: 'error', summary: 'Send failed', detail: 'The parent slip could not be sent.' });
                }
            });
        } catch {
            this.messages.add({ severity: 'error', summary: 'Send failed', detail: 'The parent slip could not be prepared.' });
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
        this.selectedYear = this.yearOptions.some((option) => option.value === this.selectedYear) ? this.selectedYear : null;
        this.selectedClass = this.classOptions.some((option) => option.value === this.selectedClass) ? this.selectedClass : '';
        this.selectedStudentId = this.studentOptions.some((option) => option.value === this.selectedStudentId) ? this.selectedStudentId : null;
        this.selectedTeacherId = this.teacherOptions.some((option) => option.value === this.selectedTeacherId) ? this.selectedTeacherId : null;
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

    private buildStudentSlipPdf(results: ResultResponse[]): jsPDF {
        const student = results[0];
        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        const margin = 40;
        const schoolName = this.schoolNameForResult(student);
        const subjectRows = results
            .slice()
            .sort((left, right) => left.subjectName.localeCompare(right.subjectName));

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Parent result slip', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Student: ${student.studentName}`, margin, 60);
        doc.text(`Student number: ${student.studentNumber}`, margin, 74);
        doc.text(`School: ${schoolName}`, margin, 88);
        doc.text(`Class: ${student.studentClass} | Year: ${student.resultYear}`, margin, 102);
        const overallAverage = subjectRows.length === 0 ? 0 : subjectRows.reduce((sum, result) => sum + result.score, 0) / subjectRows.length;
        doc.text(`Overall average: ${overallAverage.toFixed(1)}%`, margin, 116);
        doc.text(`Generated: ${this.formatDate(new Date())}`, margin, 130);

        autoTable(doc, {
            startY: 148,
            head: [['Subject', 'Teacher', 'Score', 'Grade', 'Term', 'Comment', 'Date']],
            body: subjectRows.map((result) => [
                result.subjectName,
                result.teacherName,
                `${result.score.toFixed(1)}%`,
                result.grade,
                result.term,
                result.comment || 'No teacher comment yet.',
                this.formatDate(result.createdAt)
            ]),
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 5, valign: 'top' },
            headStyles: { fillColor: [37, 99, 235] },
            margin: { left: margin, right: margin }
        });

        return doc;
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

    private fileNameForReport(): string {
        return `results-report-${this.selectedYear ?? 'all'}-${this.selectedClass || 'all'}.pdf`;
    }

    private fileNameForExcel(): string {
        return `results-report-${this.selectedYear ?? 'all'}-${this.selectedClass || 'all'}.xlsx`;
    }

    private formatDate(value: string | Date): string {
        return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
    }
}
