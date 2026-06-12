import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { AccountingTransactionResponse, SchoolResponse, StudentResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { buildPaymentReceiptPdf } from '../../shared/report/report-pdf';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="grid gap-6">
            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>
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
                            (ngModelChange)="onStudentSelect($event)"
                        ></app-dropdown>
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Amount</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="number" [(ngModel)]="draft.amount" name="amount" />
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Method</span>
                        <app-dropdown
                            [options]="methodOptions"
                            [(ngModel)]="draft.method"
                            name="method"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full mt-2"
                            appendTo="body"
                            [filter]="false">
                        </app-dropdown>
                    </label>

                    <button pButton class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="submit" [disabled]="submitting" [label]="submitting ? 'Recording…' : 'Record payment'" [icon]="submitting ? 'pi pi-spin pi-spinner' : ''"></button>
                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Reference" [(ngModel)]="draft.reference" name="reference" />
                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Description" [(ngModel)]="draft.description" name="description" />
                </form>

                <div *ngIf="lastTransaction" class="mt-4 rounded-2xl border border-green-400/50 bg-green-50 dark:bg-green-950/30 p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p class="font-semibold text-green-700 dark:text-green-400"><i class="pi pi-check-circle mr-1"></i>Payment recorded</p>
                        <p class="text-sm text-muted-color mt-0.5">Transaction #{{ lastTransaction.id }} · {{ lastTransaction.amount | currency }}</p>
                    </div>
                    <button pButton type="button" label="Print receipt" icon="pi pi-print" severity="success" size="small"
                        (click)="printReceipt()" [disabled]="printingReceipt">
                    </button>
                </div>
            </section>

            <section *ngIf="selectedStudent" class="workspace-card p-5">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">Selected student</p>
                        <h3 class="text-xl font-display font-bold mt-1">{{ selectedStudent.fullName }}</h3>
                        <p class="text-sm text-muted-color mt-0.5">{{ selectedStudent.studentNumber }}</p>
                    </div>
                    <p-tag [value]="selectedStudent.status" [severity]="statusSeverity(selectedStudent.status)"></p-tag>
                </div>
                <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                        <div class="text-xs text-muted-color uppercase tracking-[0.18em]">Class</div>
                        <div class="font-semibold mt-1">{{ selectedStudent.class || '—' }}</div>
                    </div>
                    <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                        <div class="text-xs text-muted-color uppercase tracking-[0.18em]">Level</div>
                        <div class="font-semibold mt-1">{{ selectedStudent.level || '—' }}</div>
                    </div>
                    <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                        <div class="text-xs text-muted-color uppercase tracking-[0.18em]">Parent email</div>
                        <div class="font-semibold mt-1">{{ selectedStudent.parentEmail || '—' }}</div>
                    </div>
                    <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                        <div class="text-xs text-muted-color uppercase tracking-[0.18em]">Parent phone</div>
                        <div class="font-semibold mt-1">{{ selectedStudent.parentPhone || '—' }}</div>
                    </div>
                </div>
                <div *ngIf="selectedStudent.subjects?.length" class="mt-3 text-sm text-muted-color">
                    <span class="font-semibold text-color">Subjects:</span> {{ selectedStudent.subjects.join(', ') }}
                </div>
            </section>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h2 class="text-xl font-semibold">Students</h2>
                        <p class="text-sm text-muted-color mt-1">Search by name, class, or level. Click a row to select the student for payment.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ filteredStudents.length }} / {{ currentStudents.length }} student(s)</span>
                </div>

                <div class="flex flex-wrap gap-3 mb-4">
                    <input
                        class="rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm min-w-[16rem]"
                        placeholder="Search name, class, or level…"
                        [(ngModel)]="searchTerm"
                        name="search"
                    />
                </div>

                <div *ngIf="loading" class="flex items-center justify-center gap-3 py-8 text-muted-color">
                    <i class="pi pi-spin pi-spinner text-2xl"></i>
                    <span>Loading students…</span>
                </div>

                <div *ngIf="!loading" class="overflow-x-auto">
                    <p-table [value]="filteredStudents" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>#</th>
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
                        <ng-template pTemplate="body" let-student let-rowIndex="rowIndex">
                            <tr
                                class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900/40"
                                [ngClass]="selectedStudent?.id === student.id ? 'bg-primary-50 dark:bg-primary-950/30' : ''"
                                (click)="onStudentSelect(student.id)"
                            >
                                <td class="text-sm text-muted-color">{{ rowIndex + 1 }}</td>
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
    private readonly messages = inject(MessageService);

    readonly methodOptions = [
        { label: 'Cash',         value: 'Cash' },
        { label: 'Bank',         value: 'Bank' },
        { label: 'Mobile Money', value: 'MobileMoney' }
    ];

    loading = false;
    submitting = false;
    printingReceipt = false;
    errorMessage: string | null = null;
    lastTransaction: AccountingTransactionResponse | null = null;

    schools: SchoolResponse[] = [];
    students: StudentResponse[] = [];
    selectedSchoolId: number | null = this.auth.schoolId();
    selectedStudent: StudentResponse | null = null;
    searchTerm = '';
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

    get filteredStudents(): StudentResponse[] {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.currentStudents;
        return this.currentStudents.filter((s) =>
            [s.fullName, s.class, s.level, s.studentNumber]
                .some((field) => (field ?? '').toLowerCase().includes(term))
        );
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
            this.selectedStudent = null;
            return;
        }

        this.loading = true;
        this.errorMessage = null;
        this.api.getStudents(undefined, schoolId ?? undefined).subscribe({
            next: (students) => {
                this.students = students;
                const firstCurrent = this.currentStudents[0];
                this.draft.studentId = firstCurrent?.id ?? null;
                this.selectedStudent = firstCurrent ?? null;
                this.loading = false;
            },
            error: (err) => {
                this.errorMessage = 'Failed to load students. Please try again.';
                this.loading = false;
                console.error('Payments: load students error', err);
            }
        });
    }

    onStudentSelect(studentId: number | null): void {
        this.draft.studentId = studentId;
        this.selectedStudent = studentId != null
            ? (this.students.find((s) => s.id === studentId) ?? null)
            : null;
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

        this.submitting = true;
        this.errorMessage = null;
        this.lastTransaction = null;
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
        ).subscribe({
            next: (transaction) => {
                this.lastTransaction = transaction;
                this.draft.amount = 0;
                this.draft.reference = '';
                this.draft.description = '';
                this.submitting = false;
            },
            error: (err) => {
                this.errorMessage = 'Failed to record payment. Please try again.';
                this.submitting = false;
                console.error('Payments: submit error', err);
            }
        });
    }

    printReceipt(): void {
        if (!this.lastTransaction) return;
        this.printingReceipt = true;
        const schoolId = this.resolveSchoolId();
        this.api.getPaymentReceipt(this.lastTransaction.id, schoolId).subscribe({
            next: (receipt) => {
                const schoolInfo = { name: receipt.schoolName };
                const doc = buildPaymentReceiptPdf(receipt, schoolInfo);
                doc.save(`receipt-${receipt.paymentId}.pdf`);
                this.printingReceipt = false;
            },
            error: () => {
                this.messages.add({ severity: 'error', summary: 'Receipt failed', detail: 'Could not generate the payment receipt.' });
                this.printingReceipt = false;
            }
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
