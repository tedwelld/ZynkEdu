import { Routes } from '@angular/router';

export const libraryRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.LibraryDashboard) },
    { path: 'books', loadComponent: () => import('./books').then((m) => m.LibraryBooks) },
    { path: 'loans', loadComponent: () => import('./loans').then((m) => m.LibraryLoans) },
    { path: 'users', loadComponent: () => import('./users').then((m) => m.LibraryUsers) }
];
