import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
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
    );
};
