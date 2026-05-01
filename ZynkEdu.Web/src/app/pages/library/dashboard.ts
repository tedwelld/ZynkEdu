import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryBookResponse, LibraryDashboardResponse, LibraryLoanResponse, SchoolResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

@Component({
    standalone: true,
    selector: 'app-library-dashboard',
    imports: [CommonModule, FormsModule, ButtonModule, AppDropdownComponent, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Library</p>
                    <h1 class="text-3xl font-display font-bold m-0">Library control center</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Track stock, loans, and overdue items from one place.</p>
                </div>
                <div class="flex gap-3 items-center">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-72" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="loadData()"></app-dropdown>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-6 xl:grid-cols-2">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Recent books</h2>
                            <p class="text-sm text-muted-color">Newest catalog entries in the selected school.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ books.length }} total</span>
                    </div>
                    <div class="space-y-3">
                        <div *ngFor="let book of books.slice(0, 6)" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4 flex items-center justify-between gap-4">
                            <div>
                                <div class="font-semibold">{{ book.title }}</div>
                                <div class="text-xs text-muted-color">{{ book.author }} - {{ book.availableCopies }}/{{ book.totalCopies }} available</div>
                            </div>
                            <p-tag [value]="book.isActive ? 'Active' : 'Inactive'" [severity]="book.isActive ? 'success' : 'danger'"></p-tag>
                        </div>
                        <div *ngIf="books.length === 0" class="text-sm text-muted-color">No books yet.</div>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Overdue loans</h2>
                            <p class="text-sm text-muted-color">Items that need attention.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ overdueLoans.length }} overdue</span>
                    </div>
                    <div class="space-y-3">
                        <div *ngFor="let loan of overdueLoans.slice(0, 6)" class="rounded-2xl border border-red-200 dark:border-red-900/40 p-4">
                            <div class="font-semibold">{{ loan.bookTitle }}</div>
                            <div class="text-xs text-muted-color mt-1">{{ loan.borrowerDisplayName }} - Due {{ loan.dueAt | date: 'mediumDate' }}</div>
                            <p-tag value="Overdue" severity="danger" class="mt-3"></p-tag>
                        </div>
                        <div *ngIf="overdueLoans.length === 0" class="text-sm text-muted-color">No overdue items.</div>
                    </div>
                </article>
            </section>
        </section>
    `
})
export class LibraryDashboard implements OnInit {
    private readonly api = inject(ApiService);
    readonly auth = inject(AuthService);

    dashboard: LibraryDashboardResponse | null = null;
    books: LibraryBookResponse[] = [];
    overdueLoans: LibraryLoanResponse[] = [];
    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = null;

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
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
            dashboard: this.api.getLibraryDashboard(schoolId),
            books: this.api.getLibraryBooks(schoolId),
            overdueLoans: this.api.getLibraryOverdueLoans(schoolId)
        }).subscribe({
            next: ({ dashboard, books, overdueLoans }) => {
                this.dashboard = dashboard;
                this.books = books;
                this.overdueLoans = overdueLoans;
            }
        });
    }
}
