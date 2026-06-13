import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ResultResponse, StudentResponse, TeacherAssignmentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

interface ClassStudentModalState {
    averageScore: number;
    resultCount: number;
    latestComment: string;
}

@Component({
    standalone: true,
    selector: 'app-teacher-classes',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DialogModule, AppDropdownComponent, MetricCardComponent, SkeletonModule, TableModule, TagModule],
    template: `
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">My classes</p>
                    <h1 class="text-3xl font-display font-bold m-0">Classes and learners</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Use the dropdown to switch classes, then jump straight into attendance or results from the summary and quick actions.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="success" (click)="exportClassPdf()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="info" (click)="loadClassData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-3">
                <app-metric-card label="Students" [value]="classStudents.length.toString()" delta="Roster" hint="Class size" icon="pi pi-users" tone="blue" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></app-metric-card>
                <app-metric-card label="Results" [value]="classResults.length.toString()" delta="Published" hint="Result rows" icon="pi pi-chart-line" tone="purple" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></app-metric-card>
                <app-metric-card label="Average" [value]="classAverage.toFixed(1) + '%'" delta="Current class" hint="Performance" icon="pi pi-bolt" tone="green" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div class="w-full xl:max-w-sm">
                        <label class="block text-sm font-semibold mb-2">Choose class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadClassData()" (ngModelChange)="loadClassData()"></app-dropdown>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 xl:justify-end">
                        <span class="text-sm text-muted-color">{{ selectedClass || 'No class selected' }} - {{ classStudents.length }} students - {{ classResults.length }} results</span>
                        <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="info" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Enter results" icon="pi pi-table" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="success" (click)="exportClassPdf()"></button>
                        <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="info" routerLink="/teacher/profile"></button>
                    </div>
                </div>

                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Students in class</h2>
                        <p class="text-sm text-muted-color">Roster details are shown in rows, with learner actions at the end of each row.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ classStudents.length }} visible</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <ng-container *ngIf="!loading">
                    <div *ngIf="classStudents.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-8 text-center text-muted-color">
                        No students are assigned to {{ selectedClass || 'the selected class' }} yet.
                    </div>

                    <p-table *ngIf="classStudents.length > 0" [value]="classStudents" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th class="text-muted-color w-8">#</th>
                                <th>Student</th>
                                <th>Class</th>
                                <th>Guardian email</th>
                                <th>Guardian phone</th>
                                <th>Average</th>
                                <th>Results</th>
                                <th>Latest comment</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student let-rowIndex="rowIndex">
                            <tr>
                                <td class="text-sm text-muted-color">{{ rowIndex + 1 }}</td>
                                <td>
                                    <div class="font-semibold">{{ student.fullName }}</div>
                                    <div class="text-xs text-muted-color">{{ student.studentNumber }}</div>
                                </td>
                                <td class="text-sm text-muted-color">{{ student.class }}</td>
                                <td class="text-sm break-all">{{ student.parentEmail || 'Not set' }}</td>
                                <td class="text-sm">{{ student.parentPhone || 'Not set' }}</td>
                                <td>
                                    <p-tag [value]="studentAverage(student.id)" [severity]="studentAverageSeverity(student.id)"></p-tag>
                                </td>
                                <td class="text-sm text-muted-color">{{ resultCountForStudent(student.id) }}</td>
                                <td class="text-sm text-muted-color">{{ latestCommentForStudent(student.id) }}</td>
                                <td class="text-right">
                                    <div class="flex flex-wrap items-center justify-end gap-1">
                                        <button pButton type="button" icon="pi pi-eye" label="View" class="p-button-text p-button-sm" (click)="openStudent(student)"></button>
                                        <button pButton type="button" icon="pi pi-check-square" label="Attendance" severity="info" class="p-button-text p-button-sm" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></button>
                                        <button pButton type="button" icon="pi pi-table" label="Results" class="p-button-text p-button-sm" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></button>
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </ng-container>
            </article>

            <p-dialog [(visible)]="studentModalVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(42rem, 95vw)' }" header="Student profile" appendTo="body">
                <div *ngIf="selectedStudent" class="space-y-4">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-surface-200 dark:border-surface-700 text-left">
                                    <th class="py-2 pr-4">Student</th>
                                    <th class="py-2 pr-4">Number</th>
                                    <th class="py-2 pr-4">Class</th>
                                    <th class="py-2 pr-4">Guardian email</th>
                                    <th class="py-2">Guardian phone</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b border-surface-100 dark:border-surface-800">
                                    <td class="py-3 pr-4 font-semibold">{{ selectedStudent.fullName }}</td>
                                    <td class="py-3 pr-4 text-muted-color">{{ selectedStudent.studentNumber }}</td>
                                    <td class="py-3 pr-4 text-muted-color">{{ selectedStudent.class }}</td>
                                    <td class="py-3 pr-4 break-all">{{ selectedStudent.parentEmail || 'Not set' }}</td>
                                    <td class="py-3">{{ selectedStudent.parentPhone || 'Not set' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-surface-200 dark:border-surface-700 text-left">
                                    <th class="py-2 pr-4">Average score</th>
                                    <th class="py-2 pr-4">Results</th>
                                    <th class="py-2">Latest comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b border-surface-100 dark:border-surface-800">
                                    <td class="py-3 pr-4">{{ studentState.averageScore.toFixed(1) }}%</td>
                                    <td class="py-3 pr-4 text-muted-color">{{ studentState.resultCount }}</td>
                                    <td class="py-3 text-muted-color">{{ studentState.latestComment || 'No teacher comment yet.' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="flex flex-wrap justify-end gap-3">
                        <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="info" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Enter results" icon="pi pi-table" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="info" routerLink="/teacher/profile"></button>
                        <button pButton type="button" label="Close" severity="warn" (click)="studentModalVisible = false"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class TeacherClasses implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly route = inject(ActivatedRoute);

    loading = true;
    errorMessage = '';
    assignments: TeacherAssignmentResponse[] = [];
    classStudents: StudentResponse[] = [];
    classResults: ResultResponse[] = [];
    selectedClass = '';
    selectedStudent: StudentResponse | null = null;
    studentModalVisible = false;
    studentState: ClassStudentModalState = {
        averageScore: 0,
        resultCount: 0,
        latestComment: ''
    };
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        const teacherId = this.auth.userId();
        const request = teacherId ? this.api.getAssignmentsByTeacher(teacherId) : this.api.getAssignments();
        request.subscribe({
            next: (assignments) => {
                this.assignments = assignments;
                this.selectedClass = this.route.snapshot.queryParamMap.get('class') ?? this.classOptions[0]?.value ?? '';
                this.loadClassData();
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Failed to load data. Please refresh or check your connection.';
            }
        });
    }

    get classOptions(): { label: string; value: string }[] {
        return Array.from(new Set(this.assignments.map((assignment) => assignment.class))).map((value) => ({ label: value, value }));
    }

    get classAverage(): number {
        if (this.classResults.length === 0) {
            return 0;
        }

        return this.classResults.reduce((total, row) => total + row.score, 0) / this.classResults.length;
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
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Failed to load data. Please refresh or check your connection.';
            }
        });
    }

    openStudent(student: StudentResponse): void {
        this.selectedStudent = student;
        const rows = this.resultsForStudent(student.id);
        this.studentState = {
            averageScore: rows.length === 0 ? 0 : rows.reduce((total, row) => total + row.score, 0) / rows.length,
            resultCount: rows.length,
            latestComment: rows[0]?.comment ?? ''
        };
        this.studentModalVisible = true;
    }

    exportClassPdf(): void {
        if (!this.selectedClass) {
            return;
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`Class roster - ${this.selectedClass}`, 40, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 60);

        autoTable(doc, {
            startY: 80,
            head: [['Student', 'Number', 'Average', 'Latest comment']],
            body: this.classStudents.map((student) => {
                const rows = this.resultsForStudent(student.id);
                const average = rows.length === 0 ? 0 : rows.reduce((total, row) => total + row.score, 0) / rows.length;
                return [student.fullName, student.studentNumber, `${average.toFixed(1)}%`, rows[0]?.comment ?? 'No comment yet.'];
            }),
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 5 },
            headStyles: { fillColor: [124, 58, 237] }
        });

        doc.save(`class-details-${this.selectedClass}.pdf`);
    }

    studentAverage(studentId: number): string {
        return `${this.studentAverageValue(studentId).toFixed(1)}%`;
    }

    studentAverageValue(studentId: number): number {
        const rows = this.resultsForStudent(studentId);
        if (rows.length === 0) {
            return 0;
        }

        return rows.reduce((total, row) => total + row.score, 0) / rows.length;
    }

    studentAverageSeverity(studentId: number): 'success' | 'warning' | 'danger' {
        const average = this.studentAverageValue(studentId);
        if (average >= 75) {
            return 'success';
        }

        if (average >= 60) {
            return 'warning';
        }

        return 'danger';
    }

    resultCountForStudent(studentId: number): number {
        return this.resultsForStudent(studentId).length;
    }

    latestCommentForStudent(studentId: number): string {
        return this.resultsForStudent(studentId)[0]?.comment || 'No comment yet.';
    }

    private resultsForStudent(studentId: number): ResultResponse[] {
        return this.classResults.filter((result) => result.studentId === studentId);
    }
}
