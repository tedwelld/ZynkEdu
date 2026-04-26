import { Routes } from '@angular/router';

export const platformRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./platform-dashboard').then((m) => m.PlatformDashboard) },
    { path: 'schools', loadComponent: () => import('./platform-schools').then((m) => m.PlatformSchools) },
    { path: 'admins', loadComponent: () => import('./platform-admins').then((m) => m.PlatformAdmins) }
];
