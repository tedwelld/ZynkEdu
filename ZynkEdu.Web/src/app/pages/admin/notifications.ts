import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { TextareaModule } from 'primeng/textarea';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { NotificationResponse, StudentResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-notifications',
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, MetricCardComponent, MultiSelectModule, AppDropdownComponent, SkeletonModule, TagModule, TextareaModule, TimelineModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                    <h1 class="text-3xl font-display font-bold m-0">Communication center</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Compose SMS or email alerts and watch the sent feed update in the same workspace.</p>
                </div>
                <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Sent today" [value]="sentToday" delta="Today" hint="Recent dispatches" icon="pi pi-bell" tone="blue"></app-metric-card>
                <app-metric-card label="Recipients" [value]="recipientCount" delta="Across feed" hint="Students targeted" icon="pi pi-users" tone="green"></app-metric-card>
                <app-metric-card label="SMS" [value]="smsCount" delta="Channel mix" hint="Text delivery" icon="pi pi-comment" tone="orange"></app-metric-card>
                <app-metric-card label="Email" [value]="emailCount" delta="Channel mix" hint="Email delivery" icon="pi pi-envelope" tone="purple"></app-metric-card>
            </section>

            <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Compose message</h2>
                            <p class="text-sm text-muted-color">Send to all or select students.</p>
                        </div>
                        <span class="text-xs uppercase tracking-[0.18em] text-primary font-semibold">Live API</span>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Title</label>
                            <input pInputText [(ngModel)]="draft.title" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Message</label>
                            <textarea pTextarea [(ngModel)]="draft.message" rows="6" class="w-full"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Channel</label>
                            <app-dropdown [options]="channelOptions" [(ngModel)]="draft.type" optionLabel="label" optionValue="value" class="w-full" appendTo="body"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Targets</label>
                            <p-multiSelect [options]="studentOptions" [(ngModel)]="draft.studentIds" optionLabel="label" optionValue="value" display="chip" class="w-full" appendTo="body"></p-multiSelect>
                            <div class="mt-2 text-xs text-muted-color">Leave empty to target the full school.</div>
                        </div>
                        <button pButton type="button" label="Send notification" icon="pi pi-send" class="w-full" (click)="send()"></button>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Sent feed</h2>
                            <p class="text-sm text-muted-color">WhatsApp-style communication timeline.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ notifications.length }} messages</span>
                    </div>
                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                    </div>
                    <div *ngIf="!loading" class="space-y-4">
                        <div *ngFor="let notification of notifications" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold">{{ notification.title }}</div>
                                    <div class="text-sm text-muted-color">{{ notification.message }}</div>
                                </div>
                                <p-tag [value]="notification.type"></p-tag>
                            </div>
                            <div class="mt-3 grid gap-2">
                                <div *ngFor="let recipient of notification.recipients.slice(0, 3)" class="flex items-center justify-between rounded-2xl bg-surface-50 dark:bg-surface-900/50 px-3 py-2 text-sm">
                                    <span>{{ recipient.studentName }}</span>
                                    <span class="text-muted-color">{{ recipient.status }}</span>
                                </div>
                                <div class="text-xs text-muted-color">{{ notification.recipients.length }} recipient(s) · {{ notification.createdAt | date: 'medium' }}</div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Activity feed</h2>
                        <p class="text-sm text-muted-color">Recent messages and school updates.</p>
                    </div>
                    <span class="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Live</span>
                </div>
                <div class="space-y-3">
                    <div *ngFor="let notification of recentNotifications" class="flex items-start gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 p-3">
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0">
                            <i class="pi pi-bell"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="font-semibold truncate">{{ notification.title }}</div>
                            <div class="text-sm text-muted-color line-clamp-2">{{ notification.message }}</div>
                            <div class="mt-1 text-xs text-muted-color">{{ notification.recipients.length }} recipients · {{ notification.createdAt | date: 'mediumDate' }}</div>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    `
})
export class AdminNotifications implements OnInit {
    private readonly api = inject(ApiService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    notifications: NotificationResponse[] = [];
    students: StudentResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    draft = {
        title: '',
        message: '',
        type: 'SMS',
        studentIds: [] as number[] | null
    };

    channelOptions = [
        { label: 'SMS', value: 'SMS' },
        { label: 'Email', value: 'Email' }
    ];

    get studentOptions(): { label: string; value: number }[] {
        return this.students.map((student) => ({ label: `${student.fullName} (${student.class})`, value: student.id }));
    }

    get sentToday(): string {
        return this.notifications.filter((notification) => this.isToday(notification.createdAt)).length.toString();
    }

    get recipientCount(): string {
        return this.notifications.reduce((total, notification) => total + notification.recipients.length, 0).toString();
    }

    get smsCount(): string {
        return this.notifications.filter((notification) => notification.type === 'SMS').length.toString();
    }

    get emailCount(): string {
        return this.notifications.filter((notification) => notification.type === 'Email').length.toString();
    }

    get recentNotifications(): NotificationResponse[] {
        return this.notifications.slice(0, 4);
    }

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            notifications: this.api.getNotifications(),
            students: this.api.getStudents()
        }).subscribe({
            next: ({ notifications, students }) => {
                this.notifications = notifications;
                this.students = students;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    send(): void {
        this.api.sendNotification({
            title: this.draft.title,
            message: this.draft.message,
            type: this.draft.type,
            studentIds: this.draft.studentIds?.length ? this.draft.studentIds : null
        }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Sent', detail: 'Notification dispatched successfully.' });
                this.draft = { title: '', message: '', type: 'SMS', studentIds: [] };
                this.loadData();
            }
        });
    }

    private isToday(isoDate: string): boolean {
        return new Date(isoDate).toDateString() === new Date().toDateString();
    }
}
