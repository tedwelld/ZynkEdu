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
            <div class="auth-login-shell">
                <aside class="auth-login-hero">
                    <img class="auth-login-hero-image" src="/assets/images/login-background.png" alt="" aria-hidden="true" />
                    <div class="auth-login-hero-overlay"></div>
                    <div class="auth-login-hero-copy">
                        <p class="auth-login-hero-kicker">A wise quote</p>
                        <h2>Get<br />Everything<br />You Want</h2>
                        <p>
                            The right classroom, the right tools, and the right teachers help every learner move with confidence.
                        </p>
                    </div>
                </aside>

                <section class="workspace-card auth-login-card">
                    <div class="auth-login-brand-row">
                        <div class="auth-login-brand">
                            <img src="/assets/images/zynkedu-icon.png" alt="ZynkEdu logo" class="auth-login-icon" />
                            <div>
                                <p class="auth-login-brand-name">ZynkEdu</p>
                                <p class="auth-login-brand-subtitle">Secure access for your workspace</p>
                            </div>
                        </div>
                        <button type="button" class="auth-login-help" (click)="showHelp()">
                            Need help?
                        </button>
                    </div>

                    <div class="auth-login-copy">
                        <h1>Welcome Back</h1>
                        <p>Enter your account details to access your school or platform workspace.</p>
                    </div>

                    <div class="auth-login-mode-switch" role="tablist" aria-label="Login type">
                        <button
                            type="button"
                            class="auth-login-mode-button"
                            [ngClass]="mode === 'staff' ? 'is-active' : ''"
                            (click)="mode = 'staff'"
                        >
                            School staff
                        </button>
                        <button
                            type="button"
                            class="auth-login-mode-button"
                            [ngClass]="mode === 'platform' ? 'is-active' : ''"
                            (click)="mode = 'platform'"
                        >
                            Platform admin
                        </button>
                        <button
                            type="button"
                            class="auth-login-mode-button"
                            [ngClass]="mode === 'parent' ? 'is-active' : ''"
                            (click)="mode = 'parent'"
                        >
                            Parent
                        </button>
                    </div>

                    <form class="auth-login-form" (ngSubmit)="signIn()">
                        <div *ngIf="mode === 'staff'" class="space-y-4">
                            <div>
                                <label class="auth-login-label">School</label>
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
                                    class="w-full auth-login-control"
                                    styleClass="w-full auth-login-control"
                                    name="schoolQuery"
                                >
                                    <ng-template let-school pTemplate="item">
                                        <div class="auth-login-suggestion">
                                            <span class="auth-login-suggestion-name">{{ school.name }}</span>
                                            <span class="auth-login-suggestion-meta">{{ school.address }}</span>
                                        </div>
                                    </ng-template>
                                </p-autoComplete>
                                <p class="auth-login-hint">Select your registered school before signing in.</p>
                            </div>

                            <div>
                                <label class="auth-login-label">Username</label>
                                <input pInputText [(ngModel)]="username" name="username" class="w-full auth-login-control" placeholder="Staff username" autocomplete="username" />
                            </div>

                            <div>
                                <label class="auth-login-label">Password</label>
                                <p-password
                                    [(ngModel)]="password"
                                    name="password"
                                    [toggleMask]="true"
                                    [feedback]="false"
                                    styleClass="w-full auth-login-control"
                                    inputStyleClass="w-full auth-login-input"
                                    autocomplete="current-password"
                                ></p-password>
                            </div>
                        </div>

                        <div *ngIf="mode === 'platform'" class="space-y-4">
                            <div>
                                <label class="auth-login-label">Username</label>
                                <input pInputText [(ngModel)]="username" name="username" class="w-full auth-login-control" placeholder="Platform admin username" autocomplete="username" />
                            </div>

                            <div>
                                <label class="auth-login-label">Password</label>
                                <p-password
                                    [(ngModel)]="password"
                                    name="password"
                                    [toggleMask]="true"
                                    [feedback]="false"
                                    styleClass="w-full auth-login-control"
                                    inputStyleClass="w-full auth-login-input"
                                    autocomplete="current-password"
                                ></p-password>
                            </div>
                        </div>

                        <div *ngIf="mode === 'parent'" class="space-y-4">
                            <div>
                                <label class="auth-login-label">Email or phone</label>
                                <input
                                    pInputText
                                    [(ngModel)]="parentIdentifier"
                                    name="parentIdentifier"
                                    class="w-full auth-login-control"
                                    placeholder="Email address or phone number"
                                    autocomplete="username"
                                />
                            </div>

                            <div>
                                <label class="auth-login-label">Password</label>
                                <p-password
                                    [(ngModel)]="password"
                                    name="password"
                                    [toggleMask]="true"
                                    [feedback]="false"
                                    styleClass="w-full auth-login-control"
                                    inputStyleClass="w-full auth-login-input"
                                    autocomplete="current-password"
                                ></p-password>
                            </div>
                        </div>

                        <div class="auth-login-footer-row">
                            <label class="auth-login-remember">
                                <input type="checkbox" />
                                <span>Remember me</span>
                            </label>
                            <button type="button" class="auth-login-link" (click)="showHelp()">Forgot password?</button>
                        </div>

                        <button
                            pButton
                            type="submit"
                            label="Sign In"
                            icon="pi pi-arrow-right"
                            iconPos="right"
                            class="w-full auth-login-submit"
                            [loading]="loading"
                            [disabled]="loading"
                        ></button>

                        <p class="auth-login-bottom-note">
                            Need access to a new workspace? Contact your school administrator or platform admin.
                        </p>
                    </form>
                </section>
            </div>
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

    showHelp(): void {
        this.messages.add({
            severity: 'info',
            summary: 'Password help',
            detail: 'Please contact your school admin or platform admin to reset your access.'
        });
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
