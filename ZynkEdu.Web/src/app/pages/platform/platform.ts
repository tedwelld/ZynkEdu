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
import { CreateSchoolWithAdminRequest, SchoolResponse, UpdateSchoolRequest, UpdateSchoolUserRequest, UserResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-platform-dashboard',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Platform</p>
                    <h1 class="text-3xl font-display font-bold m-0">System administration</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Manage schools and school admins from one place.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Add School" icon="pi pi-building" (click)="openSchoolCreate()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Schools" [value]="schoolCount" delta="System scope" hint="All schools" icon="pi pi-building" tone="blue"></app-metric-card>
                <app-metric-card label="Admins" [value]="adminCount" delta="School admins" hint="Managed accounts" icon="pi pi-user" tone="purple"></app-metric-card>
                <app-metric-card label="Active" [value]="activeAdminCount" delta="Enabled" hint="Live access" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Disabled" [value]="inactiveAdminCount" delta="Paused" hint="No access" icon="pi pi-ban" tone="orange" direction="down"></app-metric-card>
            </section>

            <section class="grid gap-6 xl:grid-cols-2">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Schools</h2>
                            <p class="text-sm text-muted-color">Create and update schools.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ schools.length }} total</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <p-table *ngIf="!loading" [value]="schools" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>School</th>
                                <th>Address</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-school>
                            <tr>
                                <td class="font-semibold">{{ school.name }}</td>
                                <td class="text-sm text-muted-color">{{ school.address }}</td>
                                <td class="text-right">
                                    <button pButton type="button" icon="pi pi-pencil" class="p-button-text p-button-sm" (click)="openSchoolEdit(school)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteSchool(school)"></button>
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">School admins</h2>
                            <p class="text-sm text-muted-color">Create admins and bind them to a school.</p>
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
            </section>

            <p-dialog [(visible)]="schoolDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="schoolDrawerMode === 'create' ? 'Add school and admin' : 'Edit school'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="schoolDrawerMode === 'create'; else editSchoolName">
                        <label class="block text-sm font-semibold mb-2">Name</label>
                        <input pInputText [(ngModel)]="schoolCreateDraft.name" class="w-full" />
                    </div>
                    <ng-template #editSchoolName>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Name</label>
                            <input pInputText [(ngModel)]="schoolDraft.name" class="w-full" />
                        </div>
                    </ng-template>
                    <div *ngIf="schoolDrawerMode === 'create'; else editSchoolAddress">
                        <label class="block text-sm font-semibold mb-2">Address</label>
                        <input pInputText [(ngModel)]="schoolCreateDraft.address" class="w-full" />
                    </div>
                    <ng-template #editSchoolAddress>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Address</label>
                            <input pInputText [(ngModel)]="schoolDraft.address" class="w-full" />
                        </div>
                    </ng-template>
                    <div *ngIf="schoolDrawerMode === 'create'; else editSchoolEmail">
                        <label class="block text-sm font-semibold mb-2">Admin contact email</label>
                        <input pInputText [(ngModel)]="schoolCreateDraft.adminContactEmail" class="w-full" />
                    </div>
                    <ng-template #editSchoolEmail>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Admin contact email</label>
                            <input pInputText [(ngModel)]="schoolDraft.adminContactEmail" class="w-full" />
                        </div>
                    </ng-template>
                    <div *ngIf="schoolDrawerMode === 'create'" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4 space-y-4">
                        <div>
                            <div class="text-xs uppercase tracking-[0.18em] text-muted-color font-semibold">First admin</div>
                            <div class="text-sm text-muted-color mt-1">Create the school and its first admin at the same time.</div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Admin username</label>
                            <input pInputText [(ngModel)]="schoolCreateDraft.adminUsername" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Admin display name</label>
                            <input pInputText [(ngModel)]="schoolCreateDraft.adminDisplayName" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Admin password</label>
                            <input pInputText [(ngModel)]="schoolCreateDraft.adminPassword" class="w-full" type="password" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Status</label>
                            <div class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 px-3 py-3">
                                <input type="checkbox" [(ngModel)]="schoolCreateDraft.adminIsActive" />
                                <label class="text-sm font-medium">{{ schoolCreateDraft.adminIsActive ? 'Active' : 'Inactive' }}</label>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button pButton type="button" label="Cancel" severity="secondary" (click)="schoolDrawerVisible = false"></button>
                        <button pButton type="button" [label]="schoolDrawerMode === 'create' ? 'Save school' : 'Update school'" icon="pi pi-check" (click)="saveSchool()"></button>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="adminDrawerVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(34rem, 96vw)' }" [header]="adminDrawerMode === 'create' ? 'Add admin' : 'Edit admin'" appendTo="body">
                <div class="space-y-4">
                    <div *ngIf="adminDrawerMode === 'create'">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolSelectOptions" [(ngModel)]="adminDraft.schoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
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
export class PlatformDashboard implements OnInit {
    private readonly api = inject(ApiService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    schools: SchoolResponse[] = [];
    admins: UserResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    schoolDrawerVisible = false;
    adminDrawerVisible = false;
    schoolDrawerMode: 'create' | 'edit' = 'create';
    adminDrawerMode: 'create' | 'edit' = 'create';
    schoolDraft: { id?: number; name: string; address: string; adminContactEmail: string } = { name: '', address: '', adminContactEmail: '' };
    schoolCreateDraft: { name: string; address: string; adminContactEmail: string; adminUsername: string; adminDisplayName: string; adminPassword: string; adminIsActive: boolean } = {
        name: '',
        address: '',
        adminContactEmail: '',
        adminUsername: '',
        adminDisplayName: '',
        adminPassword: '',
        adminIsActive: true
    };
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

    openSchoolCreate(): void {
        this.schoolDrawerMode = 'create';
        this.schoolDraft = { name: '', address: '', adminContactEmail: '' };
        this.schoolCreateDraft = {
            name: '',
            address: '',
            adminContactEmail: '',
            adminUsername: '',
            adminDisplayName: '',
            adminPassword: '',
            adminIsActive: true
        };
        this.schoolDrawerVisible = true;
    }

    openSchoolEdit(school: SchoolResponse): void {
        this.schoolDrawerMode = 'edit';
        this.schoolDraft = { id: school.id, name: school.name, address: school.address, adminContactEmail: school.adminContactEmail ?? '' };
        this.schoolDrawerVisible = true;
    }

    saveSchool(): void {
        if (this.schoolDrawerMode === 'create') {
            if (!this.schoolCreateDraft.name.trim() || !this.schoolCreateDraft.address.trim() || !this.schoolCreateDraft.adminContactEmail.trim() || !this.schoolCreateDraft.adminUsername.trim() || !this.schoolCreateDraft.adminDisplayName.trim() || !this.schoolCreateDraft.adminPassword.trim()) {
                this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Fill in the school and admin details before saving.' });
                return;
            }

            if (this.schoolCreateDraft.name.trim().length < 2) {
                this.messages.add({ severity: 'warn', summary: 'School name required', detail: 'School names must be at least 2 characters long.' });
                return;
            }

            if (this.schoolCreateDraft.address.trim().length < 3) {
                this.messages.add({ severity: 'warn', summary: 'Address required', detail: 'School addresses must be at least 3 characters long.' });
                return;
            }

            if (!this.isValidEmail(this.schoolCreateDraft.adminContactEmail)) {
                this.messages.add({ severity: 'warn', summary: 'Email required', detail: 'Enter a valid admin contact email.' });
                return;
            }

            if (this.schoolCreateDraft.adminUsername.trim().length < 3) {
                this.messages.add({ severity: 'warn', summary: 'Username required', detail: 'Admin usernames must be at least 3 characters long.' });
                return;
            }

            if (this.schoolCreateDraft.adminDisplayName.trim().length < 2) {
                this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Admin display names must be at least 2 characters long.' });
                return;
            }

            if (this.schoolCreateDraft.adminPassword.trim().length < 8) {
                this.messages.add({ severity: 'warn', summary: 'Password required', detail: 'Admin passwords must be at least 8 characters long.' });
                return;
            }

            const request: CreateSchoolWithAdminRequest = {
                name: this.schoolCreateDraft.name,
                address: this.schoolCreateDraft.address,
                adminContactEmail: this.schoolCreateDraft.adminContactEmail,
                adminUsername: this.schoolCreateDraft.adminUsername,
                adminDisplayName: this.schoolCreateDraft.adminDisplayName,
                adminPassword: this.schoolCreateDraft.adminPassword,
                adminIsActive: this.schoolCreateDraft.adminIsActive
            };

            this.api.createSchoolWithAdmin(request).subscribe({
                next: () => {
                    this.messages.add({
                        severity: 'success',
                        summary: 'School saved',
                        detail: `${this.schoolCreateDraft.name} and its first admin were added.`
                    });
                    this.schoolDrawerVisible = false;
                    this.loadData();
                },
                error: (error) => {
                    this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The school could not be saved.') });
                }
            });
            return;
        }

        if (!this.schoolDraft.id) {
            return;
        }

        if (!this.schoolDraft.name.trim() || !this.schoolDraft.address.trim() || !this.schoolDraft.adminContactEmail.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Missing details', detail: 'Fill in the school details before updating.' });
            return;
        }

        if (this.schoolDraft.name.trim().length < 2) {
            this.messages.add({ severity: 'warn', summary: 'School name required', detail: 'School names must be at least 2 characters long.' });
            return;
        }

        if (this.schoolDraft.address.trim().length < 3) {
            this.messages.add({ severity: 'warn', summary: 'Address required', detail: 'School addresses must be at least 3 characters long.' });
            return;
        }

        if (!this.isValidEmail(this.schoolDraft.adminContactEmail)) {
            this.messages.add({ severity: 'warn', summary: 'Email required', detail: 'Enter a valid admin contact email.' });
            return;
        }

        this.api.updateSchool(this.schoolDraft.id, { name: this.schoolDraft.name, address: this.schoolDraft.address, adminContactEmail: this.schoolDraft.adminContactEmail }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'School updated', detail: `${this.schoolDraft.name} saved.` });
                this.schoolDrawerVisible = false;
                this.loadData();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Update failed', detail: this.readErrorMessage(error, 'The school could not be updated.') });
            }
        });
    }

    deleteSchool(school: SchoolResponse): void {
        this.confirmation.confirm({
            message: `Delete ${school.name}?`,
            header: 'Delete school',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteSchool(school.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'School deleted', detail: `${school.name} removed.` });
                        this.loadData();
                    },
                    error: (error) => {
                        this.messages.add({ severity: 'error', summary: 'Delete failed', detail: this.readErrorMessage(error, 'The school could not be deleted.') });
                    }
                })
        });
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
            if (!this.adminDraft.schoolId) {
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

    private isValidEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    }
}
