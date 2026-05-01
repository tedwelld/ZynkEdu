import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AcademicTermResponse, FeeStructureRequest, FeeStructureResponse, SchoolClassResponse, SchoolResponse, UserResponse } from '../../core/api/api.models';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <section class="grid gap-6">
            <header class="workspace-card p-6 md:p-8">
                <p class="text-xs uppercase tracking-[0.28em] text-muted-color font-semibold">School setup</p>
                <h1 class="text-3xl md:text-4xl font-display font-bold mt-3">Accounting administration</h1>
                <p class="text-muted-color mt-2">Create accountant accounts and maintain fee structures for the active school.</p>
            </header>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <h2 class="text-xl font-semibold">Accountants</h2>
                    <select *ngIf="isPlatformAdmin" class="rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="selectedSchoolId" (ngModelChange)="refresh()">
                        <option [ngValue]="null">All schools</option>
                        <option *ngFor="let school of schools" [ngValue]="school.id">{{ school.name }}</option>
                    </select>
                </div>

                <div class="grid lg:grid-cols-2 gap-6 mt-5">
                    <form class="space-y-3" (ngSubmit)="createAccountant()">
                        <div class="grid gap-3 md:grid-cols-2">
                            <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Username" [(ngModel)]="accountantDraft.username" name="username" />
                            <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Display name" [(ngModel)]="accountantDraft.displayName" name="displayName" />
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                            <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Password" type="password" [(ngModel)]="accountantDraft.password" name="password" />
                            <select class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="accountantDraft.role" name="role">
                                <option value="AccountantJunior">AccountantJunior</option>
                                <option value="AccountantSenior">AccountantSenior</option>
                                <option value="AccountantSuper">AccountantSuper</option>
                            </select>
                        </div>
                        <input class="w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Email" [(ngModel)]="accountantDraft.contactEmail" name="contactEmail" />
                        <button class="rounded-xl bg-primary text-white px-4 py-2 font-semibold" type="submit">Create accountant</button>
                    </form>

                    <div class="space-y-3">
                        <div *ngFor="let accountant of accountants" class="rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 flex items-center justify-between">
                            <div>
                                <div class="font-semibold">{{ accountant.displayName }}</div>
                                <div class="text-sm text-muted-color">{{ accountant.username }} &middot; {{ accountant.role }}</div>
                            </div>
                            <span class="text-xs uppercase tracking-[0.2em] text-muted-color">School {{ accountant.schoolId }}</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="workspace-card p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <h2 class="text-xl font-semibold">Fee structures</h2>
                    <button class="rounded-xl border border-surface-300 px-4 py-2" type="button" (click)="refresh()">Reload</button>
                </div>

                <form class="grid gap-3 md:grid-cols-4 mt-5 items-end" (ngSubmit)="saveFeeStructure()">
                    <label class="block">
                        <span class="text-sm text-muted-color">Grade level</span>
                        <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="feeDraft.gradeLevel" name="gradeLevel" required>
                            <option [ngValue]="''" disabled>Select grade level</option>
                            <option *ngFor="let level of gradeLevelOptions" [ngValue]="level">{{ level }}</option>
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-sm text-muted-color">Term</span>
                        <select class="mt-2 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" [(ngModel)]="feeDraft.term" name="term" required>
                            <option [ngValue]="''" disabled>Select term</option>
                            <option *ngFor="let term of termOptions" [ngValue]="term">{{ term }}</option>
                        </select>
                    </label>
                    <input class="rounded-xl border border-surface-300 bg-surface-0 px-3 py-2" placeholder="Amount" type="number" [(ngModel)]="feeDraft.amount" name="amount" />
                    <button class="rounded-xl bg-primary text-white px-4 py-2 font-semibold" type="submit">Save fee structure</button>
                </form>

                <div class="mt-5 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-muted-color uppercase tracking-[0.18em] text-xs">
                            <tr>
                                <th class="py-3 pr-4">Grade</th>
                                <th class="py-3 pr-4">Term</th>
                                <th class="py-3 pr-4">Amount</th>
                                <th class="py-3 pr-4">Description</th>
                                <th class="py-3">School</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let fee of feeStructures" class="border-t border-surface-200 dark:border-surface-700">
                                <td class="py-3 pr-4 font-medium">{{ fee.gradeLevel }}</td>
                                <td class="py-3 pr-4">{{ fee.term }}</td>
                                <td class="py-3 pr-4">{{ fee.amount | number:'1.0-2' }}</td>
                                <td class="py-3 pr-4">{{ fee.description || '-' }}</td>
                                <td class="py-3">#{{ fee.schoolId }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    `
})
export class AdminAccounting implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    schools: SchoolResponse[] = [];
    accountants: UserResponse[] = [];
    feeStructures: FeeStructureResponse[] = [];
    gradeLevelOptions: string[] = [];
    termOptions: string[] = [];
    selectedSchoolId: number | null = this.auth.schoolId();

    accountantDraft = {
        username: '',
        password: '',
        displayName: '',
        contactEmail: '',
        role: 'AccountantJunior' as 'AccountantJunior' | 'AccountantSenior' | 'AccountantSuper'
    };

    feeDraft: FeeStructureRequest = {
        gradeLevel: '',
        term: '',
        amount: 0,
        description: ''
    };

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    ngOnInit(): void {
        if (this.isPlatformAdmin) {
            this.api.getPlatformSchools().subscribe((schools) => {
                this.schools = schools;
                if (this.selectedSchoolId == null) {
                    this.selectedSchoolId = schools[0]?.id ?? null;
                }
                this.refresh();
            });
            return;
        }

        this.refresh();
    }

    refresh(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        this.api.getAccountants(schoolId ?? undefined).subscribe((accountants) => (this.accountants = accountants));
        this.api.getFeeStructures(schoolId ?? undefined).subscribe((fees) => (this.feeStructures = fees));
        this.api.getClasses(schoolId ?? undefined).subscribe((classes) => {
            const levels = Array.from(new Set(classes.map((schoolClass: SchoolClassResponse) => schoolClass.gradeLevel).filter((gradeLevel) => !!gradeLevel && gradeLevel.trim().length > 0)));
            this.gradeLevelOptions = levels.length > 0 ? levels.sort((left, right) => left.localeCompare(right)) : ['ZGC Level', "O'Level", "A'Level"];
            if (!this.gradeLevelOptions.includes(this.feeDraft.gradeLevel)) {
                this.feeDraft.gradeLevel = this.gradeLevelOptions[0] ?? '';
            }
        });
        this.api.getAcademicTerms(schoolId ?? undefined).subscribe((terms) => {
            this.termOptions = this.normalizeTermOptions(terms);
            if (!this.termOptions.includes(this.feeDraft.term)) {
                this.feeDraft.term = this.termOptions[0] ?? '';
            }
        });
    }

    createAccountant(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        if (this.isPlatformAdmin && !schoolId) {
            return;
        }

        const request = {
            username: this.accountantDraft.username,
            password: this.accountantDraft.password,
            displayName: this.accountantDraft.displayName || this.accountantDraft.username,
            contactEmail: this.accountantDraft.contactEmail || null,
            role: this.accountantDraft.role
        };

        const creator = this.isPlatformAdmin && schoolId
            ? this.api.createPlatformAccountant(request, schoolId)
            : this.api.createSchoolAccountant(request);

        creator.subscribe(() => {
            this.accountantDraft = { username: '', password: '', displayName: '', contactEmail: '', role: 'AccountantJunior' };
            this.refresh();
        });
    }

    saveFeeStructure(): void {
        const schoolId = this.isPlatformAdmin ? this.selectedSchoolId : this.auth.schoolId();
        if (this.isPlatformAdmin && !schoolId) {
            return;
        }

        this.api.saveFeeStructure(this.feeDraft, schoolId ?? undefined).subscribe(() => {
            this.feeDraft = { gradeLevel: '', term: '', amount: 0, description: '' };
            this.refresh();
        });
    }

    private normalizeTermOptions(terms: AcademicTermResponse[]): string[] {
        const labels = terms
            .slice()
            .sort((left, right) => left.termNumber - right.termNumber)
            .map((term) => term.name.trim())
            .filter((term) => term.length > 0);

        return labels.length > 0 ? labels : ['Term 1', 'Term 2', 'Term 3'];
    }
}
