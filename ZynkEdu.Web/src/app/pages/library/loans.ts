import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import {
    BorrowingEligibilityResponse,
    CreateFineRequest,
    IssueLibraryBookRequest,
    LibraryBookCopyResponse,
    LibraryBookResponse,
    LibraryBorrowerSummaryResponse,
    LibraryLoanResponse,
    SchoolResponse,
    RenewLibraryLoanRequest,
    ReturnLibraryBookRequest,
    StudentResponse,
    UserResponse
} from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { ReportSchoolInfo, buildLibraryBorrowersPdf, buildLibraryOverdueLoansPdf } from '../../shared/report/report-pdf';

type IssueDraft = {
    borrowerType: 'Student' | 'Teacher';
    borrowerId: number | null;
    bookCopyId: number | null;
    dueAt: string;
    notes: string;
};

type BorrowerSelection = StudentResponse | UserResponse | null;

@Component({
    standalone: true,
    selector: 'app-library-loans',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Library</p>
                    <h1 class="text-3xl font-display font-bold m-0">Loans and returns</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Issue books, renew them, and keep overdue items visible.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-72" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="loadData()"></app-dropdown>
                    <button pButton type="button" label="Issue book" icon="pi pi-plus" (click)="openIssue()"></button>
                    <button pButton type="button" label="Overdue items" icon="pi pi-exclamation-triangle" severity="danger" (click)="openOverdueModal()"></button>
                    <button pButton type="button" label="Borrowers" icon="pi pi-users" severity="success" (click)="openBorrowersModal()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="info" (click)="loadData()"></button>
                </div>
            </header>

            <section class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Active loans</h2>
                        <p class="text-sm text-muted-color">Current issues across the school.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ activeLoans.length }} open</span>
                </div>
                <p-table [value]="activeLoans" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Book</th>
                            <th>Borrower</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-loan>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ loan.bookTitle }}</div>
                                <div class="text-xs text-muted-color">{{ loan.copyAccessionNumber || 'Copy ' + loan.libraryBookCopyId }} - {{ loan.bookAuthor || 'Unknown author' }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ loan.borrowerDisplayName }}</td>
                            <td class="text-sm text-muted-color">{{ loan.dueAt | date: 'mediumDate' }}</td>
                            <td><p-tag [value]="loan.isOverdue ? 'Overdue' : 'Open'" [severity]="loan.isOverdue ? 'danger' : 'success'"></p-tag></td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-refresh" class="p-button-text p-button-sm" (click)="openRenew(loan)"></button>
                                <button pButton type="button" icon="pi pi-check" class="p-button-text p-button-sm" (click)="openReturn(loan)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </section>

            <p-dialog [(visible)]="overdueModalVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(80rem, 96vw)' }" appendTo="body" header="Overdue items" (onHide)="closeOverdueModal()">
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] items-end">
                        <label class="block">
                            <span class="text-sm font-semibold">Search overdue loans</span>
                            <input pInputText class="mt-2 w-full" [(ngModel)]="overdueSearch.term" name="overdueSearchTerm" placeholder="Search book, borrower, copy, author, or due date" />
                        </label>
                        <div class="flex gap-3 flex-wrap">
                            <button pButton type="button" label="Search" icon="pi pi-search" (click)="applyOverdueSearch()"></button>
                            <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="success" (click)="exportOverduePdf()"></button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-color">
                        <span>Showing {{ filteredOverdueLoans.length }} of {{ overdueLoans.length }} overdue loan(s)</span>
                        <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="clearOverdueSearch()">Clear search</button>
                    </div>

                    <div class="overflow-x-auto">
                        <p-table [value]="filteredOverdueLoans" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Book</th>
                                    <th>Borrower</th>
                                    <th>Due date</th>
                                    <th>Copy</th>
                                    <th>Author</th>
                                    <th>Status</th>
                                    <th>Fine</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-loan>
                                <tr>
                                    <td class="font-medium">{{ loan.bookTitle }}</td>
                                    <td>{{ loan.borrowerDisplayName }}</td>
                                    <td>{{ loan.dueAt | date:'mediumDate' }}</td>
                                    <td>{{ loan.copyAccessionNumber || 'Copy ' + loan.libraryBookCopyId }}</td>
                                    <td>{{ loan.bookAuthor || 'Unknown author' }}</td>
                                    <td><p-tag value="Overdue" severity="danger"></p-tag></td>
                                    <td>
                                        <ng-container *ngIf="loan.borrowerType === 'Student' && loan.borrowerId">
                                            <ng-container *ngIf="activeFineTargetId === loan.id; else fineBtn">
                                                <div class="flex items-center gap-2">
                                                    <input
                                                        class="w-20 rounded-lg border border-surface-300 bg-surface-0 px-2 py-1 text-sm"
                                                        type="number"
                                                        [(ngModel)]="inlineFineAmount"
                                                        name="inlineFineAmount"
                                                        min="0.01"
                                                        step="0.01" />
                                                    <button pButton type="button" icon="pi pi-check" class="p-button-sm p-button-success" (click)="submitLibraryFine(loan)"></button>
                                                    <button pButton type="button" icon="pi pi-times" class="p-button-sm p-button-text" (click)="activeFineTargetId = null"></button>
                                                </div>
                                            </ng-container>
                                            <ng-template #fineBtn>
                                                <button pButton type="button" icon="pi pi-exclamation-circle" label="Charge fine" class="p-button-sm p-button-warning p-button-text" (click)="openFineForm(loan)"></button>
                                            </ng-template>
                                        </ng-container>
                                        <span *ngIf="loan.borrowerType !== 'Student' || !loan.borrowerId" class="text-muted-color text-sm">—</span>
                                    </td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="borrowersModalVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(80rem, 96vw)' }" appendTo="body" header="Borrowers" (onHide)="closeBorrowersModal()">
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] items-end">
                        <label class="block">
                            <span class="text-sm font-semibold">Search borrowers</span>
                            <input pInputText class="mt-2 w-full" [(ngModel)]="borrowerSearch.term" name="borrowerSearchTerm" placeholder="Search name, reference, or type" />
                        </label>
                        <div class="flex gap-3 flex-wrap">
                            <button pButton type="button" label="Search" icon="pi pi-search" (click)="applyBorrowerSearch()"></button>
                            <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="success" (click)="exportBorrowersPdf()"></button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-color">
                        <span>Showing {{ filteredBorrowers.length }} of {{ borrowers.length }} borrower(s)</span>
                        <button class="rounded-xl border border-surface-300 px-4 py-2 font-semibold" type="button" (click)="clearBorrowerSearch()">Clear search</button>
                    </div>

                    <div class="overflow-x-auto">
                        <p-table [value]="filteredBorrowers" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Name</th>
                                    <th>Reference</th>
                                    <th>Type</th>
                                    <th>Open loans</th>
                                    <th>Overdue loans</th>
                                    <th>Outstanding balance</th>
                                    <th>Fees</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-borrower>
                                <tr>
                                    <td class="font-medium">{{ borrower.displayName }}</td>
                                    <td>{{ borrower.reference || 'No reference' }}</td>
                                    <td><p-tag [value]="borrower.borrowerType" severity="info"></p-tag></td>
                                    <td>{{ borrower.activeLoanCount }}</td>
                                    <td>{{ borrower.overdueLoanCount }}</td>
                                    <td>{{ borrower.borrowerType === 'Student' ? (borrower.outstandingBalance | number:'1.2-2') : '—' }}</td>
                                    <td>
                                        <p-tag *ngIf="borrower.borrowerType === 'Student' && borrower.hasOverdueInvoice" value="Overdue fees" severity="danger"></p-tag>
                                        <span *ngIf="borrower.borrowerType !== 'Student' || !borrower.hasOverdueInvoice" class="text-muted-color text-sm">—</span>
                                    </td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="issueVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(56rem, 96vw)' }" header="Issue book" appendTo="body">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Book copy</label>
                        <app-dropdown [options]="copyOptions" [(ngModel)]="issueDraft.bookCopyId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search books and copies"></app-dropdown>
                    </div>

                    <div *ngIf="selectedBookCopy" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4 bg-surface-0/70">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">Selected book</div>
                        <div class="mt-2 font-semibold text-lg">{{ selectedBookCopy.libraryBookTitle }}</div>
                        <div *ngIf="selectedBook" class="mt-1 text-sm text-muted-color">
                            {{ selectedBook.author }} - {{ selectedBook.isbn || 'No ISBN' }} - {{ selectedBook.publisher || 'No publisher' }}
                        </div>
                        <div class="mt-1 text-sm text-muted-color">
                            Copy {{ selectedBookCopy.accessionNumber || selectedBookCopy.id }} - {{ selectedBookCopy.status }} - {{ selectedBookCopy.condition || 'No condition recorded' }}
                        </div>
                        <div class="mt-1 text-sm text-muted-color">
                            Shelf {{ selectedBookCopy.shelfLocation || 'Not set' }} - {{ selectedBookCopy.isActive ? 'Active copy' : 'Inactive copy' }}
                        </div>
                        <div *ngIf="selectedBook" class="mt-1 text-sm text-muted-color">
                            {{ selectedBook.subject || 'No subject' }} - {{ selectedBook.genre || 'No genre' }} - {{ selectedBook.edition || 'No edition' }} - {{ selectedBook.publicationYear || 'No year' }}
                        </div>
                        <div *ngIf="selectedBook" class="mt-1 text-sm text-muted-color">
                            {{ selectedBook.availableCopies }}/{{ selectedBook.totalCopies }} copies available - {{ selectedBook.isActive ? 'Active title' : 'Inactive title' }}
                        </div>
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Borrower type</label>
                            <app-dropdown [options]="borrowerTypeOptions" [(ngModel)]="issueDraft.borrowerType" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (ngModelChange)="issueDraft.borrowerId = null; borrowingEligibility = null"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Borrower</label>
                            <app-dropdown [options]="borrowerOptions" [(ngModel)]="issueDraft.borrowerId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search borrower" (ngModelChange)="onBorrowerSelected()"></app-dropdown>
                        </div>
                    </div>

                    <div *ngIf="selectedBorrower" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4 bg-surface-0/70">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">Selected borrower</div>
                        <div class="mt-2 font-semibold text-lg">{{ selectedBorrowerName }}</div>
                        <div class="mt-1 text-sm text-muted-color">{{ borrowerSummary }}</div>
                        <div class="mt-1 text-sm text-muted-color">
                            Open loans {{ borrowerLoanSummary.open }} - Overdue {{ borrowerLoanSummary.overdue }}
                        </div>
                    </div>

                    <div *ngIf="borrowingEligibility && !borrowingEligibility.canBorrow" class="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 flex gap-3 items-start">
                        <i class="pi pi-ban text-red-600 mt-0.5"></i>
                        <div>
                            <div class="font-semibold text-red-700 dark:text-red-400">Borrowing blocked</div>
                            <div class="text-sm text-red-600 dark:text-red-300 mt-1">{{ borrowingEligibility.blockReason }}</div>
                            <div class="text-sm text-red-600 dark:text-red-300 mt-1">Outstanding balance: {{ borrowingEligibility.outstandingBalance | number:'1.2-2' }}</div>
                        </div>
                    </div>

                    <div *ngIf="borrowingEligibility && borrowingEligibility.canBorrow && borrowingEligibility.outstandingBalance > 0" class="rounded-2xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 p-4 flex gap-3 items-start">
                        <i class="pi pi-exclamation-triangle text-yellow-600 mt-0.5"></i>
                        <div>
                            <div class="font-semibold text-yellow-700 dark:text-yellow-400">Outstanding fees</div>
                            <div class="text-sm text-yellow-600 dark:text-yellow-300 mt-1">This student has an outstanding balance of {{ borrowingEligibility.outstandingBalance | number:'1.2-2' }} but no overdue invoices. Borrowing is permitted.</div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold mb-2">Due date</label>
                        <input pInputText type="date" [(ngModel)]="issueDraft.dueAt" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Notes</label>
                        <input pInputText [(ngModel)]="issueDraft.notes" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="warn" (click)="issueVisible = false"></button>
                        <button pButton type="button" label="Issue" icon="pi pi-check" [disabled]="issueBlocked" (click)="saveIssue()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="returnVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(30rem, 96vw)' }" header="Return book" appendTo="body">
                <div class="space-y-4">
                    <div class="text-sm text-muted-color">Return <span class="font-semibold">{{ selectedLoan?.bookTitle }}</span> for <span class="font-semibold">{{ selectedLoan?.borrowerDisplayName }}</span>.</div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Return notes</label>
                        <input pInputText [(ngModel)]="returnNotes" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="warn" (click)="returnVisible = false"></button>
                        <button pButton type="button" label="Return" icon="pi pi-check" (click)="saveReturn()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="renewVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(30rem, 96vw)' }" header="Renew loan" appendTo="body">
                <div class="space-y-4">
                    <div class="text-sm text-muted-color">Renew <span class="font-semibold">{{ selectedLoan?.bookTitle }}</span>.</div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">New due date</label>
                        <input pInputText type="date" [(ngModel)]="renewDueAt" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Renewal notes</label>
                        <input pInputText [(ngModel)]="renewNotes" class="w-full" />
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="warn" (click)="renewVisible = false"></button>
                        <button pButton type="button" label="Renew" icon="pi pi-check" (click)="saveRenew()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class LibraryLoans implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = null;
    books: LibraryBookResponse[] = [];
    copies: LibraryBookCopyResponse[] = [];
    activeLoans: LibraryLoanResponse[] = [];
    overdueLoans: LibraryLoanResponse[] = [];
    borrowers: LibraryBorrowerSummaryResponse[] = [];
    students: StudentResponse[] = [];
    teachers: UserResponse[] = [];
    issueVisible = false;
    returnVisible = false;
    renewVisible = false;
    overdueModalVisible = false;
    borrowersModalVisible = false;
    activeFineTargetId: number | null = null;
    inlineFineAmount = 1.00;
    selectedLoan: LibraryLoanResponse | null = null;
    returnNotes = '';
    renewDueAt = '';
    renewNotes = '';
    issueDraft: IssueDraft = this.blankIssueDraft();
    borrowingEligibility: BorrowingEligibilityResponse | null = null;
    overdueSearch = { term: '', appliedTerm: '' };
    borrowerSearch = { term: '', appliedTerm: '' };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get borrowerTypeOptions(): { label: string; value: 'Student' | 'Teacher' }[] {
        return [
            { label: 'Student', value: 'Student' },
            { label: 'Teacher', value: 'Teacher' }
        ];
    }

    get copyOptions(): { label: string; value: number }[] {
        return this.copies.map((copy) => {
            const book = this.bookForCopy(copy);
            const parts = [
                `Copy ${copy.accessionNumber || copy.id}`,
                copy.status,
                copy.condition || 'No condition',
                copy.shelfLocation || 'No shelf'
            ];

            if (book) {
                parts.splice(1, 0, book.author || 'Unknown author');
                if (book.isbn) {
                    parts.push(`ISBN ${book.isbn}`);
                }
                if (book.subject) {
                    parts.push(book.subject);
                }
                if (book.genre) {
                    parts.push(book.genre);
                }
            }

            return {
                label: `${copy.libraryBookTitle} - ${parts.join(' - ')}`,
                value: copy.id
            };
        });
    }

    get selectedBookCopy(): LibraryBookCopyResponse | null {
        if (!this.issueDraft.bookCopyId) {
            return null;
        }

        return this.copies.find((copy) => copy.id === this.issueDraft.bookCopyId) ?? null;
    }

    get selectedBook(): LibraryBookResponse | null {
        if (!this.selectedBookCopy) {
            return null;
        }

        return this.bookForCopy(this.selectedBookCopy);
    }

    get borrowerOptions(): { label: string; value: number }[] {
        return this.issueDraft.borrowerType === 'Teacher'
            ? this.teachers.map((teacher) => ({
                  label: `${teacher.displayName} - ${teacher.username} - ${teacher.contactEmail || 'No email'} - ${teacher.isActive ? 'Active' : 'Inactive'}`,
                  value: teacher.id
              }))
            : this.students.map((student) => ({
                  label: `${student.fullName} - ${student.studentNumber} - ${student.class} - ${student.level} - ${student.parentPhone || 'No phone'}`,
                  value: student.id
              }));
    }

    get selectedBorrower(): BorrowerSelection {
        if (!this.issueDraft.borrowerId) {
            return null;
        }

        if (this.issueDraft.borrowerType === 'Teacher') {
            return this.teachers.find((teacher) => teacher.id === this.issueDraft.borrowerId) ?? null;
        }

        return this.students.find((student) => student.id === this.issueDraft.borrowerId) ?? null;
    }

    get selectedBorrowerName(): string {
        if (!this.selectedBorrower) {
            return '';
        }

        return 'fullName' in this.selectedBorrower ? this.selectedBorrower.fullName : this.selectedBorrower.displayName;
    }

    get borrowerSummary(): string {
        if (!this.selectedBorrower) {
            return '';
        }

        if (this.issueDraft.borrowerType === 'Teacher') {
            const teacher = this.selectedBorrower as UserResponse;
            return [
                `Username ${teacher.username}`,
                `Email ${teacher.contactEmail || 'No email'}`,
                `Role ${teacher.role}`,
                `School ${teacher.schoolId}`,
                teacher.isActive ? 'Active' : 'Inactive',
                `Created ${new Date(teacher.createdAt).toLocaleDateString()}`
            ].join(' - ');
        }

        const student = this.selectedBorrower as StudentResponse;
        return [
            `Student no. ${student.studentNumber}`,
            `Class ${student.class}`,
            `Level ${student.level}`,
            `Status ${student.status}`,
            `Year ${student.enrollmentYear}`,
            `Parent ${student.parentPhone || 'No phone'}`,
            `Email ${student.parentEmail || 'No email'}`
        ].join(' - ');
    }

    get borrowerLoanSummary(): { open: number; overdue: number } {
        if (!this.selectedBorrower) {
            return { open: 0, overdue: 0 };
        }

        const entry = this.borrowers.find((item) => item.borrowerId === this.issueDraft.borrowerId && item.borrowerType === this.issueDraft.borrowerType);
        return {
            open: entry?.activeLoanCount ?? 0,
            overdue: entry?.overdueLoanCount ?? 0
        };
    }

    get filteredOverdueLoans(): LibraryLoanResponse[] {
        const term = this.overdueSearch.appliedTerm.trim().toLowerCase();
        if (!term) {
            return this.overdueLoans;
        }

        return this.overdueLoans.filter((loan) =>
            [loan.bookTitle, loan.borrowerDisplayName, loan.copyAccessionNumber || '', `Copy ${loan.libraryBookCopyId}`, loan.bookAuthor || '', loan.dueAt]
                .join(' ')
                .toLowerCase()
                .includes(term)
        );
    }

    get filteredBorrowers(): LibraryBorrowerSummaryResponse[] {
        const term = this.borrowerSearch.appliedTerm.trim().toLowerCase();
        if (!term) {
            return this.borrowers;
        }

        return this.borrowers.filter((borrower) =>
            [borrower.displayName, borrower.reference || '', borrower.borrowerType, borrower.activeLoanCount.toString(), borrower.overdueLoanCount.toString()]
                .join(' ')
                .toLowerCase()
                .includes(term)
        );
    }

    ngOnInit(): void {
        if (this.isPlatformAdmin) {
            this.auth.loadSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    this.selectedSchoolId = this.selectedSchoolId ?? schools[0]?.id ?? null;
                    this.loadData();
                }
            });
            return;
        }

        this.selectedSchoolId = this.auth.schoolId();
        this.loadData();
    }

    loadData(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        forkJoin({
            books: this.api.getLibraryBooks(schoolId),
            loans: this.api.getLibraryLoans(schoolId, true),
            overdueLoans: this.api.getLibraryOverdueLoans(schoolId),
            borrowers: this.api.getLibraryBorrowers(schoolId),
            students: this.api.getStudents(undefined, schoolId ?? null),
            teachers: this.api.getTeachers(schoolId)
        }).subscribe({
            next: ({ books, loans, overdueLoans, borrowers, students, teachers }) => {
                this.books = books;
                this.activeLoans = loans;
                this.overdueLoans = overdueLoans;
                this.borrowers = borrowers;
                this.students = students;
                this.teachers = teachers;
                this.refreshCopies(schoolId);
            }
        });
    }

    refreshCopies(schoolId?: number | null): void {
        const requests = this.books.map((book) => this.api.getLibraryCopies(book.id, schoolId));
        if (requests.length === 0) {
            this.copies = [];
            return;
        }

        forkJoin(requests).subscribe({
            next: (copySets) => {
                this.copies = copySets.flat();
            }
        });
    }

    get issueBlocked(): boolean {
        return this.borrowingEligibility !== null && !this.borrowingEligibility.canBorrow;
    }

    onBorrowerSelected(): void {
        this.borrowingEligibility = null;
        if (this.issueDraft.borrowerType !== 'Student' || !this.issueDraft.borrowerId) {
            return;
        }

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        this.api.getBorrowingEligibility('Student', this.issueDraft.borrowerId, schoolId).subscribe({
            next: (eligibility) => {
                this.borrowingEligibility = eligibility;
            }
        });
    }

    openIssue(): void {
        this.issueDraft = this.blankIssueDraft();
        this.borrowingEligibility = null;
        this.issueVisible = true;
    }

    openOverdueModal(): void {
        this.overdueModalVisible = true;
        this.overdueSearch.appliedTerm = this.overdueSearch.term;
    }

    closeOverdueModal(): void {
        this.overdueModalVisible = false;
        this.activeFineTargetId = null;
    }

    openFineForm(loan: LibraryLoanResponse): void {
        this.activeFineTargetId = loan.id;
        this.inlineFineAmount = 1.00;
    }

    submitLibraryFine(loan: LibraryLoanResponse): void {
        if (!loan.borrowerId || this.inlineFineAmount <= 0) {
            return;
        }
        const schoolId = this.selectedSchoolId ?? this.auth.schoolId();
        const request: CreateFineRequest = {
            studentId: loan.borrowerId,
            amount: this.inlineFineAmount,
            reference: `Library Fine — ${loan.bookTitle}`,
            description: 'Overdue book fine'
        };
        this.api.postFine(request, schoolId).subscribe({
            next: () => {
                this.activeFineTargetId = null;
                this.inlineFineAmount = 1.00;
            },
            error: (err) => {
                this.messages.add({ severity: 'error', summary: 'Fine failed', detail: extractApiErrorMessage(err, 'Could not charge the fine.') });
            }
        });
    }

    openBorrowersModal(): void {
        this.borrowersModalVisible = true;
        this.borrowerSearch.appliedTerm = this.borrowerSearch.term;
    }

    closeBorrowersModal(): void {
        this.borrowersModalVisible = false;
    }

    applyOverdueSearch(): void {
        this.overdueSearch.appliedTerm = this.overdueSearch.term;
    }

    clearOverdueSearch(): void {
        this.overdueSearch = { term: '', appliedTerm: '' };
    }

    applyBorrowerSearch(): void {
        this.borrowerSearch.appliedTerm = this.borrowerSearch.term;
    }

    clearBorrowerSearch(): void {
        this.borrowerSearch = { term: '', appliedTerm: '' };
    }

    exportOverduePdf(): void {
        buildLibraryOverdueLoansPdf(this.schoolInfo, new Date(), this.filteredOverdueLoans, 'library-overdue-loans.pdf');
    }

    exportBorrowersPdf(): void {
        buildLibraryBorrowersPdf(this.schoolInfo, new Date(), this.filteredBorrowers, 'library-borrowers.pdf');
    }

    saveIssue(): void {
        if (!this.issueDraft.bookCopyId || !this.issueDraft.borrowerId || !this.issueDraft.dueAt) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a copy, borrower, and due date.' });
            return;
        }

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        if (this.isPlatformAdmin && !schoolId) {
            this.messages.add({ severity: 'warn', summary: 'School required', detail: 'Choose a school before issuing a book.' });
            return;
        }

        const request: IssueLibraryBookRequest = {
            borrowerType: this.issueDraft.borrowerType,
            borrowerId: this.issueDraft.borrowerId,
            bookCopyId: this.issueDraft.bookCopyId,
            dueAt: new Date(this.issueDraft.dueAt).toISOString(),
            notes: this.issueDraft.notes.trim() || null
        };

        this.api.issueLibraryBook(request, schoolId).subscribe({
            next: () => {
                this.issueVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Issue failed', detail: extractApiErrorMessage(error, 'Could not issue the book.') });
            }
        });
    }

    openReturn(loan: LibraryLoanResponse): void {
        this.selectedLoan = loan;
        this.returnNotes = '';
        this.returnVisible = true;
    }

    saveReturn(): void {
        if (!this.selectedLoan) {
            return;
        }

        const request: ReturnLibraryBookRequest = {
            notes: this.returnNotes.trim() || null
        };

        this.api.returnLibraryBook(this.selectedLoan.id, request).subscribe({
            next: () => {
                this.returnVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Return failed', detail: extractApiErrorMessage(error, 'Could not return the book.') });
            }
        });
    }

    openRenew(loan: LibraryLoanResponse): void {
        this.selectedLoan = loan;
        this.renewDueAt = new Date(new Date(loan.dueAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        this.renewNotes = '';
        this.renewVisible = true;
    }

    saveRenew(): void {
        if (!this.selectedLoan || !this.renewDueAt) {
            return;
        }

        const request: RenewLibraryLoanRequest = {
            dueAt: new Date(this.renewDueAt).toISOString(),
            notes: this.renewNotes.trim() || null
        };

        this.api.renewLibraryLoan(this.selectedLoan.id, request).subscribe({
            next: () => {
                this.renewVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Renew failed', detail: extractApiErrorMessage(error, 'Could not renew the loan.') });
            }
        });
    }

    private bookForCopy(copy: LibraryBookCopyResponse): LibraryBookResponse | null {
        return this.books.find((book) => book.id === copy.libraryBookId) ?? null;
    }

    private blankIssueDraft(): IssueDraft {
        return {
            borrowerType: 'Student',
            borrowerId: null,
            bookCopyId: null,
            dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            notes: ''
        };
    }

    private get schoolInfo(): ReportSchoolInfo {
        const id = this.auth.schoolId();
        const school = this.schools.find(s => s.id === id);
        return { name: school?.name ?? (id ? `School ${id}` : 'All schools'), address: school?.address ?? null };
    }
}
