import { Routes } from '@angular/router';

export const accountantRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.AccountantDashboard) },
    { path: 'students', loadComponent: () => import('./students').then((m) => m.AccountantStudents) },
    { path: 'payments', loadComponent: () => import('./payments').then((m) => m.AccountantPayments) },
    { path: 'invoices', loadComponent: () => import('./invoices').then((m) => m.AccountantInvoices) },
    { path: 'reports', loadComponent: () => import('./reports').then((m) => m.AccountantReports) }
];
