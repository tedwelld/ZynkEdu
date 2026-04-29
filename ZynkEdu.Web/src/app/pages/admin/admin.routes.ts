import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.AdminDashboard) },
    { path: 'attendance', loadComponent: () => import('./attendance').then((m) => m.AdminAttendance) },
    { path: 'students', loadComponent: () => import('./students').then((m) => m.AdminStudents) },
    { path: 'teachers', loadComponent: () => import('./teachers').then((m) => m.AdminTeachers) },
    { path: 'classes', loadComponent: () => import('./classes').then((m) => m.AdminClasses) },
    { path: 'subjects', loadComponent: () => import('./subjects').then((m) => m.AdminSubjects) },
    { path: 'assignments', loadComponent: () => import('./assignments').then((m) => m.AdminAssignments) },
    { path: 'timetable', loadComponent: () => import('./timetable').then((m) => m.AdminTimetable) },
    { path: 'results', loadComponent: () => import('./results').then((m) => m.AdminResults) },
    { path: 'notifications', loadComponent: () => import('./notifications').then((m) => m.AdminNotifications) },
    { path: 'calendar', loadComponent: () => import('./calendar').then((m) => m.AdminCalendar) },
    { path: 'reports', loadComponent: () => import('./reports').then((m) => m.AdminReports) }
];
