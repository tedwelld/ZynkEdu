import { MenuItem } from 'primeng/api';
import { WorkspaceRole } from '../api/api.models';

export interface WorkspaceMenuSection {
    label: string;
    items: MenuItem[];
}

export function buildWorkspaceMenu(role: WorkspaceRole | null): WorkspaceMenuSection[] {
    if (role === 'PlatformAdmin') {
        return [
            {
                label: 'Platform',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-shield', routerLink: ['/platform/dashboard'] },
                    { label: 'Schools', icon: 'pi pi-fw pi-building', routerLink: ['/platform/schools'] },
                    { label: 'Admins', icon: 'pi pi-fw pi-user', routerLink: ['/platform/admins'] },
                    { label: 'Attendance', icon: 'pi pi-fw pi-check-square', routerLink: ['/platform/attendance'] },
                    { label: 'Students', icon: 'pi pi-fw pi-users', routerLink: ['/platform/students'] },
                    { label: 'Teachers', icon: 'pi pi-fw pi-id-card', routerLink: ['/platform/teachers'] },
                    { label: 'Classes', icon: 'pi pi-fw pi-sitemap', routerLink: ['/platform/classes'] }
                ]
            },
            {
                label: 'Academics',
                items: [
                    { label: 'Calendar', icon: 'pi pi-fw pi-calendar', routerLink: ['/platform/calendar'] },
                    { label: 'Subjects', icon: 'pi pi-fw pi-book', routerLink: ['/platform/subjects'] },
                    { label: 'Assignments', icon: 'pi pi-fw pi-sitemap', routerLink: ['/platform/assignments'] },
                    { label: 'Timetable', icon: 'pi pi-fw pi-clock', routerLink: ['/platform/timetable'] },
                    { label: 'Grading', icon: 'pi pi-fw pi-sliders-h', routerLink: ['/platform/grading'] },
                    { label: 'Progression', icon: 'pi pi-fw pi-sort-alt', routerLink: ['/platform/progression'] },
                    { label: 'Results', icon: 'pi pi-fw pi-chart-line', routerLink: ['/platform/results'] }
                ]
            },
            {
                label: 'Communications',
                items: [
                    { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/platform/notifications'] },
                    { label: 'Reports', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/platform/reports'] }
                ]
            }
        ];
    }

    if (role === 'Teacher') {
        return [
            {
                label: 'Teaching',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/teacher/dashboard'] },
                    { label: 'Attendance', icon: 'pi pi-fw pi-check-square', routerLink: ['/teacher/attendance'] },
                    { label: 'Results Entry', icon: 'pi pi-fw pi-table', routerLink: ['/teacher/results'] },
                    { label: 'My Classes', icon: 'pi pi-fw pi-users', routerLink: ['/teacher/classes'] },
                    { label: 'Timetable', icon: 'pi pi-fw pi-calendar', routerLink: ['/teacher/timetable'] },
                    { label: 'Subjects', icon: 'pi pi-fw pi-book', routerLink: ['/teacher/subjects'] }
                ]
            },
            {
                label: 'More',
                items: [
                    { label: 'Profile', icon: 'pi pi-fw pi-id-card', routerLink: ['/teacher/profile'] },
                    { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/teacher/notifications'] }
                ]
            }
        ];
    }

    return [
        {
            label: 'School',
            items: [
                { label: 'School Data', icon: 'pi pi-fw pi-home', routerLink: ['/admin/dashboard'] },
                { label: 'Attendance', icon: 'pi pi-fw pi-check-square', routerLink: ['/admin/attendance'] },
                { label: 'Students', icon: 'pi pi-fw pi-users', routerLink: ['/admin/students'] },
                { label: 'Teachers', icon: 'pi pi-fw pi-id-card', routerLink: ['/admin/teachers'] },
                { label: 'Classes', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/classes'] },
                { label: 'Calendar', icon: 'pi pi-fw pi-calendar', routerLink: ['/admin/calendar'] },
                { label: 'Timetable', icon: 'pi pi-fw pi-clock', routerLink: ['/admin/timetable'] },
                { label: 'Grading', icon: 'pi pi-fw pi-sliders-h', routerLink: ['/admin/grading'] },
                { label: 'Progression', icon: 'pi pi-fw pi-sort-alt', routerLink: ['/admin/progression'] }
            ]
        },
        {
            label: 'School',
            items: [
                { label: 'Subjects', icon: 'pi pi-fw pi-book', routerLink: ['/admin/subjects'] },
                { label: 'Assignments', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/assignments'] },
                { label: 'Results', icon: 'pi pi-fw pi-chart-line', routerLink: ['/admin/results'] }
            ]
        },
        {
            label: 'Messages',
            items: [
                { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/admin/notifications'] },
                { label: 'Reports', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/admin/reports'] }
            ]
        }
    ];
}
