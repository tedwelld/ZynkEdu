import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { TextareaModule } from 'primeng/textarea';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { NotificationAudience, NotificationResponse, SchoolResponse, StudentResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-notifications',
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, MetricCardComponent, MultiSelectModule, AppDropdownComponent, PaginatorModule, SkeletonModule, TagModule, TextareaModule, TimelineModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                    <h1 class="text-3xl font-display font-bold m-0">Communication center</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Compose SMS or email alerts for students, guardians, teachers, and school admins from one place.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <app-dropdown
                        *ngIf="isPlatformAdmin"
                        [options]="schoolOptions"
                        [(ngModel)]="selectedSchoolId"
                        optionLabel="label"
                        optionValue="value"
                        class="w-72"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        filterPlaceholder="Search schools"
                        [showClear]="true"
                        (opened)="loadData()"
                        (ngModelChange)="onSchoolChange($event)"
                    ></app-dropdown>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Sent today" [value]="sentToday" delta="Today" hint="Recent dispatches" icon="pi pi-bell" tone="blue"></app-metric-card>
                <app-metric-card label="Recipients" [value]="recipientCount" delta="Across feed" hint="Students targeted" icon="pi pi-users" tone="green"></app-metric-card>
                <app-metric-card label="SMS" [value]="smsCount" delta="Channel mix" hint="Text delivery" icon="pi pi-comment" tone="orange"></app-metric-card>
                <app-metric-card label="Email" [value]="emailCount" delta="Channel mix" hint="Email delivery" icon="pi pi-envelope" tone="purple"></app-metric-card>
            </section>

            <div class="grid gap-6 xl:grid-cols-1">
                <article class="workspace-card">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Compose message</h2>
                            <p class="text-sm text-muted-color">Send to all or select students.</p>
                        </div>
                        <span class="text-xs uppercase tracking-[0.18em] text-primary font-semibold">Live API</span>
                    </div>
                    <div class="space-y-4">
                        <div *ngIf="isPlatformAdmin" class="rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm text-muted-color">
                            Platform admins must choose a school before sending class or individual notifications.
                        </div>

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
                            <label class="block text-sm font-semibold mb-2">Audience</label>
                            <app-dropdown
                                [options]="audienceOptions"
                                [(ngModel)]="draft.audience"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                appendTo="body"
                                (ngModelChange)="onAudienceChange($event)"
                            ></app-dropdown>
                        </div>
                        <div *ngIf="draft.audience === 'Class'">
                            <label class="block text-sm font-semibold mb-2">Class</label>
                            <app-dropdown
                                [options]="classOptions"
                                [(ngModel)]="draft.className"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                appendTo="body"
                                [filter]="true"
                                filterBy="label"
                                filterPlaceholder="Search classes"
                                [showClear]="true"
                                (opened)="loadData()"
                            ></app-dropdown>
                        </div>
                        <div *ngIf="draft.audience === 'Individual'">
                            <label class="block text-sm font-semibold mb-2">Targets</label>
                            <p-multiSelect [options]="studentOptions" [(ngModel)]="draft.studentIds" optionLabel="label" optionValue="value" display="chip" class="w-full" appendTo="body"></p-multiSelect>
                            <div class="mt-2 text-xs text-muted-color">Choose one or more students in the selected school.</div>
                        </div>
                        <div *ngIf="draft.audience === 'All'" class="text-xs text-muted-color">
                            Sends to every student and guardian in the selected school.
                        </div>
                        <div *ngIf="draft.audience === 'Teachers'" class="text-xs text-muted-color">
                            Sends to all active teachers in the selected school.
                        </div>
                        <div *ngIf="draft.audience === 'Admins'" class="text-xs text-muted-color">
                            Sends to all school admins in the selected school.
                        </div>
                        <div *ngIf="draft.audience === 'PlatformAdmins'" class="text-xs text-muted-color">
                            Sends to all platform admins.
                        </div>
                        <button pButton type="button" label="Send notification" icon="pi pi-send" class="w-full" (click)="send()" [disabled]="isSendBlocked"></button>
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
                        <div *ngFor="let notification of pagedNotifications" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold">{{ notification.title }}</div>
                                    <div class="text-sm text-muted-color">{{ notification.message }}</div>
                                </div>
                                <p-tag [value]="notification.type"></p-tag>
                            </div>
                            <div class="mt-3 grid gap-2">
                                <div *ngFor="let recipient of notification.recipients.slice(0, 3)" class="flex items-center justify-between rounded-2xl bg-surface-50 dark:bg-surface-900/50 px-3 py-2 text-sm">
                                    <span>{{ recipient.recipientName }}</span>
                                    <span class="text-muted-color">{{ recipient.status }}</span>
                                </div>
                                <div class="text-xs text-muted-color">{{ notification.recipients.length }} recipient(s) · {{ notification.createdAt | date: 'medium' }}</div>
                            </div>
                        </div>
                    </div>
                    <p-paginator *ngIf="!loading && notifications.length > sentFeedRows" [rows]="sentFeedRows" [first]="sentFeedFirst" [totalRecords]="notifications.length" (onPageChange)="onSentFeedPageChange($event)" styleClass="mt-4"></p-paginator>
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
    private readonly auth = inject(AuthService);

    loading = true;
    notifications: NotificationResponse[] = [];
    schools: SchoolResponse[] = [];
    students: StudentResponse[] = [];
    skeletonRows = Array.from({ length: 4 });
    selectedSchoolId: number | null = this.auth.schoolId();
    sentFeedFirst = 0;
    readonly sentFeedRows = 5;
    draft = {
        title: '',
        message: '',
        type: 'Sms',
        audience: 'All' as NotificationAudience,
        studentIds: [] as number[] | null,
        className: '' as string | null,
        schoolId: this.auth.schoolId()
    };

    channelOptions = [
        { label: 'SMS', value: 'Sms' },
        { label: 'Email', value: 'Email' }
    ];

    audienceOptions = [
        { label: 'Everyone', value: 'All' },
        { label: 'Class', value: 'Class' },
        { label: 'Individual', value: 'Individual' },
        { label: 'Teachers', value: 'Teachers' },
        { label: 'School admins', value: 'Admins' },
        { label: 'Platform admins', value: 'PlatformAdmins' }
    ];

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get studentOptions(): { label: string; value: number }[] {
        return this.students.map((student) => ({ label: `${student.fullName} (${student.class})`, value: student.id }));
    }

    get classOptions(): { label: string; value: string }[] {
        const values = Array.from(new Set(this.students.map((student) => student.class).filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
        return values.map((value) => ({ label: value, value }));
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get sentToday(): string {
        return this.notifications.filter((notification) => this.isToday(notification.createdAt)).length.toString();
    }

    get recipientCount(): string {
        return this.notifications.reduce((total, notification) => total + notification.recipients.length, 0).toString();
    }

    get smsCount(): string {
        return this.notifications.filter((notification) => notification.type === 'Sms').length.toString();
    }

    get emailCount(): string {
        return this.notifications.filter((notification) => notification.type === 'Email').length.toString();
    }

    get recentNotifications(): NotificationResponse[] {
        return this.notifications.slice(0, 4);
    }

    get pagedNotifications(): NotificationResponse[] {
        return this.notifications.slice(this.sentFeedFirst, this.sentFeedFirst + this.sentFeedRows);
    }

    get isSendBlocked(): boolean {
        if (this.loading || !this.draft.title.trim() || !this.draft.message.trim()) {
            return true;
        }

        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            return true;
        }

        if (this.draft.audience === 'Individual') {
            return !this.draft.studentIds?.length;
        }

        if (this.draft.audience === 'Class') {
            return !this.draft.className?.trim();
        }

        return false;
    }

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        forkJoin({
            notifications: this.api.getNotifications(),
            schools: this.isPlatformAdmin ? this.api.getPlatformSchools() : this.api.getSchools(),
            students: schoolId ? this.api.getStudents(undefined, schoolId) : of([] as StudentResponse[])
        }).subscribe({
            next: ({ notifications, schools, students }) => {
                this.schools = schools;
                this.notifications = schoolId ? notifications.filter((notification) => notification.schoolId === schoolId) : notifications;
                this.students = students;
                this.draft.schoolId = schoolId;
                this.syncDraftTargets();
                this.sentFeedFirst = 0;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.draft.schoolId = schoolId;
        this.syncDraftTargets(true);
        this.sentFeedFirst = 0;
        this.loadData();
    }

    onAudienceChange(audience: NotificationAudience): void {
        this.draft.audience = audience;
        this.syncDraftTargets();
    }

    send(): void {
        if (this.isPlatformAdmin && !this.selectedSchoolId) {
            this.messages.add({ severity: 'warn', summary: 'Select a school', detail: 'Choose a school before sending a notification.' });
            return;
        }

        if (this.draft.audience === 'Individual' && !this.draft.studentIds?.length) {
            this.messages.add({ severity: 'warn', summary: 'Choose recipients', detail: 'Select at least one student for an individual notification.' });
            return;
        }

        if (this.draft.audience === 'Class' && !this.draft.className?.trim()) {
            this.messages.add({ severity: 'warn', summary: 'Choose a class', detail: 'Select a class before sending a class notification.' });
            return;
        }

        this.api.sendNotification({
            title: this.draft.title,
            message: this.draft.message,
            type: this.draft.type,
            audience: this.draft.audience,
            schoolId: this.selectedSchoolId,
            className: this.draft.audience === 'Class' ? this.draft.className?.trim() ?? null : null,
            studentIds: this.draft.audience === 'Individual' && this.draft.studentIds?.length ? this.draft.studentIds : null,
            staffIds: null
        }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Sent', detail: 'Notification dispatched successfully.' });
                this.draft = {
                    title: '',
                    message: '',
                    type: 'Sms',
                    audience: 'All',
                    studentIds: [],
                    className: '',
                    schoolId: this.selectedSchoolId
                };
                this.sentFeedFirst = 0;
                this.loadData();
            },
            error: () => {
                this.messages.add({ severity: 'error', summary: 'Failed', detail: 'Notification could not be dispatched.' });
            }
        });
    }

    onSentFeedPageChange(event: PaginatorState): void {
        this.sentFeedFirst = event.first ?? 0;
    }

    private syncDraftTargets(clearAll = false): void {
        if (clearAll) {
            this.draft.studentIds = [];
            this.draft.className = '';
            return;
        }

        if (this.draft.audience !== 'Individual') {
            this.draft.studentIds = [];
        }

        if (this.draft.audience !== 'Class') {
            this.draft.className = '';
        }

        this.draft.studentIds = this.draft.studentIds?.filter((studentId) => this.students.some((student) => student.id === studentId)) ?? [];
        if (this.draft.className && !this.classOptions.some((option) => option.value === this.draft.className)) {
            this.draft.className = '';
        }
    }

    private isToday(isoDate: string): boolean {
        return new Date(isoDate).toDateString() === new Date().toDateString();
    }
}
