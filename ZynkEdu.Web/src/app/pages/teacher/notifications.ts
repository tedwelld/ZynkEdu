import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { AcademicTermResponse, NotificationResponse, SchoolCalendarEventResponse, TimetableResponse } from '../../core/api/api.models';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

interface InboxItem {
    id: number;
    title: string;
    preview: string;
    category: string;
    timestamp: string;
    timestampValue: number;
    read: boolean;
    source: SchoolCalendarEventResponse | NotificationResponse;
}

interface QuickActionItem {
    label: string;
    icon: string;
    route: string;
    severity: 'secondary' | 'help' | 'info';
}

interface TimetableReportRow {
    label: string;
    cells: string[];
    isBreak: boolean;
}

@Component({
    standalone: true,
    selector: 'app-teacher-notifications',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DialogModule, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                    <h1 class="text-3xl font-display font-bold m-0">Schedule and alerts</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Review your timetable in a full-width table and open the bell icon whenever you want to read stored notices.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" icon="pi pi-bell" severity="secondary" class="p-button-text" (click)="openNotifications()"></button>
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

            <article class="workspace-card">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Quick actions</h2>
                        <p class="text-sm text-muted-color">Jump to the most common teacher tasks.</p>
                    </div>
                    <button pButton type="button" severity="secondary" class="p-button-text" (click)="openNotifications()">
                        <span class="inline-flex items-center gap-2">
                            <i class="pi pi-bell"></i>
                            <span>Notifications</span>
                            <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">{{ unreadCount }}</span>
                        </span>
                    </button>
                </div>
                <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <button
                        *ngFor="let action of pagedQuickActions"
                        pButton
                        type="button"
                        [label]="action.label"
                        [icon]="action.icon"
                        [severity]="action.severity"
                        style="width: 100%; justify-content: flex-start;"
                        [routerLink]="action.route"
                    ></button>
                </div>
                <div class="mt-4 flex items-center justify-between gap-3">
                    <span class="text-xs uppercase tracking-[0.2em] text-muted-color">
                        Page {{ quickActionsPage + 1 }} of {{ quickActionTotalPages }}
                    </span>
                    <div class="flex items-center gap-2">
                        <button pButton type="button" icon="pi pi-chevron-left" severity="secondary" class="p-button-text p-button-sm" [disabled]="quickActionsPage === 0" (click)="previousQuickActionsPage()"></button>
                        <button pButton type="button" icon="pi pi-chevron-right" severity="secondary" class="p-button-text p-button-sm" [disabled]="quickActionsPage >= quickActionTotalPages - 1" (click)="nextQuickActionsPage()"></button>
                    </div>
                </div>
            </article>

            <article class="workspace-card w-full">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">My timetable</h2>
                        <p class="text-sm text-muted-color">This timetable only shows the classes, subjects, and times assigned to you.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (ngModelChange)="onTermChange($event)"></app-dropdown>
                        <app-dropdown [options]="dayFilterOptions" [(ngModel)]="selectedDayFilter" optionLabel="label" optionValue="value" class="w-40" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search days" (ngModelChange)="onDayChange($event)"></app-dropdown>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="reportRows.length === 0" (click)="exportTimetablePdf()"></button>
                    </div>
                </div>

                <div *ngIf="loading" class="mt-4 space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loading && reportRows.length === 0" class="mt-4 rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No timetable entries are available for the current term.
                </div>

                <div *ngIf="!loading && reportRows.length > 0" class="mt-4 overflow-x-auto">
                    <table class="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                <th class="sticky left-0 z-10 bg-surface-0 dark:bg-surface-950 px-4 py-3 whitespace-nowrap">Time</th>
                                <th *ngFor="let day of displayedDays" class="px-4 py-3 whitespace-nowrap">{{ day }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of reportRows; let rowIndex = index" class="border-t border-surface-200 dark:border-surface-800" [ngClass]="row.isBreak ? 'bg-surface-200/60 dark:bg-surface-800/50' : (rowIndex % 2 === 0 ? 'bg-surface-0 dark:bg-surface-950' : 'bg-surface-50 dark:bg-surface-900/40')">
                                <td class="sticky left-0 z-10 bg-inherit px-4 py-4 align-top font-semibold whitespace-nowrap">
                                    {{ row.label }}
                                </td>
                                <td *ngFor="let cell of row.cells" class="px-4 py-4 align-top">
                                    <div class="min-h-20 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 text-sm leading-6 whitespace-pre-line" [ngClass]="cell ? 'bg-surface-0/90 dark:bg-surface-950/80' : 'border-dashed text-center text-muted-color flex items-center justify-center'">
                                        {{ cell || 'Empty' }}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>

            <p-dialog [(visible)]="notificationDialogVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(72rem, 96vw)' }" appendTo="body" header="Notifications">
                <div class="space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Stored alerts</div>
                            <div class="text-xl font-display font-bold">{{ unreadCount }} unread notification(s)</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-3">
                            <app-dropdown [options]="categoryOptions" [(ngModel)]="selectedCategory" optionLabel="label" optionValue="value" class="w-56" appendTo="body" (ngModelChange)="refreshInbox()"></app-dropdown>
                            <button pButton type="button" label="Mark all read" icon="pi pi-check" severity="secondary" (click)="markAllRead()"></button>
                        </div>
                    </div>

                    <div *ngIf="filteredInbox.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                        No notifications match the current filter.
                    </div>

                    <div *ngIf="filteredInbox.length > 0" class="space-y-3">
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
                                    <button pButton type="button" label="Read" icon="pi pi-eye" class="p-button-sm" (click)="openNotification(item)"></button>
                                    <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm" severity="danger" (click)="deleteItem(item)"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </p-dialog>

            <p-dialog [(visible)]="notificationDetailVisible" [modal]="true" [draggable]="false" [dismissableMask]="true" [style]="{ width: 'min(50rem, 96vw)' }" appendTo="body" [header]="selectedNotification?.title ?? 'Notification'">
                <div *ngIf="selectedNotification" class="space-y-4">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-color">
                        <span>{{ selectedNotification.timestamp }}</span>
                        <p-tag [value]="selectedNotification.category" [severity]="categorySeverity(selectedNotification.category)"></p-tag>
                    </div>
                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4 leading-7 text-sm whitespace-pre-line">
                        {{ selectedNotification.preview }}
                    </div>
                    <div class="flex justify-end">
                        <button pButton type="button" label="Done" icon="pi pi-check" (click)="closeNotificationDetail()"></button>
                    </div>
                </div>
            </p-dialog>
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
    selectedDayFilter = 'All';
    notificationDialogVisible = false;
    notificationDetailVisible = false;
    selectedNotification: InboxItem | null = null;
    quickActionsPage = 0;
    readonly quickActionsPageSize = 5;
    readonly quickActions: QuickActionItem[] = [
        { label: 'Mark Attendance', icon: 'pi pi-check-square', route: '/teacher/attendance', severity: 'secondary' },
        { label: 'Enter Results', icon: 'pi pi-table', route: '/teacher/results', severity: 'secondary' },
        { label: 'My Classes', icon: 'pi pi-users', route: '/teacher/classes', severity: 'secondary' },
        { label: 'Account Settings', icon: 'pi pi-cog', route: '/account/settings', severity: 'help' }
    ];
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        this.loadData();
    }

    get todaySchedule(): TimetableResponse[] {
        const today = new Date().toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
        return this.timetable.filter((slot) => slot.dayOfWeek.toLowerCase() === today);
    }

    get sortedTimetable(): TimetableResponse[] {
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        return [...this.timetable].sort((left, right) => {
            const dayDelta = dayOrder.indexOf(left.dayOfWeek) - dayOrder.indexOf(right.dayOfWeek);
            if (dayDelta !== 0) {
                return dayDelta;
            }

            return left.startTime.localeCompare(right.startTime);
        });
    }

    get sessionRows(): { label: string; startTime: string; endTime: string }[] {
        return [
            ['07:20', '07:55'],
            ['07:55', '08:30'],
            ['08:30', '09:05'],
            ['09:05', '09:40'],
            ['09:40', '10:15'],
            ['10:50', '11:25'],
            ['11:25', '12:00'],
            ['12:00', '12:35'],
            ['12:35', '13:10']
        ].map(([startTime, endTime]) => ({
            label: `${startTime} - ${endTime}`,
            startTime,
            endTime
        }));
    }

    get dayFilterOptions(): { label: string; value: string }[] {
        return [
            { label: 'All days', value: 'All' },
            { label: 'Monday', value: 'Monday' },
            { label: 'Tuesday', value: 'Tuesday' },
            { label: 'Wednesday', value: 'Wednesday' },
            { label: 'Thursday', value: 'Thursday' },
            { label: 'Friday', value: 'Friday' }
        ];
    }

    get quickActionTotalPages(): number {
        return Math.max(1, Math.ceil(this.quickActions.length / this.quickActionsPageSize));
    }

    get pagedQuickActions(): QuickActionItem[] {
        const start = this.quickActionsPage * this.quickActionsPageSize;
        return this.quickActions.slice(start, start + this.quickActionsPageSize);
    }

    get displayedDays(): string[] {
        return this.selectedDayFilter === 'All' ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] : [this.selectedDayFilter];
    }

    get reportRows(): TimetableReportRow[] {
        const timetable = this.timetable;
        if (timetable.length === 0) {
            return [];
        }

        const slotLookup = new Map<string, TimetableResponse[]>();
        for (const slot of timetable) {
            const key = this.slotKey(slot.dayOfWeek, slot.startTime, slot.endTime);
            const entries = slotLookup.get(key) ?? [];
            entries.push(slot);
            slotLookup.set(key, entries);
        }

        const rows: TimetableReportRow[] = [];
        for (let index = 0; index < this.sessionRows.length; index++) {
            const session = this.sessionRows[index];
            rows.push({
                label: `${session.startTime} - ${session.endTime}`,
                cells: this.displayedDays.map((day) => this.reportCellValue(slotLookup.get(this.slotKey(day, session.startTime, session.endTime)) ?? [])),
                isBreak: false
            });

            if (index === 4) {
                rows.push({
                    label: '10:15 - 10:50 Tea Break',
                    cells: this.displayedDays.map(() => 'Tea Break'),
                    isBreak: true
                });
            }
        }

        rows.push({
            label: '13:10 - 14:20 Lunch Break',
            cells: this.displayedDays.map(() => 'Lunch Break'),
            isBreak: true
        });

        return rows;
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
            events: this.api.getCalendarEvents(),
            notifications: this.api.getNotifications()
        }).subscribe({
            next: ({ terms, events, notifications }) => {
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
                        this.inbox = this.buildInbox(events, notifications);
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

    onTermChange(termId: number | null): void {
        this.selectedTermId = termId;
        this.loadData();
    }

    onDayChange(day: string): void {
        this.selectedDayFilter = day;
    }

    previousQuickActionsPage(): void {
        this.quickActionsPage = Math.max(0, this.quickActionsPage - 1);
    }

    nextQuickActionsPage(): void {
        this.quickActionsPage = Math.min(this.quickActionTotalPages - 1, this.quickActionsPage + 1);
    }

    openNotifications(): void {
        this.notificationDialogVisible = true;
    }

    refreshInbox(): void {
        const items = this.selectedCategory === 'All' ? this.inbox : this.inbox.filter((item) => item.category === this.selectedCategory);
        this.filteredInbox = [...items].sort((a, b) => b.timestampValue - a.timestampValue);
    }

    markRead(item: InboxItem): void {
        item.read = true;
        this.refreshInbox();
        this.persistReadState();
    }

    openNotification(item: InboxItem): void {
        this.markRead(item);
        this.selectedNotification = item;
        this.notificationDetailVisible = true;
    }

    closeNotificationDetail(): void {
        this.notificationDetailVisible = false;
    }

    deleteItem(item: InboxItem): void {
        this.inbox = this.inbox.filter((entry) => entry.id !== item.id);
        this.refreshInbox();
        this.persistReadState();
        if (this.selectedNotification?.id === item.id) {
            this.selectedNotification = null;
            this.notificationDetailVisible = false;
        }
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

    exportTimetablePdf(): void {
        const termLabel = this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'All terms';
        const dayLabel = this.selectedDayFilter;
        const displayedDays = this.displayedDays;
        const reportRows = this.reportRows;
        const fileName = `teacher-timetable-${termLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'timetable'}-${dayLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'all-days'}.pdf`;
        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('My timetable', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Teacher: ${this.auth.displayName()}`, margin, 60);
        doc.text(`Term: ${termLabel}`, margin, 74);
        doc.text(`Day: ${dayLabel}`, margin, 88);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 102);

        autoTable(doc, {
            startY: 118,
            head: [['Time', ...displayedDays]],
            body: reportRows.map((row) => [row.label, ...row.cells]),
            theme: 'grid',
            styles: {
                fontSize: 6.8,
                cellPadding: 3,
                minCellHeight: 30,
                valign: 'middle',
                overflow: 'linebreak',
                halign: 'center'
            },
            headStyles: {
                fillColor: [37, 99, 235]
            },
            columnStyles: {
                0: { cellWidth: 106 }
            },
            didParseCell: (data) => {
                if (data.section !== 'body') {
                    return;
                }

                const reportRow = reportRows[data.row.index];
                if (!reportRow) {
                    return;
                }

                data.cell.styles.fillColor = reportRow.isBreak
                    ? [229, 231, 235]
                    : (data.row.index % 2 === 0 ? [248, 250, 252] : [240, 249, 255]);
                data.cell.styles.textColor = reportRow.isBreak ? [75, 85, 99] : [15, 23, 42];
                if (data.column.index === 0) {
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            margin: {
                left: margin,
                right: margin
            }
        });

        doc.save(fileName);
    }

    private buildInbox(events: SchoolCalendarEventResponse[], notifications: NotificationResponse[]): InboxItem[] {
        const readState = this.loadReadState();
        const eventItems = events.map((event) => ({
            id: event.id,
            title: event.title,
            preview: event.description || 'School announcement',
            category: this.classifyEvent(event),
            timestamp: new Date(event.eventDate).toLocaleString(),
            timestampValue: new Date(event.eventDate).getTime(),
            read: readState.includes(event.id),
            source: event
        }));

        const notificationItems = notifications.map((notification) => ({
            id: notification.id,
            title: notification.title,
            preview: notification.message,
            category: this.classifyNotification(notification),
            timestamp: new Date(notification.createdAt).toLocaleString(),
            timestampValue: new Date(notification.createdAt).getTime(),
            read: readState.includes(notification.id),
            source: notification
        }));

        return [...eventItems, ...notificationItems].sort((left, right) => right.timestampValue - left.timestampValue);
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

    private classifyNotification(notification: NotificationResponse): string {
        if (notification.type === 'System' && notification.title.toLowerCase().includes('timetable')) {
            return 'Announcement';
        }

        return notification.type || 'Announcement';
    }

    private reportCellValue(slots: TimetableResponse[]): string {
        if (slots.length === 0) {
            return '';
        }

        return slots
            .map((slot) => `${slot.class}\n${slot.subjectName}\n${slot.startTime} - ${slot.endTime}`)
            .join('\n\n');
    }

    private slotKey(dayOfWeek: string, startTime: string, endTime: string): string {
        return `${dayOfWeek}|${startTime}|${endTime}`;
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
