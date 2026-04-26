import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Notfound } from './app/pages/notfound/notfound';
import { workspaceGuard } from './app/core/auth/role.guard';

export const appRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes').then((m) => m.authRoutes) },
    {
        path: 'admin',
        component: AppLayout,
        canActivate: [workspaceGuard],
        data: { roles: ['Admin', 'PlatformAdmin'] },
        loadChildren: () => import('./app/pages/admin/admin.routes').then((m) => m.adminRoutes)
    },
    {
        path: 'platform',
        component: AppLayout,
        canActivate: [workspaceGuard],
        data: { roles: ['PlatformAdmin'] },
        loadChildren: () => import('./app/pages/platform/platform.routes').then((m) => m.platformRoutes)
    },
    {
        path: 'teacher',
        component: AppLayout,
        canActivate: [workspaceGuard],
        data: { roles: ['Teacher', 'PlatformAdmin'] },
        loadChildren: () => import('./app/pages/teacher/teacher.routes').then((m) => m.teacherRoutes)
    },
    {
        path: 'parent',
        component: AppLayout,
        canActivate: [workspaceGuard],
        data: { roles: ['Parent', 'PlatformAdmin'] },
        loadChildren: () => import('./app/pages/parent/parent.routes').then((m) => m.parentRoutes)
    },
    {
        path: 'legacy',
        component: AppLayout,
        children: [
            { path: '', redirectTo: '/auth/login', pathMatch: 'full' }
        ]
    },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
