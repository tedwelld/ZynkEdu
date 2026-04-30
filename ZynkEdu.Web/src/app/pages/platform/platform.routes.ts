import { Routes } from '@angular/router';

export const platformRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./platform-dashboard').then((m) => m.PlatformDashboard) },
    { path: 'schools', loadComponent: () => import('./platform-schools').then((m) => m.PlatformSchools) },
    { path: 'admins', loadComponent: () => import('./platform-admins').then((m) => m.PlatformAdmins) },
    { path: 'attendance', loadComponent: () => import('../admin/attendance').then((m) => m.AdminAttendance) },
    { path: 'students', loadComponent: () => import('../admin/students').then((m) => m.AdminStudents) },
    { path: 'teachers', loadComponent: () => import('../admin/teachers').then((m) => m.AdminTeachers) },
    { path: 'classes', loadComponent: () => import('../admin/classes').then((m) => m.AdminClasses) },
    { path: 'calendar', loadComponent: () => import('../admin/calendar').then((m) => m.AdminCalendar) },
    { path: 'subjects', loadComponent: () => import('../admin/subjects').then((m) => m.AdminSubjects) },
    { path: 'assignments', loadComponent: () => import('../admin/assignments').then((m) => m.AdminAssignments) },
    { path: 'timetable', loadComponent: () => import('../admin/timetable').then((m) => m.AdminTimetable) },
    { path: 'grading', loadComponent: () => import('../admin/grading').then((m) => m.AdminGrading) },
    { path: 'progression', loadComponent: () => import('../admin/progression').then((m) => m.AdminProgression) },
    { path: 'results', loadComponent: () => import('../admin/results').then((m) => m.AdminResults) },
    { path: 'notifications', loadComponent: () => import('../admin/notifications').then((m) => m.AdminNotifications) },
    { path: 'reports', loadComponent: () => import('../admin/reports').then((m) => m.AdminReports) }
];
