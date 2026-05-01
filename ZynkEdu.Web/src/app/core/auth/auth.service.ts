import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthSession, LoginRequest, LoginResponse, SchoolResponse, WorkspaceRole } from '../api/api.models';

const AUTH_STORAGE_KEY = 'zynkedu.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly sessionState = signal<AuthSession | null>(this.loadSession());
    private readonly schoolsState = signal<SchoolResponse[]>([]);
    private readonly loadingState = signal(false);

    readonly session = computed(() => this.sessionState());
    readonly token = computed(() => this.sessionState()?.accessToken ?? null);
    readonly role = computed(() => this.sessionState()?.role ?? null);
    readonly displayName = computed(() => this.sessionState()?.displayName ?? 'Guest');
    readonly schoolId = computed(() => this.sessionState()?.schoolId ?? null);
    readonly userId = computed(() => this.sessionState()?.userId ?? null);
    readonly schools = computed(() => this.schoolsState());
    readonly isAuthenticated = computed(() => this.isSessionValid(this.sessionState()));
    readonly isLoading = computed(() => this.loadingState());

    login(request: LoginRequest): Observable<LoginResponse> {
        this.loadingState.set(true);
        return this.api.login(request).pipe(
            tap((response) => this.saveSession(response)),
            tap(() => this.loadingState.set(false)),
            catchError((error) => {
                this.loadingState.set(false);
                return throwError(() => error);
            })
        );
    }

    loadSchools(force = false): Observable<SchoolResponse[]> {
        if (this.schoolsState().length > 0 && !force) {
            return of(this.schoolsState());
        }

        this.loadingState.set(true);
        return this.api.getSchools().pipe(
            tap((schools) => this.schoolsState.set([...schools].sort((a, b) => a.name.localeCompare(b.name)))),
            tap(() => this.loadingState.set(false)),
            catchError((error) => {
                this.loadingState.set(false);
                return throwError(() => error);
            })
        );
    }

    logout(): void {
        this.sessionState.set(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        void this.router.navigate(['/auth/login']);
    }

    updateDisplayName(displayName: string): void {
        const session = this.sessionState();
        if (!session) {
            return;
        }

        const nextSession = { ...session, displayName };
        this.sessionState.set(nextSession);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    }

    navigateAfterLogin(role: WorkspaceRole): Promise<boolean> {
        const target = role === 'Teacher'
            ? '/teacher/dashboard'
            : role === 'AccountantSuper' || role === 'AccountantSenior' || role === 'AccountantJunior'
                ? '/accountant/dashboard'
            : role === 'PlatformAdmin'
                ? '/platform/dashboard'
                : role === 'LibraryAdmin'
                    ? '/library/dashboard'
                    : '/admin/dashboard';
        return this.router.navigateByUrl(target);
    }

    private saveSession(response: LoginResponse): void {
        const session: AuthSession = {
            accessToken: response.accessToken,
            role: response.role,
            schoolId: response.schoolId,
            userId: response.userId,
            displayName: response.displayName,
            expiresAt: this.readJwtExp(response.accessToken)
        };

        this.sessionState.set(session);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        void this.navigateAfterLogin(response.role);
    }

    private loadSession(): AuthSession | null {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        try {
            const session = JSON.parse(raw) as AuthSession;
            return this.isSessionValid(session) ? session : null;
        } catch {
            return null;
        }
    }

    private isSessionValid(session: AuthSession | null): boolean {
        if (!session?.accessToken) {
            return false;
        }

        if (!session.expiresAt) {
            return true;
        }

        return session.expiresAt * 1000 > Date.now();
    }

    private readJwtExp(token: string): number | null {
        const payload = token.split('.')[1];
        if (!payload) {
            return null;
        }

        try {
            const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return typeof parsed.exp === 'number' ? parsed.exp : null;
        } catch {
            return null;
        }
    }
}
