import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../../core/api/api.service';
import { AttendanceClassOptionResponse, AttendanceRegisterResponse, AttendanceStatus, SchoolResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';

type AttendanceStatusTone = 'success' | 'secondary' | 'warning' | 'danger';

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
                    <p class="text-muted-color mt-2 max-w-2xl">
                        Pick the class, mark the register with one click, and let autosave keep the work safe while you move through the row.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Mark all present" icon="pi pi-check" severity="success" [disabled]="!register || register.isLocked" (click)="markAllPresent()"></button>
                    <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="secondary" (click)="exportPdf()"></button>
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button *ngIf="canSave" pButton type="button" label="Save register" icon="pi pi-save" (click)="saveRegister(false)"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Students" [value]="studentCount" delta="Selected class" hint="Roster size" icon="pi pi-users" tone="blue"></app-metric-card>
                <app-metric-card label="Present" [value]="presentCount" delta="Current register" hint="Marked present" icon="pi pi-check-circle" tone="green" routerLink="/teacher/classes"></app-metric-card>
                <app-metric-card label="Absent" [value]="absentCount" delta="Current register" hint="Marked absent" icon="pi pi-times-circle" tone="orange" direction="down"></app-metric-card>
                <app-metric-card label="Late" [value]="lateCount" delta="Current register" hint="Marked late" icon="pi pi-clock" tone="purple"></app-metric-card>
            </section>

            <article class="workspace-card space-y-4">
                <div class="grid gap-4 lg:grid-cols-3">
                    <div *ngIf="isPlatformAdmin">
                        <label class="block text-sm font-semibold mb-2">School</label>
                        <app-dropdown [options]="schoolOptions" [(ngModel)]="selectedSchoolId" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search schools" (opened)="loadData()" (ngModelChange)="onSchoolChange($event)"></app-dropdown>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Attendance date</label>
                        <p-datepicker [(ngModel)]="attendanceDate" [showIcon]="true" [showButtonBar]="true" appendTo="body" class="w-full" (ngModelChange)="onDateChange($event)"></p-datepicker>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">Class</label>
                        <app-dropdown [options]="classOptions" [(ngModel)]="selectedClassName" optionLabel="label" optionValue="value" class="w-full" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search classes" (opened)="loadData()" (ngModelChange)="onClassChange($event)"></app-dropdown>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 text-sm text-muted-color">
                    <span *ngIf="selectedSchoolLabel">School: <strong class="text-color">{{ selectedSchoolLabel }}</strong></span>
                    <span *ngIf="selectedClassOption">Teachers: <strong class="text-color">{{ selectedClassOption.teacherNames.join(', ') || 'Unassigned' }}</strong></span>
                    <span *ngIf="selectedClassOption">Subjects: <strong class="text-color">{{ selectedClassOption.subjectNames.join(', ') || 'None' }}</strong></span>
                    <span *ngIf="register?.isLocked" class="text-rose-500 font-semibold">Dispatched at {{ register?.dispatchedAt | date: 'shortTime' }}</span>
                    <span *ngIf="saveFeedback" class="font-semibold text-emerald-600">{{ saveFeedback }}</span>
                </div>
            </article>

            <article class="workspace-card">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">Daily register</h2>
                        <p class="text-sm text-muted-color">Tap the status buttons for each student. Any change schedules an autosave.</p>
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
                        <tr [ngClass]="rowTone(student.status)">
                            <td>
                                <div class="font-semibold">{{ student.studentName }}</div>
                                <div class="text-xs text-muted-color">{{ student.studentNumber }}</div>
                            </td>
                            <td class="text-sm text-muted-color">{{ student.level }}</td>
                            <td class="min-w-72">
                                <div class="flex flex-wrap gap-2">
                                    <button pButton type="button" label="Present" class="p-button-sm" [severity]="statusButtonSeverity(student.status, 'Present')" [outlined]="student.status !== 'Present'" [disabled]="!!register?.isLocked" (click)="setStatus(student, 'Present')"></button>
                                    <button pButton type="button" label="Absent" class="p-button-sm" [severity]="statusButtonSeverity(student.status, 'Absent')" [outlined]="student.status !== 'Absent'" [disabled]="!!register?.isLocked" (click)="setStatus(student, 'Absent')"></button>
                                    <button pButton type="button" label="Late" class="p-button-sm" [severity]="statusButtonSeverity(student.status, 'Late')" [outlined]="student.status !== 'Late'" [disabled]="!!register?.isLocked" (click)="setStatus(student, 'Late')"></button>
                                    <button pButton type="button" label="Excused" class="p-button-sm" [severity]="statusButtonSeverity(student.status, 'Excused')" [outlined]="student.status !== 'Excused'" [disabled]="!!register?.isLocked" (click)="setStatus(student, 'Excused')"></button>
                                </div>
                            </td>
                            <td class="min-w-72">
                                <input pInputText [(ngModel)]="student.note" class="w-full" [disabled]="!!register?.isLocked" placeholder="Optional note" (ngModelChange)="scheduleAutosave()" />
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
export class TeacherAttendance implements OnInit, OnDestroy {
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
    private autosaveHandle: ReturnType<typeof window.setTimeout> | null = null;
    saveFeedback = '';

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

    ngOnDestroy(): void {
        if (this.autosaveHandle) {
            window.clearTimeout(this.autosaveHandle);
        }
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

    setStatus(student: AttendanceRegisterResponse['students'][number], status: AttendanceStatus): void {
        if (this.register?.isLocked) {
            return;
        }

        student.status = status;
        this.scheduleAutosave();
    }

    markAllPresent(): void {
        if (!this.register || this.register.isLocked) {
            return;
        }

        this.register.students.forEach((student) => {
            student.status = 'Present';
        });

        this.saveFeedback = 'All students marked present';
        this.scheduleAutosave();
    }

    scheduleAutosave(): void {
        if (!this.register || this.register.isLocked) {
            return;
        }

        if (this.autosaveHandle) {
            window.clearTimeout(this.autosaveHandle);
        }

        this.autosaveHandle = window.setTimeout(() => this.saveRegister(true), 900);
    }

    saveRegister(silent = false): void {
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
                this.saveFeedback = silent ? 'Autosaved just now' : 'Register saved';
                if (!silent) {
                    this.messages.add({ severity: 'success', summary: 'Register saved', detail: 'The attendance register is ready for dispatch.' });
                }
                this.loadRegister();
            },
            error: (error) => {
                this.messages.add({ severity: 'error', summary: 'Save failed', detail: this.readErrorMessage(error, 'The register could not be saved.') });
            }
        });
    }

    exportPdf(): void {
        if (!this.register || !this.selectedClassName) {
            return;
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`Attendance register - ${this.selectedClassName}`, 40, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Date: ${this.serializeDate(this.attendanceDate)}`, 40, 60);
        doc.text(`School: ${this.selectedSchoolLabel || this.register.schoolName}`, 40, 74);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 88);

        autoTable(doc, {
            startY: 106,
            head: [['Student', 'Number', 'Level', 'Status', 'Note']],
            body: this.register.students.map((student) => [
                student.studentName,
                student.studentNumber,
                student.level,
                student.status,
                student.note || ''
            ]),
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 5 },
            headStyles: { fillColor: [37, 99, 235] }
        });

        doc.save(`attendance-${this.selectedClassName}-${this.serializeDate(this.attendanceDate)}.pdf`);
    }

    statusButtonSeverity(current: AttendanceStatus, target: AttendanceStatus): 'success' | 'secondary' | 'info' | 'danger' {
        if (current === target) {
            return this.statusSeverity(target);
        }

        return 'secondary';
    }

    rowTone(status: AttendanceStatus): string {
        return {
            Present: 'bg-emerald-50/50 dark:bg-emerald-950/20',
            Absent: 'bg-rose-50/50 dark:bg-rose-950/20',
            Late: 'bg-amber-50/50 dark:bg-amber-950/20',
            Excused: 'bg-sky-50/50 dark:bg-sky-950/20'
        }[status];
    }

    private statusSeverity(status: AttendanceStatus): 'success' | 'info' | 'danger' | 'secondary' {
        switch (status) {
            case 'Present':
                return 'success';
            case 'Late':
                return 'info';
            case 'Absent':
                return 'danger';
            default:
                return 'secondary';
        }
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
        return date.toISOString().slice(0, 10);
    }

    private readErrorMessage(error: unknown, fallback: string): string {
        if (typeof error === 'object' && error !== null && 'error' in error) {
            const payload = (error as { error?: { detail?: string; title?: string } }).error;
            if (payload?.detail) {
                return payload.detail;
            }

            if (payload?.title) {
                return payload.title;
            }
        }

        return fallback;
    }
}
