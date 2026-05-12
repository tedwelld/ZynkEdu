import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { SchoolResponse, StudentResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Cash capture</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Payments</h1>
                <p class="text-muted-color mt-2">Capture cash, bank, and mobile money receipts against a student account.</p>
            </header>

            <section class="workspace-card p-6">
                <form class="grid gap-4 md:grid-cols-4 items-end" (ngSubmit)="submitPayment()">
                    <label *ngIf="isPlatformAdmin" class="block">
                        <span class="text-sm text-muted-color">School</span>
                        <app-dropdown
                            [options]="schoolOptions"
                            [(ngModel)]="selectedSchoolId"
                            name="schoolId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full mt-2"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search schools"
                            [showClear]="false"
                            (ngModelChange)="loadStudents()"
                        ></app-dropdown>
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Student</span>
                        <app-dropdown
                            [options]="studentOptions"
                            [(ngModel)]="draft.studentId"
                            name="studentId"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full mt-2"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            filterPlaceholder="Search students"
                            [showClear]="true"
                        ></app-dropdown>
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Amount</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="number" [(ngModel)]="draft.amount" name="amount" />
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Method</span>
                        <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="draft.method" name="method">
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank</option>
                            <option value="MobileMoney">MobileMoney</option>
                        </select>
                    </label>

                    <button pButton class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="submit" label="Record payment"></button>
                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Reference" [(ngModel)]="draft.reference" name="reference" />
                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Description" [(ngModel)]="draft.description" name="description" />
                </form>
            </section>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 class="text-xl font-semibold">Students</h2>
                        <p class="text-sm text-muted-color mt-1">Current enrolled students for the active school, shown with the details you need for payment capture.</p>
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
                                    <div class="max-w-xs truncate" [title]="subjectSummary(student)">
                                        {{ subjectSummary(student) }}
                                    </div>
                                </td>
                                <td>{{ guardianCount(student) }}</td>
                                <td>
                                    <div>{{ contactEmail(student) }}</div>
                                    <div class="text-xs text-muted-color">{{ contactPhone(student) }}</div>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>

                <div *ngIf="currentStudents.length === 0" class="mt-4 rounded-2xl border border-dashed border-surface-300 px-4 py-6 text-sm text-muted-color">
                    {{ emptyStateMessage }}
                </div>
            </section>
        </section>
    `
})
export class AccountantPayments implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    schools: SchoolResponse[] = [];
    students: StudentResponse[] = [];
    selectedSchoolId: number | null = this.auth.schoolId();
    draft = {
        studentId: null as number | null,
        amount: 0,
        method: 'Cash' as 'Cash' | 'Bank' | 'MobileMoney',
        reference: '',
        description: ''
    };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({
            label: school.name,
            value: school.id
        }));
    }

    get studentOptions(): { label: string; value: number }[] {
        return this.currentStudents.map((student) => ({
            label: `${student.fullName} - ${student.studentNumber} - ${student.class} - ${student.level}`,
            value: student.id
        }));
    }

    get currentStudents(): StudentResponse[] {
        return this.students.filter((student) => this.isCurrentEnrollment(student));
    }

    get emptyStateMessage(): string {
        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            return 'Choose a school to load enrolled students for payment capture.';
        }

        return 'No current enrolled students were found for the active school.';
    }

    ngOnInit(): void {
        if (this.isPlatformAdmin) {
            this.api.getPlatformSchools().subscribe((schools) => {
                this.schools = schools;
                this.selectedSchoolId = this.selectedSchoolId ?? schools[0]?.id ?? null;
                this.loadStudents();
            });
            return;
        }

        this.loadStudents();
    }

    loadStudents(): void {
        const schoolId = this.resolveSchoolId();
        if (this.isPlatformAdmin && !schoolId) {
            this.students = [];
            this.draft.studentId = null;
            return;
        }

        this.api.getStudents(undefined, schoolId ?? undefined).subscribe((students) => {
            this.students = students;
            this.draft.studentId = this.currentStudents[0]?.id ?? null;
        });
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        const normalized = (status ?? '').trim().toLowerCase();
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

    submitPayment(): void {
        const schoolId = this.resolveSchoolId();
        if (!this.draft.studentId || (this.isPlatformAdmin && !schoolId)) {
            return;
        }

        this.api.postPayment(
            {
                studentId: this.draft.studentId,
                amount: this.draft.amount,
                method: this.draft.method,
                reference: this.draft.reference || null,
                description: this.draft.description || null,
                receivedAt: new Date().toISOString()
            },
            schoolId
        ).subscribe(() => {
            this.draft.amount = 0;
            this.draft.reference = '';
            this.draft.description = '';
        });
    }

    subjectSummary(student: StudentResponse): string {
        const subjects = Array.isArray(student.subjects) ? student.subjects.filter((subject) => !!subject) : [];
        return subjects.length > 0 ? subjects.join(', ') : 'No subjects assigned';
    }

    guardianCount(student: StudentResponse): number {
        return Array.isArray(student.guardians) ? student.guardians.length : 0;
    }

    contactEmail(student: StudentResponse): string {
        return student.parentEmail || 'No email';
    }

    contactPhone(student: StudentResponse): string {
        return student.parentPhone || 'No phone';
    }

    private isCurrentEnrollment(student: StudentResponse): boolean {
        const status = (student.status ?? '').trim().toLowerCase();
        return status === 'active' || status === 'suspended';
    }

    private resolveSchoolId(): number | null {
        return this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
    }
}
