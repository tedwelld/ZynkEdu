import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { PopoverModule } from 'primeng/popover';
import { StyleClassModule } from 'primeng/styleclass';
import { catchError, of } from 'rxjs';
import { LayoutService } from '../service/layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import { GlobalSearchService } from '../../core/search/global-search.service';
import { NotificationResponse, SearchHit } from '../../core/api/api.models';
import { ZynkEduLogo } from '../../shared/ui/zynkedu-logo.component';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, StyleClassModule, AutoCompleteModule, AvatarModule, BadgeModule, ButtonModule, MenuModule, PopoverModule, ZynkEduLogo],
    template: `
        <header class="layout-topbar">
            <div class="layout-topbar-logo-container">
                <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                    <i class="pi pi-bars"></i>
                </button>
                <a class="layout-topbar-logo" routerLink="/">
                    <div class="flex items-center gap-3">
                        <zynkedu-logo [size]="44" class="shrink-0"></zynkedu-logo>
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
                    <button *ngIf="canViewNotifications" type="button" class="layout-topbar-action relative" (click)="notifPanel.toggle($event)" title="Notifications">
                        <i class="pi pi-bell"></i>
                        <span *ngIf="recentNotifications.length > 0" class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center rounded-full bg-red-500 text-white text-[0.6rem] font-bold px-0.5 leading-none">
                            {{ recentNotifications.length > 9 ? '9+' : recentNotifications.length }}
                        </span>
                    </button>
                    <p-popover #notifPanel appendTo="body" styleClass="notifications-panel">
                        <div class="w-80 max-h-96 overflow-y-auto">
                            <div class="flex items-center justify-between mb-3">
                                <span class="font-semibold text-sm">Recent notifications</span>
                                <a class="text-xs text-primary hover:underline cursor-pointer" [routerLink]="notificationsRoute()">View all</a>
                            </div>
                            <div *ngIf="recentNotifications.length === 0" class="text-sm text-muted-color text-center py-4">
                                No notifications yet.
                            </div>
                            <div *ngFor="let n of recentNotifications" class="flex gap-3 py-2.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                                <div class="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                    <i class="pi pi-megaphone text-primary text-xs"></i>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-semibold truncate">{{ n.title }}</p>
                                    <p class="text-xs text-muted-color line-clamp-2 mt-0.5">{{ n.message }}</p>
                                    <p class="text-xs text-muted-color mt-1">{{ n.createdAt | date:'d MMM, h:mm a' }}</p>
                                </div>
                            </div>
                        </div>
                    </p-popover>
                    <button pButton type="button" label="Logout" icon="pi pi-sign-out" severity="danger" class="logout-button" (click)="auth.logout()"></button>
                    <button type="button" class="layout-topbar-action flex items-center gap-1.5 px-2 rounded-full" (click)="profileMenu.toggle($event)">
                        <p-avatar [label]="avatarLabel()" shape="circle" styleClass="bg-gradient-to-br from-blue-600 to-violet-600 text-white !text-sm !w-8 !h-8"></p-avatar>
                        <i class="pi pi-chevron-down text-xs text-muted-color"></i>
                    </button>
                    <p-menu #profileMenu [popup]="true" [model]="profileItems" appendTo="body"></p-menu>
                </div>
            </div>
        </header>
    `
})
export class AppTopbar implements OnInit {
    private readonly router = inject(Router);
    private readonly api = inject(ApiService);
    readonly auth = inject(AuthService);
    readonly searchService = inject(GlobalSearchService);
    searchQuery = '';
    searchResults: SearchHit[] = [];
    recentNotifications: NotificationResponse[] = [];
    profileItems: MenuItem[] = [
        { label: 'Dashboard', icon: 'pi pi-fw pi-home', command: () => void this.router.navigateByUrl(this.homeRoute()) },
        { label: 'Account settings', icon: 'pi pi-fw pi-cog', command: () => void this.router.navigateByUrl('/account/settings') },
        { label: 'Logout', icon: 'pi pi-fw pi-sign-out', command: () => this.auth.logout() }
    ];

    constructor(public layoutService: LayoutService) {}

    get canViewNotifications(): boolean {
        const role = this.auth.role();
        return role === 'Admin' || role === 'PlatformAdmin';
    }

    ngOnInit(): void {
        if (!this.canViewNotifications) return;
        this.api.getNotifications().pipe(catchError(() => of([] as NotificationResponse[]))).subscribe((notifications) => {
            this.recentNotifications = notifications
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);
        });
    }

    notificationsRoute(): string {
        return '/admin/notifications';
    }

    workspaceLabel(): string {
        const role = this.auth.role();
        if (role === 'PlatformAdmin') {
            return 'Platform';
        }

        if (role === 'LibraryAdmin') {
            return 'Library';
        }

        if (role === 'Admin') {
            return 'School';
        }

        if (role === 'Teacher') {
            return 'Teacher';
        }

        if (role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'AccountantJunior') {
            return 'Accounting';
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

        if (role === 'LibraryAdmin') {
            return '/library/dashboard';
        }

        if (role === 'Teacher') {
            return '/teacher/dashboard';
        }

        if (role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'AccountantJunior') {
            return '/accountant/dashboard';
        }

        return '/admin/dashboard';
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }
}
