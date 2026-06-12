import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { ExamTimetableEntryResponse } from '../../core/api/api.models';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { extractApiErrorMessage } from '../../core/api/api-error';

@Component({
    standalone: true,
    selector: 'app-teacher-exam-timetable',
    imports: [CommonModule, FormsModule, ButtonModule, SkeletonModule, TableModule, TagModule, AppDropdownComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Examinations</p>
                    <h1 class="text-3xl font-display font-bold m-0">Exam timetable</h1>
                    <p class="text-muted-color mt-2">Your published exam schedule for the selected term.</p>
                </div>
                <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
            </div>

            <article class="workspace-card flex flex-wrap items-center gap-4">
                <app-dropdown
                    [options]="termOptions"
                    [(ngModel)]="termFilter"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="All terms"
                    class="w-48"
                    appendTo="body"
                    [showClear]="true"
                    (ngModelChange)="loadData()"
                ></app-dropdown>
                <app-dropdown
                    [options]="classFilterOptions"
                    [(ngModel)]="classFilter"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="All classes"
                    class="w-48"
                    appendTo="body"
                    [showClear]="true"
                ></app-dropdown>
            </article>

            <div *ngIf="loading" class="space-y-3">
                <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
            </div>

            <article *ngIf="!loading" class="workspace-card">
                <p-table [value]="filteredEntries" styleClass="p-datatable-sm" [paginator]="filteredEntries.length > 20" [rows]="20">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Date</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Time</th>
                            <th>Venue</th>
                            <th>Term</th>
                            <th>Notes</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-e>
                        <tr>
                            <td class="font-semibold text-sm">{{ e.examDate }}</td>
                            <td>{{ e.class }}</td>
                            <td>{{ e.subjectName }}</td>
                            <td class="font-mono text-sm">{{ e.startTime }}–{{ e.endTime }}</td>
                            <td class="text-muted-color text-sm">{{ e.venue || '—' }}</td>
                            <td class="text-sm">{{ e.term }}</td>
                            <td class="text-muted-color text-sm">{{ e.notes || '—' }}</td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr><td colspan="7" class="text-center text-muted-color py-8">No published exam entries found for this selection.</td></tr>
                    </ng-template>
                </p-table>
            </article>
        </section>
    `
})
export class TeacherExamTimetable implements OnInit {
    private readonly api = inject(ApiService);
    private readonly messages = inject(MessageService);

    loading = true;
    entries: ExamTimetableEntryResponse[] = [];
    termFilter = '';
    classFilter = '';
    skeletonRows = Array.from({ length: 5 });

    ngOnInit(): void {
        void this.loadData();
    }

    get termOptions(): { label: string; value: string }[] {
        return [...new Set(this.entries.map(e => e.term))].map(v => ({ label: v, value: v }));
    }

    get classFilterOptions(): { label: string; value: string }[] {
        return [...new Set(this.entries.map(e => e.class))].map(v => ({ label: v, value: v }));
    }

    get filteredEntries(): ExamTimetableEntryResponse[] {
        return this.entries.filter(e =>
            (!this.classFilter || e.class === this.classFilter)
        );
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            this.entries = await firstValueFrom(this.api.getMyExamTimetable(this.termFilter || null));
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'Could not load exam timetable.') });
        } finally {
            this.loading = false;
        }
    }
}
