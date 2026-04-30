import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CreateResultRequest, GradingSchemeResponse, ResultResponse, StudentResponse, TeacherAssignmentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { buildTeacherClassResultsPdf } from '../../shared/report/report-pdf';

interface ResultEntryRow {
    student: StudentResponse;
    latestResult: ResultResponse | null;
    subjectLinked: boolean;
    testScore: number | null;
    assignmentScore: number | null;
    examScore: number | null;
    finalScore: number | null;
    grade: string;
    comment: string;
    saving: boolean;
    locked: boolean;
    draftSavedAt: string | null;
}

const ASSESSMENTS = [
    { key: 'testScore', label: 'Test', weight: 30 },
    { key: 'assignmentScore', label: 'Assignment', weight: 20 },
    { key: 'examScore', label: 'Exam', weight: 50 }
] as const;

@Component({
    standalone: true,
    selector: 'app-teacher-results',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputNumberModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Results entry</p>
                    <h1 class="text-3xl font-display font-bold m-0">Structured results entry</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">
                        Select the class, subject, and term, then enter tests, assignments, and exams with automatic totals and grade calculation.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="contrast" (click)="exportClassPdf()"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadClassData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Classes" [value]="classCount" delta="Assigned load" hint="Available lanes" icon="pi pi-sitemap" tone="blue" routerLink="/teacher/classes"></app-metric-card>
                <app-metric-card label="Students" [value]="studentCount" delta="Selected subject" hint="Loaded roster" icon="pi pi-users" tone="purple"></app-metric-card>
                <app-metric-card label="Submitted" [value]="resultCount" delta="Selected subject" hint="Published rows" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Term" [value]="termFilter" delta="Entry term" hint="Editable" icon="pi pi-calendar" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Select class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadClassData()" (ngModelChange)="loadClassData()"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Select subject</label>
                        <app-dropdown
                            [options]="subjectOptions"
                            [(ngModel)]="selectedSubjectId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            appendTo="body"
                            [disabled]="subjectOptions.length === 0"
                            (opened)="loadClassData()"
                            (ngModelChange)="onSubjectChange($event)"
                        ></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Select term</label>
                        <app-dropdown [options]="termOptions" [(ngModel)]="termFilter" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadClassData()" (ngModelChange)="onTermChange()"></app-dropdown>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 text-sm text-muted-color">
                    <span *ngIf="selectedClass">Class: <strong class="text-color">{{ selectedClass }}</strong></span>
                    <span>Weights: <strong class="text-color">Test 30%, Assignment 20%, Exam 50%</strong></span>
                    <span *ngIf="selectedSubjectName">Subject: <strong class="text-color">{{ selectedSubjectName }}</strong></span>
                    <span *ngIf="draftCount > 0" class="font-semibold text-emerald-600">{{ draftCount }} draft(s) saved locally</span>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Assessment grid</h2>
                        <p class="text-sm text-muted-color">Enter scores once. Totals, averages, and grades are calculated for you.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ entryRows.length }} student(s)</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && !selectedSubjectId" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    Select a subject to begin entering marks.
                </div>

                <div *ngIf="!loading && selectedSubjectId && entryRows.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No students are assigned to this class yet.
                </div>

                <p-table *ngIf="!loading && selectedSubjectId && entryRows.length > 0" [value]="entryRows" [rowHover]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Student</th>
                            <th>Latest result</th>
                            <th>Test</th>
                            <th>Assignment</th>
                            <th>Exam</th>
                            <th>Total</th>
                            <th>Grade</th>
                            <th>Comment</th>
                            <th class="text-right">Action</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                        <tr [ngClass]="row.locked ? 'opacity-80' : ''">
                            <td>
                                <div class="font-semibold">{{ row.student.fullName }}</div>
                                <div class="text-xs text-muted-color">{{ row.student.studentNumber }}</div>
                                <div class="text-xs mt-1" [ngClass]="row.subjectLinked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">
                                    {{ row.subjectLinked ? 'Linked to selected subject' : 'Shown from class roster' }}
                                </div>
                            </td>
                            <td>
                                <div class="space-y-1">
                                    <p-tag
                                        [value]="row.latestResult ? latestResultLabel(row.latestResult) : 'No result yet'"
                                        [severity]="row.latestResult ? resultSeverity(row.latestResult.score) : 'secondary'"
                                    ></p-tag>
                                    <div *ngIf="row.latestResult" class="text-xs text-muted-color">
                                        {{ row.latestResult.term }} - {{ row.latestResult.grade }}
                                    </div>
                                </div>
                            </td>
                            <td class="min-w-28">
                                <p-inputNumber
                                    [(ngModel)]="row.testScore"
                                    [min]="0"
                                    [max]="100"
                                    [showButtons]="true"
                                    [useGrouping]="false"
                                    mode="decimal"
                                    placeholder="0 - 100"
                                    [disabled]="row.locked"
                                    (ngModelChange)="recalculateRow(row)"
                                ></p-inputNumber>
                            </td>
                            <td class="min-w-28">
                                <p-inputNumber
                                    [(ngModel)]="row.assignmentScore"
                                    [min]="0"
                                    [max]="100"
                                    [showButtons]="true"
                                    [useGrouping]="false"
                                    mode="decimal"
                                    placeholder="0 - 100"
                                    [disabled]="row.locked"
                                    (ngModelChange)="recalculateRow(row)"
                                ></p-inputNumber>
                            </td>
                            <td class="min-w-28">
                                <p-inputNumber
                                    [(ngModel)]="row.examScore"
                                    [min]="0"
                                    [max]="100"
                                    [showButtons]="true"
                                    [useGrouping]="false"
                                    mode="decimal"
                                    placeholder="0 - 100"
                                    [disabled]="row.locked"
                                    (ngModelChange)="recalculateRow(row)"
                                ></p-inputNumber>
                            </td>
                            <td>
                                <div class="font-semibold">{{ row.finalScore === null ? '-' : row.finalScore.toFixed(1) + '%' }}</div>
                            </td>
                            <td>
                                <p-tag [value]="row.grade || '-'" [severity]="gradeSeverity(row.grade)"></p-tag>
                            </td>
                            <td class="min-w-72">
                                <input pInputText type="text" [(ngModel)]="row.comment" [disabled]="row.locked" (ngModelChange)="persistDrafts()" placeholder="Optional comment" class="w-full" />
                                <div class="text-xs text-muted-color mt-1">{{ row.draftSavedAt || 'Draft not saved yet' }}</div>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" label="Submit" icon="pi pi-check" [disabled]="row.locked || row.saving || !canSubmit(row)" (click)="saveResult(row)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>
        </section>
    `
})
export class TeacherResults implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    assignments: TeacherAssignmentResponse[] = [];
    classStudents: StudentResponse[] = [];
    classResults: ResultResponse[] = [];
    selectedClass = '';
    selectedSubjectId: number | null = null;
    termFilter = 'Term 1';
    skeletonRows = Array.from({ length: 4 });
    entryRows: ResultEntryRow[] = [];
    draftCount = 0;
    gradingScheme: GradingSchemeResponse | null = null;

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const request = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();
        request.subscribe({
            next: (assignments) => {
                this.assignments = assignments;
                this.selectedClass = this.classOptions[0]?.value ?? '';
                void this.loadGradingScheme();
                this.loadClassData();
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get classOptions(): { label: string; value: string }[] {
        return Array.from(new Set(this.assignments.map((assignment) => assignment.class))).map((value) => ({ label: value, value }));
    }

    get termOptions(): { label: string; value: string }[] {
        return ['Term 1', 'Term 2', 'Term 3', 'Exam'].map((value) => ({ label: value, value }));
    }

    get subjectOptions(): { label: string; value: number }[] {
        return this.assignments
            .filter((assignment) => assignment.class === this.selectedClass)
            .map((assignment) => ({ label: assignment.subjectName, value: assignment.subjectId }))
            .filter((item, index, list) => list.findIndex((entry) => entry.value === item.value) === index);
    }

    get selectedClassLevel(): string {
        return this.assignments.find((assignment) => assignment.class === this.selectedClass)?.gradeLevel ?? '';
    }

    get selectedSubjectName(): string {
        return this.subjectOptions.find((subject) => subject.value === this.selectedSubjectId)?.label ?? 'No subject selected';
    }

    get classCount(): string {
        return this.classOptions.length.toString();
    }

    get studentCount(): string {
        return this.entryRows.length.toString();
    }

    get resultCount(): string {
        return this.subjectResults.length.toString();
    }

    get subjectResults(): ResultResponse[] {
        if (this.selectedSubjectId === null) {
            return [];
        }

        return this.classResults.filter((result) => result.subjectId === this.selectedSubjectId);
    }

    loadClassData(): void {
        if (!this.selectedClass) {
            this.loading = false;
            this.entryRows = [];
            return;
        }

        this.loading = true;
        forkJoin({
            students: this.api.getStudents(this.selectedClass),
            results: this.api.getResultsByClass(this.selectedClass)
        }).subscribe({
            next: ({ students, results }) => {
                this.classStudents = students;
                this.classResults = results;
                this.selectedSubjectId = this.subjectOptions.some((subject) => subject.value === this.selectedSubjectId)
                    ? this.selectedSubjectId
                    : this.subjectOptions[0]?.value ?? null;
                this.refreshEntryRows();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    onSubjectChange(subjectId: number | null): void {
        this.selectedSubjectId = subjectId;
        this.refreshEntryRows();
    }

    onTermChange(): void {
        this.loadClassData();
    }

    saveResult(row: ResultEntryRow): void {
        if (this.selectedSubjectId === null || row.finalScore === null) {
            return;
        }

        row.saving = true;
        const payload: CreateResultRequest = {
            studentId: row.student.id,
            subjectId: this.selectedSubjectId,
            score: row.finalScore,
            term: this.termFilter.trim() || 'Term 1',
            comment: row.comment.trim() || null
        };

        this.api.createResult(payload).subscribe({
            next: () => {
                row.saving = false;
                row.locked = true;
                row.draftSavedAt = new Date().toLocaleString();
                this.saveLockedStudentId(row.student.id);
                this.persistDrafts();
                this.loadClassData();
            },
            error: () => {
                row.saving = false;
            }
        });
    }

    exportClassPdf(): void {
        if (!this.selectedClass) {
            return;
        }

        const doc = buildTeacherClassResultsPdf(
            this.selectedClass,
            this.selectedSubjectName,
            this.termFilter,
            new Date(),
            this.entryRows.map((row) => ({
                studentName: row.student.fullName,
                studentNumber: row.student.studentNumber,
                testScore: row.testScore,
                assignmentScore: row.assignmentScore,
                examScore: row.examScore,
                finalScore: row.finalScore,
                grade: row.grade
            }))
        );
        doc.save(`class-results-${this.selectedClass}.pdf`);
    }

    latestResultLabel(result: ResultResponse): string {
        return `${result.score.toFixed(1)}% - ${result.grade}`;
    }

    resultSeverity(score: number): 'success' | 'warning' | 'danger' {
        if (score >= 75) {
            return 'success';
        }

        if (score >= 60) {
            return 'warning';
        }

        return 'danger';
    }

    gradeSeverity(grade: string): 'success' | 'warning' | 'danger' | 'secondary' {
        if (!grade || grade === '-') {
            return 'secondary';
        }

        if (['A', 'A+', 'A-'].includes(grade)) {
            return 'success';
        }

        if (['B', 'B+', 'B-'].includes(grade)) {
            return 'warning';
        }

        return 'danger';
    }

    canSubmit(row: ResultEntryRow): boolean {
        return row.finalScore !== null && ![row.testScore, row.assignmentScore, row.examScore].some((value) => value !== null && (value < 0 || value > 100));
    }

    recalculateRow(row: ResultEntryRow): void {
        row.finalScore = this.calculateWeightedScore(row.testScore, row.assignmentScore, row.examScore);
        row.grade = this.gradeForScore(row.finalScore);
        row.locked = false;
        this.persistDrafts();
    }

    persistDrafts(): void {
        const payload = this.entryRows
            .filter((row) => !row.locked)
            .map((row) => ({
                studentId: row.student.id,
                testScore: row.testScore,
                assignmentScore: row.assignmentScore,
                examScore: row.examScore,
                comment: row.comment,
                draftSavedAt: row.draftSavedAt
            }));

        window.localStorage.setItem(this.draftStorageKey(), JSON.stringify(payload));
        this.draftCount = payload.length;
        this.entryRows.forEach((row) => {
            if (!row.locked) {
                row.draftSavedAt = new Date().toLocaleString();
            }
        });
    }

    private refreshEntryRows(): void {
        if (this.selectedSubjectId === null) {
            this.entryRows = [];
            return;
        }

        const subjectResults = this.subjectResults;
        const draftRows = this.loadDraftRows();
        const lockedStudentIds = this.loadLockedStudentIds();
        this.entryRows = this.classStudents
            .slice()
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
            .map((student) => {
                const latestResult = subjectResults.find((result) => result.studentId === student.id) ?? null;
                const subjectLinked = student.subjectIds.includes(this.selectedSubjectId as number);
                const draft = draftRows.find((row) => row.studentId === student.id);
                const testScore = draft?.testScore ?? null;
                const assignmentScore = draft?.assignmentScore ?? null;
                const examScore = draft?.examScore ?? null;
                const finalScore = this.calculateWeightedScore(testScore, assignmentScore, examScore);

                return {
                    student,
                    latestResult,
                    subjectLinked,
                    testScore,
                    assignmentScore,
                    examScore,
                    finalScore,
                    grade: this.gradeForScore(finalScore),
                    comment: draft?.comment ?? '',
                    saving: false,
                    locked: lockedStudentIds.includes(student.id),
                    draftSavedAt: draft?.draftSavedAt ?? null
                };
            });

        this.draftCount = this.entryRows.filter((row) => !row.locked && (row.testScore !== null || row.assignmentScore !== null || row.examScore !== null || row.comment.trim().length > 0)).length;
    }

    private loadDraftRows(): Array<{ studentId: number; testScore: number | null; assignmentScore: number | null; examScore: number | null; comment: string; draftSavedAt: string | null }> {
        try {
            const raw = window.localStorage.getItem(this.draftStorageKey());
            if (!raw) {
                return [];
            }

            return JSON.parse(raw) as Array<{ studentId: number; testScore: number | null; assignmentScore: number | null; examScore: number | null; comment: string; draftSavedAt: string | null }>;
        } catch {
            return [];
        }
    }

    private loadLockedStudentIds(): number[] {
        try {
            const raw = window.localStorage.getItem(`${this.draftStorageKey()}.locked`);
            if (!raw) {
                return [];
            }

            return JSON.parse(raw) as number[];
        } catch {
            return [];
        }
    }

    private saveLockedStudentId(studentId: number): void {
        const ids = this.loadLockedStudentIds();
        if (!ids.includes(studentId)) {
            ids.push(studentId);
            window.localStorage.setItem(`${this.draftStorageKey()}.locked`, JSON.stringify(ids));
        }
    }

    private draftStorageKey(): string {
        return `zynkedu.teacher.results.${this.auth.userId() ?? 'guest'}.${this.selectedClass}.${this.selectedSubjectId ?? 'none'}.${this.termFilter}`;
    }

    private calculateWeightedScore(testScore: number | null, assignmentScore: number | null, examScore: number | null): number | null {
        if (testScore === null || assignmentScore === null || examScore === null) {
            return null;
        }

        const total = (testScore * ASSESSMENTS[0].weight + assignmentScore * ASSESSMENTS[1].weight + examScore * ASSESSMENTS[2].weight) / 100;
        return Number.isFinite(total) ? Math.round(total * 10) / 10 : null;
    }

    private gradeForScore(score: number | null): string {
        if (score === null) {
            return '-';
        }

        const bands = this.gradingBandsForSelectedClass();
        if (bands.length === 0) {
            return this.defaultGradeForScore(score);
        }

        const rounded = Math.round(score * 10) / 10;
        const match = bands.find((band) => rounded >= band.minScore && rounded <= band.maxScore);
        return match?.grade ?? this.defaultGradeForScore(score);
    }

    private async loadGradingScheme(): Promise<void> {
        const schoolId = this.auth.schoolId();
        if (!schoolId) {
            return;
        }

        this.api.getGradingScheme(schoolId).subscribe({
            next: (scheme) => {
                this.gradingScheme = scheme;
                this.refreshEntryRows();
            },
            error: () => {
                this.gradingScheme = null;
                this.refreshEntryRows();
            }
        });
    }

    private gradingBandsForSelectedClass(): Array<{ grade: string; minScore: number; maxScore: number }> {
        const level = this.selectedClassLevel;
        if (!level || !this.gradingScheme) {
            return [];
        }

        return this.gradingScheme.levels.find((entry) => entry.level === level)?.bands ?? [];
    }

    private defaultGradeForScore(score: number): string {
        if (score >= 80) {
            return 'A';
        }

        if (score >= 70) {
            return 'B';
        }

        if (score >= 60) {
            return 'C';
        }

        if (score >= 50) {
            return 'D';
        }

        return 'F';
    }
}
