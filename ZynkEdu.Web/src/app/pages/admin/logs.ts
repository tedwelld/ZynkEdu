import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuditLogResponse } from '../../core/api/api.models';

const CATEGORIES = ['All', 'Student', 'Financial', 'Attendance', 'Results', 'System'] as const;
type Category = (typeof CATEGORIES)[number];

@Component({
    standalone: true,
    selector: 'app-admin-logs',
    imports: [CommonModule, FormsModule, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card">
                <p class="text-sm uppercase tracking-[0.28em] text-muted-color font-semibold">System</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-2">Audit &amp; activity logs</h1>
                <p class="text-muted-color mt-2 max-w-2xl">A full audit trail of actions performed in the system — who did what, when, and on which record.</p>
            </header>

            <div *ngIf="errorMessage" class="workspace-card border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <i class="pi pi-exclamation-triangle mr-2"></i>{{ errorMessage }}
            </div>

            <section class="workspace-card">
                <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div class="flex flex-wrap gap-2">
                        <button
                            *ngFor="let cat of categories"
                            type="button"
                            class="rounded-full px-4 py-1.5 text-sm font-semibold border transition"
                            [class.bg-primary]="selectedCategory === cat"
                            [class.text-white]="selectedCategory === cat"
                            [class.border-primary]="selectedCategory === cat"
                            [class.border-surface-300]="selectedCategory !== cat"
                            [class.text-color]="selectedCategory !== cat"
                            (click)="onFilterChange(cat)"
                        >{{ cat }}</button>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-sm text-muted-color">{{ filteredLogs.length }} of {{ logs.length }} entries</span>
                        <input
                            class="rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm w-56"
                            [(ngModel)]="searchTerm"
                            (ngModelChange)="onSearchChange()"
                            placeholder="Search actor, action, entity..."
                        />
                    </div>
                </div>
            </section>

            <section class="workspace-card overflow-hidden">
                <div *ngIf="loading" class="space-y-3 p-2">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="2.5rem" styleClass="rounded-xl"></p-skeleton>
                </div>

                <div *ngIf="!loading && filteredLogs.length === 0 && !errorMessage" class="py-12 text-center text-muted-color">
                    <i class="pi pi-list text-4xl mb-3 block"></i>
                    <p class="text-sm">No log entries match the current filter.</p>
                </div>

                <div *ngIf="!loading && filteredLogs.length > 0" class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.15em] text-xs border-b border-surface-200 dark:border-surface-700">
                            <tr>
                                <th class="py-3 pr-3 pl-2 w-8">#</th>
                                <th class="py-3 pr-4">Actor</th>
                                <th class="py-3 pr-4">Role</th>
                                <th class="py-3 pr-4">Action</th>
                                <th class="py-3 pr-4">Entity type</th>
                                <th class="py-3 pr-4">Entity ID</th>
                                <th class="py-3 pr-4">Summary</th>
                                <th class="py-3 pr-2">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                *ngFor="let log of pagedLogs; let i = index"
                                class="border-t border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900/40 transition"
                            >
                                <td class="py-3 pr-3 pl-2 text-muted-color text-xs font-mono">{{ currentPage * pageSize + i + 1 }}</td>
                                <td class="py-3 pr-4 font-semibold">{{ log.actorName }}</td>
                                <td class="py-3 pr-4">
                                    <p-tag [value]="log.actorRole" [severity]="roleSeverity(log.actorRole)"></p-tag>
                                </td>
                                <td class="py-3 pr-4">
                                    <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                        {{ log.action }}
                                    </span>
                                </td>
                                <td class="py-3 pr-4 text-muted-color">{{ log.entityType }}</td>
                                <td class="py-3 pr-4 text-muted-color font-mono text-xs">{{ log.entityId }}</td>
                                <td class="py-3 pr-4 max-w-xs truncate" [title]="log.summary">{{ log.summary }}</td>
                                <td class="py-3 pr-2 text-muted-color whitespace-nowrap">{{ log.createdAt | date:'d MMM y, HH:mm' }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div *ngIf="totalPages > 1" class="flex items-center justify-between gap-4 pt-4 border-t border-surface-200 dark:border-surface-700 mt-4">
                        <span class="text-sm text-muted-color">Page {{ currentPage + 1 }} of {{ totalPages }}</span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-surface-300 px-3 py-1.5 text-sm disabled:opacity-40 transition hover:bg-surface-50 dark:hover:bg-surface-800"
                                [disabled]="currentPage === 0"
                                (click)="currentPage = currentPage - 1"
                            ><i class="pi pi-chevron-left text-xs"></i></button>
                            <button
                                *ngFor="let p of pageNumbers"
                                type="button"
                                class="rounded-lg border px-3 py-1.5 text-sm transition"
                                [class.border-primary]="p === currentPage"
                                [class.bg-primary]="p === currentPage"
                                [class.text-white]="p === currentPage"
                                [class.border-surface-300]="p !== currentPage"
                                [class.hover:bg-surface-50]="p !== currentPage"
                                (click)="currentPage = p"
                            >{{ p + 1 }}</button>
                            <button
                                type="button"
                                class="rounded-lg border border-surface-300 px-3 py-1.5 text-sm disabled:opacity-40 transition hover:bg-surface-50 dark:hover:bg-surface-800"
                                [disabled]="currentPage === totalPages - 1"
                                (click)="currentPage = currentPage + 1"
                            ><i class="pi pi-chevron-right text-xs"></i></button>
                        </div>
                    </div>
                </div>
            </section>
        </section>
    `
})
export class AdminLogs implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    readonly categories: readonly Category[] = CATEGORIES;
    readonly skeletonRows = Array.from({ length: 8 });

    readonly pageSize = 10;

    logs: AuditLogResponse[] = [];
    loading = true;
    errorMessage = '';
    searchTerm = '';
    selectedCategory: Category = 'All';
    currentPage = 0;

    get filteredLogs(): AuditLogResponse[] {
        return this.logs.filter(log => {
            const matchesCategory =
                this.selectedCategory === 'All' ||
                log.entityType?.toLowerCase().includes(this.selectedCategory.toLowerCase());

            const term = this.searchTerm.trim().toLowerCase();
            const matchesSearch =
                !term ||
                [log.actorName, log.action, log.entityType, log.summary, log.entityId]
                    .some(f => f?.toLowerCase().includes(term));

            return matchesCategory && matchesSearch;
        });
    }

    get pagedLogs(): AuditLogResponse[] {
        const start = this.currentPage * this.pageSize;
        return this.filteredLogs.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.ceil(this.filteredLogs.length / this.pageSize);
    }

    get pageNumbers(): number[] {
        const total = this.totalPages;
        const current = this.currentPage;
        const delta = 2;
        const pages: number[] = [];
        for (let i = Math.max(0, current - delta); i <= Math.min(total - 1, current + delta); i++) {
            pages.push(i);
        }
        return pages;
    }

    onFilterChange(cat: Category): void {
        this.selectedCategory = cat;
        this.currentPage = 0;
    }

    onSearchChange(): void {
        this.currentPage = 0;
    }

    ngOnInit(): void {
        this.api.getAuditLogs(this.auth.schoolId(), 500).subscribe({
            next: logs => {
                this.logs = logs;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Failed to load audit logs. Please refresh or check your connection.';
            }
        });
    }

    roleSeverity(role: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
        if (role === 'Admin' || role === 'PlatformAdmin') return 'danger';
        if (role === 'Teacher') return 'info';
        if (role?.startsWith('Accountant')) return 'warn';
        return undefined;
    }
}
