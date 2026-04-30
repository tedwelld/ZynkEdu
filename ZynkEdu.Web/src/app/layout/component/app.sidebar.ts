import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AppMenu } from './app.menu';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, AppMenu, ButtonModule],
    template: `
        <aside class="layout-sidebar">
            <div class="workspace-card mx-4 my-4">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-[0.22em] text-muted-color font-semibold">Signed in</p>
                        <div class="text-xl font-display font-bold mt-1">ZynkEdu</div>
                    </div>
                    <i class="pi pi-user text-xl text-primary"></i>
                </div>
                <div class="mt-4 grid gap-2 text-sm">
                    <div class="flex items-center justify-between">
                        <span class="text-muted-color">Role</span>
                        <span class="font-semibold">{{ roleLabel }}</span>
                    </div>
                </div>
                <button pButton type="button" label="Logout" icon="pi pi-sign-out" severity="danger" class="w-full mt-4 logout-button" (click)="auth.logout()"></button>
            </div>
            <app-menu></app-menu>
        </aside>
    `
})
export class AppSidebar {
    readonly auth = inject(AuthService);

    get roleLabel(): string {
        const role = this.auth.role();
        if (role === 'PlatformAdmin') {
            return 'Platform';
        }

        if (role === 'Teacher') {
            return 'Teacher';
        }

        return 'School';
    }
}
