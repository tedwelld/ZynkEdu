import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AcademicTermResponse, TeacherAssignmentResponse, TimetableResponse, UpdateSchoolUserRequest, UserResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';

interface AccountNotificationPreferences {
    attendanceAlerts: boolean;
    resultAlerts: boolean;
    adminAnnouncements: boolean;
    classMessages: boolean;
    weeklyDigest: boolean;
}

interface QuickLinkCard {
    label: string;
    value: string;
    delta: string;
    hint: string;
    icon: string;
    tone: 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red';
    route: string;
    queryParams?: Record<string, unknown>;
}

const DEFAULT_PREFERENCES: AccountNotificationPreferences = {
    attendanceAlerts: true,
    resultAlerts: true,
    adminAnnouncements: true,
    classMessages: true,
    weeklyDigest: false
};

@Component({
    standalone: true,
    selector: 'app-teacher-profile',
    imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule, TableModule, AppDropdownComponent, MetricCardComponent, SkeletonModule, TagModule],
    template: `
        <section class="space-y-6">
            <header class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Account settings</p>
                    <h1 class="text-3xl font-display font-bold m-0">Profile and preferences</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">
                        Keep your staff details current, manage your password, and choose how the system should keep you informed.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Dashboard" icon="pi pi-home" severity="secondary" [routerLink]="homeRoute"></button>
                    <button pButton type="button" label="Attendance" icon="pi pi-check-square" severity="secondary" routerLink="/teacher/attendance" *ngIf="isTeacher"></button>
                    <button pButton type="button" label="Results" icon="pi pi-table" routerLink="/teacher/results" *ngIf="isTeacher"></button>
                    <button pButton type="button" label="My classes" icon="pi pi-users" severity="secondary" routerLink="/teacher/classes" *ngIf="isTeacher"></button>
                    <button pButton type="button" label="Timetable" icon="pi pi-calendar" severity="secondary" routerLink="/teacher/timetable" *ngIf="isTeacher"></button>
                    <button pButton type="button" label="Subjects" icon="pi pi-book" severity="secondary" routerLink="/teacher/subjects" *ngIf="isTeacher"></button>
                </div>
            </header>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card
                    *ngFor="let card of quickLinks"
                    [label]="card.label"
                    [value]="card.value"
                    [delta]="card.delta"
                    [hint]="card.hint"
                    [icon]="card.icon"
                    [tone]="card.tone"
                    [routerLink]="card.route"
                    [queryParams]="card.queryParams ?? null"
                ></app-metric-card>
            </section>

            <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Account summary</h2>
                            <p class="text-sm text-muted-color">Your login details and current workspace context.</p>
                        </div>
                        <p-tag [value]="profile?.role ?? auth.role() ?? 'Staff'" severity="info"></p-tag>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="space-y-3">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Username</div>
                            <div class="font-semibold mt-1">{{ profile?.username ?? 'Read only' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Created</div>
                            <div class="font-semibold mt-1">{{ profile?.createdAt | date : 'medium' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Assigned classes</div>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <p-tag *ngFor="let className of assignedClasses" [value]="className"></p-tag>
                                <span *ngIf="assignedClasses.length === 0" class="text-sm text-muted-color">No class assignments found.</span>
                            </div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Assigned subjects</div>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <p-tag *ngFor="let subject of assignedSubjects" [value]="subject" severity="success"></p-tag>
                                <span *ngIf="assignedSubjects.length === 0" class="text-sm text-muted-color">No subject assignments found.</span>
                            </div>
                        </div>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Edit profile</h2>
                            <p class="text-sm text-muted-color">Update your display name and password here.</p>
                        </div>
                        <span *ngIf="saveMessage" class="text-sm font-semibold text-emerald-600">{{ saveMessage }}</span>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="4rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold mb-2">Display name</label>
                            <input pInputText [(ngModel)]="draft.displayName" class="w-full" [disabled]="!canEditProfile" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-2">New password</label>
                            <input pInputText type="password" [(ngModel)]="draft.password" class="w-full" [disabled]="!canEditProfile" placeholder="Leave blank to keep current password" />
                        </div>
                        <div class="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 p-4 text-sm text-muted-color" *ngIf="!canEditProfile">
                            Platform admin profile details are managed separately for v1. You can still control notification preferences below.
                        </div>
                        <div class="flex justify-end gap-3 pt-2" *ngIf="canEditProfile">
                            <button pButton type="button" label="Reset" severity="secondary" (click)="resetDraft()"></button>
                            <button pButton type="button" label="Save changes" icon="pi pi-check" (click)="saveProfile()"></button>
                        </div>
                    </div>
                </article>
            </div>

            <article *ngIf="isTeacher" class="workspace-card">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-display font-bold mb-1">My timetable</h2>
                        <p class="text-sm text-muted-color">This timetable only shows the classes, subjects, and times assigned to you.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <app-dropdown [options]="termOptions" [(ngModel)]="selectedTermId" optionLabel="label" optionValue="value" class="w-44" appendTo="body" [filter]="true" filterBy="label" filterPlaceholder="Search terms" (ngModelChange)="onTermChange($event)"></app-dropdown>
                        <button pButton type="button" label="Export PDF" icon="pi pi-file-pdf" severity="help" [disabled]="sortedTimetable.length === 0" (click)="exportTimetablePdf()"></button>
                    </div>
                </div>

                <div *ngIf="timetableLoading" class="mt-4 space-y-3">
                    <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                    <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                    <p-skeleton height="4.5rem" borderRadius="1rem"></p-skeleton>
                </div>

                <div *ngIf="!timetableLoading && sortedTimetable.length === 0" class="mt-4 rounded-3xl border border-dashed border-surface-300 dark:border-surface-700 p-6 text-sm text-muted-color">
                    No timetable entries are available for the current term.
                </div>

                <div *ngIf="!timetableLoading && sortedTimetable.length > 0" class="mt-4 overflow-x-auto">
                    <table class="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.18em] text-muted-color">
                                <th class="px-4 py-3">Day</th>
                                <th class="px-4 py-3 whitespace-nowrap">Time</th>
                                <th class="px-4 py-3">Class</th>
                                <th class="px-4 py-3">Subject</th>
                                <th class="px-4 py-3 whitespace-nowrap">Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let slot of sortedTimetable; let index = index" class="border-t border-surface-200 dark:border-surface-800" [ngClass]="index % 2 === 0 ? 'bg-surface-0 dark:bg-surface-950' : 'bg-surface-50 dark:bg-surface-900/40'">
                                <td class="px-4 py-4 font-semibold">{{ slot.dayOfWeek }}</td>
                                <td class="px-4 py-4 whitespace-nowrap">{{ slot.startTime }} - {{ slot.endTime }}</td>
                                <td class="px-4 py-4">{{ slot.class }}</td>
                                <td class="px-4 py-4">{{ slot.subjectName }}</td>
                                <td class="px-4 py-4 whitespace-nowrap">
                                    <p-tag [value]="slot.gradeLevel" severity="secondary"></p-tag>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>

            <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Notification preferences</h2>
                            <p class="text-sm text-muted-color">Choose which updates you want to surface first.</p>
                        </div>
                        <button pButton type="button" label="Save preferences" icon="pi pi-save" severity="secondary" (click)="savePreferences()"></button>
                    </div>

                    <div class="space-y-3">
                        <div class="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div>
                                <div class="font-semibold">Attendance alerts</div>
                                <div class="text-sm text-muted-color">Daily register reminders and missing submissions.</div>
                            </div>
                            <input type="checkbox" class="h-5 w-5 accent-blue-600" [(ngModel)]="preferences.attendanceAlerts" (ngModelChange)="savePreferences()" />
                        </div>
                        <div class="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div>
                                <div class="font-semibold">Result alerts</div>
                                <div class="text-sm text-muted-color">Marks, grading and submission notices.</div>
                            </div>
                            <input type="checkbox" class="h-5 w-5 accent-blue-600" [(ngModel)]="preferences.resultAlerts" (ngModelChange)="savePreferences()" />
                        </div>
                        <div class="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div>
                                <div class="font-semibold">Admin announcements</div>
                                <div class="text-sm text-muted-color">Deadlines, meetings and school updates.</div>
                            </div>
                            <input type="checkbox" class="h-5 w-5 accent-blue-600" [(ngModel)]="preferences.adminAnnouncements" (ngModelChange)="savePreferences()" />
                        </div>
                        <div class="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div>
                                <div class="font-semibold">Class messages</div>
                                <div class="text-sm text-muted-color">Per-class communication and task reminders.</div>
                            </div>
                            <input type="checkbox" class="h-5 w-5 accent-blue-600" [(ngModel)]="preferences.classMessages" (ngModelChange)="savePreferences()" />
                        </div>
                        <div class="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div>
                                <div class="font-semibold">Weekly digest</div>
                                <div class="text-sm text-muted-color">A compact summary instead of individual alerts.</div>
                            </div>
                            <input type="checkbox" class="h-5 w-5 accent-blue-600" [(ngModel)]="preferences.weeklyDigest" (ngModelChange)="savePreferences()" />
                        </div>
                    </div>
                </article>

                <article class="workspace-card">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 class="text-xl font-display font-bold mb-1">Activity and status</h2>
                            <p class="text-sm text-muted-color">A quick view of your account footprint.</p>
                        </div>
                        <p-tag [value]="profile?.isActive ? 'Active' : 'Inactive'" [severity]="profile?.isActive ? 'success' : 'danger'"></p-tag>
                    </div>

                    <div *ngIf="loading" class="space-y-3">
                        <p-skeleton height="5rem" borderRadius="1rem"></p-skeleton>
                        <p-skeleton height="5rem" borderRadius="1rem"></p-skeleton>
                    </div>

                    <div *ngIf="!loading" class="space-y-3">
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Last saved</div>
                            <div class="font-semibold mt-1">{{ preferencesSavedAt || 'Not saved yet' }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Role</div>
                            <div class="font-semibold mt-1">{{ profile?.role ?? auth.role() }}</div>
                        </div>
                        <div class="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
                            <div class="text-xs uppercase tracking-[0.2em] text-muted-color">Session display name</div>
                            <div class="font-semibold mt-1">{{ auth.displayName() }}</div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    `
})
export class TeacherProfile implements OnInit {
    private readonly api = inject(ApiService);
    readonly auth = inject(AuthService);

    loading = true;
    timetableLoading = true;
    profile: UserResponse | null = null;
    assignments: TeacherAssignmentResponse[] = [];
    timetable: TimetableResponse[] = [];
    terms: AcademicTermResponse[] = [];
    termOptions: { label: string; value: number }[] = [];
    selectedTermId: number | null = null;
    draft = {
        displayName: '',
        password: ''
    };
    preferences: AccountNotificationPreferences = { ...DEFAULT_PREFERENCES };
    preferencesSavedAt = '';
    saveMessage = '';

    get canEditProfile(): boolean {
        return this.isTeacher || this.isSchoolAdmin || this.isLibraryAdmin;
    }

    get isTeacher(): boolean {
        return this.auth.role() === 'Teacher';
    }

    get isSchoolAdmin(): boolean {
        return this.auth.role() === 'Admin';
    }

    get isLibraryAdmin(): boolean {
        return this.auth.role() === 'LibraryAdmin';
    }

    get homeRoute(): string {
        if (this.isTeacher) {
            return '/teacher/dashboard';
        }

        if (this.isLibraryAdmin) {
            return '/library/dashboard';
        }

        return '/admin/dashboard';
    }

    get assignedClasses(): string[] {
        return Array.from(new Set(this.assignments.map((assignment) => assignment.class)));
    }

    get assignedSubjects(): string[] {
        return Array.from(new Set(this.assignments.map((assignment) => assignment.subjectName)));
    }

    get selectedTermName(): string | null {
        return this.terms.find((term) => term.id === this.selectedTermId)?.name ?? null;
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

    get quickLinks(): QuickLinkCard[] {
        if (this.isTeacher) {
            return [
                { label: 'Attendance', value: 'Open', delta: 'Fast register', hint: 'Today and this week', icon: 'pi pi-check-square', tone: 'blue', route: '/teacher/attendance' },
                { label: 'Results', value: 'Enter', delta: 'Marks entry', hint: 'Assessments and grades', icon: 'pi pi-table', tone: 'purple', route: '/teacher/results' },
                { label: 'My classes', value: `${this.assignedClasses.length}`, delta: 'Teaching load', hint: 'Assigned classes', icon: 'pi pi-users', tone: 'green', route: '/teacher/classes' },
                { label: 'Dashboard', value: 'Home', delta: 'Control center', hint: 'Overview and alerts', icon: 'pi pi-home', tone: 'orange', route: '/teacher/dashboard' }
            ];
        }

        if (this.isLibraryAdmin) {
            return [
                { label: 'Books', value: 'Manage', delta: 'Catalog', hint: 'Library titles', icon: 'pi pi-book', tone: 'blue', route: '/library/books' },
                { label: 'Loans', value: 'Track', delta: 'Circulation', hint: 'Issue and returns', icon: 'pi pi-clock', tone: 'purple', route: '/library/loans' },
                { label: 'Users', value: 'Review', delta: 'Library staff', hint: 'Library admin accounts', icon: 'pi pi-user', tone: 'green', route: '/library/users' },
                { label: 'Dashboard', value: 'Home', delta: 'Control center', hint: 'Overview and alerts', icon: 'pi pi-home', tone: 'orange', route: '/library/dashboard' }
            ];
        }

        return [
            { label: 'Dashboard', value: 'Home', delta: 'School overview', hint: 'Admin workspace', icon: 'pi pi-home', tone: 'blue', route: '/admin/dashboard' },
            { label: 'Students', value: 'Manage', delta: 'Roster', hint: 'School students', icon: 'pi pi-users', tone: 'purple', route: '/admin/students' },
            { label: 'Teachers', value: 'Manage', delta: 'Staff', hint: 'Assigned teachers', icon: 'pi pi-id-card', tone: 'green', route: '/admin/teachers' },
            { label: 'Notifications', value: 'Inbox', delta: 'School updates', hint: 'Announcements and alerts', icon: 'pi pi-bell', tone: 'orange', route: '/admin/notifications' }
        ];
    }

    ngOnInit(): void {
        this.loadProfile();
        this.loadPreferences();
    }

    loadProfile(): void {
        this.loading = true;
        this.timetableLoading = true;
        const role = this.auth.role();
        const userId = this.auth.userId();

        if (!role || !userId) {
            this.loading = false;
            return;
        }

        if (this.isTeacher) {
            forkJoin({
                users: this.api.getTeachers(),
                assignments: this.api.getAssignmentsByTeacher(userId, this.auth.schoolId() ?? undefined),
                terms: this.api.getAcademicTerms()
            }).subscribe({
                next: ({ users, assignments, terms }) => {
                    this.profile = users.find((teacher) => teacher.id === userId) ?? null;
                    this.assignments = assignments;
                    this.terms = terms;
                    this.termOptions = terms.map((term) => ({ label: term.name, value: term.id }));
                    this.selectedTermId = this.selectedTermId ?? this.termOptions[0]?.value ?? null;
                    this.resetDraft();
                    this.loadTeacherTimetable();
                },
                error: () => {
                    this.timetableLoading = false;
                    this.loading = false;
                }
            });
            return;
        }

        if (this.isLibraryAdmin) {
            this.api.getLibraryAdmins(this.auth.schoolId() ?? undefined).subscribe({
                next: (libraryAdmins) => {
                    this.profile = libraryAdmins.find((libraryAdmin) => libraryAdmin.id === userId) ?? null;
                    this.resetDraft();
                    this.timetableLoading = false;
                    this.loading = false;
                },
                error: () => {
                    this.timetableLoading = false;
                    this.loading = false;
                }
            });
            return;
        }

        if (this.isSchoolAdmin) {
            this.api.getAdmins(this.auth.schoolId() ?? undefined).subscribe({
                next: (admins) => {
                    this.profile = admins.find((admin) => admin.id === userId) ?? null;
                    this.resetDraft();
                    this.timetableLoading = false;
                    this.loading = false;
                },
                error: () => {
                    this.timetableLoading = false;
                    this.loading = false;
                }
            });
            return;
        }

        this.profile = {
            id: userId,
            username: 'platform-admin',
            displayName: this.auth.displayName(),
            role: 'PlatformAdmin',
            schoolId: this.auth.schoolId() ?? 0,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        this.resetDraft();
        this.timetableLoading = false;
        this.loading = false;
    }

    resetDraft(): void {
        if (!this.profile) {
            return;
        }

        this.draft = {
            displayName: this.profile.displayName,
            password: ''
        };
    }

    saveProfile(): void {
        if (!this.profile || !this.canEditProfile) {
            return;
        }

        const request: UpdateSchoolUserRequest = {
            displayName: this.draft.displayName.trim() || this.profile.displayName,
            password: this.draft.password.trim() || null,
            isActive: this.profile.isActive
        };

        const request$ = this.isTeacher
            ? this.api.updateTeacher(this.profile.id, request)
            : this.isLibraryAdmin
                ? this.api.updateLibraryAdmin(this.profile.id, request)
                : this.api.updateAdmin(this.profile.id, request);
        request$.subscribe({
            next: (updated) => {
                this.profile = updated;
                this.auth.updateDisplayName(updated.displayName);
                this.saveMessage = 'Profile saved';
                this.resetDraft();
                window.setTimeout(() => {
                    this.saveMessage = '';
                }, 2500);
            }
        });
    }

    onTermChange(termId: number | null): void {
        this.selectedTermId = termId;
        this.loadTeacherTimetable();
    }

    loadTeacherTimetable(): void {
        if (!this.isTeacher) {
            this.timetable = [];
            this.timetableLoading = false;
            return;
        }

        this.timetableLoading = true;
        const selectedTerm = this.selectedTermName ?? 'Term 1';
        this.api.getTeacherTimetable(selectedTerm).subscribe({
            next: (timetable) => {
                this.timetable = timetable;
                this.timetableLoading = false;
                this.loading = false;
            },
            error: () => {
                this.timetable = [];
                this.timetableLoading = false;
                this.loading = false;
            }
        });
    }

    exportTimetablePdf(): void {
        const termLabel = this.selectedTermName ?? 'All terms';
        const fileName = `teacher-timetable-${termLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'timetable'}.pdf`;
        const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const margin = 40;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('My timetable', margin, 42);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Teacher: ${this.auth.displayName()}`, margin, 60);
        doc.text(`Term: ${termLabel}`, margin, 74);
        doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 88);

        autoTable(doc, {
            startY: 104,
            head: [['Day', 'Time', 'Class', 'Subject', 'Level']],
            body: this.sortedTimetable.map((slot) => [slot.dayOfWeek, `${slot.startTime} - ${slot.endTime}`, slot.class, slot.subjectName, slot.gradeLevel]),
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 3,
                minCellHeight: 24,
                valign: 'middle',
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [37, 99, 235]
            },
            margin: {
                left: margin,
                right: margin
            }
        });

        doc.save(fileName);
    }

    loadPreferences(): void {
        const key = this.preferenceStorageKey();
        const raw = localStorage.getItem(key);
        if (!raw) {
            this.preferences = { ...DEFAULT_PREFERENCES };
            return;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<AccountNotificationPreferences>;
            this.preferences = { ...DEFAULT_PREFERENCES, ...parsed };
        } catch {
            this.preferences = { ...DEFAULT_PREFERENCES };
        }
    }

    savePreferences(): void {
        localStorage.setItem(this.preferenceStorageKey(), JSON.stringify(this.preferences));
        this.preferencesSavedAt = new Date().toLocaleString();
    }

    private preferenceStorageKey(): string {
        return `zynkedu.account.preferences.${this.auth.role() ?? 'guest'}.${this.auth.userId() ?? 'anon'}`;
    }
}
