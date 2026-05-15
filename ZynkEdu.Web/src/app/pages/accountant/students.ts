import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { buildStudentStatementPdf } from '../../shared/report/report-pdf';
import { CreateAdjustmentRequest, CreateFineRequest, CreateRefundRequest, InvoiceResponse, LibraryBorrowerSummaryResponse, StatementLineResponse, StudentResponse, StudentStatementResponse, UpdateInvoiceRequest } from '../../core/api/api.models';

interface InvoiceDraft {
    term: string;
    totalAmount: number;
    dueAt: string;
    reference: string;
    description: string;
}

interface TxActionDraft {
    amount: number;
    reference: string;
    description: string;
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Student finance</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Student statements</h1>
                <p class="text-muted-color mt-2">Pick a student to view their statement, then open the modal for invoice actions.</p>
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
                        <p class="text-sm text-muted-color mt-1">Click any learner to open the finance modal with invoices and the statement timeline.</p>
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
                                <th>Overdue library loans</th>
                                <th>Parent Contact</th>
                                <th>Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student>
                            <tr class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900/40" (click)="openStudent(student)">
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
                                    <ng-container *ngIf="overdueLibraryBorrowers.length > 0">
                                        <ng-container *ngIf="getStudentOverdueLoanCount(student.id) as count; else noLoans">
                                            <span class="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold text-sm"><i class="pi pi-book text-xs"></i> {{ count }}</span>
                                        </ng-container>
                                        <ng-template #noLoans><span class="text-muted-color text-sm">—</span></ng-template>
                                    </ng-container>
                                    <span *ngIf="overdueLibraryBorrowers.length === 0" class="text-muted-color text-sm">—</span>
                                </td>
                                <td>
                                    <div>{{ student.parentEmail || 'No email' }}</div>
                                    <div class="text-xs text-muted-color">{{ student.parentPhone || 'No phone' }}</div>
                                </td>
                                <td>
                                    <button
                                        pButton
                                        type="button"
                                        icon="pi pi-eye"
                                        label="Open"
                                        class="p-button-text p-button-sm"
                                        (click)="$event.stopPropagation(); openStudent(student)"
                                    ></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </section>

            <p-dialog
                [(visible)]="studentModalVisible"
                [modal]="true"
                [draggable]="false"
                [dismissableMask]="true"
                [style]="{ width: 'min(90rem, 98vw)' }"
                [header]="studentModalHeader"
                appendTo="body"
                (onHide)="closeStudentModal()"
            >
                <ng-container *ngIf="selectedStudent; else modalEmpty">
                    <div class="space-y-6">
                        <div class="workspace-card metric-gradient">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Student profile</p>
                                    <h3 class="text-2xl font-display font-bold m-0">{{ selectedStudent.fullName }}</h3>
                                <p class="text-muted-color mt-1">{{ selectedStudent.studentNumber }} - {{ selectedStudent.class }} - {{ selectedStudent.level }}</p>
                                </div>
                                <button pButton type="button" icon="pi pi-times" class="p-button-rounded p-button-text" (click)="studentModalVisible = false"></button>
                            </div>

                            <div class="grid gap-3 md:grid-cols-3 mt-4 text-sm">
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Closing balance</div>
                                    <div class="font-semibold">{{ (statement?.closingBalance || 0) | number:'1.0-2' }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Invoice count</div>
                                    <div class="font-semibold">{{ studentInvoices.length }}</div>
                                </div>
                                <div class="rounded-2xl bg-surface-0/70 dark:bg-surface-950/40 p-3">
                                    <div class="text-muted-color">Invoice access</div>
                                    <div class="font-semibold">{{ canManageInvoices ? 'Edit and delete' : 'View only' }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] items-start">
                            <section class="workspace-card">
                                <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
                                    <div>
                                        <h4 class="text-lg font-display font-bold mb-0">Invoice register</h4>
                                        <p class="text-sm text-muted-color mt-1">View, amend, or delete invoices for this student.</p>
                                    </div>
                                    <span class="text-sm text-muted-color">{{ studentInvoices.length }} invoice(s)</span>
                                </div>

                                <div *ngIf="studentInvoices.length === 0" class="rounded-2xl border border-dashed border-surface-300 p-5 text-sm text-muted-color">
                                    No invoices have been issued for this student yet.
                                </div>

                                <div *ngIf="studentInvoices.length > 0" class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                                            <tr>
                                                <th class="py-3 pr-4">Term</th>
                                                <th class="py-3 pr-4">Amount</th>
                                                <th class="py-3 pr-4">Status</th>
                                                <th class="py-3 pr-4">Due</th>
                                                <th class="py-3 pr-4">Issued</th>
                                                <th class="py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr *ngFor="let invoice of studentInvoices" class="border-t border-surface-200 dark:border-surface-700">
                                                <td class="py-3 pr-4">
                                                    <div class="font-medium">{{ invoice.term }}</div>
                                                    <div class="text-xs text-muted-color">{{ invoice.reference || 'No reference' }}</div>
                                                </td>
                                                <td class="py-3 pr-4">{{ invoice.totalAmount | number:'1.0-2' }}</td>
                                                <td class="py-3 pr-4">
                                                    <p-tag [value]="invoice.status" [severity]="invoiceStatusSeverity(invoice.status)"></p-tag>
                                                </td>
                                                <td class="py-3 pr-4">{{ invoice.dueAt | date:'mediumDate' }}</td>
                                                <td class="py-3 pr-4">{{ invoice.issuedAt | date:'mediumDate' }}</td>
                                                <td class="py-3">
                                                    <div class="flex flex-wrap gap-2">
                                                        <button pButton type="button" icon="pi pi-eye" class="p-button-text p-button-sm" label="View" (click)="viewInvoice(invoice)"></button>
                                                        <button
                                                            *ngIf="canManageInvoices && canEditInvoice(invoice)"
                                                            pButton
                                                            type="button"
                                                            icon="pi pi-pencil"
                                                            class="p-button-text p-button-sm"
                                                            label="Amend"
                                                            (click)="startInvoiceEdit(invoice)"
                                                        ></button>
                                                        <button
                                                            *ngIf="canManageInvoices && canDeleteInvoice(invoice)"
                                                            pButton
                                                            type="button"
                                                            icon="pi pi-trash"
                                                            class="p-button-text p-button-sm p-button-danger"
                                                            label="Delete"
                                                            (click)="deleteInvoice(invoice)"
                                                        ></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <div class="space-y-6">
                                <section class="workspace-card">
                                    <div class="flex items-center justify-between gap-3 mb-4">
                                        <h4 class="text-lg font-display font-bold mb-0">Selected invoice</h4>
                                        <button *ngIf="selectedInvoice" pButton type="button" class="p-button-text p-button-sm" label="Clear" (click)="selectedInvoice = null"></button>
                                    </div>

                                    <div *ngIf="selectedInvoice; else noInvoiceSelection" class="space-y-3 text-sm">
                                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                            <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Term</div>
                                            <div class="font-semibold">{{ selectedInvoice.term }}</div>
                                        </div>
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                                <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Amount</div>
                                                <div class="font-semibold">{{ selectedInvoice.totalAmount | number:'1.0-2' }}</div>
                                            </div>
                                            <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                                <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Status</div>
                                                <div class="font-semibold">{{ selectedInvoice.status }}</div>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                                <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Due</div>
                                                <div class="font-semibold">{{ selectedInvoice.dueAt | date:'mediumDate' }}</div>
                                            </div>
                                            <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                                <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Issued</div>
                                                <div class="font-semibold">{{ selectedInvoice.issuedAt | date:'mediumDate' }}</div>
                                            </div>
                                        </div>
                                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                            <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Reference</div>
                                            <div class="font-semibold">{{ selectedInvoice.reference || 'No reference' }}</div>
                                        </div>
                                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                                            <div class="text-muted-color text-xs uppercase tracking-[0.18em]">Description</div>
                                            <div class="font-semibold">{{ selectedInvoice.description || 'No description' }}</div>
                                        </div>
                                    </div>

                                    <ng-template #noInvoiceSelection>
                                        <div class="rounded-2xl border border-dashed border-surface-300 p-5 text-sm text-muted-color">
                                            Use the View button beside an invoice to inspect its details here.
                                        </div>
                                    </ng-template>
                                </section>

                                <section *ngIf="editingInvoice" class="workspace-card">
                                    <div class="flex items-center justify-between gap-3 mb-4">
                                        <h4 class="text-lg font-display font-bold mb-0">Amend invoice</h4>
                                        <span class="text-sm text-muted-color">Editing invoice #{{ editingInvoice.id }}</span>
                                    </div>

                                    <div class="grid gap-4 md:grid-cols-2">
                                        <label class="block">
                                            <span class="text-sm text-muted-color">Term</span>
                                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="invoiceDraft.term" name="invoiceTerm" />
                                        </label>
                                        <label class="block">
                                            <span class="text-sm text-muted-color">Amount</span>
                                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="number" [(ngModel)]="invoiceDraft.totalAmount" name="invoiceAmount" />
                                        </label>
                                        <label class="block">
                                            <span class="text-sm text-muted-color">Due date</span>
                                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="invoiceDraft.dueAt" name="invoiceDueAt" />
                                        </label>
                                        <label class="block">
                                            <span class="text-sm text-muted-color">Reference</span>
                                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="invoiceDraft.reference" name="invoiceReference" />
                                        </label>
                                        <label class="block md:col-span-2">
                                            <span class="text-sm text-muted-color">Description</span>
                                            <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="invoiceDraft.description" name="invoiceDescription" />
                                        </label>
                                    </div>

                                    <div class="mt-4 flex flex-wrap gap-3 justify-end">
                                        <button pButton type="button" label="Cancel" severity="secondary" (click)="cancelInvoiceEdit()"></button>
                                        <button pButton type="button" label="Save amendment" icon="pi pi-check" (click)="saveInvoice()"></button>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <section *ngIf="pendingTransactions.length > 0 && canApproveTransactions" class="workspace-card p-5">
                            <div class="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h4 class="text-lg font-display font-bold mb-0">Pending transactions</h4>
                                    <p class="text-sm text-muted-color mt-1">These transactions require approval before they affect the account balance.</p>
                                </div>
                                <span class="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-1">{{ pendingTransactions.length }} pending</span>
                            </div>
                            <div class="space-y-2">
                                <div *ngFor="let tx of pendingTransactions" class="flex items-center justify-between gap-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                                    <div class="text-sm">
                                        <div class="font-semibold">{{ tx.type }} &mdash; {{ tx.amount | number:'1.0-2' }}</div>
                                        <div class="text-muted-color text-xs mt-0.5">{{ tx.reference || tx.description || 'No reference' }} &middot; {{ tx.transactionDate | date:'mediumDate' }}</div>
                                    </div>
                                    <button pButton type="button" icon="pi pi-check" label="Approve" class="p-button-sm p-button-success" (click)="approveTransaction(tx)"></button>
                                </div>
                            </div>
                        </section>

                        <section class="workspace-card p-5">
                            <button
                                type="button"
                                class="flex w-full items-center justify-between gap-3 text-left"
                                (click)="actionsExpanded = !actionsExpanded">
                                <div>
                                    <h4 class="text-lg font-display font-bold mb-0">Transaction actions</h4>
                                    <p class="text-sm text-muted-color mt-1">Record an adjustment, refund, or fine against this student's account.</p>
                                </div>
                                <i class="pi shrink-0" [ngClass]="actionsExpanded ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                            </button>

                            <div *ngIf="actionsExpanded" class="mt-5 grid gap-6 md:grid-cols-3">
                                <div *ngIf="canRecordAdjustment" class="space-y-3">
                                    <h5 class="font-semibold text-sm uppercase tracking-[0.18em] text-muted-color">Adjustment</h5>
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" type="number" placeholder="Amount" [(ngModel)]="adjustmentDraft.amount" name="adjAmount" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Reference" [(ngModel)]="adjustmentDraft.reference" name="adjRef" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Description" [(ngModel)]="adjustmentDraft.description" name="adjDesc" />
                                    <button pButton type="button" label="Post adjustment" class="p-button-sm w-full" (click)="submitAdjustment()"></button>
                                </div>

                                <div class="space-y-3">
                                    <h5 class="font-semibold text-sm uppercase tracking-[0.18em] text-muted-color">Refund</h5>
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" type="number" placeholder="Amount" [(ngModel)]="refundDraft.amount" name="refAmount" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Reference" [(ngModel)]="refundDraft.reference" name="refRef" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Description" [(ngModel)]="refundDraft.description" name="refDesc" />
                                    <button pButton type="button" label="Post refund" class="p-button-sm w-full" (click)="submitRefund()"></button>
                                </div>

                                <div class="space-y-3">
                                    <h5 class="font-semibold text-sm uppercase tracking-[0.18em] text-muted-color">Fine</h5>
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" type="number" placeholder="Amount" [(ngModel)]="fineDraft.amount" name="fineAmount" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Reference" [(ngModel)]="fineDraft.reference" name="fineRef" />
                                    <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm" placeholder="Description" [(ngModel)]="fineDraft.description" name="fineDesc" />
                                    <button pButton type="button" label="Charge fine" class="p-button-sm p-button-warning w-full" (click)="submitFine()"></button>
                                </div>
                            </div>
                        </section>
                    </div>
                </ng-container>

                <ng-template #modalEmpty>
                    <div class="flex h-full items-center justify-center text-muted-color">Select a student to open the finance modal.</div>
                </ng-template>
            </p-dialog>
        </section>
    `
})
export class AccountantStudents implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    students: StudentResponse[] = [];
    overdueLibraryBorrowers: LibraryBorrowerSummaryResponse[] = [];
    selectedStudentId: number | null = null;
    selectedStudent: StudentResponse | null = null;
    studentModalVisible = false;
    statement: StudentStatementResponse | null = null;
    studentInvoices: InvoiceResponse[] = [];
    selectedInvoice: InvoiceResponse | null = null;
    editingInvoice: InvoiceResponse | null = null;
    invoiceDraft: InvoiceDraft = this.createInvoiceDraft();
    actionsExpanded = false;
    adjustmentDraft: TxActionDraft = { amount: 0, reference: '', description: '' };
    refundDraft: TxActionDraft = { amount: 0, reference: '', description: '' };
    fineDraft: TxActionDraft = { amount: 0, reference: '', description: '' };

    get currentStudents(): StudentResponse[] {
        return this.students.filter((student) => this.isCurrentEnrollment(student));
    }

    get studentOptions(): { label: string; value: number }[] {
        return this.currentStudents.map((student) => ({
            label: `${student.fullName} - ${student.studentNumber} - ${student.class} - ${student.level}`,
            value: student.id
        }));
    }

    get canManageInvoices(): boolean {
        const role = this.auth.role();
        return role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'Admin' || role === 'PlatformAdmin';
    }

    get canApproveTransactions(): boolean {
        return this.canManageInvoices;
    }

    get canRecordAdjustment(): boolean {
        const role = this.auth.role();
        return role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'Admin' || role === 'PlatformAdmin';
    }

    get pendingTransactions(): StatementLineResponse[] {
        return (this.statement?.transactions ?? []).filter((tx) => tx.status === 'Pending');
    }

    get studentModalHeader(): string {
        return this.selectedStudent ? `${this.selectedStudent.fullName} finance` : 'Student finance';
    }

    ngOnInit(): void {
        forkJoin({
            students: this.api.getStudents(undefined, this.auth.schoolId()),
            overdueLibraryBorrowers: this.api.getLibraryBorrowersWithOverdueLoans(this.auth.schoolId())
        }).subscribe(({ students, overdueLibraryBorrowers }) => {
            this.students = students;
            this.overdueLibraryBorrowers = overdueLibraryBorrowers;
            this.selectedStudentId = this.currentStudents[0]?.id ?? null;
            this.loadStatement();
        });
    }

    getStudentOverdueLoanCount(studentId: number): number {
        return this.overdueLibraryBorrowers.find((b) => b.borrowerType === 'Student' && b.borrowerId === studentId)?.overdueLoanCount ?? 0;
    }

    openStudent(student: StudentResponse): void {
        this.selectedStudent = student;
        this.selectedStudentId = student.id;
        this.studentModalVisible = true;
        this.selectedInvoice = null;
        this.editingInvoice = null;
        this.actionsExpanded = false;
        this.invoiceDraft = this.createInvoiceDraft();
        this.adjustmentDraft = { amount: 0, reference: '', description: '' };
        this.refundDraft = { amount: 0, reference: '', description: '' };
        this.fineDraft = { amount: 0, reference: '', description: '' };
        this.loadStudentFinance();
    }

    closeStudentModal(): void {
        this.studentModalVisible = false;
        this.selectedInvoice = null;
        this.editingInvoice = null;
        this.invoiceDraft = this.createInvoiceDraft();
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

    invoiceStatusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        const normalized = status.trim().toLowerCase();
        if (normalized === 'paid') {
            return 'success';
        }
        if (normalized === 'partial') {
            return 'warning';
        }
        if (normalized === 'draft') {
            return 'info';
        }
        return 'danger';
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

    loadStudentFinance(): void {
        if (!this.selectedStudentId) {
            this.statement = null;
            this.studentInvoices = [];
            return;
        }

        forkJoin({
            statement: this.api.getStudentStatement(this.selectedStudentId, this.auth.schoolId()),
            invoices: this.api.getStudentInvoices(this.selectedStudentId, this.auth.schoolId())
        }).subscribe({
            next: ({ statement, invoices }) => {
                this.statement = statement;
                this.studentInvoices = invoices;
                this.selectedInvoice = invoices.find((invoice) => invoice.id === this.selectedInvoice?.id) ?? null;
            }
        });
    }

    viewInvoice(invoice: InvoiceResponse): void {
        this.selectedInvoice = invoice;
    }

    startInvoiceEdit(invoice: InvoiceResponse): void {
        this.selectedInvoice = invoice;
        this.editingInvoice = invoice;
        this.invoiceDraft = this.createInvoiceDraft(invoice);
    }

    cancelInvoiceEdit(): void {
        this.editingInvoice = null;
        this.invoiceDraft = this.createInvoiceDraft();
    }

    saveInvoice(): void {
        if (!this.selectedStudentId || !this.editingInvoice) {
            return;
        }

        if (!this.invoiceDraft.term.trim() || !this.invoiceDraft.dueAt) {
            return;
        }

        const request: UpdateInvoiceRequest = {
            term: this.invoiceDraft.term.trim(),
            totalAmount: this.invoiceDraft.totalAmount,
            dueAt: this.normalizeDateInput(this.invoiceDraft.dueAt),
            reference: this.normalizeOptional(this.invoiceDraft.reference),
            description: this.normalizeOptional(this.invoiceDraft.description)
        };

        this.api.updateInvoice(this.editingInvoice.id, request, this.auth.schoolId()).subscribe({
            next: (updated) => {
                this.selectedInvoice = updated;
                this.editingInvoice = null;
                this.invoiceDraft = this.createInvoiceDraft();
                this.loadStudentFinance();
            }
        });
    }

    deleteInvoice(invoice: InvoiceResponse): void {
        if (!this.canManageInvoices) {
            return;
        }

        const confirmed = window.confirm(`Delete invoice ${invoice.term} for ${invoice.studentName}?`);
        if (!confirmed) {
            return;
        }

        this.api.deleteInvoice(invoice.id, this.auth.schoolId()).subscribe({
            next: () => {
                if (this.selectedInvoice?.id === invoice.id) {
                    this.selectedInvoice = null;
                }
                if (this.editingInvoice?.id === invoice.id) {
                    this.cancelInvoiceEdit();
                }
                this.loadStudentFinance();
                this.loadStatement();
            }
        });
    }

    canEditInvoice(invoice: InvoiceResponse): boolean {
        return invoice.status === 'Draft' || invoice.status === 'Issued';
    }

    canDeleteInvoice(invoice: InvoiceResponse): boolean {
        return this.canEditInvoice(invoice);
    }

    approveTransaction(tx: StatementLineResponse): void {
        if (!this.selectedStudentId) {
            return;
        }
        this.api.approveTransaction(tx.transactionId, this.auth.schoolId()).subscribe(() => this.loadStudentFinance());
    }

    submitAdjustment(): void {
        if (!this.selectedStudentId || this.adjustmentDraft.amount === 0) {
            return;
        }
        const request: CreateAdjustmentRequest = {
            studentId: this.selectedStudentId,
            amount: this.adjustmentDraft.amount,
            reference: this.adjustmentDraft.reference || null,
            description: this.adjustmentDraft.description || null
        };
        this.api.postAdjustment(request, this.auth.schoolId()).subscribe(() => {
            this.adjustmentDraft = { amount: 0, reference: '', description: '' };
            this.loadStudentFinance();
        });
    }

    submitRefund(): void {
        if (!this.selectedStudentId || this.refundDraft.amount === 0) {
            return;
        }
        const request: CreateRefundRequest = {
            studentId: this.selectedStudentId,
            amount: this.refundDraft.amount,
            reference: this.refundDraft.reference || null,
            description: this.refundDraft.description || null
        };
        this.api.postRefund(request, this.auth.schoolId()).subscribe(() => {
            this.refundDraft = { amount: 0, reference: '', description: '' };
            this.loadStudentFinance();
        });
    }

    submitFine(): void {
        if (!this.selectedStudentId || this.fineDraft.amount === 0) {
            return;
        }
        const request: CreateFineRequest = {
            studentId: this.selectedStudentId,
            amount: this.fineDraft.amount,
            reference: this.fineDraft.reference || null,
            description: this.fineDraft.description || null
        };
        this.api.postFine(request, this.auth.schoolId()).subscribe(() => {
            this.fineDraft = { amount: 0, reference: '', description: '' };
            this.loadStudentFinance();
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

    private createInvoiceDraft(invoice?: InvoiceResponse | null): InvoiceDraft {
        return {
            term: invoice?.term ?? '',
            totalAmount: invoice?.totalAmount ?? 0,
            dueAt: this.toDateInput(invoice?.dueAt ?? null),
            reference: invoice?.reference ?? '',
            description: invoice?.description ?? ''
        };
    }

    private normalizeDateInput(value: string): string {
        if (!value) {
            return new Date().toISOString();
        }

        return new Date(`${value}T00:00:00Z`).toISOString();
    }

    private normalizeOptional(value: string): string | null {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private toDateInput(value: string | null): string {
        if (!value) {
            return '';
        }

        return value.slice(0, 10);
    }

    private isCurrentEnrollment(student: StudentResponse): boolean {
        const status = student.status.trim().toLowerCase();
        return status === 'active' || status === 'suspended';
    }
}
