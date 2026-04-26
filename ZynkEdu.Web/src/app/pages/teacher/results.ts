import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CreateResultRequest, ResultResponse, StudentResponse, TeacherAssignmentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface ResultDraft {
    studentId: number;
    subjectId: number | null;
    score: number;
    term: string;
    comment: string;
}

@Component({
    standalone: true,
    selector: 'app-teacher-results',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Results entry</p>
                    <h1 class="text-3xl font-display font-bold m-0">Class-based results entry</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Choose a class, review the learners in it, and enter marks from a simple modal.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="contrast" (click)="exportClassPdf()"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" (click)="loadClassData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Classes" [value]="classCount" delta="Assigned load" hint="Available lanes" icon="pi pi-sitemap" tone="blue"></app-metric-card>
                <app-metric-card label="Students" [value]="studentCount" delta="Visible class" hint="Loaded roster" icon="pi pi-users" tone="purple"></app-metric-card>
                <app-metric-card label="Results" [value]="resultCount" delta="Current class" hint="Published rows" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Draft term" [value]="termFilter" delta="Entry term" hint="Editable" icon="pi pi-calendar" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card grid gap-4 xl:grid-cols-[0.9fr_1.1fr] items-start">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Select class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (ngModelChange)="loadClassData()"></app-dropdown>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <button *ngFor="let cls of classOptions" pButton type="button" class="p-button-sm" [label]="cls.value" [severity]="cls.value === selectedClass ? 'primary' : 'secondary'" (click)="selectedClass = cls.value; loadClassData()"></button>
                    </div>

                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h2 class="text-lg font-display font-bold mb-0">Assigned subjects</h2>
                            <span class="text-sm text-muted-color">{{ subjectOptions.length }}</span>
                        </div>
                        <div class="space-y-2">
                            <div *ngFor="let subject of subjectOptions" class="rounded-2xl bg-surface-100 dark:bg-surface-900/50 px-3 py-2 text-sm font-medium">
                                {{ subject.label }}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Students in class</h2>
                            <p class="text-sm text-muted-color">Click a row to open the result entry modal.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ classStudents.length }} students</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <p-table *ngIf="!loading" [value]="classStudents" [rowHover]="true" selectionMode="single" dataKey="id" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Student</th>
                                <th>Contact</th>
                                <th>Recent avg</th>
                                <th class="text-right">Action</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student>
                            <tr [pSelectableRow]="student" class="cursor-pointer" (click)="openResultModal(student)">
                                <td>
                                    <div class="font-semibold">{{ student.fullName }}</div>
                                    <div class="text-xs text-muted-color">{{ student.studentNumber }}</div>
                                </td>
                                <td>
                                    <div class="text-sm">{{ student.parentEmail }}</div>
                                    <div class="text-xs text-muted-color">{{ student.parentPhone }}</div>
                                </td>
                                <td>
                                    <p-tag [value]="studentAverage(student.id)" [severity]="studentAverageValue(student.id) >= 75 ? 'success' : studentAverageValue(student.id) >= 60 ? 'warning' : 'danger'"></p-tag>
                                </td>
                                <td class="text-right">
                                    <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="$event.stopPropagation(); openResultModal(student)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </article>

            <p-dialog [(visible)]="resultModalVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(36rem, 95vw)' }" header="Enter student results" appendTo="body">
                <div *ngIf="selectedStudent" class="space-y-4">
                    <div class="rounded-3xl bg-surface-100 dark:bg-surface-900/50 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Student</div>
                        <div class="text-xl font-display font-bold">{{ selectedStudent.fullName }}</div>
                        <div class="text-sm text-muted-color">{{ selectedStudent.studentNumber }} · {{ selectedStudent.class }}</div>
                    </div>

                    <div class="grid gap-3">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Subject</label>
                            <app-dropdown [options]="subjectOptions" [(ngModel)]="resultDraft.subjectId" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Marks</label>
                            <input pInputText type="number" min="0" max="100" [(ngModel)]="resultDraft.score" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Term</label>
                            <input pInputText [(ngModel)]="resultDraft.term" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Comment</label>
                            <textarea [(ngModel)]="resultDraft.comment" rows="4" class="w-full rounded-2xl border border-surface-300 dark:border-surface-700 bg-transparent px-4 py-3"></textarea>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-2">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="resultModalVisible = false"></button>
                        <button pButton type="button" label="Save result" icon="pi pi-check" (click)="saveResult()"></button>
                    </div>
                </div>
            </p-dialog>
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
    selectedStudent: StudentResponse | null = null;
    resultModalVisible = false;
    termFilter = 'Term 1';
    skeletonRows = Array.from({ length: 4 });
    resultDraft: ResultDraft = {
        studentId: 0,
        subjectId: null,
        score: 0,
        term: 'Term 1',
        comment: ''
    };

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const request = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();
        request.subscribe({
            next: (assignments) => {
                this.assignments = assignments;
                this.selectedClass = this.classOptions[0]?.value ?? '';
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

    get subjectOptions(): { label: string; value: number }[] {
        return this.assignments
            .filter((assignment) => assignment.class === this.selectedClass)
            .map((assignment) => ({ label: assignment.subjectName, value: assignment.subjectId }))
            .filter((item, index, list) => list.findIndex((entry) => entry.value === item.value) === index);
    }

    get classCount(): string {
        return this.classOptions.length.toString();
    }

    get studentCount(): string {
        return this.classStudents.length.toString();
    }

    get resultCount(): string {
        return this.classResults.length.toString();
    }

    loadClassData(): void {
        if (!this.selectedClass) {
            this.loading = false;
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
                this.resultDraft.subjectId = this.subjectOptions[0]?.value ?? null;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    openResultModal(student: StudentResponse): void {
        this.selectedStudent = student;
        this.resultDraft = {
            studentId: student.id,
            subjectId: this.subjectOptions[0]?.value ?? null,
            score: 0,
            term: this.termFilter,
            comment: ''
        };
        this.resultModalVisible = true;
    }

    saveResult(): void {
        if (!this.selectedStudent || this.resultDraft.subjectId === null) {
            return;
        }

        const payload: CreateResultRequest = {
            studentId: this.resultDraft.studentId,
            subjectId: this.resultDraft.subjectId,
            score: this.resultDraft.score,
            term: this.resultDraft.term.trim() || this.termFilter,
            comment: this.resultDraft.comment.trim() || null
        };

        this.api.createResult(payload).subscribe({
            next: () => {
                this.resultModalVisible = false;
                this.loadClassData();
            }
        });
    }

    exportClassPdf(): void {
        if (!this.selectedClass) {
            return;
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`Class results - ${this.selectedClass}`, 40, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Term: ${this.termFilter}`, 40, 60);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 74);

        autoTable(doc, {
            startY: 92,
            head: [['Student', 'Number', 'Average', 'Results']],
            body: this.classStudents.map((student) => {
                const rows = this.classResults.filter((result) => result.studentId === student.id);
                const average = rows.length === 0 ? 0 : rows.reduce((total, row) => total + row.score, 0) / rows.length;
                return [student.fullName, student.studentNumber, `${average.toFixed(1)}%`, rows.length.toString()];
            }),
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 5 },
            headStyles: { fillColor: [37, 99, 235] }
        });

        doc.save(`class-results-${this.selectedClass}.pdf`);
    }

    studentAverage(studentId: number): string {
        return `${this.studentAverageValue(studentId).toFixed(1)}%`;
    }

    studentAverageValue(studentId: number): number {
        const rows = this.classResults.filter((result) => result.studentId === studentId);
        if (rows.length === 0) {
            return 0;
        }

        return rows.reduce((total, row) => total + row.score, 0) / rows.length;
    }
}
