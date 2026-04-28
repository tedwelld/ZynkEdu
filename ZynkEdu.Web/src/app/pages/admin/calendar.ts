import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AcademicTermResponse, CreateSchoolCalendarEventRequest, SchoolCalendarEventResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

interface CalendarEventDraft {
    academicTermId: number | null;
    title: string;
    description: string;
    eventDate: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-calendar',
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, AppDropdownComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">School calendar</p>
                    <h1 class="text-3xl font-display font-bold m-0">Three-term setup and events</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Set term dates, add events, and switch between list, month, and week views.</p>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex rounded-2xl border border-surface-200 dark:border-surface-700 p-1">
                        <button pButton type="button" label="List" class="p-button-text p-button-sm" [severity]="viewMode === 'list' ? 'primary' : 'secondary'" (click)="viewMode = 'list'"></button>
                        <button pButton type="button" label="Month" class="p-button-text p-button-sm" [severity]="viewMode === 'month' ? 'primary' : 'secondary'" (click)="viewMode = 'month'"></button>
                        <button pButton type="button" label="Week" class="p-button-text p-button-sm" [severity]="viewMode === 'week' ? 'primary' : 'secondary'" (click)="viewMode = 'week'"></button>
                    </div>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div *ngFor="let term of terms" class="workspace-card">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">{{ term.name }}</div>
                            <div class="text-lg font-display font-bold mt-1">Term {{ term.termNumber }}</div>
                        </div>
                        <p-tag [value]="termEvents(term.id).length + ' event(s)'"></p-tag>
                    </div>

                    <div class="space-y-3 mt-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Start date</label>
                            <input pInputText type="date" class="w-full" [(ngModel)]="term.startDate" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">End date</label>
                            <input pInputText type="date" class="w-full" [(ngModel)]="term.endDate" />
                        </div>
                        <button pButton type="button" label="Save term" icon="pi pi-check" severity="success" class="w-full" (click)="saveTerm(term)"></button>
                    </div>
                </div>
            </section>

            <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Add event</h2>
                            <p class="text-sm text-muted-color">Enter a school event for any of the three terms.</p>
                        </div>
                        <span class="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Admin only</span>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Term</label>
                            <app-dropdown [options]="termOptions" [(ngModel)]="eventDraft.academicTermId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" (opened)="loadData()"></app-dropdown>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Title</label>
                            <input pInputText [(ngModel)]="eventDraft.title" class="w-full" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Description</label>
                            <textarea [(ngModel)]="eventDraft.description" rows="4" class="w-full rounded-2xl border border-surface-300 dark:border-surface-700 bg-transparent px-4 py-3"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">Date</label>
                            <input pInputText type="date" [(ngModel)]="eventDraft.eventDate" class="w-full" />
                        </div>
                        <button pButton type="button" label="Add event" icon="pi pi-plus" severity="help" class="w-full" (click)="createEvent()"></button>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Term events</h2>
                            <p class="text-sm text-muted-color">Overview grouped by month or week.</p>
                        </div>
                        <span class="text-sm text-muted-color">{{ events.length }} total</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="space-y-3">
                        <ng-container *ngIf="viewMode === 'list'; else groupedEventsTemplate">
                            <div *ngFor="let event of events" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <div class="font-semibold">{{ event.title }}</div>
                                        <div class="text-sm text-muted-color">{{ event.description || 'No description provided.' }}</div>
                                        <div class="text-xs text-muted-color mt-1">{{ event.termName }} - {{ event.eventDate | date: 'mediumDate' }}</div>
                                    </div>
                                    <div class="flex flex-col items-end gap-2">
                                        <p-tag [value]="eventType(event)" [severity]="eventTypeSeverity(event)"></p-tag>
                                        <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteEvent(event)"></button>
                                    </div>
                                </div>
                            </div>
                        </ng-container>

                        <ng-template #groupedEventsTemplate>
                            <div *ngFor="let group of groupedEventsByPeriod" class="space-y-3">
                                <div class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">{{ group.label }}</div>
                                <div *ngFor="let event of group.items" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="font-semibold">{{ event.title }}</div>
                                            <div class="text-sm text-muted-color">{{ event.description || 'No description provided.' }}</div>
                                            <div class="text-xs text-muted-color mt-1">{{ event.termName }} - {{ event.eventDate | date: 'mediumDate' }}</div>
                                        </div>
                                        <div class="flex flex-col items-end gap-2">
                                            <p-tag [value]="eventType(event)" [severity]="eventTypeSeverity(event)"></p-tag>
                                            <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="deleteEvent(event)"></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ng-template>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class AdminCalendar implements OnInit {
    private readonly api = inject(ApiService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);

    loading = true;
    terms: AcademicTermResponse[] = [];
    events: SchoolCalendarEventResponse[] = [];
    viewMode: 'list' | 'month' | 'week' = 'list';
    skeletonRows = Array.from({ length: 4 });
    eventDraft: CalendarEventDraft = {
        academicTermId: null,
        title: '',
        description: '',
        eventDate: new Date().toISOString().slice(0, 10)
    };

    get termOptions(): { label: string; value: number }[] {
        return this.terms.map((term) => ({ label: term.name, value: term.id }));
    }

    get groupedEventsByPeriod(): { label: string; items: SchoolCalendarEventResponse[] }[] {
        const groups = new Map<string, SchoolCalendarEventResponse[]>();
        for (const event of this.events) {
            const date = new Date(event.eventDate);
            const key = this.viewMode === 'week'
                ? `Week of ${this.startOfWeek(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const items = groups.get(key) ?? [];
            items.push(event);
            groups.set(key, items);
        }

        return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
    }

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        forkJoin({
            terms: this.api.getAcademicTerms(),
            events: this.api.getCalendarEvents()
        }).subscribe({
            next: ({ terms, events }) => {
                this.terms = terms;
                this.events = events;
                this.eventDraft.academicTermId = this.eventDraft.academicTermId ?? this.terms[0]?.id ?? null;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    saveTerm(term: AcademicTermResponse): void {
        this.api.updateAcademicTerm(term.termNumber, {
            name: term.name,
            startDate: term.startDate || null,
            endDate: term.endDate || null
        }).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Term saved', detail: `${term.name} dates updated.` });
                this.loadData();
            }
        });
    }

    createEvent(): void {
        if (!this.eventDraft.academicTermId || !this.eventDraft.title.trim() || !this.eventDraft.eventDate) {
            return;
        }

        const payload: CreateSchoolCalendarEventRequest = {
            academicTermId: this.eventDraft.academicTermId,
            title: this.eventDraft.title.trim(),
            description: this.eventDraft.description.trim() || null,
            eventDate: this.eventDraft.eventDate
        };

        this.api.createCalendarEvent(payload).subscribe({
            next: () => {
                this.messages.add({ severity: 'success', summary: 'Event added', detail: 'The school calendar was updated.' });
                this.eventDraft.title = '';
                this.eventDraft.description = '';
                this.eventDraft.eventDate = new Date().toISOString().slice(0, 10);
                this.loadData();
            }
        });
    }

    deleteEvent(event: SchoolCalendarEventResponse): void {
        this.confirmation.confirm({
            message: `Delete ${event.title}?`,
            header: 'Delete event',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () =>
                this.api.deleteCalendarEvent(event.id).subscribe({
                    next: () => {
                        this.messages.add({ severity: 'info', summary: 'Event deleted', detail: `${event.title} removed.` });
                        this.loadData();
                    }
                })
        });
    }

    termEvents(termId: number): SchoolCalendarEventResponse[] {
        return this.events.filter((event) => event.academicTermId === termId);
    }

    eventType(event: SchoolCalendarEventResponse): string {
        const text = `${event.title} ${event.description || ''}`.toLowerCase();
        if (text.includes('exam')) {
            return 'Exam';
        }

        if (text.includes('holiday')) {
            return 'Holiday';
        }

        if (text.includes('meeting')) {
            return 'Meeting';
        }

        return 'Event';
    }

    eventTypeSeverity(event: SchoolCalendarEventResponse): 'success' | 'warning' | 'help' | 'secondary' {
        const type = this.eventType(event);
        if (type === 'Exam') {
            return 'warning';
        }

        if (type === 'Holiday') {
            return 'help';
        }

        if (type === 'Meeting') {
            return 'success';
        }

        return 'secondary';
    }

    private startOfWeek(date: Date): Date {
        const result = new Date(date);
        const day = result.getDay();
        const offset = (day + 6) % 7;
        result.setDate(result.getDate() - offset);
        result.setHours(0, 0, 0, 0);
        return result;
    }
}
