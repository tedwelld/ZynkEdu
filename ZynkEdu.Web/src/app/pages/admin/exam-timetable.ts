import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    AcademicTermResponse,
    CreateExamTimetableEntryRequest,
    ExamTimetableEntryResponse,
    SchoolClassResponse,
    SchoolResponse,
    SubjectResponse
} from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { extractApiErrorMessage } from '../../core/api/api-error';

interface EntryDraft {
    class: string;
    subjectId: number | null;
    examDate: string;
    startTime: string;
    endTime: string;
    venue: string;
    notes: string;
}

@Component({
    standalone: true,
    selector: 'app-admin-exam-timetable',
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, SkeletonModule, TableModule, TagModule, AppDropdownComponent, MetricCardComponent],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Academics</p>
                    <h1 class="text-3xl font-display font-bold m-0">Exam timetable</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Schedule exams per class and subject. Publish when ready to share with teachers.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Add entry" icon="pi pi-plus" severity="info" (click)="openAddDialog()"></button>
                    <button pButton type="button" label="Publish term" icon="pi pi-send" severity="success" (click)="publishTerm()" [disabled]="!termFilter || publishing"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Entries" [value]="entries.length.toString()" delta="Scheduled" hint="Total exam sessions" icon="pi pi-calendar" tone="blue"></app-metric-card>
                <app-metric-card label="Published" [value]="publishedCount" delta="Visible to teachers" hint="Published entries" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Classes" [value]="classCount" delta="Distinct" hint="Classes with exams" icon="pi pi-building" tone="purple"></app-metric-card>
                <app-metric-card label="Term" [value]="termFilter || 'All'" delta="Filter" hint="Active filter" icon="pi pi-filter" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card flex flex-wrap items-center gap-4">
                <app-dropdown
                    *ngIf="isPlatformAdmin"
                    [options]="schoolOptions"
                    [(ngModel)]="selectedSchoolId"
                    optionLabel="label"
                    optionValue="value"
                    class="w-60"
                    appendTo="body"
                    [filter]="true"
                    filterBy="label"
                    [showClear]="false"
                    (ngModelChange)="loadData()"
                ></app-dropdown>
                <app-dropdown
                    [options]="termOptions"
                    [(ngModel)]="termFilter"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Filter by term"
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
                    placeholder="Filter by class"
                    class="w-48"
                    appendTo="body"
                    [showClear]="true"
                    (ngModelChange)="loadData()"
                ></app-dropdown>
            </article>

            <div *ngIf="loading" class="space-y-3">
                <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
            </div>

            <article *ngIf="!loading" class="workspace-card">
                <p-table [value]="entries" styleClass="p-datatable-sm" [paginator]="entries.length > 20" [rows]="20">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Date</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Time</th>
                            <th>Venue</th>
                            <th>Term</th>
                            <th>Status</th>
                            <th>Actions</th>
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
                            <td><p-tag [value]="e.isPublished ? 'Published' : 'Draft'" [severity]="e.isPublished ? 'success' : 'secondary'"></p-tag></td>
                            <td>
                                <div class="flex gap-2">
                                    <button pButton type="button" icon="pi pi-pencil" severity="secondary" size="small" class="p-button-text" (click)="openEditDialog(e)"></button>
                                    <button pButton type="button" icon="pi pi-trash" severity="danger" size="small" class="p-button-text" (click)="deleteEntry(e.id)"></button>
                                </div>
                            </td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr><td colspan="8" class="text-center text-muted-color py-8">No exam entries found. Add entries using the button above.</td></tr>
                    </ng-template>
                </p-table>
            </article>
        </section>

        <!-- Add / Edit dialog -->
        <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{width: '640px'}" [header]="editingId ? 'Edit exam entry' : 'Add exam entry'" [closable]="!saving">
            <div class="grid gap-4 p-2">
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Term</span>
                        <input pInputText type="text" [(ngModel)]="draft.term" placeholder="e.g. Term 1" class="mt-1 w-full" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Class</span>
                        <app-dropdown
                            [options]="classOptions"
                            [(ngModel)]="draft.class"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Select class"
                            appendTo="body"
                            [filter]="true"
                            filterBy="label"
                            [showClear]="false"
                        ></app-dropdown>
                    </label>
                </div>
                <label class="block">
                    <span class="text-sm font-medium text-muted-color">Subject</span>
                    <app-dropdown
                        [options]="subjectOptions"
                        [(ngModel)]="draft.subjectId"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select subject"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        [showClear]="false"
                    ></app-dropdown>
                </label>
                <div class="grid gap-4 md:grid-cols-3">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Exam date</span>
                        <input type="date" [(ngModel)]="draft.examDate" class="mt-1 w-full rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-3 py-2 text-sm" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Start time</span>
                        <input type="time" [(ngModel)]="draft.startTime" class="mt-1 w-full rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-3 py-2 text-sm" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">End time</span>
                        <input type="time" [(ngModel)]="draft.endTime" class="mt-1 w-full rounded-xl border border-surface-300 bg-surface-0 dark:bg-surface-900 px-3 py-2 text-sm" />
                    </label>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Venue (optional)</span>
                        <input pInputText type="text" [(ngModel)]="draft.venue" placeholder="e.g. Hall A" class="mt-1 w-full" />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-muted-color">Notes (optional)</span>
                        <input pInputText type="text" [(ngModel)]="draft.notes" placeholder="Any additional info" class="mt-1 w-full" />
                    </label>
                </div>
            </div>
            <ng-template pTemplate="footer">
                <button pButton type="button" label="Cancel" severity="secondary" (click)="dialogVisible = false" [disabled]="saving"></button>
                <button pButton type="button" [label]="editingId ? 'Save changes' : 'Add entry'" icon="pi pi-check" (click)="saveEntry()" [disabled]="saving || !canSaveEntry"></button>
            </ng-template>
        </p-dialog>
    `
})
export class AdminExamTimetable implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    saving = false;
    publishing = false;
    dialogVisible = false;
    editingId: number | null = null;
    entries: ExamTimetableEntryResponse[] = [];
    schools: SchoolResponse[] = [];
    classes: SchoolClassResponse[] = [];
    subjects: SubjectResponse[] = [];
    terms: AcademicTermResponse[] = [];
    selectedSchoolId: number | null = null;
    termFilter = '';
    classFilter = '';
    skeletonRows = Array.from({ length: 5 });

    draft: EntryDraft & { term: string } = { term: '', class: '', subjectId: null, examDate: '', startTime: '', endTime: '', venue: '', notes: '' };

    ngOnInit(): void {
        this.selectedSchoolId = this.isPlatformAdmin ? null : this.auth.schoolId();
        void this.loadInitial();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map(s => ({ label: s.name, value: s.id }));
    }

    get termOptions(): { label: string; value: string }[] {
        const fromEntries = [...new Set(this.entries.map(e => e.term))];
        const fromTerms = this.terms.map(t => t.name);
        return [...new Set([...fromTerms, ...fromEntries])].map(v => ({ label: v, value: v }));
    }

    get classFilterOptions(): { label: string; value: string }[] {
        return [...new Set(this.entries.map(e => e.class))].map(v => ({ label: v, value: v }));
    }

    get classOptions(): { label: string; value: string }[] {
        return this.classes.map(c => ({ label: c.className, value: c.className }));
    }

    get subjectOptions(): { label: string; value: number }[] {
        return this.subjects.map(s => ({ label: s.name, value: s.id }));
    }

    get publishedCount(): string {
        return this.entries.filter(e => e.isPublished).length.toString();
    }

    get classCount(): string {
        return new Set(this.entries.map(e => e.class)).size.toString();
    }

    get canSaveEntry(): boolean {
        return !!this.draft.term && !!this.draft.class && !!this.draft.subjectId && !!this.draft.examDate && !!this.draft.startTime && !!this.draft.endTime;
    }

    async loadInitial(): Promise<void> {
        try {
            if (this.isPlatformAdmin) {
                this.schools = await firstValueFrom(this.api.getPlatformSchools());
                this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
            }
            const [classes, subjects, terms] = await Promise.all([
                firstValueFrom(this.api.getClasses(this.selectedSchoolId)),
                firstValueFrom(this.api.getSubjects(this.selectedSchoolId)),
                firstValueFrom(this.api.getAcademicTerms(this.selectedSchoolId))
            ]);
            this.classes = classes;
            this.subjects = subjects;
            this.terms = terms;
        } catch {
            // Non-critical, ignore
        }
        await this.loadData();
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            this.entries = await firstValueFrom(this.api.getExamTimetable(this.selectedSchoolId, this.termFilter || null, this.classFilter || null));
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'Could not load exam timetable.') });
        } finally {
            this.loading = false;
        }
    }

    openAddDialog(): void {
        this.editingId = null;
        this.draft = { term: this.termFilter || '', class: '', subjectId: null, examDate: '', startTime: '', endTime: '', venue: '', notes: '' };
        this.dialogVisible = true;
    }

    openEditDialog(e: ExamTimetableEntryResponse): void {
        this.editingId = e.id;
        this.draft = { term: e.term, class: e.class, subjectId: e.subjectId, examDate: e.examDate, startTime: e.startTime, endTime: e.endTime, venue: e.venue ?? '', notes: e.notes ?? '' };
        this.dialogVisible = true;
    }

    async saveEntry(): Promise<void> {
        if (!this.canSaveEntry || this.draft.subjectId == null) return;
        this.saving = true;
        try {
            const payload: CreateExamTimetableEntryRequest = {
                term: this.draft.term,
                class: this.draft.class,
                subjectId: this.draft.subjectId,
                examDate: this.draft.examDate,
                startTime: this.draft.startTime,
                endTime: this.draft.endTime,
                venue: this.draft.venue || null,
                notes: this.draft.notes || null
            };

            if (this.editingId) {
                const updated = await firstValueFrom(this.api.updateExamTimetableEntry(this.editingId, payload, this.selectedSchoolId));
                this.entries = this.entries.map(e => e.id === updated.id ? updated : e);
            } else {
                const created = await firstValueFrom(this.api.createExamTimetableEntry(payload, this.selectedSchoolId));
                this.entries = [...this.entries, created];
            }

            this.dialogVisible = false;
            this.messages.add({ severity: 'success', summary: 'Saved', detail: 'Exam entry saved.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'Could not save entry.') });
        } finally {
            this.saving = false;
        }
    }

    async deleteEntry(id: number): Promise<void> {
        try {
            await firstValueFrom(this.api.deleteExamTimetableEntry(id, this.selectedSchoolId));
            this.entries = this.entries.filter(e => e.id !== id);
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'Exam entry removed.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Delete failed', detail: extractApiErrorMessage(error, 'Could not delete entry.') });
        }
    }

    async publishTerm(): Promise<void> {
        if (!this.termFilter) return;
        this.publishing = true;
        try {
            const updated = await firstValueFrom(this.api.publishExamTimetable({ term: this.termFilter, class: this.classFilter || null }, this.selectedSchoolId));
            this.entries = this.entries.map(existing => {
                const pub = updated.find(u => u.id === existing.id);
                return pub ?? existing;
            });
            this.messages.add({ severity: 'success', summary: 'Published', detail: `Exam timetable for "${this.termFilter}" is now visible to teachers.` });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Publish failed', detail: extractApiErrorMessage(error, 'Could not publish timetable.') });
        } finally {
            this.publishing = false;
        }
    }
}
