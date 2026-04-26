import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { UpdateSchoolUserRequest, UserResponse } from '../../core/api/api.models';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-teacher-profile',
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card">
                <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Profile</p>
                <h1 class="text-3xl font-display font-bold m-0">Your account details</h1>
                <p class="text-muted-color mt-2 max-w-2xl">Review your details and update your display name or password when needed.</p>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Display name" [value]="profile?.displayName ?? 'Loading'" delta="Visible name" hint="Profile identity" icon="pi pi-id-card" tone="blue"></app-metric-card>
                <app-metric-card label="Role" [value]="profile?.role ?? 'Teacher'" delta="Workspace role" hint="Access level" icon="pi pi-shield" tone="purple"></app-metric-card>
                <app-metric-card label="School" [value]="profile?.schoolId?.toString() ?? '0'" delta="Current school" hint="Tenant scope" icon="pi pi-building" tone="green"></app-metric-card>
                <app-metric-card label="Status" [value]="profile?.isActive ? 'Active' : 'Inactive'" delta="Account state" hint="Login access" icon="pi pi-check-circle" tone="orange"></app-metric-card>
            </section>

            <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <article class="workspace-card">
                    <h2 class="text-xl font-display font-bold mb-4">Account summary</h2>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="5rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <div *ngIf="!loading && profile" class="space-y-3">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Username</div>
                            <div class="font-semibold mt-1">{{ profile.username }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Created</div>
                            <div class="font-semibold mt-1">{{ profile.createdAt | date : 'medium' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Login state</div>
                            <p-tag [value]="profile.isActive ? 'Active' : 'Inactive'" [severity]="profile.isActive ? 'success' : 'danger'"></p-tag>
                        </div>
                    </div>
                </article>

                <article class="workspace-card">
                    <h2 class="text-xl font-display font-bold mb-4">Edit profile</h2>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <div *ngIf="!loading && profile" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Display name</label>
                            <input pInputText [(ngModel)]="draft.displayName" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">New password</label>
                            <input pInputText type="password" [(ngModel)]="draft.password" class="w-full" placeholder="Leave blank to keep current password" />
                        </div>
                        <div class="flex justify-end gap-3 pt-2">
                            <button pButton type="button" label="Reset" severity="secondary" (click)="resetDraft()"></button>
                            <button pButton type="button" label="Save changes" icon="pi pi-check" (click)="saveProfile()"></button>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class TeacherProfile implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    profile: UserResponse | null = null;
    draft = {
        displayName: '',
        password: ''
    };

    ngOnInit(): void {
        this.loadProfile();
    }

    loadProfile(): void {
        this.loading = true;
        const teacherId = this.auth.userId();
        if (!teacherId) {
            this.loading = false;
            return;
        }

        this.api.getTeachers().subscribe({
            next: (teachers) => {
                this.profile = teachers.find((teacher) => teacher.id === teacherId) ?? null;
                this.resetDraft();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    resetDraft(): void {
        if (!this.profile) {
            return;
        }

        this.draft = {
            displayName: this.profile.displayName,
            password: ''
        };
    }

    saveProfile(): void {
        if (!this.profile) {
            return;
        }

        const request: UpdateSchoolUserRequest = {
            displayName: this.draft.displayName.trim() || this.profile.displayName,
            password: this.draft.password.trim() || null,
            isActive: this.profile.isActive
        };

        this.api.updateTeacher(this.profile.id, request).subscribe({
            next: (updated) => {
                this.profile = updated;
                this.resetDraft();
            }
        });
    }
}
