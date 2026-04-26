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

interface ClassStudentModalState {
    averageScore: number;
    resultCount: number;
    latestComment: string;
}

@Component({
    standalone: true,
    selector: 'app-teacher-classes',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DialogModule, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">My classes</p>
                    <h1 class="text-3xl font-display font-bold m-0">Classes and learners</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Use the dropdown or the side buttons to switch classes and inspect the students in each one.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="contrast" (click)="exportClassPdf()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadClassData()"></button>
                </div>
            </div>

            <article class="workspace-card grid gap-4 xl:grid-cols-[0.7fr_1.3fr] items-start">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Choose class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (ngModelChange)="loadClassData()"></app-dropdown>
                    </div>

                    <div class="space-y-2">
                        <button *ngFor="let cls of classOptions" pButton type="button" class="w-full justify-start" [label]="cls.value" [severity]="cls.value === selectedClass ? 'primary' : 'secondary'" (click)="selectedClass = cls.value; loadClassData()"></button>
                    </div>

                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Class load</div>
                        <div class="text-2xl font-display font-bold mt-2">{{ selectedClass || 'No class selected' }}</div>
                        <div class="text-sm text-muted-color mt-1">{{ classStudents.length }} students · {{ classResults.length }} results</div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Students in class</h2>
                            <p class="text-sm text-muted-color">Click a row to open the student modal.</p>
                        </div>
                        <button pButton type="button" label="Open results" icon="pi pi-table" severity="secondary" routerLink="/teacher/results"></button>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <p-table *ngIf="!loading" [value]="classStudents" [rowHover]="true" selectionMode="single" dataKey="id" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Student</th>
                                <th>Contact</th>
                                <th>Average</th>
                                <th class="text-right">View</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student>
                            <tr [pSelectableRow]="student" class="cursor-pointer" (click)="openStudent(student)">
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
                                    <button pButton type="button" icon="pi pi-eye" class="p-button-text p-button-sm" (click)="$event.stopPropagation(); openStudent(student)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </article>

            <p-dialog [(visible)]="studentModalVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(42rem, 95vw)' }" header="Student profile" appendTo="body">
                <div *ngIf="selectedStudent" class="space-y-4">
                    <div class="rounded-3xl bg-surface-100 dark:bg-surface-900/50 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Learner</div>
                        <div class="text-2xl font-display font-bold">{{ selectedStudent.fullName }}</div>
                        <div class="text-sm text-muted-color">{{ selectedStudent.studentNumber }} · {{ selectedStudent.class }}</div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Parent email</div>
                            <div class="font-semibold mt-1">{{ selectedStudent.parentEmail }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Parent phone</div>
                            <div class="font-semibold mt-1">{{ selectedStudent.parentPhone }}</div>
                        </div>
                    </div>

                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-display font-bold mb-0">Result summary</h3>
                            <span class="text-sm text-muted-color">{{ studentState.resultCount }} results</span>
                        </div>
                        <div class="text-sm text-muted-color">Average score: {{ studentState.averageScore.toFixed(1) }}%</div>
                        <div class="text-sm text-muted-color">Latest comment: {{ studentState.latestComment || 'No teacher comment yet.' }}</div>
                    </div>

                    <div class="flex justify-end">
                        <button pButton type="button" label="Close" severity="secondary" (click)="studentModalVisible = false"></button>
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
            }
        });
    }

    get classOptions(): { label: string; value: string }[] {
        return Array.from(new Set(this.assignments.map((assignment) => assignment.class))).map((value) => ({ label: value, value }));
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
            }
        });
    }

    openStudent(student: StudentResponse): void {
        this.selectedStudent = student;
        const rows = this.classResults.filter((result) => result.studentId === student.id);
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
                const rows = this.classResults.filter((result) => result.studentId === student.id);
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
        const rows = this.classResults.filter((result) => result.studentId === studentId);
        if (rows.length === 0) {
            return 0;
        }

        return rows.reduce((total, row) => total + row.score, 0) / rows.length;
    }
}
