import { Routes } from '@angular/router';

export const teacherRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.TeacherDashboard) },
    { path: 'attendance', loadComponent: () => import('./attendance').then((m) => m.TeacherAttendance) },
    { path: 'classes', loadComponent: () => import('./classes').then((m) => m.TeacherClasses) },
    { path: 'results', loadComponent: () => import('./results').then((m) => m.TeacherResults) },
    { path: 'subjects', loadComponent: () => import('./subjects').then((m) => m.TeacherSubjects) },
    { path: 'timetable', loadComponent: () => import('./timetable').then((m) => m.TeacherTimetable) },
    { path: 'profile', loadComponent: () => import('./profile').then((m) => m.TeacherProfile) },
    { path: 'notifications', loadComponent: () => import('./notifications').then((m) => m.TeacherNotifications) }
];
