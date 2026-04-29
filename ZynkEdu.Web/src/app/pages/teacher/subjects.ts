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
import { AcademicTermResponse, TeacherAssignmentResponse, TimetableResponse } from '../../core/api/api.models';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface TeacherSubjectRow {
    className: string;
    subjectName: string;
    gradeLevel: string;
    slotCount: number;
    timeSlots: string;
}

interface QuickActionItem {
    label: string;
    icon: string;
    route: string;
    severity: 'secondary' | 'help' | 'info';
}

@Component({
    standalone: true,
    selector: 'app-teacher-subjects',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, SkeletonModule, TagModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teacher profile</p>
                    <h1 class="text-3xl font-display font-bold m-0">My subjects</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">This page shows the subjects you teach together with the approved timetable slots for the selected term.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Dashboard" icon="pi pi-home" severity="secondary" routerLink="/teacher/dashboard"></button>
                    <button pButton type="button" label="My timetable" icon="pi pi-calendar" severity="secondary" routerLink="/teacher/timetable"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                    <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="help" routerLink="/teacher/profile"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Assignments" [value]="subjectRows.length.toString()" delta="Subject rows" hint="Approved load" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Classes" [value]="classCount.toString()" delta="Teaching classes" hint="Across terms" icon="pi pi-users" tone="purple"></app-metric-card>
                <app-metric-card label="Subjects" [value]="subjectCount.toString()" delta="Unique subjects" hint="Your load" icon="pi pi-tags" tone="green"></app-metric-card>
                <app-metric-card label="Slots" [value]="slotCount.toString()" delta="Scheduled lessons" hint="This term" icon="pi pi-clock" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Quick actions</h2>
                        <p class="text-sm text-muted-color">Jump between your teacher workspaces.</p>
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
                        <h2 class="text-xl font-display font-bold mb-1">Subject load</h2>
                        <p class="text-sm text-muted-color">The subjects below are grouped from your assigned timetable for the approved term.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (ngModelChange)="onTermChange($event)"></app-dropdown>
                        <app-dropdown [options]="classFilterOptions" [(ngModel)]="selectedClassFilter" optionLabel="label" optionValue="value" class="w-40" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes" (ngModelChange)="onFilterChange()"></app-dropdown>
                        <app-dropdown [options]="levelFilterOptions" [(ngModel)]="selectedLevelFilter" optionLabel="label" optionValue="value" class="w-40" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search levels" (ngModelChange)="onFilterChange()"></app-dropdown>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="displayedSubjectRows.length === 0" (click)="exportSubjectsPdf()"></button>
                    </div>
                </div>

                <div *ngIf="loading" class="mt-4 space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && displayedSubjectRows.length === 0" class="mt-4 rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No subjects are available for the selected filters and approved term.
                </div>

                <div *ngIf="!loading && displayedSubjectRows.length > 0" class="mt-4 overflow-x-auto">
                    <table class="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                <th class="px-4 py-3">Class</th>
                                <th class="px-4 py-3">Subject</th>
                                <th class="px-4 py-3 whitespace-nowrap">Level</th>
                                <th class="px-4 py-3 whitespace-nowrap">Slots</th>
                                <th class="px-4 py-3">Timetable</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of displayedSubjectRows; let index = index" class="border-t border-surface-200 dark:border-surface-800" [ngClass]="index % 2 === 0 ? 'bg-surface-0 dark:bg-surface-950' : 'bg-surface-50 dark:bg-surface-900/40'">
                                <td class="px-4 py-4 font-semibold">{{ row.className }}</td>
                                <td class="px-4 py-4">{{ row.subjectName }}</td>
                                <td class="px-4 py-4 whitespace-nowrap">
                                    <p-tag [value]="row.gradeLevel" severity="secondary"></p-tag>
                                </td>
                                <td class="px-4 py-4 whitespace-nowrap">{{ row.slotCount }}</td>
                                <td class="px-4 py-4 whitespace-pre-line leading-6 text-sm text-muted-color">{{ row.timeSlots }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>
        </section>
    `
})
export class TeacherSubjects implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    assignments: TeacherAssignmentResponse[] = [];
    timetable: TimetableResponse[] = [];
    terms: AcademicTermResponse[] = [];
    termOptions: { label: string; value: number }[] = [];
    selectedTermId: number | null = null;
    selectedClassFilter = 'All';
    selectedLevelFilter = 'All';
    skeletonRows = Array.from({ length: 4 });
    readonly quickActions: QuickActionItem[] = [
        { label: 'Attendance', icon: 'pi pi-check-square', route: '/teacher/attendance', severity: 'secondary' },
        { label: 'Results', icon: 'pi pi-table', route: '/teacher/results', severity: 'secondary' },
        { label: 'My timetable', icon: 'pi pi-calendar', route: '/teacher/timetable', severity: 'secondary' },
        { label: 'My classes', icon: 'pi pi-users', route: '/teacher/classes', severity: 'help' }
    ];

    ngOnInit(): void {
        this.loadData();
    }

    get classCount(): number {
        return new Set(this.displayedSubjectRows.map((row) => row.className)).size;
    }

    get subjectCount(): number {
        return new Set(this.displayedSubjectRows.map((row) => row.subjectName)).size;
    }

    get slotCount(): number {
        return this.displayedSubjectRows.reduce((total, row) => total + row.slotCount, 0);
    }

    get classFilterOptions(): { label: string; value: string }[] {
        const classes = Array.from(new Set(this.assignments.map((assignment) => assignment.class))).sort();
        return [{ label: 'All classes', value: 'All' }, ...classes.map((value) => ({ label: value, value }))];
    }

    get levelFilterOptions(): { label: string; value: string }[] {
        const levels = Array.from(new Set(this.assignments.map((assignment) => assignment.gradeLevel))).sort();
        return [{ label: 'All levels', value: 'All' }, ...levels.map((value) => ({ label: value, value }))];
    }

    get subjectRows(): TeacherSubjectRow[] {
        const rows = new Map<string, TeacherSubjectRow>();

        for (const assignment of this.assignments) {
            const key = `${assignment.class}|${assignment.subjectId}`;
            const slots = this.timetable.filter((slot) => slot.class === assignment.class && slot.subjectId === assignment.subjectId);
            const timeSlots = slots.length === 0
                ? 'No approved slot yet'
                : slots
                    .map((slot) => `${slot.dayOfWeek} ${slot.startTime} - ${slot.endTime}`)
                    .join('\n');

            rows.set(key, {
                className: assignment.class,
                subjectName: assignment.subjectName,
                gradeLevel: assignment.gradeLevel,
                slotCount: slots.length,
                timeSlots
            });
        }

        return [...rows.values()].sort((left, right) => {
            const classDelta = left.className.localeCompare(right.className);
            if (classDelta !== 0) {
                return classDelta;
            }

            return left.subjectName.localeCompare(right.subjectName);
        });
    }

    get displayedSubjectRows(): TeacherSubjectRow[] {
        return this.subjectRows.filter((row) => {
            if (this.selectedClassFilter !== 'All' && row.className !== this.selectedClassFilter) {
                return false;
            }

            if (this.selectedLevelFilter !== 'All' && row.gradeLevel !== this.selectedLevelFilter) {
                return false;
            }

            return true;
        });
    }

    loadData(): void {
        this.loading = true;
        const teacherId = this.auth.userId();
        const schoolId = this.auth.schoolId() ?? undefined;

        if (!teacherId) {
            this.loading = false;
            return;
        }

        forkJoin({
            assignments: this.api.getAssignmentsByTeacher(teacherId, schoolId),
            terms: this.api.getAcademicTerms(schoolId)
        }).subscribe({
            next: ({ assignments, terms }) => {
                this.assignments = assignments;
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

    onFilterChange(): void {
        // Filters are computed from the current in-memory rows.
    }

    exportSubjectsPdf(): void {
        const termLabel = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'All terms';
        const fileName = `teacher-subjects-${termLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'subjects'}.pdf`;
        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('My subjects', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Teacher: ${this.auth.displayName()}`, margin, 60);
        doc.text(`Term: ${termLabel}`, margin, 74);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 88);

        autoTable(doc, {
            startY: 104,
            head: [['Class', 'Subject', 'Level', 'Slots', 'Timetable']],
            body: this.displayedSubjectRows.map((row) => [row.className, row.subjectName, row.gradeLevel, row.slotCount.toString(), row.timeSlots]),
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
            margin: {
                left: margin,
                right: margin
            }
        });

        doc.save(fileName);
    }
}
