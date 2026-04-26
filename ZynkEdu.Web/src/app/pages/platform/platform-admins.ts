import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { CreateSchoolUserRequest, SchoolResponse, UpdateSchoolUserRequest, UserResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-platform-admins',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Platform</p>
                    <h1 class="text-3xl font-display font-bold m-0">School admins</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Create, update, and remove school admin accounts.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Add Admin" icon="pi pi-user-plus" (click)="openAdminCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Admins" [value]="adminCount" delta="School scope" hint="Managed accounts" icon="pi pi-user" tone="blue"></app-metric-card>
                <app-metric-card label="Active" [value]="activeAdminCount" delta="Enabled" hint="Live access" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Inactive" [value]="inactiveAdminCount" delta="Paused" hint="No access" icon="pi pi-ban" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Schools" [value]="schoolCount" delta="Available schools" hint="Selectable scope" icon="pi pi-building" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Admin directory</h2>
                        <p class="text-sm text-muted-color">Manage access by school.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ admins.length }} total</span>
                </div>
                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>
                <p-table *ngIf="!loading" [value]="admins" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Admin</th>
                            <th>School</th>
                            <th>Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-admin>
                        <tr>
                            <td>
                                <div class="font-semibold">{{ admin.displayName }}</div>
                                <div class="text-xs text-muted-color">{{ admin.username }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ schoolNameFor(admin.schoolId) }}</td>
                            <td>
                                <p-tag [value]="admin.isActive ? 'Active' : 'Inactive'" [severity]="admin.isActive ? 'success' : 'danger'"></p-tag>
                            </td>
                            <td class="text-right">
                                <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openAdminEdit(admin)"></button>
                                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteAdmin(admin)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="adminDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="adminDrawerMode === 'create' ? 'Add admin' : 'Edit admin'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="adminDrawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolSelectOptions" [(ngModel)]="adminDraft.schoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Username</label>
                        <input pInputText [(ngModel)]="adminDraft.username" class="w-full" [disabled]="adminDrawerMode === 'edit'" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Display name</label>
                        <input pInputText [(ngModel)]="adminDraft.displayName" class="w-full" />
                    </div>
                    <div *ngIf="adminDrawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Password</label>
                        <input pInputText [(ngModel)]="adminDraft.password" class="w-full" type="password" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <div class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 px-3 py-3">
                            <input type="checkbox" [(ngModel)]="adminDraft.isActive" />
                            <label class="text-sm font-medium">{{ adminDraft.isActive ? 'Active' : 'Inactive' }}</label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="adminDrawerVisible = false"></button>
                        <button pButton type="button" [label]="adminDrawerMode === 'create' ? 'Save admin' : 'Update admin'" icon="pi pi-check" (click)="saveAdmin()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class PlatformAdmins implements OnInit {
    private readonly api = inject(ApiService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    schools: SchoolResponse[] = [];
    admins: UserResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    adminDrawerVisible = false;
    adminDrawerMode: 'create' | 'edit' = 'create';
    adminDraft: { id?: number; schoolId: number | null; username: string; displayName: string; password: string; isActive: boolean } = {
        schoolId: null,
        username: '',
        displayName: '',
        password: '',
        isActive: true
    };

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            schools: this.api.getPlatformSchools(),
            admins: this.api.getAdmins()
        }).subscribe({
            next: ({ schools, admins }) => {
                this.schools = schools;
                this.admins = admins;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    get schoolCount(): string {
        return this.schools.length.toString();
    }

    get adminCount(): string {
        return this.admins.length.toString();
    }

    get activeAdminCount(): string {
        return this.admins.filter((admin) => admin.isActive).length.toString();
    }

    get inactiveAdminCount(): string {
        return this.admins.filter((admin) => !admin.isActive).length.toString();
    }

    get schoolSelectOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    openAdminCreate(): void {
        this.adminDrawerMode = 'create';
        this.adminDraft = {
            schoolId: this.schools[0]?.id ?? null,
            username: '',
            displayName: '',
            password: '',
            isActive: true
        };
        this.adminDrawerVisible = true;
    }

    openAdminEdit(admin: UserResponse): void {
        this.adminDrawerMode = 'edit';
        this.adminDraft = {
            id: admin.id,
            schoolId: admin.schoolId,
            username: admin.username,
            displayName: admin.displayName,
            password: '',
            isActive: admin.isActive
        };
        this.adminDrawerVisible = true;
    }

    saveAdmin(): void {
        if (this.adminDrawerMode === 'create') {
            if (!this.adminDraft.schoolId || !this.adminDraft.username.trim() || !this.adminDraft.displayName.trim() || !this.adminDraft.password.trim()) {
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a school and fill in the admin details before saving.' });
                return;
            }

            if (this.adminDraft.username.trim().length < 3) {
                this.messages.add({ severity: 'warn', summary: 'Username required', detail: 'Admin usernames must be at least 3 characters long.' });
                return;
            }

            if (this.adminDraft.displayName.trim().length < 2) {
                this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Admin display names must be at least 2 characters long.' });
                return;
            }

            if (this.adminDraft.password.trim().length < 8) {
                this.messages.add({ severity: 'warn', summary: 'Password required', detail: 'Admin passwords must be at least 8 characters long.' });
                return;
            }

            const request: CreateSchoolUserRequest = {
                username: this.adminDraft.username,
                displayName: this.adminDraft.displayName,
                password: this.adminDraft.password
            };

            this.api.createAdmin(request, this.adminDraft.schoolId).subscribe({
                next: () => {
                    this.messages.add({ severity: 'success', summary: 'Admin saved', detail: `${this.adminDraft.displayName} added.` });
                    this.adminDrawerVisible = false;
                    this.loadData();
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The admin could not be saved.') });
                }
            });
            return;
        }

        if (!this.adminDraft.id) {
            return;
        }

        if (this.adminDraft.displayName.trim().length < 2) {
            this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Admin display names must be at least 2 characters long.' });
            return;
        }

        if (this.adminDraft.password.trim().length > 0 && this.adminDraft.password.trim().length < 8) {
            this.messages.add({ severity: 'warn', summary: 'Password required', detail: 'Admin passwords must be at least 8 characters long.' });
            return;
        }

        const request: UpdateSchoolUserRequest = {
            displayName: this.adminDraft.displayName,
            password: this.adminDraft.password || null,
            isActive: this.adminDraft.isActive
        };

        this.api.updateAdmin(this.adminDraft.id, request).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Admin updated', detail: `${this.adminDraft.displayName} saved.` });
                this.adminDrawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The admin could not be updated.') });
            }
        });
    }

    deleteAdmin(admin: UserResponse): void {
        this.confirmation.confirm({
            message: `Delete ${admin.displayName}?`,
            header: 'Delete admin',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteAdmin(admin.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Admin deleted', detail: `${admin.displayName} removed.` });
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: this.readErrorMessage(error, 'The admin could not be deleted.') });
                    }
                })
        });
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        return extractApiErrorMessage(error, fallback);
    }
}
