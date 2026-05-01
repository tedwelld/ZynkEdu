import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { StudentResponse, StudentStatementResponse } from '../../core/api/api.models';
import { buildStudentStatementPdf } from '../../shared/report/report-pdf';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Student finance</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Student statements</h1>
                <p class="text-muted-color mt-2">Pick a student to view their statement and current balance.</p>
            </header>

            <section class="workspace-card p-6">
                <div class="grid lg:grid-cols-3 gap-4 items-end">
                    <label class="block">
                        <span class="text-sm text-muted-color">Student</span>
                        <app-dropdown
                            [options]="studentOptions"
                            [(ngModel)]="selectedStudentId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full mt-2"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search students"
                            [showClear]="true"
                            (ngModelChange)="loadStatement()"
                        ></app-dropdown>
                    </label>
                    <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Balance</div>
                        <div class="text-3xl font-bold mt-2">{{ (statement?.closingBalance || 0) | number:'1.0-2' }}</div>
                    </div>
                    <button pButton class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="button" label="Refresh statement" (click)="loadStatement()"></button>
                </div>
            </section>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 class="text-xl font-semibold">Current students</h2>
                        <p class="text-sm text-muted-color mt-1">All currently enrolled students at this school, shown in a searchable table for quick statement work.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ currentStudents.length }} current student(s)</span>
                </div>

                <div class="overflow-x-auto mt-4">
                    <p-table [value]="currentStudents" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Student</th>
                                <th>Student No.</th>
                                <th>Class</th>
                                <th>Level</th>
                                <th>Status</th>
                                <th>Enrollment Year</th>
                                <th>Subjects</th>
                                <th>Guardians</th>
                                <th>Parent Contact</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student>
                            <tr>
                                <td class="font-medium">
                                    <div>{{ student.fullName }}</div>
                                    <div class="text-xs text-muted-color">{{ student.profileKey }}</div>
                                </td>
                                <td>{{ student.studentNumber }}</td>
                                <td>{{ student.class }}</td>
                                <td>{{ student.level }}</td>
                                <td>
                                    <p-tag [value]="student.status" [severity]="statusSeverity(student.status)"></p-tag>
                                </td>
                                <td>{{ student.enrollmentYear }}</td>
                                <td>
                                    <div class="max-w-xs truncate" [title]="student.subjects.join(', ') || 'No subjects assigned'">
                                        {{ student.subjects.join(', ') || 'No subjects assigned' }}
                                    </div>
                                </td>
                                <td>{{ student.guardians.length }}</td>
                                <td>
                                    <div>{{ student.parentEmail || 'No email' }}</div>
                                    <div class="text-xs text-muted-color">{{ student.parentPhone || 'No phone' }}</div>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </section>

            <section class="workspace-card p-6">
                <h2 class="text-xl font-semibold mb-4">{{ statement?.studentName || 'Statement' }}</h2>
                <div class="mb-4">
                    <button class="rounded-xl bg-primary text-white px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed" type="button" (click)="exportPdf()" [disabled]="!statement">Export statement PDF</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">Date</th>
                                <th class="py-3 pr-4">Type</th>
                                <th class="py-3 pr-4">Reference</th>
                                <th class="py-3 pr-4">Debit</th>
                                <th class="py-3 pr-4">Credit</th>
                                <th class="py-3">Running</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let line of (statement?.transactions || [])" class="border-t border-surface-200 dark:border-surface-700">
                                <td class="py-3 pr-4">{{ line.transactionDate | date:'mediumDate' }}</td>
                                <td class="py-3 pr-4">{{ line.type }} &middot; {{ line.status }}</td>
                                <td class="py-3 pr-4">{{ line.reference || '-' }}</td>
                                <td class="py-3 pr-4">{{ line.debit | number:'1.0-2' }}</td>
                                <td class="py-3 pr-4">{{ line.credit | number:'1.0-2' }}</td>
                                <td class="py-3">{{ line.runningBalance | number:'1.0-2' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    `
})
export class AccountantStudents implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    students: StudentResponse[] = [];
    selectedStudentId: number | null = null;
    statement: StudentStatementResponse | null = null;

    get currentStudents(): StudentResponse[] {
        return this.students.filter((student) => this.isCurrentEnrollment(student));
    }

    get studentOptions(): { label: string; value: number }[] {
        return this.currentStudents.map((student) => ({
            label: `${student.fullName} · ${student.studentNumber} · ${student.class} · ${student.level}`,
            value: student.id
        }));
    }

    ngOnInit(): void {
        this.api.getStudents(undefined, this.auth.schoolId()).subscribe((students) => {
            this.students = students;
            this.selectedStudentId = this.currentStudents[0]?.id ?? null;
            this.loadStatement();
        });
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        const normalized = status.trim().toLowerCase();
        if (normalized === 'active') {
            return 'success';
        }
        if (normalized === 'suspended') {
            return 'warning';
        }
        if (normalized === 'inactive' || normalized === 'withdrawn' || normalized === 'graduated') {
            return 'danger';
        }
        return 'info';
    }

    loadStatement(): void {
        if (!this.selectedStudentId) {
            this.statement = null;
            return;
        }

        this.api.getStudentStatement(this.selectedStudentId, this.auth.schoolId()).subscribe((statement) => {
            this.statement = statement;
        });
    }

    exportPdf(): void {
        if (!this.statement) {
            return;
        }

        buildStudentStatementPdf(
            this.statement,
            `student-statement-${this.statement.studentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${this.statement.studentId}.pdf`
        );
    }

    private isCurrentEnrollment(student: StudentResponse): boolean {
        const status = student.status.trim().toLowerCase();
        return status === 'active' || status === 'suspended';
    }
}
