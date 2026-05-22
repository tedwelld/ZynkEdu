import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AcademicTermResponse, FeeStructureResponse, SchoolResponse, StudentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { InvoicePdfData, ReportSchoolInfo, buildFeeStructuresPdf, buildInvoicePdf } from '../../shared/report/report-pdf';

type TermOption = {
    label: string;
    value: string;
};

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, AppDropdownComponent],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">Billing</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Invoices</h1>
                <p class="text-muted-color mt-2">Generate term invoices for a single student using the configured fee structures.</p>
            </header>

            <section class="workspace-card p-6">
                <form class="grid gap-4 md:grid-cols-4 items-end" (ngSubmit)="submitInvoice()">
                    <label class="block">
                        <span class="text-sm text-muted-color">Student</span>
                        <app-dropdown
                            [options]="studentOptions"
                            [(ngModel)]="draft.studentId"
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
                        <span class="text-sm text-muted-color">Term</span>
                        <app-dropdown
                            [options]="termOptions"
                            [(ngModel)]="draft.term"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full mt-2"
                            appendTo="body"
                            [filter]="false"
                            [showClear]="false"
                        ></app-dropdown>
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Amount</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="number" [(ngModel)]="draft.totalAmount" name="totalAmount" />
                    </label>

                    <label class="block">
                        <span class="text-sm text-muted-color">Due date</span>
                        <input class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" type="date" [(ngModel)]="draft.dueAt" name="dueAt" />
                    </label>

                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Reference" [(ngModel)]="draft.reference" name="reference" />
                    <input class="md:col-span-2 rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Description" [(ngModel)]="draft.description" name="description" />
                    <button class="rounded-xl bg-primary text-white px-4 py-3 font-semibold md:col-span-4" type="submit">Issue invoice</button>
                </form>
            </section>

            <section class="workspace-card p-6">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold mb-2">Fee structures</h2>
                        <p class="text-sm text-muted-color">Search the fee structures below, then export the filtered results as a PDF.</p>
                    </div>
                    <div class="grid gap-3 md:grid-cols-[minmax(16rem,24rem)_auto] items-end w-full lg:w-auto">
                        <label class="block">
                            <span class="text-sm text-muted-color">Search fees</span>
                            <input
                                class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2"
                                [(ngModel)]="feeSearch"
                                name="feeSearch"
                                placeholder="Grade, term, amount, or description"
                            />
                        </label>
                        <div class="flex flex-col gap-2">
                            <button class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="button" (click)="exportFeeStructuresPdf()" [disabled]="filteredFeeStructures.length === 0">
                                Export filtered PDF
                            </button>
                            <button class="rounded-xl border border-surface-300 px-4 py-3 font-semibold" type="button" (click)="sendFeeNewsletterToAdmin()" [disabled]="filteredFeeStructures.length === 0 || sendingNewsletter">
                                Send newsletter to admin
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-5 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">Grade level</th>
                                <th class="py-3 pr-4">Term</th>
                                <th class="py-3 pr-4">Amount</th>
                                <th class="py-3 pr-4">Description</th>
                                <th class="py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                *ngFor="let fee of filteredFeeStructures"
                                class="border-t border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-900/40 cursor-pointer"
                                (click)="applyFee(fee)"
                            >
                                <td class="py-3 pr-4 font-medium">{{ fee.gradeLevel }}</td>
                                <td class="py-3 pr-4">{{ fee.term }}</td>
                                <td class="py-3 pr-4">{{ fee.amount | number:'1.0-2' }}</td>
                                <td class="py-3 pr-4 text-muted-color">{{ fee.description || '—' }}</td>
                                <td class="py-3">
                                    <button type="button" class="text-primary text-xs font-semibold hover:underline" (click)="$event.stopPropagation(); applyFee(fee)">Apply</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div *ngIf="filteredFeeStructures.length === 0" class="mt-5 rounded-2xl border border-dashed border-surface-300 px-4 py-6 text-sm text-muted-color">
                    No fee structures match the current search.
                </div>
            </section>
        </section>
    `
})
export class AccountantInvoices implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    schools: SchoolResponse[] = [];
    terms: AcademicTermResponse[] = [];
    students: StudentResponse[] = [];
    feeStructures: FeeStructureResponse[] = [];
    feeSearch = '';
    sendingNewsletter = false;
    draft = {
        studentId: null as number | null,
        term: '',
        totalAmount: 0,
        dueAt: '',
        reference: '',
        description: ''
    };

    get termOptions(): TermOption[] {
        if (this.terms.length > 0) {
            return [...this.terms]
                .sort((a, b) => a.termNumber - b.termNumber)
                .map(t => ({ label: t.name, value: t.name }));
        }
        return [
            { label: 'Term 1', value: 'Term 1' },
            { label: 'Term 2', value: 'Term 2' },
            { label: 'Term 3', value: 'Term 3' }
        ];
    }

    get studentOptions(): { label: string; value: number }[] {
        return this.students.map((student) => ({
            label: `${student.fullName} · ${student.studentNumber} · ${student.class}`,
            value: student.id
        }));
    }

    get filteredFeeStructures(): FeeStructureResponse[] {
        const term = this.feeSearch.trim().toLowerCase();
        if (!term) {
            return this.feeStructures;
        }

        return this.feeStructures.filter((fee) => {
            return [fee.gradeLevel, fee.term, fee.amount.toFixed(2), fee.description ?? '']
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }

    ngOnInit(): void {
        const schoolId = this.auth.schoolId();
        this.api.getSchools().subscribe({ next: s => this.schools = s });
        this.api.getAcademicTerms(schoolId).subscribe({ next: terms => {
            this.terms = terms;
            if (!this.draft.term && terms.length > 0) {
                this.draft.term = [...terms].sort((a, b) => a.termNumber - b.termNumber)[0].name;
            }
        }});
        this.api.getStudents(undefined, schoolId).subscribe((students) => {
            this.students = students;
            this.draft.studentId = students[0]?.id ?? null;
        });
        this.api.getFeeStructures(schoolId).subscribe((fees) => (this.feeStructures = fees));
        this.draft.term = this.termOptions[0]?.value ?? '';
    }

    applyFee(fee: FeeStructureResponse): void {
        this.draft.term = this.normalizeTerm(fee.term);
        this.draft.totalAmount = fee.amount;
    }

    exportFeeStructuresPdf(): void {
        buildFeeStructuresPdf(this.schoolInfo, new Date(), this.filteredFeeStructures, 'fee-structures.pdf');
    }

    sendFeeNewsletterToAdmin(): void {
        if (this.filteredFeeStructures.length === 0) {
            return;
        }

        this.sendingNewsletter = true;
        try {
            const pdf = buildFeeStructuresPdf(this.schoolInfo, new Date(), this.filteredFeeStructures, undefined, false);
            const blob = pdf.output('blob');
            this.api.sendFeeStructureNewsletter(
                { note: 'Attached is the current fee structure newsletter and payment method guide.' },
                blob,
                this.auth.schoolId()
            ).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Newsletter sent', detail: 'The fee structure newsletter was sent to the school admin.' });
                    this.sendingNewsletter = false;
                },
                error: () => {
                    this.messages.add({ severity: 'error', summary: 'Send failed', detail: 'The fee structure newsletter could not be sent.' });
                    this.sendingNewsletter = false;
                }
            });
        } catch {
            this.sendingNewsletter = false;
            this.messages.add({ severity: 'error', summary: 'Send failed', detail: 'The fee structure newsletter could not be created.' });
        }
    }

    submitInvoice(): void {
        if (!this.draft.studentId || !this.draft.term || !this.draft.dueAt) {
            return;
        }

        const studentId = this.draft.studentId;
        const schoolId = this.auth.schoolId();
        const invoicePayload = {
            studentId,
            term: this.draft.term,
            totalAmount: this.draft.totalAmount,
            dueAt: new Date(this.draft.dueAt).toISOString(),
            reference: this.draft.reference || null,
            description: this.draft.description || null
        };

        this.api.postInvoice(invoicePayload, schoolId).subscribe({
            next: (transaction) => {
                this.draft.reference = '';
                this.draft.description = '';
                this.messages.add({ severity: 'success', summary: 'Invoice issued', detail: 'The invoice has been created.' });
                this.sendInvoicePdfToParent(transaction.id, studentId, invoicePayload, transaction.transactionDate, schoolId);
            },
            error: () => {
                this.messages.add({ severity: 'error', summary: 'Invoice failed', detail: 'The invoice could not be created.' });
            }
        });
    }

    private sendInvoicePdfToParent(
        transactionId: number,
        studentId: number,
        payload: { term: string; totalAmount: number; dueAt: string; reference: string | null; description: string | null },
        transactionDate: string,
        schoolId: number | null
    ): void {
        this.api.getStudentInvoices(studentId, schoolId).subscribe({
            next: (invoices) => {
                const invoice = invoices.find(i => i.accountingTransactionId === transactionId)
                    ?? invoices.at(-1);

                if (!invoice) return;

                const student = this.students.find(s => s.id === studentId);
                const pdfData: InvoicePdfData = {
                    invoiceId: invoice.id,
                    studentName: invoice.studentName,
                    studentNumber: invoice.studentNumber,
                    studentClass: invoice.studentClass,
                    term: invoice.term,
                    amount: invoice.totalAmount,
                    dueAt: invoice.dueAt,
                    issuedAt: invoice.issuedAt,
                    reference: invoice.reference,
                    description: invoice.description,
                    status: invoice.status
                };

                try {
                    const pdfBlob = buildInvoicePdf(pdfData, this.schoolInfo);
                    this.api.sendInvoicePdf(invoice.id, pdfBlob, schoolId).subscribe({
                        next: () => {
                            const email = student?.parentEmail;
                            this.messages.add({
                                severity: 'info',
                                summary: 'PDF sent',
                                detail: email ? `Invoice PDF emailed to ${email}.` : 'Invoice PDF sent to parent email on record.'
                            });
                        },
                        error: () => {
                            this.messages.add({
                                severity: 'warn',
                                summary: 'PDF not sent',
                                detail: 'Invoice was created but the PDF could not be emailed. Check that a parent email is on file.'
                            });
                        }
                    });
                } catch {
                    // PDF build failure is non-critical; invoice was already created successfully
                }
            }
        });
    }

    private normalizeTerm(term: string): string {
        const trimmed = term.trim().toLowerCase();
        if (trimmed.includes('1')) {
            return 'Term 1';
        }
        if (trimmed.includes('2')) {
            return 'Term 2';
        }
        if (trimmed.includes('3')) {
            return 'Term 3';
        }
        return term;
    }

    private get schoolInfo(): ReportSchoolInfo {
        const id = this.auth.schoolId();
        const school = this.schools.find(s => s.id === id);
        return { name: school?.name ?? (id ? `School ${id}` : 'All schools'), address: school?.address ?? null };
    }
}
