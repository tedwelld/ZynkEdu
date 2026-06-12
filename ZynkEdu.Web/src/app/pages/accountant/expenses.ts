import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    CreateSchoolExpenseRequest,
    ExpenseCategoryResponse,
    ExpenseSummaryResponse,
    SaveExpenseCategoryRequest,
    SchoolExpenseResponse,
    UpdateSchoolExpenseRequest
} from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';

type ActiveTab = 'expenses' | 'categories';

interface ExpenseDraft {
    categoryId: number | null;
    amount: number | null;
    currency: string;
    expenseDate: string;
    reference: string;
    description: string;
}

@Component({
    standalone: true,
    selector: 'app-accountant-expenses',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SkeletonModule, TableModule, TagModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Finance</p>
                    <h1 class="text-3xl font-display font-bold m-0">School Expenses</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Track outgoing school expenses by category. Use this for P&amp;L reporting alongside revenue.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Record expense" icon="pi pi-plus" severity="info" (click)="openAddExpense()"></button>
                </div>
            </div>

            <!-- Summary cards -->
            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="This month" [value]="summary ? (summary.currency + ' ' + summary.totalThisMonth.toFixed(2)) : '—'" delta="Expenditure" hint="Current calendar month" icon="pi pi-calendar" tone="orange"></app-metric-card>
                <app-metric-card label="This year" [value]="summary ? (summary.currency + ' ' + summary.totalThisYear.toFixed(2)) : '—'" delta="Expenditure" hint="Current calendar year" icon="pi pi-chart-bar" tone="blue"></app-metric-card>
                <app-metric-card label="All time" [value]="summary ? (summary.currency + ' ' + summary.totalAllTime.toFixed(2)) : '—'" delta="Total" hint="All recorded expenses" icon="pi pi-database" tone="purple"></app-metric-card>
                <app-metric-card label="Categories" [value]="categories.length.toString()" delta="Expense types" hint="Active categories" icon="pi pi-tags" tone="green"></app-metric-card>
            </section>

            <!-- Tabs -->
            <div class="flex gap-2 border-b border-surface-200 dark:border-surface-700">
                <button
                    *ngFor="let tab of tabs"
                    (click)="activeTab = tab.key"
                    class="px-4 py-2 text-sm font-medium transition-colors"
                    [class.text-primary-500]="activeTab === tab.key"
                    [class.border-b-2]="activeTab === tab.key"
                    [class.border-primary-500]="activeTab === tab.key"
                    [class.text-muted-color]="activeTab !== tab.key"
                >{{ tab.label }}</button>
            </div>

            <!-- Expenses table -->
            <ng-container *ngIf="activeTab === 'expenses'">
                <article class="workspace-card flex flex-wrap items-center gap-4 mb-0">
                    <app-dropdown
                        [options]="categoryFilterOptions"
                        [(ngModel)]="categoryFilter"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="All categories"
                        class="w-56"
                        appendTo="body"
                        [showClear]="true"
                        (ngModelChange)="loadExpenses()"
                    ></app-dropdown>
                    <label class="flex items-center gap-2 text-sm text-muted-color">
                        From: <input type="date" [(ngModel)]="fromFilter" (change)="loadExpenses()" class="rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-2 py-1 text-sm" />
                    </label>
                    <label class="flex items-center gap-2 text-sm text-muted-color">
                        To: <input type="date" [(ngModel)]="toFilter" (change)="loadExpenses()" class="rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-2 py-1 text-sm" />
                    </label>
                </article>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <article *ngIf="!loading" class="workspace-card">
                    <p-table [value]="expenses" styleClass="p-datatable-sm" [paginator]="expenses.length > 20" [rows]="20">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Reference</th>
                                <th>Description</th>
                                <th>Recorded by</th>
                                <th>Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-e>
                            <tr>
                                <td class="font-semibold text-sm">{{ e.expenseDate | date:'mediumDate' }}</td>
                                <td><p-tag [value]="e.categoryName" severity="secondary"></p-tag></td>
                                <td class="font-mono font-semibold">{{ e.currency }} {{ e.amount | number:'1.2-2' }}</td>
                                <td class="text-muted-color text-sm">{{ e.reference || '—' }}</td>
                                <td class="text-muted-color text-sm">{{ e.description || '—' }}</td>
                                <td class="text-sm">{{ e.recordedByName }}</td>
                                <td>
                                    <div class="flex gap-2">
                                        <button pButton type="button" icon="pi pi-pencil" severity="secondary" size="small" class="p-button-text" (click)="openEditExpense(e)"></button>
                                        <button pButton type="button" icon="pi pi-trash" severity="danger" size="small" class="p-button-text" (click)="deleteExpense(e.id)"></button>
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="emptymessage">
                            <tr><td colspan="7" class="text-center text-muted-color py-8">No expenses recorded. Use "Record expense" to add one.</td></tr>
                        </ng-template>
                    </p-table>
                </article>

                <!-- Category breakdown -->
                <article *ngIf="summary && summary.byCategory.length > 0" class="workspace-card">
                    <h2 class="text-lg font-display font-bold mb-3">Breakdown by category</h2>
                    <p-table [value]="summary.byCategory" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Category</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Entries</th>
                                <th class="text-right">% of all</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-b>
                            <tr>
                                <td class="font-semibold">{{ b.categoryName }}</td>
                                <td class="text-right font-mono">{{ summary!.currency }} {{ b.total | number:'1.2-2' }}</td>
                                <td class="text-right text-muted-color text-sm">{{ b.count }}</td>
                                <td class="text-right text-muted-color text-sm">{{ summary!.totalAllTime > 0 ? (b.total / summary!.totalAllTime * 100 | number:'1.1-1') + '%' : '—' }}</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </article>
            </ng-container>

            <!-- Categories management -->
            <ng-container *ngIf="activeTab === 'categories'">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <h2 class="text-xl font-display font-bold m-0">Expense categories</h2>
                        <button pButton type="button" label="Add category" icon="pi pi-plus" severity="secondary" size="small" (click)="openAddCategory()"></button>
                    </div>
                    <p-table [value]="categories" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th class="text-right">Entries</th>
                                <th class="text-right">Total spent</th>
                                <th>Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-c>
                            <tr>
                                <td class="font-semibold">{{ c.name }}</td>
                                <td class="text-muted-color text-sm">{{ c.description || '—' }}</td>
                                <td class="text-right text-sm">{{ c.expenseCount }}</td>
                                <td class="text-right font-mono text-sm">{{ c.totalSpent | number:'1.2-2' }}</td>
                                <td>
                                    <div class="flex gap-2">
                                        <button pButton type="button" icon="pi pi-pencil" severity="secondary" size="small" class="p-button-text" (click)="openEditCategory(c)"></button>
                                        <button pButton type="button" icon="pi pi-trash" severity="danger" size="small" class="p-button-text" (click)="deleteCategory(c.id)" [disabled]="c.expenseCount > 0"></button>
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="emptymessage">
                            <tr><td colspan="5" class="text-center text-muted-color py-6">No categories yet. Add one using the button above.</td></tr>
                        </ng-template>
                    </p-table>
                </article>
            </ng-container>
        </section>

        <!-- Expense dialog -->
        <p-dialog [(visible)]="expenseDialogVisible" [modal]="true" [style]="{width:'580px'}" [header]="editingExpenseId ? 'Edit expense' : 'Record expense'" [closable]="!saving">
            <div class="grid gap-4 p-2">
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Category</span>
                    <app-dropdown
                        [options]="categoryDropdownOptions"
                        [(ngModel)]="expenseDraft.categoryId"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select category"
                        appendTo="body"
                        [showClear]="false"
                    ></app-dropdown>
                </label>
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Amount</span>
                        <p-inputNumber [(ngModel)]="expenseDraft.amount" [min]="0" mode="decimal" [minFractionDigits]="2" [maxFractionDigits]="2" class="mt-1 w-full"></p-inputNumber>
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Currency</span>
                        <input pInputText type="text" [(ngModel)]="expenseDraft.currency" placeholder="USD" maxlength="10" class="mt-1 w-full" />
                    </label>
                </div>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Expense date</span>
                    <input type="date" [(ngModel)]="expenseDraft.expenseDate" class="mt-1 w-full rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-3 py-2 text-sm" />
                </label>
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Reference (optional)</span>
                        <input pInputText type="text" [(ngModel)]="expenseDraft.reference" placeholder="Invoice #, receipt #..." class="mt-1 w-full" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Description (optional)</span>
                        <input pInputText type="text" [(ngModel)]="expenseDraft.description" placeholder="Brief description" class="mt-1 w-full" />
                    </label>
                </div>
            </div>
            <ng-template pTemplate="footer">
                <button pButton type="button" label="Cancel" severity="secondary" (click)="expenseDialogVisible = false" [disabled]="saving"></button>
                <button pButton type="button" [label]="editingExpenseId ? 'Save changes' : 'Record'" icon="pi pi-check" (click)="saveExpense()" [disabled]="saving || !canSaveExpense"></button>
            </ng-template>
        </p-dialog>

        <!-- Category dialog -->
        <p-dialog [(visible)]="categoryDialogVisible" [modal]="true" [style]="{width:'460px'}" [header]="editingCategoryId ? 'Edit category' : 'Add category'" [closable]="!saving">
            <div class="grid gap-4 p-2">
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Category name</span>
                    <input pInputText type="text" [(ngModel)]="categoryDraft.name" placeholder="e.g. Utilities, Staff welfare..." class="mt-1 w-full" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Description (optional)</span>
                    <input pInputText type="text" [(ngModel)]="categoryDraft.description" placeholder="Optional short description" class="mt-1 w-full" />
                </label>
            </div>
            <ng-template pTemplate="footer">
                <button pButton type="button" label="Cancel" severity="secondary" (click)="categoryDialogVisible = false" [disabled]="saving"></button>
                <button pButton type="button" [label]="editingCategoryId ? 'Save changes' : 'Add'" icon="pi pi-check" (click)="saveCategory()" [disabled]="saving || !categoryDraft.name"></button>
            </ng-template>
        </p-dialog>
    `
})
export class AccountantExpenses implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    saving = false;
    activeTab: ActiveTab = 'expenses';
    tabs = [
        { key: 'expenses' as ActiveTab, label: 'Expenses' },
        { key: 'categories' as ActiveTab, label: 'Categories' }
    ];

    expenses: SchoolExpenseResponse[] = [];
    categories: ExpenseCategoryResponse[] = [];
    summary: ExpenseSummaryResponse | null = null;
    categoryFilter: number | null = null;
    fromFilter = '';
    toFilter = '';
    skeletonRows = Array.from({ length: 5 });

    expenseDialogVisible = false;
    editingExpenseId: number | null = null;
    expenseDraft: ExpenseDraft = { categoryId: null, amount: null, currency: 'USD', expenseDate: '', reference: '', description: '' };

    categoryDialogVisible = false;
    editingCategoryId: number | null = null;
    categoryDraft: SaveExpenseCategoryRequest & { description: string | null } = { name: '', description: null };

    ngOnInit(): void {
        void this.loadData();
    }

    get categoryFilterOptions(): { label: string; value: number }[] {
        return this.categories.map(c => ({ label: c.name, value: c.id }));
    }

    get categoryDropdownOptions(): { label: string; value: number }[] {
        return this.categories.map(c => ({ label: c.name, value: c.id }));
    }

    get canSaveExpense(): boolean {
        return !!this.expenseDraft.categoryId && !!this.expenseDraft.amount && this.expenseDraft.amount > 0 && !!this.expenseDraft.expenseDate;
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            const [categories, summary] = await Promise.all([
                firstValueFrom(this.api.getExpenseCategories()),
                firstValueFrom(this.api.getExpenseSummary()).catch(() => null)
            ]);
            this.categories = categories;
            this.summary = summary;
            await this.loadExpenses();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'Could not load expense data.') });
        } finally {
            this.loading = false;
        }
    }

    async loadExpenses(): Promise<void> {
        try {
            this.expenses = await firstValueFrom(this.api.getExpenses(null, this.categoryFilter, this.fromFilter || null, this.toFilter || null));
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'Could not load expenses.') });
        }
    }

    openAddExpense(): void {
        this.editingExpenseId = null;
        this.expenseDraft = { categoryId: null, amount: null, currency: 'USD', expenseDate: new Date().toISOString().split('T')[0], reference: '', description: '' };
        this.expenseDialogVisible = true;
    }

    openEditExpense(e: SchoolExpenseResponse): void {
        this.editingExpenseId = e.id;
        this.expenseDraft = {
            categoryId: e.categoryId,
            amount: e.amount,
            currency: e.currency,
            expenseDate: e.expenseDate.split('T')[0],
            reference: e.reference ?? '',
            description: e.description ?? ''
        };
        this.expenseDialogVisible = true;
    }

    async saveExpense(): Promise<void> {
        if (!this.canSaveExpense || this.expenseDraft.categoryId == null || this.expenseDraft.amount == null) return;
        this.saving = true;
        try {
            const payload: CreateSchoolExpenseRequest = {
                categoryId: this.expenseDraft.categoryId,
                amount: this.expenseDraft.amount,
                currency: this.expenseDraft.currency || null,
                expenseDate: this.expenseDraft.expenseDate,
                reference: this.expenseDraft.reference || null,
                description: this.expenseDraft.description || null
            };

            if (this.editingExpenseId) {
                const updated = await firstValueFrom(this.api.updateExpense(this.editingExpenseId, payload as UpdateSchoolExpenseRequest));
                this.expenses = this.expenses.map(e => e.id === updated.id ? updated : e);
            } else {
                const created = await firstValueFrom(this.api.createExpense(payload));
                this.expenses = [created, ...this.expenses];
            }

            this.expenseDialogVisible = false;
            this.messages.add({ severity: 'success', summary: 'Saved', detail: 'Expense saved.' });
            void this.loadData();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save expense.') });
        } finally {
            this.saving = false;
        }
    }

    async deleteExpense(id: number): Promise<void> {
        try {
            await firstValueFrom(this.api.deleteExpense(id));
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'Expense removed.' });
            void this.loadData();
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete expense.') });
        }
    }

    openAddCategory(): void {
        this.editingCategoryId = null;
        this.categoryDraft = { name: '', description: null };
        this.categoryDialogVisible = true;
    }

    openEditCategory(c: ExpenseCategoryResponse): void {
        this.editingCategoryId = c.id;
        this.categoryDraft = { name: c.name, description: c.description };
        this.categoryDialogVisible = true;
    }

    async saveCategory(): Promise<void> {
        if (!this.categoryDraft.name) return;
        this.saving = true;
        try {
            const payload: SaveExpenseCategoryRequest = { name: this.categoryDraft.name, description: this.categoryDraft.description };
            if (this.editingCategoryId) {
                const updated = await firstValueFrom(this.api.updateExpenseCategory(this.editingCategoryId, payload));
                this.categories = this.categories.map(c => c.id === updated.id ? updated : c);
            } else {
                const created = await firstValueFrom(this.api.createExpenseCategory(payload));
                this.categories = [...this.categories, created];
            }
            this.categoryDialogVisible = false;
            this.messages.add({ severity: 'success', summary: 'Saved', detail: 'Category saved.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save category.') });
        } finally {
            this.saving = false;
        }
    }

    async deleteCategory(id: number): Promise<void> {
        try {
            await firstValueFrom(this.api.deleteExpenseCategory(id));
            this.categories = this.categories.filter(c => c.id !== id);
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'Category removed.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete category.') });
        }
    }
}
