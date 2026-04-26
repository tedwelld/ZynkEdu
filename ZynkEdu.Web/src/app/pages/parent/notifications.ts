import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api/api.service';
import { StudentCommentResponse } from '../../core/api/api.models';

@Component({
    standalone: true,
    selector: 'app-parent-notifications',
    imports: [CommonModule, SkeletonModule],
    template: `
        <section class="space-y-6">
            <div class="workspace-card">
                <p class="text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">Notifications</p>
                <h1 class="text-3xl font-display font-bold m-0">School updates</h1>
                <p class="text-muted-color mt-2 max-w-2xl">A chat-style feed so parents can scan updates quickly on mobile.</p>
            </div>

            <article class="workspace-card">
                <div *ngIf="loading" class="space-y-3">
                    <p-skeleton *ngFor="let _ of skeletonRows" height="4rem" borderRadius="1.2rem"></p-skeleton>
                </div>
                <div *ngIf="!loading" class="space-y-3">
                    <div *ngFor="let item of results" class="flex items-start gap-3 rounded-3xl border border-surface-200 dark:border-surface-700 p-4 bg-surface-50 dark:bg-surface-900/40">
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0">
                            <i class="pi pi-comment"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="font-semibold">Teacher</div>
                            <div class="text-sm text-muted-color">Your child scored {{ item.score }}% in {{ item.subjectName }}.</div>
                            <div class="mt-1 text-sm">{{ item.comment || 'New report available.' }}</div>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    `
})
export class ParentNotifications implements OnInit {
    private readonly api = inject(ApiService);
    loading = true;
    results: StudentCommentResponse[] = [];
    skeletonRows = Array.from({ length: 4 });

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.api.getParentResults().subscribe({
            next: (results) => {
                this.results = results;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }
}
