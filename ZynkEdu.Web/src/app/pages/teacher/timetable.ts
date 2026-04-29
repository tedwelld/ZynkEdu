import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { AcademicTermResponse, TimetableResponse } from '../../core/api/api.models';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface TimetableReportRow {
    label: string;
    cells: string[];
    isBreak: boolean;
}

interface QuickActionItem {
    label: string;
    icon: string;
    route: string;
    severity: 'secondary' | 'help' | 'info';
}

@Component({
    standalone: true,
    selector: 'app-teacher-timetable',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, SkeletonModule, TagModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teacher profile</p>
                    <h1 class="text-3xl font-display font-bold m-0">Approved timetable</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">This page shows the full timetable approved by the school admin for the selected term, and it remains visible until the term ends.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Dashboard" icon="pi pi-home" severity="secondary" routerLink="/teacher/dashboard"></button>
                    <button pButton type="button" label="My subjects" icon="pi pi-book" severity="secondary" routerLink="/teacher/subjects"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                    <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="help" routerLink="/teacher/profile"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Lessons" [value]="lessonCount.toString()" delta="Approved slots" hint="This term" icon="pi pi-calendar" tone="blue"></app-metric-card>
                <app-metric-card label="Classes" [value]="classCount.toString()" delta="Assigned load" hint="Across the week" icon="pi pi-users" tone="purple"></app-metric-card>
                <app-metric-card label="Subjects" [value]="subjectCount.toString()" delta="Teaching subjects" hint="Approved timetable" icon="pi pi-book" tone="green"></app-metric-card>
                <app-metric-card label="Days" [value]="displayedDays.length.toString()" delta="Visible days" hint="School week" icon="pi pi-sitemap" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Quick actions</h2>
                        <p class="text-sm text-muted-color">Open the profile pages that support your approved timetable.</p>
                    </div>
                    <button pButton type="button" severity="secondary" class="p-button-text" routerLink="/teacher/notifications">
                        <span class="inline-flex items-center gap-2">
                            <i class="pi pi-bell"></i>
                            <span>Notifications</span>
                        </span>
                    </button>
                </div>

                <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <button
                        *ngFor="let action of quickActions"
                        pButton
                        type="button"
                        [label]="action.label"
                        [icon]="action.icon"
                        [severity]="action.severity"
                        style="width: 100%; justify-content: flex-start;"
                        [routerLink]="action.route"
                    ></button>
                </div>
            </article>

            <article class="workspace-card w-full">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">My timetable</h2>
                        <p class="text-sm text-muted-color">Only the classes, subjects, and time slots approved for you are shown here.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (ngModelChange)="onTermChange($event)"></app-dropdown>
                        <app-dropdown [options]="dayFilterOptions" [(ngModel)]="selectedDayFilter" optionLabel="label" optionValue="value" class="w-40" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search days" (ngModelChange)="onDayChange($event)"></app-dropdown>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="reportRows.length === 0" (click)="exportTimetablePdf()"></button>
                    </div>
                </div>

                <div *ngIf="loading" class="mt-4 space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && reportRows.length === 0" class="mt-4 rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No approved timetable entries are available for the current term.
                </div>

                <div *ngIf="!loading && reportRows.length > 0" class="mt-4 overflow-x-auto">
                    <table class="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                <th class="sticky left-0 z-10 bg-surface-0 dark:bg-surface-950 px-4 py-3 whitespace-nowrap">Time</th>
                                <th *ngFor="let day of displayedDays" class="px-4 py-3 whitespace-nowrap">{{ day }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of reportRows; let rowIndex = index" class="border-t border-surface-200 dark:border-surface-800" [ngClass]="row.isBreak ? 'bg-surface-200/60 dark:bg-surface-800/50' : (rowIndex % 2 === 0 ? 'bg-surface-0 dark:bg-surface-950' : 'bg-surface-50 dark:bg-surface-900/40')">
                                <td class="sticky left-0 z-10 bg-inherit px-4 py-4 align-top font-semibold whitespace-nowrap">
                                    {{ row.label }}
                                </td>
                                <td *ngFor="let cell of row.cells" class="px-4 py-4 align-top">
                                    <div class="min-h-20 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm leading-6 whitespace-pre-line" [ngClass]="cell ? 'bg-surface-0/90 dark:bg-surface-950/80' : 'border-dashed text-center text-muted-color flex items-center justify-center'">
                                        {{ cell || 'Empty' }}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>
        </section>
    `
})
export class TeacherTimetable implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    timetable: TimetableResponse[] = [];
    terms: AcademicTermResponse[] = [];
    termOptions: { label: string; value: number }[] = [];
    selectedTermId: number | null = null;
    selectedDayFilter = 'All';
    skeletonRows = Array.from({ length: 4 });
    readonly quickActions: QuickActionItem[] = [
        { label: 'Attendance', icon: 'pi pi-check-square', route: '/teacher/attendance', severity: 'secondary' },
        { label: 'Results', icon: 'pi pi-table', route: '/teacher/results', severity: 'secondary' },
        { label: 'My classes', icon: 'pi pi-users', route: '/teacher/classes', severity: 'secondary' },
        { label: 'My subjects', icon: 'pi pi-book', route: '/teacher/subjects', severity: 'help' }
    ];

    ngOnInit(): void {
        this.loadData();
    }

    get lessonCount(): number {
        return this.timetable.length;
    }

    get classCount(): number {
        return new Set(this.timetable.map((slot) => slot.class)).size;
    }

    get subjectCount(): number {
        return new Set(this.timetable.map((slot) => slot.subjectName)).size;
    }

    get displayedDays(): string[] {
        return this.selectedDayFilter === 'All' ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] : [this.selectedDayFilter];
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
        ].map(([startTime, endTime]) => ({ label: `${startTime} - ${endTime}`, startTime, endTime }));
    }

    get dayFilterOptions(): { label: string; value: string }[] {
        return [
            { label: 'All days', value: 'All' },
            { label: 'Monday', value: 'Monday' },
            { label: 'Tuesday', value: 'Tuesday' },
            { label: 'Wednesday', value: 'Wednesday' },
            { label: 'Thursday', value: 'Thursday' },
            { label: 'Friday', value: 'Friday' }
        ];
    }

    get reportRows(): TimetableReportRow[] {
        if (this.timetable.length === 0) {
            return [];
        }

        const slotLookup = new Map<string, TimetableResponse[]>();
        for (const slot of this.timetable) {
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
                cells: this.displayedDays.map((day) => this.reportCellValue(slotLookup.get(this.slotKey(day, session.startTime, session.endTime)) ?? [])),
                isBreak: false
            });

            if (index === 4) {
                rows.push({
                    label: '10:15 - 10:50 Tea Break',
                    cells: this.displayedDays.map(() => 'Tea Break'),
                    isBreak: true
                });
            }
        }

        rows.push({
            label: '13:10 - 14:20 Lunch Break',
            cells: this.displayedDays.map(() => 'Lunch Break'),
            isBreak: true
        });

        return rows;
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            terms: this.api.getAcademicTerms()
        }).subscribe({
            next: ({ terms }) => {
                this.terms = terms;
                this.termOptions = terms.map((term) => ({ label: term.name, value: term.id }));
                this.selectedTermId = this.selectedTermId ?? this.termOptions[0]?.value ?? null;
                const selectedTerm = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'Term 1';
                this.api.getTeacherTimetable(selectedTerm).subscribe({
                    next: (timetable) => {
                        this.timetable = timetable;
                        this.loading = false;
                    },
                    error: () => {
                        this.timetable = [];
                        this.loading = false;
                    }
                });
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    onTermChange(termId: number | null): void {
        this.selectedTermId = termId;
        this.loadData();
    }

    onDayChange(day: string): void {
        this.selectedDayFilter = day;
    }

    exportTimetablePdf(): void {
        const termLabel = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'All terms';
        const dayLabel = this.selectedDayFilter;
        const displayedDays = this.displayedDays;
        const reportRows = this.reportRows;
        const fileName = `teacher-timetable-${termLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'timetable'}-${dayLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'all-days'}.pdf`;
        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Approved timetable', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Teacher: ${this.auth.displayName()}`, margin, 60);
        doc.text(`Term: ${termLabel}`, margin, 74);
        doc.text(`Days: ${displayedDays.join(', ')}`, margin, 88);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 102);

        autoTable(doc, {
            startY: 118,
            head: [['Time', ...displayedDays]],
            body: reportRows.map((row) => [row.label, ...row.cells]),
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 3,
                minCellHeight: 24,
                valign: 'middle',
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [37, 99, 235]
            },
            columnStyles: {
                0: { cellWidth: 90 }
            },
            margin: {
                left: margin,
                right: margin
            }
        });

        doc.save(fileName);
    }

    private reportCellValue(slots: TimetableResponse[]): string {
        if (slots.length === 0) {
            return '';
        }

        return slots
            .map((slot) => `${slot.class}\n${slot.subjectName}\n${slot.gradeLevel}`)
            .join('\n\n');
    }

    private slotKey(day: string, startTime: string, endTime: string): string {
        return `${day.toLowerCase()}|${startTime}|${endTime}`;
    }
}
