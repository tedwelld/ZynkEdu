import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const auth = inject(AuthService);
    const messageService = inject(MessageService);
    const token = auth.token();

    if (!token || request.url.includes('/auth/login') || request.url.includes('/auth/schools')) {
        return next(request);
    }

    return next(
        request.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        })
    ).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401) {
                auth.logout();
            } else if (err.status === 403) {
                messageService.add({
                    severity: 'warn',
                    summary: 'Access denied',
                    detail: 'You do not have permission to perform this action.',
                    life: 4000
                });
            } else if (err.status === 429) {
                messageService.add({
                    severity: 'warn',
                    summary: 'Too many requests',
                    detail: 'Please wait a moment before trying again.',
                    life: 5000
                });
            } else if (err.status >= 500) {
                messageService.add({
                    severity: 'error',
                    summary: 'Server error',
                    detail: 'An unexpected error occurred. Please try again later.',
                    life: 6000
                });
            } else if (err.status >= 400 && err.status !== 400 && err.status !== 422) {
                // Don't show generic toast for 400/422 — components handle validation errors locally
                messageService.add({
                    severity: 'error',
                    summary: 'Request failed',
                    detail: err.error?.detail ?? err.message ?? 'An error occurred.',
                    life: 5000
                });
            }
            return throwError(() => err);
        })
    );
};
