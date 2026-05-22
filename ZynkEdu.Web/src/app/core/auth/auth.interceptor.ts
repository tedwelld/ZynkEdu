import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const auth = inject(AuthService);
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
            }
            return throwError(() => err);
        })
    );
};
