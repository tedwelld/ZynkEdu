import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
    PreloadAllModules,
    provideRouter,
    withEnabledBlockingInitialNavigation,
    withInMemoryScrolling,
    withPreloading
} from '@angular/router';

import Aura from '@primeuix/themes/aura';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { authInterceptor } from './app/core/auth/auth.interceptor';
import { loadingInterceptor } from './app/core/loading/loading.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(
            appRoutes,
            withInMemoryScrolling({
                anchorScrolling: 'enabled',
                scrollPositionRestoration: 'enabled'
            }),
            withEnabledBlockingInitialNavigation(),
            withPreloading(PreloadAllModules)
        ),

        provideHttpClient(
            withFetch(),
            withInterceptors([loadingInterceptor, authInterceptor])
        ),

        provideAnimationsAsync(),

        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.app-dark'
                }
            },

            // 🔥 Improved zIndex stacking for overlays
            zIndex: {
                modal: 5000,
                overlay: 5100,
                menu: 5200,
                tooltip: 5300
            },

            // 🔥 This helps some overlay components behave better globally
            ripple: true
        }),

        MessageService,
        ConfirmationService
    ]
};
