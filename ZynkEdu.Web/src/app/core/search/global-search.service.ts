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
                        description: `${result.grade} · ${result.term}`,
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
                        label: `${assignment.teacherName} · ${assignment.subjectName}`,
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

        if (role === 'PlatformAdmin') {
            return this.api.getPlatformSchools().pipe(
                switchMap((schools) => {
                    const hits: SearchHit[] = schools.map((school) => this.api.toSearchHitSchool(school));

                    return this.api.getAdmins().pipe(
                        switchMap((admins) =>
                            this.api.getStudents().pipe(
                                switchMap((students) =>
                                    this.api.getTeachers().pipe(
                                        switchMap((teachers) =>
                                            this.api.getSubjects().pipe(
                                                switchMap((subjects) =>
                                                    this.api.getAssignments().pipe(
                                                        switchMap((assignments) =>
                                                            this.api.getNotifications().pipe(
                                                                map((notifications) => [
                                                                    ...hits,
                                                                    ...admins.map((admin) => this.api.toSearchHitAdmin(admin)),
                                                                    ...students.map((student) => this.api.toSearchHitStudent(student)),
                                                                    ...teachers.map((teacher) => this.api.toSearchHitTeacher(teacher)),
                                                                    ...subjects.map((subject) => this.api.toSearchHitSubject(subject)),
                                                                    ...assignments.map((assignment) => this.api.toSearchHitAssignment(assignment)),
                                                                    ...notifications.map((notification) => this.api.toSearchHitNotification(notification))
                                                                ].map((hit) => ({
                                                                    ...hit,
                                                                    route: hit.route.startsWith('/admin/')
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
                    );
                }),
                map((hits) => {
                    this.cache.set(hits);
                    this.cacheRole.set(role);
                    return hits;
                })
            );
        }

        return this.api.getStudents().pipe(
            switchMap((students) =>
                this.api.getTeachers().pipe(
                    switchMap((teachers) =>
                        this.api.getSubjects().pipe(
                            switchMap((subjects) =>
                                this.api.getAssignments().pipe(
                                    switchMap((assignments) =>
                                        this.api.getNotifications().pipe(
                                            map((notifications) => [
                                                ...students.map((student) => this.api.toSearchHitStudent(student)),
                                                ...teachers.map((teacher) => this.api.toSearchHitTeacher(teacher)),
                                                ...subjects.map((subject) => this.api.toSearchHitSubject(subject)),
                                                ...assignments.map((assignment) => this.api.toSearchHitAssignment(assignment)),
                                                ...notifications.map((notification) => this.api.toSearchHitNotification(notification))
                                            ])
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            ),
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
}
