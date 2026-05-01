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
    CreateLibraryBookCopyRequest,
    CreateLibraryBookRequest,
    LibraryBookCopyResponse,
    LibraryBookResponse,
    SchoolResponse,
    UpdateLibraryBookCopyRequest,
    UpdateLibraryBookRequest
} from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type BookDraft = {
    id?: number;
    title: string;
    author: string;
    isbn: string;
    accessionNumber: string;
    publisher: string;
    category: string;
    subject: string;
    genre: string;
    edition: string;
    publicationYear: string;
    shelfLocation: string;
    condition: string;
    initialCopies: number;
    isActive: boolean;
};

type CopyDraft = {
    id?: number;
    accessionNumber: string;
    shelfLocation: string;
    condition: string;
    isActive: boolean;
};

@Component({
    standalone: true,
    selector: 'app-library-books',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Library</p>
                    <h1 class="text-3xl font-display font-bold m-0">Book catalog</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Enter titles, track copies, and keep the catalog clean.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-72" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="loadData()"></app-dropdown>
                    <button pButton type="button" label="Add book" icon="pi pi-plus" (click)="openCreateBook()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Books" [value]="books.length.toString()" delta="Catalog" hint="Titles" icon="pi pi-book" tone="blue"></app-metric-card>
                <app-metric-card label="Copies" [value]="totalCopies.toString()" delta="Stock" hint="Physical items" icon="pi pi-clone" tone="green"></app-metric-card>
                <app-metric-card label="Available" [value]="availableCopies.toString()" delta="Ready" hint="On shelf" icon="pi pi-check-circle" tone="purple"></app-metric-card>
                <app-metric-card label="Inactive" [value]="inactiveBooks.toString()" delta="Paused" hint="Not lendable" icon="pi pi-ban" tone="orange" direction="down"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Catalog</h2>
                        <p class="text-sm text-muted-color">Book-level details and entry counts.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ books.length }} title(s)</span>
                </div>
                <p-table [value]="books" [rows]="10" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Title</th>
                            <th>Author</th>
                            <th>ISBN</th>
                            <th>Access.</th>
                            <th>Category</th>
                            <th>Copies</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-book>
                        <tr
                            class="cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/60"
                            [class.opacity-60]="!book.isActive"
                            [class.bg-primary-50]="selectedBook?.id === book.id"
                            [class.dark:bg-primary-950]="selectedBook?.id === book.id"
                            (click)="openCopies(book)"
                            (keydown.enter)="openCopies(book)"
                            (keydown.space)="openCopies(book); $event.preventDefault()"
                            tabindex="0"
                            role="button"
                        >
                            <td>
                                <div class="font-semibold">{{ book.title }}</div>
                                <div class="text-xs text-muted-color">{{ book.isbn || 'No ISBN' }} - {{ book.publisher || 'No publisher' }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ book.author }}</td>
                            <td class="text-sm text-muted-color">{{ book.isbn || 'No ISBN' }}</td>
                            <td class="text-sm text-muted-color">{{ book.accessionNumber || 'No access.' }}</td>
                            <td class="text-sm text-muted-color">{{ book.category || book.subject || 'Not set' }}</td>
                            <td>
                                <div class="font-semibold">{{ book.availableCopies }}/{{ book.totalCopies }}</div>
                            </td>
                            <td>
                                <p-tag [value]="book.isActive ? 'Active' : 'Inactive'" [severity]="book.isActive ? 'success' : 'danger'"></p-tag>
                            </td>
                            <td class="text-sm text-muted-color">{{ book.updatedAt | date: 'mediumDate' }}</td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-clone" class="p-button-text p-button-sm" (click)="$event.stopPropagation(); openCopies(book)"></button>
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="$event.stopPropagation(); openEditBook(book)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="$event.stopPropagation(); deleteBook(book)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="bookDetailVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(72rem, 96vw)' }" [header]="selectedBook?.title ?? 'Book details'" appendTo="body" (onHide)="closeBookDetails()">
                <ng-container *ngIf="selectedBook">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Book details</p>
                            <p class="text-muted-color mt-2">Inspect the record, update details, or manage copies from here.</p>
                        </div>
                        <div class="flex flex-wrap justify-end gap-3">
                            <button pButton type="button" label="Edit book" icon="pi pi-pencil" severity="secondary" (click)="openEditBook(selectedBook)"></button>
                            <button pButton type="button" label="Add copy" icon="pi pi-plus" severity="secondary" (click)="openCreateCopy()"></button>
                            <button pButton type="button" label="Delete book" icon="pi pi-trash" severity="danger" (click)="deleteBook(selectedBook)"></button>
                        </div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Status</div>
                            <div class="font-semibold flex items-center gap-2">
                                <p-tag [value]="selectedBook.isActive ? 'Active' : 'Inactive'" [severity]="selectedBook.isActive ? 'success' : 'danger'"></p-tag>
                                <span>{{ selectedBook.isActive ? 'Available in catalog' : 'Not lendable' }}</span>
                            </div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Copies</div>
                            <div class="font-semibold">{{ selectedBook.availableCopies }}/{{ selectedBook.totalCopies }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">ISBN</div>
                            <div class="font-semibold">{{ selectedBook.isbn || 'None' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Accession</div>
                            <div class="font-semibold">{{ selectedBook.accessionNumber || 'None' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Publisher</div>
                            <div class="font-semibold">{{ selectedBook.publisher || 'Not set' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Category</div>
                            <div class="font-semibold">{{ selectedBook.category || 'Not set' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Subject / Genre</div>
                            <div class="font-semibold">{{ selectedBook.subject || 'None' }}<span *ngIf="selectedBook.genre"> · {{ selectedBook.genre }}</span></div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Edition / Year</div>
                            <div class="font-semibold">{{ selectedBook.edition || 'None' }}<span *ngIf="selectedBook.publicationYear"> · {{ selectedBook.publicationYear }}</span></div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Shelf location</div>
                            <div class="font-semibold">{{ selectedBook.shelfLocation || 'Not set' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-muted-color">Condition</div>
                            <div class="font-semibold">{{ selectedBook.condition || 'Not set' }}</div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <div class="flex items-center justify-between gap-4 mb-3">
                            <div>
                                <h3 class="text-lg font-display font-bold mb-1">Copies</h3>
                                <p class="text-sm text-muted-color">Manage the physical copies tied to this book.</p>
                            </div>
                            <span class="text-sm text-muted-color">{{ copies.length }} copy(ies)</span>
                        </div>
                        <p-table [value]="copies" [rows]="6" [paginator]="true" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Copy</th>
                                    <th>Location</th>
                                    <th>Condition</th>
                                    <th>Status</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-copy>
                                <tr class="hover:bg-surface-50 dark:hover:bg-surface-800/60">
                                    <td class="font-semibold">{{ copy.accessionNumber || ('Copy #' + copy.id) }}</td>
                                    <td>{{ copy.shelfLocation || 'Same as book' }}</td>
                                    <td>{{ copy.condition || 'Unknown' }}</td>
                                    <td><p-tag [value]="copy.status" [severity]="copy.status === 'Available' ? 'success' : copy.status === 'Issued' ? 'warning' : 'danger'"></p-tag></td>
                                    <td class="text-right">
                                        <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEditCopy(copy)"></button>
                                        <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteCopy(copy)"></button>
                                    </td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </ng-container>
            </p-dialog>

            <p-dialog [(visible)]="bookDialogVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(42rem, 96vw)' }" [header]="bookDialogMode === 'create' ? 'Add book' : 'Edit book'" appendTo="body">
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-semibold mb-2">Title</label>
                        <input pInputText [(ngModel)]="bookDraft.title" class="w-full" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-semibold mb-2">Author</label>
                        <input pInputText [(ngModel)]="bookDraft.author" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">ISBN</label>
                        <input pInputText [(ngModel)]="bookDraft.isbn" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Accession number</label>
                        <input pInputText [(ngModel)]="bookDraft.accessionNumber" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Publisher</label>
                        <input pInputText [(ngModel)]="bookDraft.publisher" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Category</label>
                        <input pInputText [(ngModel)]="bookDraft.category" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Subject</label>
                        <input pInputText [(ngModel)]="bookDraft.subject" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Genre</label>
                        <input pInputText [(ngModel)]="bookDraft.genre" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Edition</label>
                        <input pInputText [(ngModel)]="bookDraft.edition" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Publication year</label>
                        <input pInputText type="number" [(ngModel)]="bookDraft.publicationYear" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Shelf location</label>
                        <input pInputText [(ngModel)]="bookDraft.shelfLocation" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Condition</label>
                        <input pInputText [(ngModel)]="bookDraft.condition" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Initial copies</label>
                        <input pInputText type="number" [(ngModel)]="bookDraft.initialCopies" class="w-full" />
                    </div>
                    <div class="flex items-center gap-3 pt-8">
                        <input type="checkbox" [(ngModel)]="bookDraft.isActive" />
                        <label class="text-sm font-medium">{{ bookDraft.isActive ? 'Active' : 'Inactive' }}</label>
                    </div>
                </div>
                <div class="flex justify-end gap-3 pt-6">
                    <button pButton type="button" label="Cancel" severity="secondary" (click)="bookDialogVisible = false"></button>
                    <button pButton type="button" [label]="bookDialogMode === 'create' ? 'Save book' : 'Update book'" icon="pi pi-check" (click)="saveBook()"></button>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="copyDialogVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="copyDialogMode === 'create' ? 'Add copy' : 'Edit copy'" appendTo="body">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">Accession number</label>
                        <input pInputText [(ngModel)]="copyDraft.accessionNumber" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Shelf location</label>
                        <input pInputText [(ngModel)]="copyDraft.shelfLocation" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Condition</label>
                        <input pInputText [(ngModel)]="copyDraft.condition" class="w-full" />
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" [(ngModel)]="copyDraft.isActive" />
                        <label class="text-sm font-medium">{{ copyDraft.isActive ? 'Active' : 'Inactive' }}</label>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="copyDialogVisible = false"></button>
                        <button pButton type="button" [label]="copyDialogMode === 'create' ? 'Save copy' : 'Update copy'" icon="pi pi-check" (click)="saveCopy()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class LibraryBooks implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = null;
    books: LibraryBookResponse[] = [];
    copies: LibraryBookCopyResponse[] = [];
    selectedBook: LibraryBookResponse | null = null;
    bookDetailVisible = false;
    bookDialogVisible = false;
    bookDialogMode: 'create' | 'edit' = 'create';
    copyDialogVisible = false;
    copyDialogMode: 'create' | 'edit' = 'create';
    bookDraft: BookDraft = this.blankBook();
    copyDraft: CopyDraft = this.blankCopy();

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get totalCopies(): number {
        return this.books.reduce((sum, book) => sum + book.totalCopies, 0);
    }

    get availableCopies(): number {
        return this.books.reduce((sum, book) => sum + book.availableCopies, 0);
    }

    get inactiveBooks(): number {
        return this.books.filter((book) => !book.isActive).length;
    }

    ngOnInit(): void {
        const focusId = Number(new URLSearchParams(window.location.search).get('focus') ?? '');
        if (this.isPlatformAdmin) {
            this.auth.loadSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    this.selectedSchoolId = this.selectedSchoolId ?? schools[0]?.id ?? null;
                    this.loadData(focusId);
                }
            });
            return;
        }

        this.selectedSchoolId = this.auth.schoolId();
        this.loadData(focusId);
    }

    loadData(focusBookId?: number): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        this.api.getLibraryBooks(schoolId).subscribe({
            next: (books) => {
                this.books = books;
                if (focusBookId) {
                    const target = books.find((book) => book.id === focusBookId);
                    if (target) {
                        this.openCopies(target);
                    }
                } else if (this.selectedBook) {
                    const target = books.find((book) => book.id === this.selectedBook?.id) ?? null;
                    if (target) {
                        this.selectedBook = target;
                        this.loadCopies(target.id);
                    }
                }
            }
        });
    }

    openCreateBook(): void {
        this.bookDialogMode = 'create';
        this.bookDraft = this.blankBook();
        this.bookDialogVisible = true;
    }

    openEditBook(book: LibraryBookResponse): void {
        this.bookDialogMode = 'edit';
        this.bookDraft = {
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn ?? '',
            accessionNumber: book.accessionNumber ?? '',
            publisher: book.publisher ?? '',
            category: book.category ?? '',
            subject: book.subject ?? '',
            genre: book.genre ?? '',
            edition: book.edition ?? '',
            publicationYear: book.publicationYear?.toString() ?? '',
            shelfLocation: book.shelfLocation ?? '',
            condition: book.condition ?? '',
            initialCopies: book.totalCopies || 1,
            isActive: book.isActive
        };
        this.bookDialogVisible = true;
    }

    saveBook(): void {
        if (!this.bookDraft.title.trim() || !this.bookDraft.author.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Title and author are required.' });
            return;
        }

        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        if (this.isPlatformAdmin && !schoolId) {
            this.messages.add({ severity: 'warn', summary: 'School required', detail: 'Choose a school before saving a book.' });
            return;
        }

        const request: CreateLibraryBookRequest | UpdateLibraryBookRequest = {
            title: this.bookDraft.title.trim(),
            author: this.bookDraft.author.trim(),
            isbn: this.bookDraft.isbn.trim() || null,
            accessionNumber: this.bookDraft.accessionNumber.trim() || null,
            publisher: this.bookDraft.publisher.trim() || null,
            category: this.bookDraft.category.trim() || null,
            subject: this.bookDraft.subject.trim() || null,
            genre: this.bookDraft.genre.trim() || null,
            edition: this.bookDraft.edition.trim() || null,
            publicationYear: this.bookDraft.publicationYear ? Number(this.bookDraft.publicationYear) : null,
            shelfLocation: this.bookDraft.shelfLocation.trim() || null,
            condition: this.bookDraft.condition.trim() || null,
            initialCopies: Math.max(1, Number(this.bookDraft.initialCopies) || 1),
            isActive: this.bookDraft.isActive
        };

        const request$ = this.bookDialogMode === 'create'
            ? this.api.createLibraryBook(request as CreateLibraryBookRequest, schoolId)
            : this.api.updateLibraryBook(this.bookDraft.id!, request as UpdateLibraryBookRequest);

        request$.subscribe({
            next: (saved) => {
                this.messages.add({ severity: 'success', summary: 'Book saved', detail: saved.title });
                this.bookDialogVisible = false;
                this.selectedBook = saved;
                this.loadData(saved.id);
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save the book.') });
            }
        });
    }

    deleteBook(book: LibraryBookResponse): void {
        this.confirmation.confirm({
            message: `Delete ${book.title}?`,
            header: 'Delete book',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.api.deleteLibraryBook(book.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Book deleted', detail: book.title });
                        if (this.selectedBook?.id === book.id) {
                            this.closeBookDetails();
                        }
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete the book.') });
                    }
                });
            }
        });
    }

    openCopies(book: LibraryBookResponse): void {
        this.selectedBook = book;
        this.bookDetailVisible = true;
        this.loadCopies(book.id);
    }

    closeBookDetails(): void {
        this.bookDetailVisible = false;
        this.selectedBook = null;
        this.copies = [];
    }

    loadCopies(bookId: number): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        this.api.getLibraryCopies(bookId, schoolId).subscribe({
            next: (copies) => {
                this.copies = copies;
            }
        });
    }

    openCreateCopy(): void {
        this.copyDialogMode = 'create';
        this.copyDraft = this.blankCopy();
        this.copyDialogVisible = true;
    }

    openEditCopy(copy: LibraryBookCopyResponse): void {
        this.copyDialogMode = 'edit';
        this.copyDraft = {
            id: copy.id,
            accessionNumber: copy.accessionNumber ?? '',
            shelfLocation: copy.shelfLocation ?? '',
            condition: copy.condition ?? '',
            isActive: copy.isActive
        };
        this.copyDialogVisible = true;
    }

    saveCopy(): void {
        if (!this.selectedBook) {
            return;
        }

        const request: CreateLibraryBookCopyRequest | UpdateLibraryBookCopyRequest = {
            accessionNumber: this.copyDraft.accessionNumber.trim() || null,
            shelfLocation: this.copyDraft.shelfLocation.trim() || null,
            condition: this.copyDraft.condition.trim() || null,
            isActive: this.copyDraft.isActive
        };

        const request$ = this.copyDialogMode === 'create'
            ? this.api.addLibraryCopy(this.selectedBook.id, request as CreateLibraryBookCopyRequest)
            : this.api.updateLibraryCopy(this.copyDraft.id!, request as UpdateLibraryBookCopyRequest);

        request$.subscribe({
            next: () => {
                this.copyDialogVisible = false;
                this.loadData(this.selectedBook?.id);
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save the copy.') });
            }
        });
    }

    deleteCopy(copy: LibraryBookCopyResponse): void {
        this.confirmation.confirm({
            message: `Delete copy ${copy.accessionNumber || copy.id}?`,
            header: 'Delete copy',
            accept: () => {
                this.api.deleteLibraryCopy(copy.id).subscribe({
                    next: () => {
                        this.loadData(this.selectedBook?.id);
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete the copy.') });
                    }
                });
            }
        });
    }

    private blankBook(): BookDraft {
        return {
            title: '',
            author: '',
            isbn: '',
            accessionNumber: '',
            publisher: '',
            category: '',
            subject: '',
            genre: '',
            edition: '',
            publicationYear: '',
            shelfLocation: '',
            condition: '',
            initialCopies: 1,
            isActive: true
        };
    }

    private blankCopy(): CopyDraft {
        return {
            accessionNumber: '',
            shelfLocation: '',
            condition: '',
            isActive: true
        };
    }
}
