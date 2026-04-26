import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { WorkspaceRole } from '../api/api.models';

function mapRoleToRoot(role: WorkspaceRole | null): string {
    if (role === 'PlatformAdmin') {
        return '/platform/dashboard';
    }

    if (role === 'Parent') {
        return '/parent/dashboard';
    }

    if (role === 'Teacher') {
        return '/teacher/dashboard';
    }

    return '/admin/dashboard';
}

function isAllowed(expected: WorkspaceRole[] | undefined, actual: WorkspaceRole | null): boolean {
    if (!expected || expected.length === 0) {
        return true;
    }

    if (!actual) {
        return false;
    }

    return expected.includes(actual);
}

export const workspaceGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    const expected = _route.data['roles'] as WorkspaceRole[] | undefined;

    if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
    }

    if (!isAllowed(expected, role)) {
        return router.createUrlTree([mapRoleToRoot(role)]);
    }

    return true;
};

export const workspaceChildGuard: CanActivateChildFn = (childRoute, state) => workspaceGuard(childRoute, state);
