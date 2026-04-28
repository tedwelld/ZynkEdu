import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

@Component({
    selector: 'app-metric-card',
    standalone: true,
    imports: [CommonModule, RouterLink, ButtonModule, RippleModule],
    template: `
        <a
            *ngIf="routerLink(); else metricCard"
            class="workspace-card metric-gradient h-full flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
            [routerLink]="routerLink()"
            [queryParams]="queryParams() ?? undefined"
            pRipple
        >
            <ng-container [ngTemplateOutlet]="metricCard"></ng-container>
        </a>

        <ng-template #metricCard>
            <div class="workspace-card metric-gradient h-full flex flex-col gap-3 transition-transform duration-200">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <span class="block text-sm uppercase tracking-[0.2em] text-muted-color font-semibold">{{ label() }}</span>
                        <h3 class="text-3xl font-bold mt-2 mb-0 font-display">{{ value() }}</h3>
                    </div>
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white soft-shadow" [ngClass]="toneClass()">
                        <i [class]="icon()" class="text-xl"></i>
                    </div>
                </div>
                <div class="flex items-center justify-between gap-3 text-sm">
                    <span class="inline-flex items-center gap-2 font-semibold" [ngClass]="deltaClass()">
                        <i [class]="trendIcon()"></i>
                        {{ delta() }}
                    </span>
                    <span class="text-muted-color">{{ hint() }}</span>
                </div>
            </div>
        </ng-template>
    `
})
export class MetricCardComponent {
    label = input.required<string>();
    value = input.required<string>();
    delta = input.required<string>();
    hint = input<string>('This week');
    icon = input<string>('pi pi-chart-line');
    tone = input<'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red'>('blue');
    direction = input<'up' | 'down' | 'flat'>('up');
    routerLink = input<string | readonly unknown[] | null>(null);
    queryParams = input<Record<string, unknown> | null>(null);

    toneClass() {
        return {
            'bg-gradient-to-br from-blue-600 to-cyan-500': this.tone() === 'blue',
            'bg-gradient-to-br from-cyan-500 to-blue-500': this.tone() === 'cyan',
            'bg-gradient-to-br from-violet-600 to-purple-500': this.tone() === 'purple',
            'bg-gradient-to-br from-emerald-600 to-green-500': this.tone() === 'green',
            'bg-gradient-to-br from-orange-500 to-amber-500': this.tone() === 'orange',
            'bg-gradient-to-br from-rose-600 to-red-500': this.tone() === 'red'
        };
    }

    deltaClass() {
        return {
            'text-emerald-600 dark:text-emerald-400': this.direction() === 'up',
            'text-rose-600 dark:text-rose-400': this.direction() === 'down',
            'text-slate-500': this.direction() === 'flat'
        };
    }

    trendIcon() {
        return this.direction() === 'down' ? 'pi pi-arrow-down' : this.direction() === 'flat' ? 'pi pi-minus' : 'pi pi-arrow-up';
    }
}
