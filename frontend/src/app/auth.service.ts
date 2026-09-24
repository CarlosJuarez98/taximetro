import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';

export interface AuthMe {
  authenticated: boolean;
  username?: string;
  nombre?: string;
  rol?: 'ADMIN' | 'TAXISTA' | string;
  usuarioId?: number;
}

const AUTH_CACHE_KEY = 'viaja.auth.snapshot';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly estado$ = new BehaviorSubject<AuthMe | null>(null);
  private meInflight$: Observable<AuthMe> | null = null;

  readonly authChanges$ = this.estado$.asObservable();

  get autenticado(): boolean {
    return !!this.estado$.value?.authenticated;
  }

  get esAdmin(): boolean {
    return this.estado$.value?.rol === 'ADMIN';
  }

  get nombre(): string | null {
    const e = this.estado$.value;
    if (!e?.authenticated) return null;
    return e.nombre || e.username || null;
  }

  get username(): string | null {
    const e = this.estado$.value;
    return e?.authenticated ? e.username || null : null;
  }

  me(opts?: { force?: boolean }): Observable<AuthMe> {
    const cached = this.estado$.value;
    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (!opts?.force && cached !== null && (!online || cached.authenticated)) {
      return of(cached);
    }
    if (this.meInflight$) return this.meInflight$;

    this.meInflight$ = this.http.get<AuthMe>('/api/auth/me', { withCredentials: true }).pipe(
      map((m) => (m?.authenticated ? m : { authenticated: false })),
      tap((m) => this.persist(m)),
      catchError(() => {
        const snap = this.readSnapshot();
        const sinRed = typeof navigator !== 'undefined' && !navigator.onLine;
        if (sinRed && snap?.authenticated) {
          this.estado$.next(snap);
          return of(snap);
        }
        const empty: AuthMe = { authenticated: false };
        this.persist(empty);
        return of(empty);
      }),
      finalize(() => {
        this.meInflight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.meInflight$;
  }

  login(username: string, password: string): Observable<void> {
    return this.http
      .post<{ ok: boolean; username: string; nombre?: string; rol?: string; usuarioId?: number }>(
        '/api/auth/login',
        { username, password },
        { withCredentials: true },
      )
      .pipe(
        tap((r) => {
          this.persist({
            authenticated: true,
            username: r.username,
            nombre: r.nombre || r.username,
            rol: r.rol,
            usuarioId: r.usuarioId,
          });
        }),
        map(() => undefined),
      );
  }

  logout(): Observable<void> {
    return this.http.post<{ ok: boolean }>('/api/auth/logout', {}, { withCredentials: true }).pipe(
      catchError(() => of({ ok: true })),
      tap(() => this.marcarNoAutenticado()),
      map(() => undefined),
    );
  }

  marcarNoAutenticado(): void {
    this.persist({ authenticated: false });
  }

  private persist(m: AuthMe): void {
    this.estado$.next(m);
    try {
      if (m.authenticated) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(m));
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  private readSnapshot(): AuthMe | null {
    try {
      const raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      const m = JSON.parse(raw) as AuthMe;
      return m?.authenticated ? m : null;
    } catch {
      return null;
    }
  }
}
