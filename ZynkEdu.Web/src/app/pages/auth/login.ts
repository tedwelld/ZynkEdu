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
                <section class="auth-login-card" aria-label="ZynkEdu login">
                    <div class="auth-login-card-content">
                        <div class="auth-login-brand">
                            <img src="assets/images/zynkedu-icon.png" alt="" class="auth-login-mark" />
                            <p class="auth-login-brand-name">ZynkEdu</p>
                        </div>
                        <h1 class="auth-login-title">Admin Panel</h1>
                        <p class="auth-login-subtitle">Control panel login</p>

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
                            <div *ngIf="mode === 'staff'" class="auth-login-fields">
                                <div class="auth-login-field">
                                    <span class="auth-login-input-wrap">
                                        <i class="pi pi-building" aria-hidden="true"></i>
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
                                            inputStyleClass="w-full auth-login-input"
                                            name="schoolQuery"
                                        >
                                            <ng-template let-school pTemplate="item">
                                                <div class="auth-login-suggestion">
                                                    <span class="auth-login-suggestion-name">{{ school.name }}</span>
                                                    <span class="auth-login-suggestion-meta">{{ school.address }}</span>
                                                </div>
                                            </ng-template>
                                        </p-autoComplete>
                                    </span>
                                </div>

                                <div class="auth-login-field">
                                    <span class="auth-login-input-wrap">
                                        <i class="pi pi-user" aria-hidden="true"></i>
                                        <input pInputText [(ngModel)]="username" name="username" class="w-full auth-login-input" placeholder="Staff username" autocomplete="username" />
                                    </span>
                                </div>

                                <div class="auth-login-field">
                                    <span class="auth-login-input-wrap">
                                        <i class="pi pi-key" aria-hidden="true"></i>
                                        <p-password
                                            [(ngModel)]="password"
                                            name="password"
                                            [toggleMask]="true"
                                            [feedback]="false"
                                            styleClass="w-full auth-login-control"
                                            inputStyleClass="w-full auth-login-input"
                                            autocomplete="current-password"
                                        ></p-password>
                                    </span>
                                </div>
                            </div>

                            <div *ngIf="mode === 'platform'" class="auth-login-fields">
                                <div class="auth-login-field">
                                    <span class="auth-login-input-wrap">
                                        <i class="pi pi-user" aria-hidden="true"></i>
                                        <input pInputText [(ngModel)]="username" name="username" class="w-full auth-login-input" placeholder="Platform admin username" autocomplete="username" />
                                    </span>
                                </div>

                                <div class="auth-login-field">
                                    <span class="auth-login-input-wrap">
                                        <i class="pi pi-key" aria-hidden="true"></i>
                                        <p-password
                                            [(ngModel)]="password"
                                            name="password"
                                            [toggleMask]="true"
                                            [feedback]="false"
                                            styleClass="w-full auth-login-control"
                                            inputStyleClass="w-full auth-login-input"
                                            autocomplete="current-password"
                                        ></p-password>
                                    </span>
                                </div>
                            </div>

                            <button
                                pButton
                                type="submit"
                                label="Login"
                                class="auth-login-submit"
                                [loading]="loading"
                                [disabled]="loading"
                            ></button>

                            <button type="button" class="auth-login-link" (click)="showHelp()">Forgot password?</button>
                        </form>
                    </div>
                    <div class="auth-login-waves" aria-hidden="true">
                        <span class="auth-login-wave auth-login-wave-one"></span>
                        <span class="auth-login-wave auth-login-wave-two"></span>
                        <span class="auth-login-wave auth-login-wave-three"></span>
                    </div>
                </section>
            </div>
        </div>
    `
})
export class Login implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

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
