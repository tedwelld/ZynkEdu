import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api/api.service';
import { AttendanceClassOptionResponse, AttendanceRegisterResponse, AttendanceStatus, SchoolResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

@Component({
    standalone: true,
    selector: 'app-teacher-attendance',
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, InputTextModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Teaching</p>
                    <h1 class="text-3xl font-display font-bold m-0">Attendance register</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">Pick the class, mark the daily register, and save it before the end-of-day dispatch.</p>
                </div>
                <div class="flex gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button *ngIf="canSave" pButton type="button" label="Save register" icon="pi pi-check" (click)="saveRegister()"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Students" [value]="studentCount" delta="Selected class" hint="Roster size" icon="pi pi-users" tone="blue"></app-metric-card>
                <app-metric-card label="Present" [value]="presentCount" delta="Current register" hint="Marked present" icon="pi pi-check-circle" tone="green"></app-metric-card>
                <app-metric-card label="Absent" [value]="absentCount" delta="Current register" hint="Marked absent" icon="pi pi-times-circle" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Late" [value]="lateCount" delta="Current register" hint="Marked late" icon="pi pi-clock" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="grid gap-4 lg:grid-cols-3">
                    <div *ngIf="isPlatformAdmin">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Attendance date</label>
                        <p-datepicker [(ngModel)]="attendanceDate" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full" (ngModelChange)="onDateChange($event)"></p-datepicker>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClassName" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes" (ngModelChange)="onClassChange($event)"></app-dropdown>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 text-sm text-muted-color">
                    <span *ngIf="selectedSchoolLabel">School: <strong class="text-color">{{ selectedSchoolLabel }}</strong></span>
                    <span *ngIf="selectedClassOption">Teachers: <strong class="text-color">{{ selectedClassOption.teacherNames.join(', ') || 'Unassigned' }}</strong></span>
                    <span *ngIf="selectedClassOption">Subjects: <strong class="text-color">{{ selectedClassOption.subjectNames.join(', ') || 'None' }}</strong></span>
                    <span *ngIf="register?.isLocked" class="text-rose-500 font-semibold">Dispatched at {{ register?.dispatchedAt | date: 'shortTime' }}</span>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Daily register</h2>
                        <p class="text-sm text-muted-color">Mark each student, then save the register for dispatch at 13:00.</p>
                    </div>
                    <p-tag [value]="register?.isLocked ? 'Dispatched' : 'Editable'" [severity]="register?.isLocked ? 'danger' : 'success'"></p-tag>
                </div>

                <div *ngIf="loadingRegister" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="3.25rem" borderRadius="1rem"></p-skeleton>
                </div>

                <p-table *ngIf="!loadingRegister" [value]="register?.students ?? []" styleClass="p-datatable-sm">
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
                            <td class="min-w-56">
                                <app-dropdown [options]="statusOptions" [(ngModel)]="student.status" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [disabled]="!!register?.isLocked"></app-dropdown>
                            </td>
                            <td class="min-w-72">
                                <input pInputText [(ngModel)]="student.note" class="w-full" [disabled]="!!register?.isLocked" placeholder="Optional note" />
                            </td>
                        </tr>
                    </ng-template>
                </p-table>

                <div *ngIf="!loadingRegister && (!register?.students?.length)" class="rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-center text-muted-color">
                    No students were found for the selected class.
                </div>
            </article>
        </section>
    `
})
export class TeacherAttendance implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loadingRegister = false;
    register: AttendanceRegisterResponse | null = null;
    classes: AttendanceClassOptionResponse[] = [];
    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = this.auth.schoolId();
    selectedClassName = '';
    attendanceDate = new Date();
    skeletonRows = Array.from({ length: 5 });

    statusOptions = [
        { label: 'Present', value: 'Present' as AttendanceStatus },
        { label: 'Absent', value: 'Absent' as AttendanceStatus },
        { label: 'Late', value: 'Late' as AttendanceStatus },
        { label: 'Excused', value: 'Excused' as AttendanceStatus }
    ];

    ngOnInit(): void {
        if (this.isPlatformAdmin) {
            this.auth.loadSchools().subscribe({
                next: (schools) => {
                    this.schools = schools;
                    if (!this.selectedSchoolId) {
                        this.selectedSchoolId = schools[0]?.id ?? null;
                    }
                    this.loadClasses();
                }
            });
            return;
        }

        this.loadClasses();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get canSave(): boolean {
        return this.auth.role() === 'Teacher' && !this.register?.isLocked;
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

    get classOptions(): { label: string; value: string }[] {
        return this.classes.map((item) => ({
            label: `${item.className} (${item.studentCount})`,
            value: item.className
        }));
    }

    get selectedClassOption(): AttendanceClassOptionResponse | null {
        return this.classes.find((item) => item.className === this.selectedClassName) ?? null;
    }

    get studentCount(): string {
        return (this.register?.students.length ?? 0).toString();
    }

    get presentCount(): string {
        return (this.register?.presentCount ?? 0).toString();
    }

    get absentCount(): string {
        return (this.register?.absentCount ?? 0).toString();
    }

    get lateCount(): string {
        return (this.register?.lateCount ?? 0).toString();
    }

    loadData(): void {
        this.loadClasses();
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        this.loadClasses();
    }

    onDateChange(date: Date | null): void {
        this.attendanceDate = date ?? new Date();
        this.loadRegister();
    }

    onClassChange(className: string | null): void {
        this.selectedClassName = className ?? '';
        this.loadRegister();
    }

    saveRegister(): void {
        if (!this.register || this.register.isLocked) {
            return;
        }

        const students = this.register.students.map((student) => ({
            studentId: student.studentId,
            status: student.status,
            note: student.note?.trim() || null
        }));

        if (!this.selectedClassName) {
            this.messages.add({ severity: 'warn', summary: 'Select a class', detail: 'Choose a class before saving the register.' });
            return;
        }

        this.api.saveAttendanceRegister({
            attendanceDate: this.serializeDate(this.attendanceDate),
            className: this.selectedClassName,
            students
        }, this.isPlatformAdmin ? this.selectedSchoolId : null).subscribe({
            next: (response) => {
                this.register = this.normalizeRegister(response);
                this.messages.add({ severity: 'success', summary: 'Register saved', detail: 'The attendance register is ready for dispatch.' });
                this.loadRegister();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The register could not be saved.') });
            }
        });
    }

    private loadClasses(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : null;
        if (this.isPlatformAdmin && !schoolId) {
            this.classes = [];
            this.register = null;
            return;
        }

        this.api.getAttendanceClasses(schoolId).subscribe({
            next: (classes) => {
                this.classes = classes;
                if (!this.selectedClassName || !this.classes.some((item) => item.className === this.selectedClassName)) {
                    this.selectedClassName = this.classes[0]?.className ?? '';
                }
                this.loadRegister();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Load failed', detail: this.readErrorMessage(error, 'Attendance classes could not be loaded.') });
            }
        });
    }

    private loadRegister(): void {
        if (!this.selectedClassName || (this.isPlatformAdmin && !this.selectedSchoolId)) {
            this.register = null;
            return;
        }

        this.loadingRegister = true;
        this.api.getAttendanceRegister(this.selectedClassName, this.serializeDate(this.attendanceDate), this.isPlatformAdmin ? this.selectedSchoolId : null).subscribe({
            next: (response) => {
                this.register = this.normalizeRegister(response);
                this.loadingRegister = false;
            },
            error: (error) => {
                this.loadingRegister = false;
                this.messages.add({ severity: 'error', summary: 'Load failed', detail: this.readErrorMessage(error, 'The attendance register could not be loaded.') });
            }
        });
    }

    private normalizeRegister(response: AttendanceRegisterResponse): AttendanceRegisterResponse {
        return {
            ...response,
            students: response.students.map((student) => ({
                ...student,
                note: student.note ?? '',
                status: student.status ?? 'Present'
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
