import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { extractApiErrorMessage } from '../../core/api/api-error';
import { GradingLevelResponse, GradingSchemeResponse, SaveGradingSchemeRequest, SchoolResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AppDropdownComponent } from '../../shared/ui/app-dropdown.component';
import { MetricCardComponent } from '../../shared/ui/metric-card.component';
import { SchoolLevel, SCHOOL_LEVEL_OPTIONS } from '../../core/school-levels';

interface GradingBandDraft {
    grade: string;
    minScore: number | null;
    maxScore: number | null;
}

interface GradingLevelDraft {
    level: SchoolLevel;
    bands: GradingBandDraft[];
}

interface GradingSchemeDraft {
    schoolId: number;
    schoolName: string;
    levels: GradingLevelDraft[];
}

@Component({
    standalone: true,
    selector: 'app-admin-grading',
    imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule, MetricCardComponent, AppDropdownComponent, SkeletonModule, TableModule, TagModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Academics</p>
                    <h1 class="text-3xl font-display font-bold m-0">Grading ranges</h1>
                    <p class="text-muted-color mt-2 max-w-2xl">School admins can define the mark bands for each level. New results use these ranges immediately, while historic grades stay unchanged.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button pButton type="button" label="Reload" icon="pi pi-refresh" severity="secondary" (click)="loadData()"></button>
                    <button pButton type="button" label="Save grading" icon="pi pi-save" severity="info" (click)="saveScheme()" [disabled]="loading || saving || !canSave"></button>
                </div>
            </div>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <app-metric-card label="Levels" [value]="levelCount" delta="Configured" hint="ZGC, O, A" icon="pi pi-sitemap" tone="blue"></app-metric-card>
                <app-metric-card label="Bands" [value]="bandCount" delta="Five per level" hint="A to F" icon="pi pi-sliders-h" tone="purple"></app-metric-card>
                <app-metric-card label="Current school" [value]="selectedSchoolName" delta="Scope" hint="Selected workspace" icon="pi pi-building" tone="green"></app-metric-card>
                <app-metric-card label="State" [value]="schemeStateLabel" delta="Validation" hint="Editable scheme" icon="pi pi-check-circle" tone="orange"></app-metric-card>
            </section>

            <article class="workspace-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 class="text-xl font-display font-bold mb-1">School scope</h2>
                    <p class="text-sm text-muted-color">Choose the school whose grading scheme you want to edit.</p>
                </div>
                <div class="flex items-center gap-3">
                    <app-dropdown
                        *ngIf="isPlatformAdmin"
                        [options]="schoolOptions"
                        [(ngModel)]="selectedSchoolId"
                        optionLabel="label"
                        optionValue="value"
                        class="w-80"
                        appendTo="body"
                        [filter]="true"
                        filterBy="label"
                        filterPlaceholder="Search schools"
                        [showClear]="false"
                        (opened)="loadData()"
                        (ngModelChange)="onSchoolChange($event)"
                    ></app-dropdown>
                    <p-tag [value]="selectedSchoolName"></p-tag>
                </div>
            </article>

            <div *ngIf="loading" class="space-y-4">
                <p-skeleton height="8rem" borderRadius="1rem"></p-skeleton>
                <p-skeleton height="8rem" borderRadius="1rem"></p-skeleton>
                <p-skeleton height="8rem" borderRadius="1rem"></p-skeleton>
            </div>

            <ng-container *ngIf="!loading">
                <article *ngIf="scheme; else noSchoolSelected" class="space-y-4">
                    <section *ngFor="let level of scheme.levels" class="workspace-card">
                        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                            <div>
                                <h2 class="text-xl font-display font-bold mb-1">{{ level.level }}</h2>
                                <p class="text-sm text-muted-color">Edit the score bands for this level. Scores are saved to one decimal place.</p>
                            </div>
                            <p-tag [value]="levelSummary(level)"></p-tag>
                        </div>

                        <p-table [value]="level.bands" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Grade</th>
                                    <th>Minimum</th>
                                    <th>Maximum</th>
                                    <th>Range</th>
                                </tr>
                            </ng-template>
                            <ng-template pTemplate="body" let-band let-index="rowIndex">
                                <tr>
                                    <td class="font-semibold">{{ band.grade }}</td>
                                    <td class="min-w-28">
                                        <p-inputNumber
                                            [(ngModel)]="band.minScore"
                                            [min]="0"
                                            [max]="100"
                                            [step]="0.1"
                                            [showButtons]="true"
                                            [useGrouping]="false"
                                            mode="decimal"
                                            placeholder="0.0"
                                            (ngModelChange)="onDraftChange()"
                                        ></p-inputNumber>
                                    </td>
                                    <td class="min-w-28">
                                        <p-inputNumber
                                            [(ngModel)]="band.maxScore"
                                            [min]="0"
                                            [max]="100"
                                            [step]="0.1"
                                            [showButtons]="true"
                                            [useGrouping]="false"
                                            mode="decimal"
                                            placeholder="100.0"
                                            (ngModelChange)="onDraftChange()"
                                        ></p-inputNumber>
                                    </td>
                                    <td class="font-semibold text-sm text-muted-color">{{ band.minScore === null || band.maxScore === null ? 'Incomplete' : formatRange(band) }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </section>
                </article>
            </ng-container>

            <ng-template #noSchoolSelected>
                <article class="workspace-card border-dashed border-2 text-center py-10">
                    <h2 class="text-xl font-display font-bold mb-2">Select a school</h2>
                    <p class="text-sm text-muted-color">Pick a school from the dropdown to load its grading bands.</p>
                </article>
            </ng-template>
        </section>
    `
})
export class AdminGrading implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly messages = inject(MessageService);

    loading = true;
    saving = false;
    schools: SchoolResponse[] = [];
    selectedSchoolId: number | null = null;
    scheme: GradingSchemeDraft | null = null;

    ngOnInit(): void {
        this.selectedSchoolId = this.isPlatformAdmin ? null : this.auth.schoolId();
        void this.loadData();
    }

    get isPlatformAdmin(): boolean {
        return this.auth.role() === 'PlatformAdmin';
    }

    get schoolOptions(): { label: string; value: number | null }[] {
        return this.schools.map((school) => ({ label: school.name, value: school.id }));
    }

    get selectedSchoolName(): string {
        if (this.scheme) {
            return this.scheme.schoolName;
        }

        return this.schools.find((school) => school.id === this.selectedSchoolId)?.name ?? 'Select a school';
    }

    get levelCount(): string {
        return this.scheme?.levels.length.toString() ?? '0';
    }

    get bandCount(): string {
        return this.scheme?.levels.reduce((sum, level) => sum + level.bands.length, 0).toString() ?? '0';
    }

    get schemeStateLabel(): string {
        if (!this.scheme) {
            return 'No scheme loaded';
        }

        return this.canSave ? 'Ready to save' : 'Needs completion';
    }

    get canSave(): boolean {
        return this.scheme !== null && this.scheme.levels.every((level) => level.bands.every((band) => band.minScore !== null && band.maxScore !== null));
    }

    async loadData(): Promise<void> {
        this.loading = true;
        try {
            this.schools = await firstValueFrom(this.isPlatformAdmin ? this.api.getPlatformSchools() : this.api.getSchools());
            if (this.isPlatformAdmin) {
                this.selectedSchoolId = this.selectedSchoolId ?? this.schools[0]?.id ?? null;
            } else {
                this.selectedSchoolId = this.auth.schoolId();
            }

            if (this.selectedSchoolId == null) {
                this.scheme = null;
                return;
            }

            const scheme = await firstValueFrom(this.api.getGradingScheme(this.selectedSchoolId));
            this.scheme = this.cloneScheme(scheme);
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'The grading scheme could not be loaded.') });
        } finally {
            this.loading = false;
        }
    }

    onSchoolChange(schoolId: number | null): void {
        this.selectedSchoolId = schoolId;
        void this.loadScheme();
    }

    onDraftChange(): void {
        if (this.scheme) {
            this.scheme = { ...this.scheme };
        }
    }

    async saveScheme(): Promise<void> {
        if (!this.scheme || this.selectedSchoolId == null || !this.canSave) {
            return;
        }

        this.saving = true;
        try {
            const response = await firstValueFrom(this.api.saveGradingScheme(this.buildSaveRequest(), this.selectedSchoolId));
            this.scheme = this.cloneScheme(response);
            this.messages.add({ severity: 'success', summary: 'Saved', detail: 'The grading scheme was updated successfully.' });
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Save failed', detail: extractApiErrorMessage(error, 'The grading scheme could not be saved.') });
        } finally {
            this.saving = false;
        }
    }

    levelSummary(level: GradingLevelDraft): string {
        const isComplete = level.bands.every((band) => band.minScore !== null && band.maxScore !== null);
        return isComplete ? 'Complete' : 'Incomplete';
    }

    formatRange(band: GradingBandDraft): string {
        return `${band.minScore?.toFixed(1)} - ${band.maxScore?.toFixed(1)}`;
    }

    private async loadScheme(): Promise<void> {
        if (this.selectedSchoolId == null) {
            this.scheme = null;
            return;
        }

        this.loading = true;
        try {
            const response = await firstValueFrom(this.api.getGradingScheme(this.selectedSchoolId));
            this.scheme = this.cloneScheme(response);
        } catch (error) {
            this.messages.add({ severity: 'error', summary: 'Load failed', detail: extractApiErrorMessage(error, 'The grading scheme could not be loaded.') });
        } finally {
            this.loading = false;
        }
    }

    private cloneScheme(response: GradingSchemeResponse): GradingSchemeDraft {
        return {
            schoolId: response.schoolId,
            schoolName: response.schoolName,
            levels: response.levels.map((level) => this.cloneLevel(level))
        };
    }

    private cloneLevel(level: GradingLevelResponse): GradingLevelDraft {
        return {
            level: level.level as Exclude<SchoolLevel, 'General'>,
            bands: level.bands.map((band) => ({
                grade: band.grade,
                minScore: band.minScore,
                maxScore: band.maxScore
            }))
        };
    }

    private buildSaveRequest(): SaveGradingSchemeRequest {
        return {
            bands: this.scheme?.levels.flatMap((level) =>
                level.bands.map((band) => ({
                    level: level.level,
                    grade: band.grade,
                    minScore: band.minScore ?? 0,
                    maxScore: band.maxScore ?? 0
                }))
            ) ?? []
        };
    }
}
