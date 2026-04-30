import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { StyleClassModule } from 'primeng/styleclass';
import { LayoutService } from '../service/layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { GlobalSearchService } from '../../core/search/global-search.service';
import { SearchHit } from '../../core/api/api.models';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, StyleClassModule, AutoCompleteModule, AvatarModule, BadgeModule, ButtonModule, MenuModule],
    template: `
        <header class="layout-topbar">
            <div class="layout-topbar-logo-container">
                <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                    <i class="pi pi-bars"></i>
                </button>
                <a class="layout-topbar-logo" routerLink="/">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-lg">
                            <i class="pi pi-graduation-cap"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-display font-bold text-xl leading-none">ZynkEdu</span>
                            <span class="text-xs text-muted-color uppercase tracking-[0.24em]">{{ workspaceLabel() }}</span>
                        </div>
                    </div>
                </a>
            </div>

            <div class="layout-topbar-search hidden lg:block">
                <p-autoComplete
                    [(ngModel)]="searchQuery"
                    [suggestions]="searchResults"
                    (completeMethod)="search($event)"
                    (onSelect)="openHit($event.value)"
                    optionLabel="label"
                    placeholder="Search students, teachers, subjects..."
                    [dropdown]="false"
                    [forceSelection]="false"
                    appendTo="body"
                    styleClass="w-full"
                >
                    <ng-template let-hit pTemplate="item">
                        <div class="flex items-center justify-between gap-4">
                            <div>
                                <div class="font-semibold">{{ hit.label }}</div>
                                <div class="text-xs text-muted-color">{{ hit.description }}</div>
                            </div>
                            <span class="text-xs uppercase tracking-[0.2em] text-primary">{{ hit.type }}</span>
                        </div>
                    </ng-template>
                </p-autoComplete>
            </div>

            <div class="layout-topbar-actions">
                <div class="hidden xl:flex items-center gap-2 px-4 py-2 rounded-full bg-surface-0/60 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700">
                    <span class="text-xs uppercase tracking-[0.25em] text-muted-color font-semibold">Status</span>
                    <span class="text-sm font-semibold">{{ auth.displayName() }}</span>
                </div>

                <div class="layout-config-menu flex items-center gap-2">
                    <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                        <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                    </button>
                    <button type="button" class="layout-topbar-action layout-topbar-action-highlight" (click)="goHome()">
                        <i class="pi pi-bolt"></i>
                    </button>
                    <button pButton type="button" label="Logout" icon="pi pi-sign-out" severity="danger" class="logout-button" (click)="auth.logout()"></button>
                    <button type="button" class="layout-topbar-action" (click)="profileMenu.toggle($event)">
                        <p-avatar [label]="avatarLabel()" shape="circle" styleClass="bg-gradient-to-br from-blue-600 to-violet-600 text-white"></p-avatar>
                    </button>
                    <p-menu #profileMenu [popup]="true" [model]="profileItems"></p-menu>
                </div>
            </div>
        </header>
    `
})
export class AppTopbar {
    private readonly router = inject(Router);
    readonly auth = inject(AuthService);
    readonly searchService = inject(GlobalSearchService);
    searchQuery = '';
    searchResults: SearchHit[] = [];
    profileItems: MenuItem[] = [
        { label: 'Dashboard', icon: 'pi pi-fw pi-home', command: () => void this.router.navigateByUrl(this.homeRoute()) },
        { label: 'Account settings', icon: 'pi pi-fw pi-cog', command: () => void this.router.navigateByUrl('/account/settings') },
        { label: 'Logout', icon: 'pi pi-fw pi-sign-out', command: () => this.auth.logout() }
    ];

    constructor(public layoutService: LayoutService) {}

    workspaceLabel(): string {
        const role = this.auth.role();
        if (role === 'PlatformAdmin') {
            return 'Platform';
        }

        if (role === 'Admin') {
            return 'School';
        }

        if (role === 'Teacher') {
            return 'Teacher';
        }

        return 'Admin';
    }

    avatarLabel(): string {
        const name = this.auth.displayName();
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('');
    }

    search(event: { query: string }) {
        this.searchService.search(event.query).subscribe((hits) => {
            this.searchResults = hits;
        });
    }

    openHit(hit: SearchHit) {
        void this.router.navigateByUrl(hit.route);
    }

    goHome() {
        void this.router.navigateByUrl(this.homeRoute());
    }

    homeRoute(): string {
        const role = this.auth.role();
        if (role === 'PlatformAdmin') {
            return '/platform/dashboard';
        }

        if (role === 'Teacher') {
            return '/teacher/dashboard';
        }

        return '/admin/dashboard';
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }
}
