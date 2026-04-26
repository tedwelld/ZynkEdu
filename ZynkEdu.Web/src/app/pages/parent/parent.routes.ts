import { Routes } from '@angular/router';

export const parentRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.ParentDashboard) },
    { path: 'results', loadComponent: () => import('./results').then((m) => m.ParentResults) },
    { path: 'notifications', loadComponent: () => import('./notifications').then((m) => m.ParentNotifications) }
];
