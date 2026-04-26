import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterModule } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { LoadingService } from './app/core/loading/loading.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterModule, ToastModule, ConfirmDialogModule],
    template: `
        <p-toast position="top-right" />
        <p-confirmDialog [style]="{ width: '28rem' }" />
        <div *ngIf="showLoader()" class="app-loader-overlay">
            <div class="loader" aria-label="Loading" role="status">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
        <router-outlet></router-outlet>
    `
})
export class AppComponent implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly loading = inject(LoadingService);
    private readonly navigationActive = signal(false);
    private readonly routerSubscription = new Subscription();

    readonly showLoader = signal(false);

    constructor() {
        effect(() => {
            this.showLoader.set(this.navigationActive() || this.loading.isLoading());
        });
    }

    ngOnInit(): void {
        this.routerSubscription.add(
            this.router.events.subscribe((event) => {
                if (event instanceof NavigationStart) {
                    this.navigationActive.set(true);
                }

                if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
                    this.navigationActive.set(false);
                }
            })
        );
    }

    ngOnDestroy(): void {
        this.routerSubscription.unsubscribe();
    }
}
