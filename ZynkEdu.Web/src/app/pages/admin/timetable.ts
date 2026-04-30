import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AcademicTermResponse, SchoolResponse, TimetableResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { SCHOOL_LEVEL_OPTIONS, SchoolLevel, normalizeSchoolLevel } from '../../core/school-levels';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface TimetableCell {
    slots: TimetableResponse[];
}

interface TimetableRow {
    day: string;
    cells: TimetableCell[];
    filledCount: number;
}

interface MissingCoverageEntry {
    className: string;
    subjectName: string;
}

interface TimetableReportRow {
    label: string;
    cells: string[];
    isBreak: boolean;
}

@Component({
    standalone: true,
    selector: 'app-admin-timetable',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, SkeletonModule, TableModule, TagModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Timetable</p>
                    <h1 class="text-3xl font-display font-bold m-0">Auto-generated timetable</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">
                        Use the class, year, level, and term filters to focus on one timetable at a time. The grid expands to the full width of the page so the selected timetable is easy to read. Each lesson runs in a 35-minute slot with a 5-minute break between periods.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="loadData()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (opened)="loadData()" (ngModelChange)="onTermChange($event)"></app-dropdown>
                    <button pButton type="button" label="Generate" icon="pi pi-sparkles" severity="help" (click)="generateTimetable()"></button>
                    <button pButton type="button" label="Approve" icon="pi pi-check" severity="secondary" (click)="publishTimetable()"></button>
                    <button pButton type="button" label="View timetable" icon="pi pi-eye" severity="secondary" [disabled]="displayedTimetable.length === 0" (click)="openTimetablePreview()"></button>
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="displayedTimetable.length === 0" (click)="exportTimetablePdf()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Slots" [value]="displayedTimetable.length.toString()" delta="Filtered view" hint="Current timetable selection" icon="pi pi-calendar" tone="blue"></app-metric-card>
                <app-metric-card label="Teachers" [value]="displayedTeacherCount.toString()" delta="Roster" hint="Teachers in the selected view" icon="pi pi-id-card" tone="green"></app-metric-card>
                <app-metric-card label="Subjects" [value]="displayedSubjectCount.toString()" delta="Coverage" hint="Subjects in the selected view" icon="pi pi-book" tone="purple"></app-metric-card>
                <app-metric-card label="Classes" [value]="displayedClassCount.toString()" delta="Registry" hint="Classes in the selected view" icon="pi pi-sitemap" tone="orange"></app-metric-card>
            </section>

            <div *ngIf="missingCoverage.length > 0" class="workspace-card border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p class="text-sm uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300 font-semibold">Missing coverage</p>
                        <h2 class="text-xl font-display font-bold mb-2">Assign teachers to the selected class subjects</h2>
                        <p class="text-sm text-muted-color max-w-3xl">
                            The timetable cannot be generated until each listed class-subject pair has a teacher. Open assignments to prefill the exact gaps.
                        </p>
                    </div>
                    <button pButton type="button" label="Open assignments" icon="pi pi-arrow-right" severity="secondary" (click)="openAssignmentsForMissingCoverage()"></button>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                    <p-tag *ngFor="let item of missingCoverage" [value]="coverageLabelFor(item)" severity="warning"></p-tag>
                </div>
            </div>

            <article class="workspace-card w-full">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Filtered timetable</h2>
                        <p class="text-sm text-muted-color">
                            Choose the class, year, level, and term you want to inspect. Selecting All values displays the combined timetable for ZGC, O'Level, and A'Level.
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <app-dropdown [options]="classFilterOptions" [(ngModel)]="selectedClassFilter" optionLabel="label" optionValue="value" class="w-52" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes" (ngModelChange)="onClassFilterChange($event)"></app-dropdown>
                        <app-dropdown [options]="yearFilterOptions" [(ngModel)]="selectedYearFilter" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search years" (ngModelChange)="onYearFilterChange($event)"></app-dropdown>
                        <app-dropdown [options]="levelFilterOptions" [(ngModel)]="selectedLevelFilter" optionLabel="label" optionValue="value" class="w-52" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels" (ngModelChange)="onLevelFilterChange($event)"></app-dropdown>
                        <p-tag [value]="selectedLevelLabel" severity="secondary"></p-tag>
                    </div>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading" class="overflow-x-auto">
                    <table class="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                <th class="sticky left-0 z-10 bg-surface-0 dark:bg-surface-950 px-4 py-3">Day</th>
                                <th *ngFor="let session of sessionRows" class="px-4 py-3 whitespace-nowrap">{{ session.label }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of filteredDayRows" class="border-t border-surface-200 dark:border-surface-800">
                                <td class="sticky left-0 z-10 bg-surface-0 dark:bg-surface-950 px-4 py-4 align-top">
                                    <div class="font-semibold">{{ row.day }}</div>
                                    <div class="text-xs text-muted-color">{{ row.filledCount }}/{{ sessionRows.length }} filled</div>
                                </td>
                                <td *ngFor="let cell of row.cells" class="px-4 py-4 align-top">
                                    <ng-container *ngIf="cell.slots.length > 0; else emptyCell">
                                        <div class="space-y-2 min-w-52">
                                            <div *ngFor="let slot of cell.slots" class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0/90 dark:bg-surface-900/40 p-3">
                                                <div class="font-semibold leading-tight">{{ slot.class }}</div>
                                                <div class="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">{{ slot.startTime }} - {{ slot.endTime }}</div>
                                                <div class="mt-1 text-xs text-muted-color">{{ slot.subjectName }}</div>
                                                <div class="mt-2 flex flex-wrap gap-1">
                                                    <p-tag [value]="slot.teacherName" severity="secondary"></p-tag>
                                                    <p-tag [value]="slot.gradeLevel" [severity]="severityForLevel(slot.gradeLevel)"></p-tag>
                                                </div>
                                            </div>
                                        </div>
                                    </ng-container>
                                    <ng-template #emptyCell>
                                        <div class="min-w-52 rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 px-3 py-4 text-center text-sm text-muted-color">
                                            Empty
                                        </div>
                                    </ng-template>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>

            <p-dialog [(visible)]="previewVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(96rem, 98vw)' }" appendTo="body" header="Timetable preview">
                <div class="space-y-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Preview</div>
                            <div class="text-xl font-display font-bold">{{ previewTitle }}</div>
                            <div class="text-sm text-muted-color">{{ previewSubtitle }}</div>
                        </div>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="displayedTimetable.length === 0" (click)="exportTimetablePdf()"></button>
                    </div>

                    <div *ngIf="previewRows.length === 0" class="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-center text-muted-color">
                        No timetable entries are available for the current selection.
                    </div>

                    <div *ngIf="previewRows.length > 0" class="overflow-x-auto">
                        <table class="min-w-full border-separate border-spacing-0">
                            <thead>
                                <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                    <th class="sticky left-0 z-10 bg-surface-0 dark:bg-surface-950 px-4 py-3 whitespace-nowrap">Time</th>
                                    <th *ngFor="let day of previewDayNames" class="px-4 py-3 whitespace-nowrap">{{ day }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let row of previewRows; let rowIndex = index" class="border-t border-surface-200 dark:border-surface-800" [ngClass]="row.isBreak ? 'bg-surface-200/60 dark:bg-surface-800/50' : (rowIndex % 2 === 0 ? 'bg-surface-0 dark:bg-surface-950' : 'bg-surface-50 dark:bg-surface-900/40')">
                                    <td class="sticky left-0 z-10 bg-inherit px-4 py-4 align-top font-semibold whitespace-nowrap">
                                        {{ row.label }}
                                    </td>
                                    <td *ngFor="let cell of row.cells; let cellIndex = index" class="px-4 py-4 align-top">
                                        <div class="min-h-20 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm leading-6 whitespace-pre-line" [ngClass]="row.isBreak ? 'border-dashed text-center text-muted-color flex items-center justify-center' : 'bg-surface-0/90 dark:bg-surface-950/80'">
                                            {{ cell || 'Empty' }}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminTimetable implements OnInit {
    private static readonly pdfRowPalette: [number, number, number][] = [
        [248, 250, 252],
        [240, 249, 255],
        [240, 253, 244],
        [255, 251, 235],
        [250, 245, 255]
    ];
    private static readonly pdfBreakFill: [number, number, number] = [229, 231, 235];
    private static readonly pdfBreakText: [number, number, number] = [75, 85, 99];

    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly messages = inject(MessageService);

    loading = true;
    schools: SchoolResponse[] = [];
    terms: AcademicTermResponse[] = [];
    timetable: TimetableResponse[] = [];
    missingCoverage: MissingCoverageEntry[] = [];
    previewVisible = false;
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = null;
    selectedTermId: number | null = null;
    selectedClassFilter = 'All';
    selectedYearFilter = 'All';
    selectedLevelFilter: SchoolLevel = 'General';
    readonly previewDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get levelFilterOptions(): { label: string; value: SchoolLevel }[] {
        return SCHOOL_LEVEL_OPTIONS;
    }

    get classFilterOptions(): { label: string; value: string }[] {
        const classes = Array.from(new Set(this.visibleTimetable.map((slot) => slot.class))).sort((left, right) => left.localeCompare(right));
        return [{ label: 'All classes', value: 'All' }, ...classes.map((value) => ({ label: value, value }))];
    }

    get yearFilterOptions(): { label: string; value: string }[] {
        const years = Array.from(new Set(this.visibleTimetable.map((slot) => this.yearForSlot(slot)))).sort((left, right) => {
            if (left === 'Other') {
                return 1;
            }

            if (right === 'Other') {
                return -1;
            }

            return Number.parseInt(left.replace(/\D+/g, ''), 10) - Number.parseInt(right.replace(/\D+/g, ''), 10);
        });

        return [{ label: 'All years', value: 'All' }, ...years.map((value) => ({ label: value, value }))];
    }

    get selectedLevelLabel(): string {
        return this.selectedLevelFilter === 'General' ? 'All levels' : this.selectedLevelFilter;
    }

    get selectedClassLabel(): string {
        return this.selectedClassFilter === 'All' ? 'All classes' : this.selectedClassFilter;
    }

    get selectedYearLabel(): string {
        return this.selectedYearFilter === 'All' ? 'All years' : this.selectedYearFilter;
    }

    get dayOptions(): { label: string; value: string }[] {
        return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({ label: day, value: day }));
    }

    get sessionRows(): { label: string; startTime: string; endTime: string }[] {
        return [
            ['07:20', '07:55'],
            ['07:55', '08:30'],
            ['08:30', '09:05'],
            ['09:05', '09:40'],
            ['09:40', '10:15'],
            ['10:50', '11:25'],
            ['11:25', '12:00'],
            ['12:00', '12:35'],
            ['12:35', '13:10']
        ].map(([startTime, endTime]) => ({
            label: `${startTime} - ${endTime}`,
            startTime,
            endTime
        }));
    }

    get termOptions(): { label: string; value: number }[] {
        return this.terms.map((term) => ({ label: term.name, value: term.id }));
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return [
            { label: 'Select school', value: null },
            ...this.schools.map((school) => ({ label: school.name, value: school.id }))
        ];
    }

    get selectedTermName(): string | null {
        return this.terms.find((term) => term.id === this.selectedTermId)?.name ?? null;
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    get previewTitle(): string {
        return `${this.selectedLevelLabel} timetable`;
    }

    get previewSubtitle(): string {
        const schoolLabel = this.selectedSchoolId ? this.schoolNameFor(this.selectedSchoolId) : 'All schools';
        const termLabel = this.selectedTermName ?? 'No term selected';
        return `${schoolLabel} · ${termLabel} · ${this.selectedClassLabel} · ${this.selectedYearLabel}`;
    }

    get visibleTimetable(): TimetableResponse[] {
        return this.timetable.filter((slot) => {
            const matchesSchool = !this.isPlatformAdmin || !this.selectedSchoolId || slot.schoolId === this.selectedSchoolId;
            const matchesTerm = !this.selectedTermName || slot.term === this.selectedTermName;
            return matchesSchool && matchesTerm;
        });
    }

    get displayedTimetable(): TimetableResponse[] {
        const timetable = this.visibleTimetable;
        return timetable.filter((slot) => {
            const matchesLevel = this.selectedLevelFilter === 'General' || this.levelForSlot(slot) === this.selectedLevelFilter;
            const matchesClass = this.selectedClassFilter === 'All' || slot.class === this.selectedClassFilter;
            const matchesYear = this.selectedYearFilter === 'All' || this.yearForSlot(slot) === this.selectedYearFilter;
            return matchesLevel && matchesClass && matchesYear;
        });
    }

    get previewRows(): TimetableReportRow[] {
        return this.buildPdfReportRows();
    }

    get filteredDayRows(): TimetableRow[] {
        const slotLookup = new Map<string, TimetableResponse[]>();
        for (const slot of this.displayedTimetable) {
            const key = this.slotKey(slot.dayOfWeek, slot.startTime, slot.endTime);
            const entries = slotLookup.get(key) ?? [];
            entries.push(slot);
            slotLookup.set(key, entries);
        }

        return this.dayOptions.map((day) => {
            const cells = this.sessionRows.map((session) => ({
                slots: slotLookup.get(this.slotKey(day.value, session.startTime, session.endTime)) ?? []
            }));

            return {
                day: day.value,
                cells,
                filledCount: cells.filter((cell) => cell.slots.length > 0).length
            };
        });
    }

    get displayedTeacherCount(): number {
        return new Set(this.displayedTimetable.map((slot) => slot.teacherId)).size;
    }

    get displayedSubjectCount(): number {
        return new Set(this.displayedTimetable.map((slot) => slot.subjectId)).size;
    }

    get displayedClassCount(): number {
        return new Set(this.displayedTimetable.map((slot) => slot.class)).size;
    }

    ngOnInit(): void {
        this.applySchoolScopeFromQuery();
        this.loadData();
    }

    loadData(): void {
        this.loading = true;

        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.api.getSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    this.selectedSchoolId = schools[0]?.id ?? null;

                    if (!this.selectedSchoolId) {
                        this.loading = false;
                        return;
                    }

                    this.loadData();
                },
                error: () => {
                    this.loading = false;
                }
            });
            return;
        }

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        forkJoin({
            terms: this.api.getAcademicTerms(schoolId),
            timetable: this.api.getTimetables(schoolId, this.selectedTermName ?? undefined),
            schools: this.api.getSchools()
        }).subscribe({
            next: ({ terms, timetable, schools }) => {
                this.terms = terms;
                this.timetable = timetable;
                this.schools = this.isPlatformAdmin ? schools : schools.filter((school) => school.id === this.auth.schoolId());
                this.selectedSchoolId = this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId();
                this.selectedTermId = this.terms.some((term) => term.id === this.selectedTermId) ? this.selectedTermId : this.terms[0]?.id ?? null;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    onTermChange(termId: number | null): void {
        this.selectedTermId = termId;
        this.loadData();
    }

    onLevelFilterChange(level: SchoolLevel): void {
        this.selectedLevelFilter = normalizeSchoolLevel(level);
    }

    onClassFilterChange(className: string): void {
        this.selectedClassFilter = className;
    }

    onYearFilterChange(year: string): void {
        this.selectedYearFilter = year;
    }

    openTimetablePreview(): void {
        this.previewVisible = true;
    }

    exportTimetablePdf(): void {
        const { doc, fileName } = this.createTimetablePdf();
        doc.save(fileName);
    }

    private createTimetablePdf(): { doc: jsPDF; fileName: string } {
        const schoolLabel = this.selectedSchoolId ? this.schoolNameFor(this.selectedSchoolId) : 'All schools';
        const termLabel = this.selectedTermName ?? 'All terms';
        const levelLabel = this.selectedLevelLabel;
        const classLabel = this.selectedClassLabel;
        const yearLabel = this.selectedYearLabel;
        const fileName = `timetable-${this.slugify(`${schoolLabel}-${termLabel}-${levelLabel}-${classLabel}-${yearLabel}`)}.pdf`;
        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Timetable', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`School: ${schoolLabel}`, margin, 60);
        doc.text(`Term: ${termLabel}`, margin, 74);
        doc.text(`Level: ${levelLabel}`, margin, 88);
        doc.text(`Class: ${classLabel}`, margin, 102);
        doc.text(`Year: ${yearLabel}`, margin, 116);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 130);

        const reportRows = this.buildPdfReportRows();
        const usableWidth = doc.internal.pageSize.getWidth() - (margin * 2);
        const timeColumnWidth = 104;
        const dayColumnWidth = (usableWidth - timeColumnWidth) / 5;

        if (reportRows.length === 0) {
            doc.text('No timetable entries are available for export.', margin, 154);
            return { doc, fileName };
        }

        autoTable(doc, {
            startY: 146,
            head: [['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']],
            body: reportRows.map((row) => [row.label, ...row.cells]),
            theme: 'grid',
            styles: {
                fontSize: 6.5,
                cellPadding: 3,
                minCellHeight: 40,
                valign: 'middle',
                overflow: 'linebreak',
                halign: 'center'
            },
            headStyles: {
                fillColor: [37, 99, 235]
            },
            columnStyles: {
                0: { cellWidth: timeColumnWidth },
                1: { cellWidth: dayColumnWidth },
                2: { cellWidth: dayColumnWidth },
                3: { cellWidth: dayColumnWidth },
                4: { cellWidth: dayColumnWidth },
                5: { cellWidth: dayColumnWidth }
            },
            didParseCell: (data) => {
                if (data.section !== 'body') {
                    return;
                }

                const reportRow = reportRows[data.row.index];
                if (!reportRow) {
                    return;
                }

                const fillColor = reportRow.isBreak
                    ? AdminTimetable.pdfBreakFill
                    : AdminTimetable.pdfRowPalette[data.row.index % AdminTimetable.pdfRowPalette.length];

                data.cell.styles.fillColor = fillColor;
                data.cell.styles.textColor = reportRow.isBreak ? AdminTimetable.pdfBreakText : [15, 23, 42];

                if (data.column.index === 0) {
                    data.cell.styles.fontStyle = 'bold';
                } else if (reportRow.isBreak) {
                    data.cell.styles.fontStyle = 'italic';
                    data.cell.styles.halign = 'center';
                }
            },
            margin: {
                left: margin,
                right: margin
            }
        });
        return { doc, fileName };
    }

    generateTimetable(): void {
        const term = this.selectedTermName;
        if (!term) {
            this.messages.add({ severity: 'warn', summary: 'Missing term', detail: 'Choose a term before generating the timetable.' });
            return;
        }

        this.api.generateTimetable(term, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Timetable generated', detail: `${term} has been rebuilt.` });
                this.missingCoverage = [];
                this.loadData();
            },
            error: (error) => {
                const detail = this.readErrorMessage(error, 'The timetable could not be generated.');
                const missingCoverage = this.parseMissingCoverage(detail);
                if (missingCoverage.length > 0) {
                    this.missingCoverage = missingCoverage;
                    this.messages.add({
                        severity: 'warn',
                        summary: 'Teacher coverage missing',
                        detail: 'Open assignments to prefill the missing class-subject pairs.'
                    });
                    return;
                }

                this.messages.add({ severity: 'error', summary: 'Generate failed', detail });
            }
        });
    }

    publishTimetable(): void {
        const term = this.selectedTermName;
        if (!term) {
            this.messages.add({ severity: 'warn', summary: 'Missing term', detail: 'Choose a term before publishing the timetable.' });
            return;
        }

        this.api.publishTimetable({ term }, this.selectedSchoolId ?? undefined).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Timetable approved', detail: `${term} is now the active timetable for dispatch.` });
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Approval failed', detail: this.readErrorMessage(error, 'The timetable could not be approved.') });
            }
        });
    }

    severityForLevel(level: string): 'success' | 'warning' | 'info' | 'secondary' {
        const normalized = normalizeSchoolLevel(level);
        if (normalized === 'ZGC Level') {
            return 'success';
        }

        if (normalized === "O'Level") {
            return 'warning';
        }

        if (normalized === "A'Level") {
            return 'info';
        }

        return 'secondary';
    }

    private levelForSlot(slot: TimetableResponse): SchoolLevel {
        return normalizeSchoolLevel(slot.gradeLevel || 'General');
    }

    private yearForSlot(slot: TimetableResponse): string {
        const match = slot.class.match(/\b(\d{1,2})\b/);
        return match ? `Year ${match[1]}` : 'Other';
    }

    private slotKey(dayOfWeek: string, startTime: string, endTime: string): string {
        return `${dayOfWeek}|${startTime}|${endTime}`;
    }

    private exportCellValue(cell: TimetableCell): string {
        if (cell.slots.length === 0) {
            return 'Empty';
        }

        return cell.slots.map((slot) => `${slot.startTime} - ${slot.endTime}\n${slot.class}\n${slot.subjectName}\n${slot.teacherName}`).join('\n\n');
    }

    private buildPdfReportRows(): TimetableReportRow[] {
        const timetable = this.displayedTimetable;
        if (timetable.length === 0) {
            return [];
        }

        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const slotLookup = new Map<string, TimetableResponse[]>();
        for (const slot of timetable) {
            const key = this.slotKey(slot.dayOfWeek, slot.startTime, slot.endTime);
            const entries = slotLookup.get(key) ?? [];
            entries.push(slot);
            slotLookup.set(key, entries);
        }

        const rows: TimetableReportRow[] = [];
        for (let index = 0; index < this.sessionRows.length; index++) {
            const session = this.sessionRows[index];
            rows.push({
                label: `${session.startTime} - ${session.endTime}`,
                cells: dayNames.map((day) => this.exportPdfCellValue(slotLookup.get(this.slotKey(day, session.startTime, session.endTime)) ?? [])),
                isBreak: false
            });

            if (index === 4) {
                rows.push({
                    label: '10:15 - 10:50 Tea Break',
                    cells: ['Tea Break', 'Tea Break', 'Tea Break', 'Tea Break', 'Tea Break'],
                    isBreak: true
                });
            }
        }

        rows.push({
            label: '13:10 - 14:20 Lunch Break',
            cells: ['Lunch Break', 'Lunch Break', 'Lunch Break', 'Lunch Break', 'Lunch Break'],
            isBreak: true
        });

        return rows;
    }

    private exportPdfCellValue(slots: TimetableResponse[]): string {
        if (slots.length === 0) {
            return '';
        }

        return slots
            .map((slot) => `${slot.class} | ${slot.subjectName} | ${slot.teacherName}`)
            .join('\n\n');
    }

    coverageLabelFor(entry: MissingCoverageEntry): string {
        return `${entry.className} / ${entry.subjectName}`;
    }

    openAssignmentsForMissingCoverage(): void {
        const coverage = this.missingCoverage
            .map((entry) => `${encodeURIComponent(entry.className)}|${encodeURIComponent(entry.subjectName)}`)
            .join(';');

        this.router.navigate(['/admin/assignments'], {
            queryParams: this.selectedSchoolId ? { schoolId: this.selectedSchoolId, coverage } : { coverage }
        });
    }

    private applySchoolScopeFromQuery(): void {
        const schoolIdText = this.route.snapshot.queryParamMap.get('schoolId');
        const schoolId = schoolIdText ? Number(schoolIdText) : null;
        if (Number.isFinite(schoolId)) {
            this.selectedSchoolId = schoolId;
        }

        const termIdText = this.route.snapshot.queryParamMap.get('termId');
        const termId = termIdText ? Number(termIdText) : null;
        if (Number.isFinite(termId)) {
            this.selectedTermId = termId;
        }
    }

    private parseMissingCoverage(errorMessage: string): MissingCoverageEntry[] {
        const match = errorMessage.match(/Missing:\s*(.+?)(?:\.|$)/i);
        if (!match) {
            return [];
        }

        return match[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const pieces = part.split('/').map((segment) => segment.trim());
                if (pieces.length < 2 || !pieces[0] || !pieces[1]) {
                    return null;
                }

                return <MissingCoverageEntry>{ className: pieces[0], subjectName: pieces[1] };
            })
            .filter((entry): entry is MissingCoverageEntry => entry !== null);
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'timetable';
    }
}
