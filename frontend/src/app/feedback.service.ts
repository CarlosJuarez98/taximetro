import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Estado de carga global (sin sonidos). */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly busy$ = new BehaviorSubject(false);
  private busyDepth = 0;
  private mensaje = '';

  readonly cargando$ = this.busy$.asObservable();

  get cargando(): boolean {
    return this.busy$.value;
  }

  get texto(): string {
    return this.mensaje || 'Cargando…';
  }

  /** No-op (sin audio). */
  tap(): void {}

  /** No-op (sin audio). */
  ok(): void {}

  /** No-op (sin audio). */
  error(): void {}

  start(msg = 'Cargando…'): void {
    this.busyDepth++;
    this.mensaje = msg;
    this.busy$.next(true);
  }

  stop(): void {
    this.busyDepth = Math.max(0, this.busyDepth - 1);
    if (this.busyDepth === 0) {
      this.mensaje = '';
      this.busy$.next(false);
    }
  }
}
