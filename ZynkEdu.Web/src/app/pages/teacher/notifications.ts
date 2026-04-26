import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AcademicTermResponse, NotificationResponse, SchoolCalendarEventResponse, TimetableResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

@Component({
    standalone: true,
    selector: 'app-teacher-notifications',
    imports: [CommonModule, FormsModule, ButtonModule, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                    <h1 class="text-3xl font-display font-bold m-0">Timetable and messages</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">See your term timetable first, then review the messages sent by the school.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Term</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ selectedTerm || 'All terms' }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Slots</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ timetable.length }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Messages</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ notifications.length }}</div>
                </div>
                <div class="workspace-card">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Classes covered</div>
                    <div class="text-2xl font-display font-bold mt-2">{{ coveredClasses }}</div>
                </div>
            </section>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Term timetable</h2>
                        <p class="text-sm text-muted-color">Time, class, and subject for each teaching slot.</p>
                    </div>
                    <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-64" appendTo="body" (ngModelChange)="refreshSchedule()"></app-dropdown>
                </div>

                <div *ngIf="loadingTimetable" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loadingTimetable" [value]="timetable" [rowHover]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Teacher</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-slot>
                        <tr>
                            <td>{{ slot.dayOfWeek }}</td>
                            <td>{{ slot.startTime }} - {{ slot.endTime }}</td>
                            <td>{{ slot.class }}</td>
                            <td>{{ slot.subjectName }}</td>
                            <td>{{ slot.teacherName }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">School calendar</h2>
                        <p class="text-sm text-muted-color">Events entered by the school admin for the selected term.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ events.length }} event(s)</span>
                </div>

                <div *ngIf="loadingMessages" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!loadingMessages" class="space-y-3">
                    <div *ngFor="let event of events" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <div class="font-semibold">{{ event.title }}</div>
                                <div class="text-sm text-muted-color">{{ event.description || 'Calendar event' }}</div>
                            </div>
                            <p-tag [value]="event.termName"></p-tag>
                        </div>
                        <div class="mt-2 text-xs text-muted-color">{{ event.eventDate | date: 'mediumDate' }}</div>
                    </div>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Messages</h2>
                        <p class="text-sm text-muted-color">School notifications and announcements.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ notifications.length }} items</span>
                </div>
                <div class="space-y-4">
                    <div *ngFor="let notification of notifications" class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <div class="font-semibold">{{ notification.title }}</div>
                                <div class="text-sm text-muted-color">{{ notification.message }}</div>
                            </div>
                            <p-tag [value]="notification.type"></p-tag>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    `
})
export class TeacherNotifications implements OnInit {
    private readonly api = inject(ApiService);

    loadingTimetable = true;
    loadingMessages = true;
    timetable: TimetableResponse[] = [];
    notifications: NotificationResponse[] = [];
    events: SchoolCalendarEventResponse[] = [];
    terms: AcademicTermResponse[] = [];
    selectedTermId: number | null = null;
    termOptions: { label: string; value: number }[] = [];
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        this.loadData();
    }

    get coveredClasses(): string {
        return new Set(this.timetable.map((slot) => slot.class)).size.toString();
    }

    get selectedTerm(): string {
        return this.terms.find((term) => term.id === this.selectedTermId)?.name ?? 'All terms';
    }

    loadData(): void {
        this.loadingMessages = true;
        forkJoin({
            terms: this.api.getAcademicTerms(),
            notifications: this.api.getNotifications()
        }).subscribe({
            next: ({ terms, notifications }) => {
                this.terms = terms;
                this.termOptions = terms.map((term) => ({ label: term.name, value: term.id }));
                this.notifications = notifications;
                if (!this.selectedTermId) {
                    this.selectedTermId = this.termOptions[0]?.value ?? null;
                }
                this.loadingMessages = false;
                this.refreshSchedule();
            },
            error: () => {
                this.loadingMessages = false;
                this.loadingTimetable = false;
            }
        });
    }

    refreshSchedule(): void {
        const selectedTerm = this.terms.find((term) => term.id === this.selectedTermId);
        this.loadingTimetable = true;

        forkJoin({
            timetable: this.api.getTeacherTimetable(selectedTerm?.name ?? 'Term 1'),
            events: this.api.getCalendarEvents(this.selectedTermId ?? undefined)
        }).subscribe({
            next: ({ timetable, events }) => {
                this.timetable = timetable;
                this.events = events;
                this.loadingTimetable = false;
            },
            error: () => {
                this.loadingTimetable = false;
            }
        });
    }
}
