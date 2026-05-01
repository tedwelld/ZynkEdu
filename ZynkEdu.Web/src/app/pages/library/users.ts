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
import { CreateSchoolUserRequest, SchoolResponse, UpdateSchoolUserRequest, UserResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type LibraryAdminDraft = {
    id?: number;
    schoolId: number | null;
    username: string;
    displayName: string;
    password: string;
    contactEmail: string;
    isActive: boolean;
};

@Component({
    standalone: true,
    selector: 'app-library-users',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Library</p>
                    <h1 class="text-3xl font-display font-bold m-0">Library users</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Create and manage library admin accounts for each school.</p>
                </div>
                <div class="flex flex-wrap gap-3 items-center">
                    <app-dropdown *ngIf="isPlatformAdmin" [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-72" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="loadData()"></app-dropdown>
                    <button *ngIf="canManage" pButton type="button" label="Add library admin" icon="pi pi-user-plus" (click)="openCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Library admins" [value]="admins.length.toString()" delta="Accounts" hint="Managed users" icon="pi pi-user" tone="blue"></app-metric-card>
                <app-metric-card label="Active" [value]="activeAdminCount" delta="Enabled" hint="Live access" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Inactive" [value]="inactiveAdminCount" delta="Paused" hint="No access" icon="pi pi-ban" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Schools" [value]="schoolCount" delta="Scope" hint="Selectable schools" icon="pi pi-building" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Library admin directory</h2>
                        <p class="text-sm text-muted-color">Accounts are school-scoped like the rest of the platform staff.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ admins.length }} total</span>
                </div>
                <p-table [value]="admins" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
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
                                <button *ngIf="canManage" pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openEdit(admin)"></button>
                                <button *ngIf="canManage" pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteAdmin(admin)"></button>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <p-dialog [(visible)]="drawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="drawerMode === 'create' ? 'Add library admin' : 'Edit library admin'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="drawerMode === 'create' && isPlatformAdmin">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolOptions" [(ngModel)]="draft.schoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Username</label>
                        <input pInputText [(ngModel)]="draft.username" class="w-full" [disabled]="drawerMode === 'edit'" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Display name</label>
                        <input pInputText [(ngModel)]="draft.displayName" class="w-full" />
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Contact email</label>
                        <input pInputText [(ngModel)]="draft.contactEmail" class="w-full" placeholder="library@example.com" />
                    </div>
                    <div *ngIf="drawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">Password</label>
                        <input pInputText [(ngModel)]="draft.password" class="w-full" type="password" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Status</label>
                        <div class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 px-3 py-3">
                            <input type="checkbox" [(ngModel)]="draft.isActive" />
                            <label class="text-sm font-medium">{{ draft.isActive ? 'Active' : 'Inactive' }}</label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="drawerVisible = false"></button>
                        <button pButton type="button" [label]="drawerMode === 'create' ? 'Save admin' : 'Update admin'" icon="pi pi-check" (click)="saveAdmin()"></button>
                    </div>
                </div>
            </p-dialog>
        </section>
    `
})
export class LibraryUsers implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    schools: SchoolResponse[] = [];
    admins: UserResponse[] = [];
    selectedSchoolId: number | null = null;
    drawerVisible = false;
    drawerMode: 'create' | 'edit' = 'create';
    draft: LibraryAdminDraft = this.blankDraft();

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get canManage(): boolean {
        return this.auth.role() === 'PlatformAdmin' || this.auth.role() === 'Admin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get schoolCount(): string {
        return this.schools.length.toString();
    }

    get activeAdminCount(): string {
        return this.admins.filter((admin) => admin.isActive).length.toString();
    }

    get inactiveAdminCount(): string {
        return this.admins.filter((admin) => !admin.isActive).length.toString();
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
        const schools$ = this.isPlatformAdmin ? this.auth.loadSchools() : this.api.getSchools();
        forkJoin({
            schools: schools$,
            admins: this.api.getLibraryAdmins(schoolId)
        }).subscribe({
            next: ({ schools, admins }) => {
                this.schools = schools;
                this.admins = admins;
            }
        });
    }

    openCreate(): void {
        this.drawerMode = 'create';
        this.draft = this.blankDraft();
        this.draft.schoolId = this.isPlatformAdmin ? this.selectedSchoolId ?? this.schools[0]?.id ?? null : this.auth.schoolId();
        this.drawerVisible = true;
    }

    openEdit(admin: UserResponse): void {
        this.drawerMode = 'edit';
        this.draft = {
            id: admin.id,
            schoolId: admin.schoolId,
            username: admin.username,
            displayName: admin.displayName,
            password: '',
            contactEmail: admin.contactEmail ?? '',
            isActive: admin.isActive
        };
        this.drawerVisible = true;
    }

    saveAdmin(): void {
        if (!this.canManage) {
            return;
        }

        if (this.drawerMode === 'create') {
            if (!this.draft.schoolId || !this.draft.username.trim() || !this.draft.displayName.trim() || !this.draft.password.trim()) {
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Choose a school and fill in the details before saving.' });
                return;
            }

            const request: CreateSchoolUserRequest = {
                username: this.draft.username,
                displayName: this.draft.displayName,
                password: this.draft.password,
                contactEmail: this.draft.contactEmail.trim() || null
            };

            this.api.createLibraryAdmin(request, this.draft.schoolId).subscribe({
                next: (saved) => {
                    this.messages.add({ severity: 'success', summary: 'Admin saved', detail: `${saved.displayName} added.` });
                    this.drawerVisible = false;
                    this.loadData();
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save the admin.') });
                }
            });
            return;
        }

        if (!this.draft.displayName.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Display name is required.' });
            return;
        }

        const request: UpdateSchoolUserRequest = {
            displayName: this.draft.displayName,
            password: this.draft.password.trim() || null,
            isActive: this.draft.isActive
        };

        this.api.updateLibraryAdmin(this.draft.id!, request).subscribe({
            next: (updated) => {
                this.messages.add({ severity: 'success', summary: 'Admin updated', detail: `${updated.displayName} saved.` });
                this.drawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: extractApiErrorMessage(error, 'Could not update the admin.') });
            }
        });
    }

    deleteAdmin(admin: UserResponse): void {
        this.confirmation.confirm({
            message: `Delete ${admin.displayName}?`,
            header: 'Delete library admin',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.api.deleteLibraryAdmin(admin.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Admin deleted', detail: `${admin.displayName} removed.` });
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete the admin.') });
                    }
                });
            }
        });
    }

    schoolNameFor(schoolId: number): string {
        return this.schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`;
    }

    private blankDraft(): LibraryAdminDraft {
        return {
            schoolId: null,
            username: '',
            displayName: '',
            password: '',
            contactEmail: '',
            isActive: true
        };
    }
}
