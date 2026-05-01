import { Injectable, computed, inject, signal } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';
import { SearchHit } from '../api/api.models';

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly cache = signal<SearchHit[]>([]);
    private readonly cacheRole = signal<string | null>(null);

    readonly searchIndex = computed(() => this.cache());

    loadIndex(force = false): Observable<SearchHit[]> {
        const role = this.auth.role();

        if (this.cache().length > 0 && this.cacheRole() === role && !force) {
            return of(this.cache());
        }

        if (false) {
            return this.api.getParentResults().pipe(
                map((results) =>
                    results.map((result) => ({
                        id: `parent-result-${result.resultId}`,
                        label: result.subjectName,
                        type: 'Result' as const,
                        description: `${result.grade} Â· ${result.term}`,
                        route: '/parent/results'
                    }))
                ),
                map((hits) => {
                    this.cache.set(hits);
                    this.cacheRole.set(role);
                    return hits;
                })
            );
        }

        if (role === 'Teacher') {
            return this.api.getAssignments().pipe(
                map((assignments) =>
                    assignments.map((assignment) => ({
                        id: `assignment-${assignment.id}`,
                        label: `${assignment.teacherName} Â· ${assignment.subjectName}`,
                        type: 'Assignment' as const,
                        description: assignment.class,
                        route: '/teacher/results'
                    }))
                ),
                map((hits) => {
                    this.cache.set(hits);
                    this.cacheRole.set(role);
                    return hits;
                })
            );
        }

        if (role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'AccountantJunior') {
            return this.api.getStudents().pipe(
                map((students) => [
                    ...students.map((student) => this.api.toSearchHitStudent(student)),
                    { id: 'accounting-dashboard', label: 'Accounting dashboard', type: 'Page' as const, description: 'Finance overview', route: '/accountant/dashboard' },
                    { id: 'accounting-students', label: 'Student statements', type: 'Page' as const, description: 'Balances and ledger history', route: '/accountant/students' },
                    { id: 'accounting-payments', label: 'Payments', type: 'Page' as const, description: 'Capture receipts', route: '/accountant/payments' },
                    { id: 'accounting-invoices', label: 'Invoices', type: 'Page' as const, description: 'Issue billing', route: '/accountant/invoices' },
                    { id: 'accounting-reports', label: 'Accounting reports', type: 'Page' as const, description: 'Collection and aging reports', route: '/accountant/reports' }
                ]),
                map((hits) => {
                    this.cache.set(hits);
                    this.cacheRole.set(role);
                    return hits;
                })
            );
        }

        if (role === 'PlatformAdmin') {
            return this.loadWorkspaceHits(true).pipe(
                switchMap((hits) =>
                    this.api.getPlatformSchools().pipe(
                        map((schools) => [
                            ...schools.map((school) => this.api.toSearchHitSchool(school)),
                            ...hits
                        ].map((hit) => ({
                            ...hit,
                            route: hit.route.startsWith('/admin/')
                                ? hit.route.replace('/admin/', '/platform/')
                                : hit.route
                        })))
                    )
                ),
                map((hits) => {
                    this.cache.set(hits);
                    this.cacheRole.set(role);
                    return hits;
                })
            );
        }

        return this.loadWorkspaceHits(false).pipe(
            map((hits) => {
                this.cache.set(hits);
                this.cacheRole.set(role);
                return hits;
            })
        );
    }

    search(term: string): Observable<SearchHit[]> {
        const query = term.trim().toLowerCase();
        if (!query) {
            return of([]);
        }

        return this.loadIndex().pipe(
            map((hits) =>
                hits.filter((hit) => {
                    const haystack = `${hit.label} ${hit.description} ${hit.type}`.toLowerCase();
                    return haystack.includes(query);
                }).slice(0, 8)
            )
        );
    }

    private loadWorkspaceHits(platformMode: boolean): Observable<SearchHit[]> {
        return this.api.getStudents().pipe(
            switchMap((students) =>
                this.api.getTeachers().pipe(
                    switchMap((teachers) =>
                        this.api.getSubjects().pipe(
                            switchMap((subjects) =>
                                this.api.getAssignments().pipe(
                                    switchMap((assignments) =>
                                        this.api.getNotifications().pipe(
                                            switchMap((notifications) =>
                                                this.api.getLibraryBooks().pipe(
                                                    switchMap((libraryBooks) =>
                                                        this.api.getLibraryLoans().pipe(
                                                            switchMap((libraryLoans) =>
                                                                this.api.getLibraryAdmins().pipe(
                                                                    map((libraryAdmins) => [
                                                                        ...students.map((student) => this.api.toSearchHitStudent(student)),
                                                                        ...teachers.map((teacher) => this.api.toSearchHitTeacher(teacher)),
                                                                        ...subjects.map((subject) => this.api.toSearchHitSubject(subject)),
                                                                        ...assignments.map((assignment) => this.api.toSearchHitAssignment(assignment)),
                                                                        ...notifications.map((notification) => this.api.toSearchHitNotification(notification)),
                                                                        ...libraryBooks.map((book) => this.api.toSearchHitLibraryBook(book)),
                                                                        ...libraryLoans.map((loan) => this.api.toSearchHitLibraryLoan(loan)),
                                                                        ...libraryAdmins.map((libraryAdmin) => this.api.toSearchHitLibraryAdmin(libraryAdmin))
                                                                    ].map((hit) => ({
                                                                        ...hit,
                                                                        route: platformMode && hit.route.startsWith('/admin/')
                                                                            ? hit.route.replace('/admin/', '/platform/')
                                                                            : hit.route
                                                                    })))
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
    }
}
