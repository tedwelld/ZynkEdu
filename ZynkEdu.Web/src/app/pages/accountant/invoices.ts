import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeeStructureResponse, StudentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { buildFeeStructuresPdf } from '../../shared/report/report-pdf';

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
                        <button class="rounded-xl bg-primary text-white px-4 py-3 font-semibold" type="button" (click)="exportFeeStructuresPdf()" [disabled]="filteredFeeStructures.length === 0">
                            Export filtered PDF
                        </button>
                    </div>
                </div>

                <div class="mt-5 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <button *ngFor="let fee of filteredFeeStructures" type="button" class="text-left rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 hover:border-primary transition" (click)="applyFee(fee)">
                        <div class="font-semibold">{{ fee.gradeLevel }} · {{ fee.term }}</div>
                        <div class="text-sm text-muted-color">{{ fee.amount | number:'1.0-2' }}</div>
                        <div class="text-xs text-muted-color mt-1">{{ fee.description || 'No description provided' }}</div>
                    </button>
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

    students: StudentResponse[] = [];
    feeStructures: FeeStructureResponse[] = [];
    feeSearch = '';
    draft = {
        studentId: null as number | null,
        term: '',
        totalAmount: 0,
        dueAt: '',
        reference: '',
        description: ''
    };

    readonly termOptions: TermOption[] = [
        { label: 'Term 1', value: 'Term 1' },
        { label: 'Term 2', value: 'Term 2' },
        { label: 'Term 3', value: 'Term 3' }
    ];

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
        buildFeeStructuresPdf(this.schoolLabel, new Date(), this.filteredFeeStructures, `fee-structures-${this.fileStamp()}.pdf`);
    }

    submitInvoice(): void {
        if (!this.draft.studentId || !this.draft.term || !this.draft.dueAt) {
            return;
        }

        this.api.postInvoice(
            {
                studentId: this.draft.studentId,
                term: this.draft.term,
                totalAmount: this.draft.totalAmount,
                dueAt: new Date(this.draft.dueAt).toISOString(),
                reference: this.draft.reference || null,
                description: this.draft.description || null
            },
            this.auth.schoolId()
        ).subscribe(() => {
            this.draft.reference = '';
            this.draft.description = '';
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

    private get schoolLabel(): string {
        return this.auth.schoolId() ? `School ${this.auth.schoolId()}` : 'All schools';
    }

    private fileStamp(): string {
        return new Date().toISOString().slice(0, 10);
    }
}
