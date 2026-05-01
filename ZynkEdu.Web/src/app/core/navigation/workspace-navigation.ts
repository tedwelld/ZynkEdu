import { MenuItem } from 'primeng/api';
import { WorkspaceRole } from '../api/api.models';

export interface WorkspaceMenuSection {
    label: string;
    items: MenuItem[];
}

export interface WorkspaceMenuModel {
    home: MenuItem | null;
    groups: MenuItem[];
}

export function buildWorkspaceMenu(role: WorkspaceRole | null): WorkspaceMenuModel {
    if (role === 'PlatformAdmin') {
        return {
            home: { label: 'Dashboard', icon: 'pi pi-fw pi-shield', routerLink: ['/platform/dashboard'] },
            groups: [
                {
                    label: 'Platform',
                    icon: 'pi pi-fw pi-building',
                    items: [
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
                    icon: 'pi pi-fw pi-book',
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
                    label: 'Library',
                    icon: 'pi pi-fw pi-book',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/library/dashboard'] },
                        { label: 'Books', icon: 'pi pi-fw pi-book', routerLink: ['/library/books'] },
                        { label: 'Loans', icon: 'pi pi-fw pi-external-link', routerLink: ['/library/loans'] },
                        { label: 'Users', icon: 'pi pi-fw pi-user', routerLink: ['/library/users'] }
                    ]
                },
                {
                    label: 'Communications',
                    icon: 'pi pi-fw pi-comments',
                    items: [
                        { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/platform/notifications'] }
                    ]
                },
                {
                    label: 'Reports',
                    icon: 'pi pi-fw pi-file-pdf',
                    items: [
                        { label: 'System reports', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/platform/reports'] }
                    ]
                },
                {
                    label: 'Accounting',
                    icon: 'pi pi-fw pi-calculator',
                    items: [
                        { label: 'Accounting setup', icon: 'pi pi-fw pi-wallet', routerLink: ['/platform/accounting'] }
                    ]
                }
            ]
        };
    }

    if (role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'AccountantJunior') {
        return {
            home: { label: 'Dashboard', icon: 'pi pi-fw pi-wallet', routerLink: ['/accountant/dashboard'] },
            groups: [
                {
                    label: 'Accounting',
                    icon: 'pi pi-fw pi-calculator',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/accountant/dashboard'] },
                        { label: 'Students', icon: 'pi pi-fw pi-users', routerLink: ['/accountant/students'] },
                        { label: 'Payments', icon: 'pi pi-fw pi-credit-card', routerLink: ['/accountant/payments'] },
                        { label: 'Invoices', icon: 'pi pi-fw pi-file', routerLink: ['/accountant/invoices'] },
                        { label: 'Reports', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/accountant/reports'] }
                    ]
                }
            ]
        };
    }

    if (role === 'Teacher') {
        return {
            home: { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/teacher/dashboard'] },
            groups: [
                {
                    label: 'Teaching',
                    icon: 'pi pi-fw pi-users',
                    items: [
                        { label: 'Attendance', icon: 'pi pi-fw pi-check-square', routerLink: ['/teacher/attendance'] },
                        { label: 'Results Entry', icon: 'pi pi-fw pi-table', routerLink: ['/teacher/results'] },
                        { label: 'My Classes', icon: 'pi pi-fw pi-users', routerLink: ['/teacher/classes'] },
                        { label: 'Timetable', icon: 'pi pi-fw pi-calendar', routerLink: ['/teacher/timetable'] },
                        { label: 'Subjects', icon: 'pi pi-fw pi-book', routerLink: ['/teacher/subjects'] }
                    ]
                },
                {
                    label: 'More',
                    icon: 'pi pi-fw pi-ellipsis-h',
                    items: [
                        { label: 'Profile', icon: 'pi pi-fw pi-id-card', routerLink: ['/teacher/profile'] },
                        { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/teacher/notifications'] }
                    ]
                }
            ]
        };
    }

    if (role === 'LibraryAdmin') {
        return {
            home: { label: 'Dashboard', icon: 'pi pi-fw pi-book', routerLink: ['/library/dashboard'] },
            groups: [
                {
                    label: 'Library',
                    icon: 'pi pi-fw pi-book',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/library/dashboard'] },
                        { label: 'Books', icon: 'pi pi-fw pi-book', routerLink: ['/library/books'] },
                        { label: 'Loans', icon: 'pi pi-fw pi-external-link', routerLink: ['/library/loans'] },
                        { label: 'Users', icon: 'pi pi-fw pi-user', routerLink: ['/library/users'] }
                    ]
                }
            ]
        };
    }

    return {
        home: { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/admin/dashboard'] },
        groups: [
            {
                label: 'School',
                icon: 'pi pi-fw pi-sitemap',
                items: [
                    { label: 'Attendance', icon: 'pi pi-fw pi-check-square', routerLink: ['/admin/attendance'] },
                    { label: 'Students', icon: 'pi pi-fw pi-users', routerLink: ['/admin/students'] },
                    { label: 'Teachers', icon: 'pi pi-fw pi-id-card', routerLink: ['/admin/teachers'] },
                    { label: 'Classes', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/classes'] }
                ]
            },
            {
                label: 'Academics',
                icon: 'pi pi-fw pi-book',
                items: [
                    { label: 'Calendar', icon: 'pi pi-fw pi-calendar', routerLink: ['/admin/calendar'] },
                    { label: 'Timetable', icon: 'pi pi-fw pi-clock', routerLink: ['/admin/timetable'] },
                    { label: 'Grading', icon: 'pi pi-fw pi-sliders-h', routerLink: ['/admin/grading'] },
                    { label: 'Progression', icon: 'pi pi-fw pi-sort-alt', routerLink: ['/admin/progression'] },
                    { label: 'Subjects', icon: 'pi pi-fw pi-book', routerLink: ['/admin/subjects'] },
                    { label: 'Assignments', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/assignments'] },
                    { label: 'Results', icon: 'pi pi-fw pi-chart-line', routerLink: ['/admin/results'] }
                ]
            },
            {
                label: 'Library',
                icon: 'pi pi-fw pi-book',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/library/dashboard'] },
                    { label: 'Books', icon: 'pi pi-fw pi-book', routerLink: ['/library/books'] },
                    { label: 'Loans', icon: 'pi pi-fw pi-external-link', routerLink: ['/library/loans'] },
                    { label: 'Users', icon: 'pi pi-fw pi-user', routerLink: ['/library/users'] }
                ]
            },
            {
                label: 'Communications',
                icon: 'pi pi-fw pi-comments',
                items: [
                    { label: 'Notifications', icon: 'pi pi-fw pi-bell', routerLink: ['/admin/notifications'] }
                ]
            },
            {
                label: 'Reports',
                icon: 'pi pi-fw pi-file-pdf',
                items: [
                    { label: 'System reports', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/admin/reports'] }
                ]
            },
            {
                label: 'Accounting',
                icon: 'pi pi-fw pi-calculator',
                items: [
                    { label: 'Accounting setup', icon: 'pi pi-fw pi-wallet', routerLink: ['/admin/accounting'] }
                ]
            }
        ]
    };
}
