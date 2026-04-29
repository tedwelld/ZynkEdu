import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
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
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DialogModule, AppDropdownComponent, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">My classes</p>
                    <h1 class="text-3xl font-display font-bold m-0">Classes and learners</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Use the dropdown to switch classes, then jump straight into attendance or results from the cards and quick actions.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="contrast" (click)="exportClassPdf()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadClassData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-3">
                <app-metric-card label="Students" [value]="classStudents.length.toString()" delta="Selected class" hint="Roster size" icon="pi pi-users" tone="blue" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></app-metric-card>
                <app-metric-card label="Results" [value]="classResults.length.toString()" delta="Selected class" hint="Published rows" icon="pi pi-chart-line" tone="purple" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></app-metric-card>
                <app-metric-card label="Average" [value]="classAverage.toFixed(1) + '%'" delta="Current class" hint="Performance" icon="pi pi-bolt" tone="green" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="grid gap-4 xl:grid-cols-[0.7fr_1.3fr] items-start">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Choose class</label>
                            <app-dropdown [options]="classOptions" [(ngModel)]="selectedClass" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadClassData()" (ngModelChange)="loadClassData()"></app-dropdown>
                        </div>

                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Class load</div>
                            <div class="text-2xl font-display font-bold mt-2">{{ selectedClass || 'No class selected' }}</div>
                            <div class="text-sm text-muted-color mt-1">{{ classStudents.length }} students - {{ classResults.length }} results</div>
                        </div>
                    </div>

                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Selected class</div>
                        <div class="text-2xl font-display font-bold mt-2">{{ selectedClass || 'Choose a class' }}</div>
                        <div class="text-sm text-muted-color mt-1">View the full roster, open student profiles, and export the class list.</div>
                    </div>
                </div>

                <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-5 space-y-4">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Students in class</h2>
                            <p class="text-sm text-muted-color">The roster now fills the full card area. Click any learner to open the student profile modal.</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="secondary" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></button>
                            <button pButton type="button" label="Enter results" icon="pi pi-table" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></button>
                            <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="contrast" (click)="exportClassPdf()"></button>
                            <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="help" routerLink="/teacher/profile"></button>
                        </div>
                    </div>

                    <div *ngIf="loading" class="grid gap-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="7rem" borderRadius="1.25rem"></p-skeleton>
                    </div>

                    <ng-container *ngIf="!loading">
                        <div *ngIf="classStudents.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-8 text-center text-muted-color">
                            No students are assigned to {{ selectedClass || 'the selected class' }} yet.
                        </div>

                        <div *ngIf="classStudents.length > 0" class="grid gap-3">
                            <div
                                *ngFor="let student of classStudents"
                                class="rounded-3xl border border-surface-200 dark:border-surface-700 bg-surface-50/70 dark:bg-surface-900/30 p-4 transition-colors hover:border-primary hover:bg-primary-50/40 dark:hover:bg-primary-500/10 cursor-pointer"
                                (click)="openStudent(student)"
                            >
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div class="flex items-start gap-4 min-w-0">
                                        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200 shrink-0">
                                            <i class="pi pi-user text-lg"></i>
                                        </div>
                                        <div class="min-w-0">
                                            <div class="text-base font-semibold truncate">{{ student.fullName }}</div>
                                            <div class="text-sm text-muted-color">{{ student.studentNumber }} - {{ student.class }}</div>
                                            <div class="text-xs text-muted-color mt-1 truncate">{{ student.parentEmail || 'No parent email' }} - {{ student.parentPhone || 'No parent phone' }}</div>
                                        </div>
                                    </div>

                                    <div class="flex flex-wrap items-center gap-3">
                                        <p-tag [value]="studentAverage(student.id)" [severity]="studentAverageValue(student.id) >= 75 ? 'success' : studentAverageValue(student.id) >= 60 ? 'warning' : 'danger'"></p-tag>
                                        <button pButton type="button" icon="pi pi-eye" label="View" class="p-button-text p-button-sm" (click)="$event.stopPropagation(); openStudent(student)"></button>
                                    </div>
                                </div>

                                <div class="mt-3 grid gap-2 md:grid-cols-2">
                                    <div class="rounded-2xl bg-surface-100/80 dark:bg-surface-900/50 px-3 py-2">
                                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Parent email</div>
                                        <div class="text-sm font-medium break-all">{{ student.parentEmail || 'Not set' }}</div>
                                    </div>
                                    <div class="rounded-2xl bg-surface-100/80 dark:bg-surface-900/50 px-3 py-2">
                                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Parent phone</div>
                                        <div class="text-sm font-medium">{{ student.parentPhone || 'Not set' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ng-container>
                </div>
            </article>

            <p-dialog [(visible)]="studentModalVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(42rem, 95vw)' }" header="Student profile" appendTo="body">
                <div *ngIf="selectedStudent" class="space-y-4">
                    <div class="rounded-3xl bg-surface-100 dark:bg-surface-900/50 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Learner</div>
                        <div class="text-2xl font-display font-bold">{{ selectedStudent.fullName }}</div>
                        <div class="text-sm text-muted-color">{{ selectedStudent.studentNumber }} - {{ selectedStudent.class }}</div>
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

                    <div class="flex flex-wrap gap-3">
                        <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="secondary" routerLink="/teacher/attendance" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Enter results" icon="pi pi-table" routerLink="/teacher/results" [queryParams]="{ class: selectedClass }"></button>
                        <button pButton type="button" label="Profile" icon="pi pi-id-card" severity="help" routerLink="/teacher/profile"></button>
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

    private resultsForStudent(studentId: number): ResultResponse[] {
        return this.classResults.filter((result) => result.studentId === studentId);
    }
}
