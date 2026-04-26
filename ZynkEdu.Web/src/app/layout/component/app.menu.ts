import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '../../core/auth/auth.service';
import { buildWorkspaceMenu } from '../../core/navigation/workspace-navigation';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `
        <nav class="layout-menu px-4 pb-4">
            <ng-container *ngFor="let section of model">
                <div class="mb-4">
                    <div class="px-3 mb-3 text-xs uppercase tracking-[0.24em] text-muted-color font-semibold">{{ section.label }}</div>
                    <ul class="space-y-1">
                        <li app-menuitem *ngFor="let item of section.items; let j = index" [item]="item" [index]="j" [root]="false"></li>
                    </ul>
                </div>
            </ng-container>
        </nav>
    `
})
export class AppMenu {
    private readonly auth = inject(AuthService);
    model: { label: string; items: MenuItem[] }[] = [];

    ngOnInit() {
        this.model = buildWorkspaceMenu(this.auth.role());
    }
}
