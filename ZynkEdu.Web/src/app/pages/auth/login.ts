import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';
import { SchoolResponse } from '../../core/api/api.models';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, AutoCompleteModule, ButtonModule, InputTextModule, PasswordModule],
    template: `
        <div class="auth-login-page">
            <img class="auth-login-bg" src="/assets/images/login-background.png" alt="" aria-hidden="true" />
            <section class="workspace-card auth-login-card w-full max-w-xl">
                <div>
                    <p class="text-sm uppercase tracking-[0.22em] text-muted-color font-semibold">Sign in</p>
                    <h1 class="text-3xl font-display font-bold m-0">Welcome back</h1>
                    <p class="text-muted-color mt-2">Use your school, platform admin, or parent account to continue.</p>
                </div>

                <div class="mt-8 flex rounded-2xl bg-surface-100 dark:bg-surface-900 p-1">
                    <button
                        type="button"
                        class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                        [ngClass]="mode === 'staff' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                        (click)="mode = 'staff'"
                    >
                        School staff
                    </button>
                    <button
                        type="button"
                        class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                        [ngClass]="mode === 'platform' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                        (click)="mode = 'platform'"
                    >
                        Platform admin
                    </button>
                    <button
                        type="button"
                        class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                        [ngClass]="mode === 'parent' ? 'bg-white dark:bg-surface-950 shadow text-surface-900 dark:text-surface-0' : 'text-muted-color'"
                        (click)="mode = 'parent'"
                    >
                        Parent
                    </button>
                </div>

                <div class="mt-8 space-y-5">
                    <div *ngIf="mode === 'staff'" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold mb-2">School</label>
                            <p-autoComplete
                                [(ngModel)]="schoolQuery"
                                [suggestions]="schoolSuggestions"
                                (completeMethod)="filterSchools($event)"
                                (onSelect)="selectSchool($event.value)"
                                (ngModelChange)="onSchoolQueryChange($event)"
                                optionLabel="name"
                                placeholder="Find your school"
                                [dropdown]="false"
                                [forceSelection]="true"
                                class="w-full"
                                styleClass="w-full"
                            >
                                <ng-template let-school pTemplate="item">
                                    <div class="flex items-center justify-between">
                                        <span class="font-semibold">{{ school.name }}</span>
                                        <span class="text-xs text-muted-color">{{ school.address }}</span>
                                    </div>
                                </ng-template>
                            </p-autoComplete>
                            <p class="mt-2 text-xs text-muted-color">Select your registered school to continue.</p>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold mb-2">Username</label>
                            <input pInputText [(ngModel)]="username" class="w-full" placeholder="Staff username" />
                        </div>

                        <div>
                            <label class="block text-sm font-semibold mb-2">Password</label>
                            <p-password [(ngModel)]="password" [toggleMask]="true" [feedback]="false" styleClass="w-full" inputStyleClass="w-full"></p-password>
                        </div>

                        <button pButton type="button" label="Sign in" icon="pi pi-arrow-right" class="w-full" [loading]="loading" (click)="signIn()"></button>
                    </div>

                    <div *ngIf="mode === 'platform'" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Username</label>
                            <input pInputText [(ngModel)]="username" class="w-full" placeholder="Platform admin username" autocomplete="username" />
                        </div>

                        <div>
                            <label class="block text-sm font-semibold mb-2">Password</label>
                            <p-password [(ngModel)]="password" [toggleMask]="true" [feedback]="false" styleClass="w-full" inputStyleClass="w-full" autocomplete="current-password"></p-password>
                        </div>

                        <button pButton type="button" label="Sign in" icon="pi pi-arrow-right" class="w-full" [loading]="loading" (click)="signIn()"></button>
                    </div>

                    <div *ngIf="mode === 'parent'" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Email or phone</label>
                            <input pInputText [(ngModel)]="parentIdentifier" class="w-full" placeholder="Email address or phone number" autocomplete="username" />
                        </div>

                        <div>
                            <label class="block text-sm font-semibold mb-2">Password</label>
                            <p-password [(ngModel)]="password" [toggleMask]="true" [feedback]="false" styleClass="w-full" inputStyleClass="w-full" autocomplete="current-password"></p-password>
                        </div>

                        <button pButton type="button" label="Sign in" icon="pi pi-arrow-right" class="w-full" [loading]="loading" (click)="signIn()"></button>
                    </div>
                </div>
            </section>
        </div>
    `
})
export class Login implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    mode: 'staff' | 'platform' | 'parent' = 'staff';
    loading = false;
    username = '';
    password = '';
    schoolQuery = '';
    selectedSchool: SchoolResponse | null = null;
    schoolSuggestions: SchoolResponse[] = [];
    parentIdentifier = '';

    ngOnInit(): void {
        this.auth.loadSchools().subscribe({
            next: (schools) => {
                this.schoolSuggestions = schools;
            }
        });
    }

    filterSchools(event: { query: string }): void {
        const query = event.query.trim().toLowerCase();
        this.schoolSuggestions = this.auth.schools().filter((school) => school.name.toLowerCase().includes(query));
    }

    onSchoolQueryChange(value: string): void {
        this.schoolQuery = value;
        if (this.selectedSchool?.name !== value) {
            this.selectedSchool = null;
        }
    }

    selectSchool(school: SchoolResponse): void {
        this.selectedSchool = school;
        this.schoolQuery = school.name;
    }

    signIn(): void {
        if (this.mode === 'staff' && !this.selectedSchool) {
            this.messages.add({
                severity: 'warn',
                summary: 'Select a school',
                detail: 'Choose your school from the list before signing in.'
            });
            return;
        }

        this.loading = true;
        const request =
            this.mode === 'parent'
                ? { username: this.parentIdentifier.trim(), password: this.password, schoolName: null }
                : this.mode === 'platform'
                    ? { username: this.username.trim(), password: this.password, schoolName: null }
                    : { username: this.username.trim(), password: this.password, schoolName: this.selectedSchool?.name ?? this.schoolQuery };

        this.auth.login(request).subscribe({
            next: () => {
                this.loading = false;
            },
            error: (error) => {
                this.loading = false;
                this.messages.add({
                    severity: 'error',
                    summary: 'Sign in failed',
                    detail: this.getLoginErrorMessage(error)
                });
            }
        });
    }

    private getLoginErrorMessage(error: unknown): string {
        const fallback =
            this.mode === 'parent'
                ? 'Check your email or phone and password.'
                : this.mode === 'platform'
                    ? 'Check your platform admin details.'
                    : 'Check your school, username, and password.';

        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        const detail = problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message;
        if (!detail) {
            return fallback;
        }

        if (this.mode === 'staff' && /school was not found/i.test(detail)) {
            return 'The selected school is not registered in the system.';
        }

        return detail;
    }
}
