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

interface FallingLetterGlyph {
    char: string;
    size: number;
}

interface FallingLetterStream {
    left: number;
    duration: string;
    delay: string;
    opacity: number;
    letters: FallingLetterGlyph[];
}

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, AutoCompleteModule, ButtonModule, InputTextModule, PasswordModule],
    template: `
        <div class="auth-login-page">
            <div class="auth-login-letters" aria-hidden="true">
                <div
                    *ngFor="let stream of letterStreams; let streamIndex = index"
                    class="auth-login-letter-stream"
                    [style.left.%]="stream.left"
                    [style.animationDuration]="stream.duration"
                    [style.animationDelay]="stream.delay"
                    [style.opacity]="stream.opacity"
                >
                    <span
                        *ngFor="let letter of stream.letters; let letterIndex = index"
                        class="auth-login-letter"
                        [style.fontSize.rem]="letter.size"
                    >
                        {{ letter.char }}
                    </span>
                </div>
            </div>
            <div class="auth-login-shell">
                <section class="workspace-card auth-login-card">
                    <div class="auth-login-brand-row">
                        <div class="auth-login-brand">
                            <div class="auth-login-mark" aria-hidden="true"></div>
                            <div>
                                <p class="auth-login-brand-name">ZynkEdu</p>
                                <p class="auth-login-brand-subtitle">Secure access for your workspace</p>
                            </div>
                        </div>
                        <button type="button" class="auth-login-help" (click)="showHelp()">
                            Need help?
                        </button>
                    </div>

                    <div class="auth-login-badge-row">
                        <span class="auth-login-badge">School</span>
                        <span class="auth-login-badge">Platform</span>
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
    readonly letterStreams = createFallingLetterStreams();

    mode: 'staff' | 'platform' = 'staff';
    loading = false;
    username = '';
    password = '';
    schoolQuery = '';
    selectedSchool: SchoolResponse | null = null;
    schoolSuggestions: SchoolResponse[] = [];

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
            this.mode === 'platform'
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
            this.mode === 'platform'
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

function createFallingLetterStreams(): FallingLetterStream[] {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    return Array.from({ length: 18 }, (_, index) => {
        const left = 3 + ((index * 5.3) % 92);
        const duration = `${12 + (index % 6) * 1.7}s`;
        const delay = `-${(index % 7) * 1.4}s`;
        const opacity = 0.14 + (index % 5) * 0.035;
        const length = 14 + (index % 5);
        const letters = Array.from({ length }, (_, letterIndex) => ({
            char: alphabet[(index * 7 + letterIndex * 11) % alphabet.length],
            size: 0.8 + ((letterIndex + index) % 5) * 0.22
        }));

        return {
            left,
            duration,
            delay,
            opacity,
            letters
        };
    });
}
