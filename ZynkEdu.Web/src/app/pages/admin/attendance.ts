import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api/api.service';
import { AttendanceDailySummaryResponse, AttendanceRegisterResponse, SchoolResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-admin-attendance',
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, DialogModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">School</p>
                    <h1 class="text-3xl font-display font-bold m-0">Attendance review</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Review each class register, see the daily counts, and open any row for the full register.</p>
                </div>
                <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Classes" [value]="classCount" delta="Daily summaries" hint="Registers submitted" icon="pi pi-list" tone="blue"></app-metric-card>
                <app-metric-card label="Students" [value]="studentCount" delta="Across summaries" hint="Marked students" icon="pi pi-users" tone="green"></app-metric-card>
                <app-metric-card label="Present" [value]="presentCount" delta="Across summaries" hint="Present count" icon="pi pi-check-circle" tone="purple"></app-metric-card>
                <app-metric-card label="Absent" [value]="absentCount" delta="Across summaries" hint="Absent count" icon="pi pi-times-circle" tone="orange" direction="down"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="grid gap-4 lg:grid-cols-2">
                    <div *ngIf="isPlatformAdmin">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Attendance date</label>
                        <p-datepicker [(ngModel)]="attendanceDate" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full" (ngModelChange)="onDateChange($event)"></p-datepicker>
                    </div>
                </div>
                <div class="text-sm text-muted-color" *ngIf="selectedSchoolLabel">
                    School: <strong class="text-color">{{ selectedSchoolLabel }}</strong>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Daily summaries</h2>
                        <p class="text-sm text-muted-color">Each row is a class register captured for the selected day.</p>
                    </div>
                    <span class="text-sm text-muted-color">{{ summaries.length }} class(es)</span>
                </div>

                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loading" [value]="summaries" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>Class</th>
                            <th>Teacher</th>
                            <th>Term</th>
                            <th>Students</th>
                            <th>Present</th>
                            <th>Absent</th>
                            <th>Status</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-summary>
                        <tr class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900/50" (click)="openSummary(summary)">
                            <td class="font-semibold">{{ summary.className }}</td>
                            <td class="text-sm text-muted-color">{{ summary.teacherName }}</td>
                            <td class="text-sm text-muted-color">{{ summary.termName }}</td>
                            <td>{{ summary.studentCount }}</td>
                            <td>{{ summary.presentCount }}</td>
                            <td>{{ summary.absentCount }}</td>
                            <td>
                                <p-tag [value]="summary.dispatchedAt ? 'Dispatched' : 'Pending'" [severity]="summary.dispatchedAt ? 'success' : 'warning'"></p-tag>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>

                <div *ngIf="!loading && summaries.length === 0" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-center text-muted-color">
                    No attendance has been captured for the selected date yet.
                </div>
            </article>

            <p-dialog [(visible)]="detailVisible" [modal]="true" [draggable]="false" [style]="{ width: 'min(72rem, 96vw)' }" header="Attendance register" appendTo="body">
                <div *ngIf="detailLoading" class="space-y-3">
                    <p-skeleton height="5rem" borderRadius="1.5rem"></p-skeleton>
                    <p-skeleton height="22rem" borderRadius="1.5rem"></p-skeleton>
                </div>

                <div *ngIf="!detailLoading && selectedRegister" class="space-y-5">
                    <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div class="text-xs uppercase tracking-[0.2em] text-muted-color font-semibold">Selected class</div>
                                <div class="text-2xl font-display font-bold mt-1">{{ selectedRegister.className }}</div>
                                <div class="text-sm text-muted-color mt-1">{{ selectedRegister.teacherName }} · {{ selectedRegister.termName }}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm text-muted-color">Date</div>
                                <div class="text-lg font-semibold">{{ selectedRegister.attendanceDate | date: 'fullDate' }}</div>
                                <p-tag class="mt-2" [value]="selectedRegister.isLocked ? 'Dispatched' : 'Pending'" [severity]="selectedRegister.isLocked ? 'success' : 'warning'"></p-tag>
                            </div>
                        </div>
                    </div>

                    <section class="grid gap-4 md:grid-cols-4">
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-sm text-muted-color">Present</div>
                            <div class="text-2xl font-bold">{{ selectedRegister.presentCount }}</div>
                        </div>
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-sm text-muted-color">Absent</div>
                            <div class="text-2xl font-bold">{{ selectedRegister.absentCount }}</div>
                        </div>
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-sm text-muted-color">Late</div>
                            <div class="text-2xl font-bold">{{ selectedRegister.lateCount }}</div>
                        </div>
                        <div class="rounded-3xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-sm text-muted-color">Excused</div>
                            <div class="text-2xl font-bold">{{ selectedRegister.excusedCount }}</div>
                        </div>
                    </section>

                    <p-table [value]="selectedRegister.students" [rows]="8" [paginator]="true" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Student</th>
                                <th>Level</th>
                                <th>Status</th>
                                <th>Note</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-student>
                            <tr>
                                <td>
                                    <div class="font-semibold">{{ student.studentName }}</div>
                                    <div class="text-xs text-muted-color">{{ student.studentNumber }}</div>
                                </td>
                                <td class="text-sm text-muted-color">{{ student.level }}</td>
                                <td>
                                    <p-tag [value]="student.status"></p-tag>
                                </td>
                                <td class="text-sm text-muted-color">{{ student.note || 'No note' }}</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </p-dialog>
        </section>
    `
})
export class AdminAttendance implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    detailLoading = false;
    summaries: AttendanceDailySummaryResponse[] = [];
    selectedRegister: AttendanceRegisterResponse | null = null;
    detailVisible = false;
    skeletonRows = Array.from({ length: 4 });
    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = this.auth.schoolId();
    attendanceDate = new Date();

    ngOnInit(): void {
        if (this.isPlatformAdmin) {
            this.auth.loadSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    if (!this.selectedSchoolId) {
                        this.selectedSchoolId = schools[0]?.id ?? null;
                    }
                    this.loadData();
                }
            });
            return;
        }

        this.loadData();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get selectedSchoolLabel(): string {
        if (!this.selectedSchoolId) {
            return '';
        }

        return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? '';
    }

    get classCount(): string {
        return this.summaries.length.toString();
    }

    get studentCount(): string {
        return this.summaries.reduce((total, summary) => total + summary.studentCount, 0).toString();
    }

    get presentCount(): string {
        return this.summaries.reduce((total, summary) => total + summary.presentCount, 0).toString();
    }

    get absentCount(): string {
        return this.summaries.reduce((total, summary) => total + summary.absentCount, 0).toString();
    }

    loadData(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : null;
        if (this.isPlatformAdmin && !schoolId) {
            this.summaries = [];
            this.loading = false;
            return;
        }

        this.loading = true;
        this.api.getAttendanceDailySummaries(this.serializeDate(this.attendanceDate), schoolId).subscribe({
            next: (summaries) => {
                this.summaries = summaries;
                this.loading = false;
            },
            error: (error) => {
                this.loading = false;
                this.messages.add({ severity: 'error', summary: 'Load failed', detail: this.readErrorMessage(error, 'Attendance summaries could not be loaded.') });
            }
        });
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadData();
    }

    onDateChange(date: Date | null): void {
        this.attendanceDate = date ?? new Date();
        this.loadData();
    }

    openSummary(summary: AttendanceDailySummaryResponse): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : null;
        if (this.isPlatformAdmin && !schoolId) {
            return;
        }

        this.detailLoading = true;
        this.detailVisible = true;
        this.api.getAttendanceRegister(summary.className, this.serializeDate(new Date(summary.attendanceDate)), schoolId).subscribe({
            next: (register) => {
                this.selectedRegister = this.normalizeRegister(register);
                this.detailLoading = false;
            },
            error: (error) => {
                this.detailLoading = false;
                this.messages.add({ severity: 'error', summary: 'Load failed', detail: this.readErrorMessage(error, 'The register could not be loaded.') });
            }
        });
    }

    private normalizeRegister(response: AttendanceRegisterResponse): AttendanceRegisterResponse {
        return {
            ...response,
            students: response.students.map((student) => ({
                ...student,
                note: student.note ?? ''
            }))
        };
    }

    private serializeDate(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00`;
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        const problem = error as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        return problem?.error?.detail ?? problem?.error?.title ?? problem?.error?.message ?? problem?.message ?? fallback;
    }
}
