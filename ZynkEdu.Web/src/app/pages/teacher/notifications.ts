import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { AcademicTermResponse, SchoolCalendarEventResponse, TimetableResponse } from '../../core/api/api.models';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

interface InboxItem {
    id: number;
    title: string;
    preview: string;
    category: string;
    timestamp: string;
    read: boolean;
    source: SchoolCalendarEventResponse;
}

@Component({
    standalone: true,
    selector: 'app-teacher-notifications',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                    <h1 class="text-3xl font-display font-bold m-0">Inbox and alerts</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Read the school updates, mark what you have seen, and keep the important notices visible.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Mark all read" icon="pi pi-check" severity="secondary" (click)="markAllRead()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Unread</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ unreadCount }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Announcements</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ categoryCount('Announcement') }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Deadlines</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ categoryCount('Deadline') }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Today&apos;s slots</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ todaySchedule.length }}</div>
                </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr] items-stretch">
                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Quick actions</h2>
                            <p class="text-sm text-muted-color">Jump to the most common teacher tasks.</p>
                        </div>
                    </div>
                    <div class="grid gap-3">
                        <button pButton type="button" label="Mark Attendance" icon="pi pi-check-square" class="w-full justify-start" routerLink="/teacher/attendance"></button>
                        <button pButton type="button" label="Enter Results" icon="pi pi-table" severity="secondary" class="w-full justify-start" routerLink="/teacher/results"></button>
                        <button pButton type="button" label="My Classes" icon="pi pi-users" severity="secondary" class="w-full justify-start" routerLink="/teacher/classes"></button>
                        <button pButton type="button" label="Account Settings" icon="pi pi-cog" severity="help" class="w-full justify-start" routerLink="/account/settings"></button>
                    </div>

                    <div class="mt-6 rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Schedule</div>
                                <div class="text-lg font-display font-bold">Today&apos;s classes</div>
                            </div>
                            <span class="text-sm text-muted-color">{{ todaySchedule.length }} slot(s)</span>
                        </div>
                        <div class="space-y-2">
                            <div *ngFor="let slot of todaySchedule" class="rounded-2xl bg-surface-100 dark:bg-surface-900/50 p-3">
                                <div class="font-semibold">{{ slot.class }} - {{ slot.subjectName }}</div>
                                <div class="text-sm text-muted-color">{{ slot.startTime }} - {{ slot.endTime }} · {{ slot.dayOfWeek }}</div>
                            </div>
                            <div *ngIf="todaySchedule.length === 0" class="text-sm text-muted-color">No slots found for today.</div>
                        </div>
                    </div>
                </article>

                <article class="workspace-card h-full flex flex-col">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Inbox</h2>
                            <p class="text-sm text-muted-color">Calendar events and school notices, sorted from newest to oldest.</p>
                        </div>
                        <app-dropdown [options]="categoryOptions" [(ngModel)]="selectedCategory" optionLabel="label" optionValue="value" class="w-56" appendTo="body" (opened)="loadData()" (ngModelChange)="refreshInbox()"></app-dropdown>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading && filteredInbox.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                        No notifications match the current filter.
                    </div>

                    <div *ngIf="!loading && filteredInbox.length > 0" class="space-y-3">
                        <div *ngFor="let item of filteredInbox" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4 transition-transform duration-200 hover:-translate-y-0.5" [ngClass]="item.read ? 'opacity-85' : 'bg-blue-50/40 dark:bg-blue-950/20'">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-start gap-3">
                                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white">
                                        <i class="pi pi-bell"></i>
                                    </div>
                                    <div>
                                        <div class="font-semibold">{{ item.title }}</div>
                                        <div class="text-sm text-muted-color">{{ item.preview }}</div>
                                        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-color">
                                            <span>{{ item.timestamp }}</span>
                                            <p-tag [value]="item.category" [severity]="categorySeverity(item.category)"></p-tag>
                                            <span *ngIf="!item.read" class="font-semibold text-blue-600">Unread</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button pButton type="button" icon="pi pi-check" class="p-button-text p-button-sm" (click)="markRead(item)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm" severity="danger" (click)="deleteItem(item)"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </section>
        </section>
    `
})
export class TeacherNotifications implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    loading = true;
    timetable: TimetableResponse[] = [];
    events: SchoolCalendarEventResponse[] = [];
    terms: AcademicTermResponse[] = [];
    inbox: InboxItem[] = [];
    filteredInbox: InboxItem[] = [];
    selectedCategory = 'All';
    termOptions: { label: string; value: number }[] = [];
    selectedTermId: number | null = null;
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        this.loadData();
    }

    get todaySchedule(): TimetableResponse[] {
        const today = new Date().toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
        return this.timetable.filter((slot) => slot.dayOfWeek.toLowerCase() === today);
    }

    get unreadCount(): string {
        return this.inbox.filter((item) => !item.read).length.toString();
    }

    get categoryOptions(): { label: string; value: string }[] {
        const categories = Array.from(new Set(this.inbox.map((item) => item.category)));
        return [{ label: 'All', value: 'All' }, ...categories.map((value) => ({ label: value, value }))];
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            terms: this.api.getAcademicTerms(),
            events: this.api.getCalendarEvents()
        }).subscribe({
            next: ({ terms, events }) => {
                this.terms = terms;
                this.termOptions = terms.map((term) => ({ label: term.name, value: term.id }));
                this.events = events;
                this.selectedTermId = this.selectedTermId ?? this.termOptions[0]?.value ?? null;
                const selectedTerm = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'Term 1';
                forkJoin({
                    timetable: this.api.getTeacherTimetable(selectedTerm)
                }).subscribe({
                    next: ({ timetable }) => {
                        this.timetable = timetable;
                        this.inbox = this.buildInbox(events);
                        this.refreshInbox();
                        this.loading = false;
                    },
                    error: () => {
                        this.loading = false;
                    }
                });
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    refreshInbox(): void {
        const items = this.selectedCategory === 'All' ? this.inbox : this.inbox.filter((item) => item.category === this.selectedCategory);
        this.filteredInbox = [...items].sort((a, b) => b.id - a.id);
    }

    markRead(item: InboxItem): void {
        item.read = true;
        this.refreshInbox();
        this.persistReadState();
    }

    deleteItem(item: InboxItem): void {
        this.inbox = this.inbox.filter((entry) => entry.id !== item.id);
        this.refreshInbox();
        this.persistReadState();
    }

    markAllRead(): void {
        this.inbox.forEach((item) => {
            item.read = true;
        });
        this.refreshInbox();
        this.persistReadState();
    }

    categoryCount(category: string): string {
        return this.inbox.filter((item) => item.category === category).length.toString();
    }

    categorySeverity(category: string): 'success' | 'warning' | 'info' | 'contrast' | 'secondary' {
        switch (category) {
            case 'Deadline':
                return 'warning';
            case 'Meeting':
                return 'contrast';
            case 'Announcement':
                return 'info';
            default:
                return 'secondary';
        }
    }

    private buildInbox(events: SchoolCalendarEventResponse[]): InboxItem[] {
        const readState = this.loadReadState();
        return events
            .map((event) => ({
                id: event.id,
                title: event.title,
                preview: event.description || 'School announcement',
                category: this.classifyEvent(event),
                timestamp: new Date(event.eventDate).toLocaleString(),
                read: readState.includes(event.id),
                source: event
            }))
            .sort((a, b) => new Date(b.source.eventDate).getTime() - new Date(a.source.eventDate).getTime());
    }

    private classifyEvent(event: SchoolCalendarEventResponse): string {
        const text = `${event.title} ${event.description ?? ''}`.toLowerCase();
        if (text.includes('deadline') || text.includes('submit') || text.includes('due')) {
            return 'Deadline';
        }

        if (text.includes('meeting') || text.includes('staff')) {
            return 'Meeting';
        }

        return 'Announcement';
    }

    private persistReadState(): void {
        const readIds = this.inbox.filter((item) => item.read).map((item) => item.id);
        localStorage.setItem(this.readStateKey(), JSON.stringify(readIds));
    }

    private loadReadState(): number[] {
        try {
            const raw = localStorage.getItem(this.readStateKey());
            if (!raw) {
                return [];
            }

            return JSON.parse(raw) as number[];
        } catch {
            return [];
        }
    }

    private readStateKey(): string {
        return `zynkedu.teacher.notifications.read.${this.auth.userId() ?? 'guest'}`;
    }
}
