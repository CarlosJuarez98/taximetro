import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

const STORAGE_KEY = 'viaja_offline_queue';

type CorteItem = {
  kind: 'corte';
  id: number;
  puntos: { lat: number; lng: number; t: string }[];
  kmManual?: number | null;
  minutosEspera?: number;
  casetas?: number;
  formaPago?: string;
};

type CorteCajaItem = {
  kind: 'corte-caja';
  conteoReal: number;
};

type QueueItem = CorteItem | CorteCajaItem;

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly api = inject(ApiService);
  private flushing = false;

  pendingCount(): number {
    return this.read().length;
  }

  enqueueCorte(
    id: number,
    puntos: { lat: number; lng: number; t: string }[],
    kmManual?: number | null,
    minutosEspera?: number,
    casetas?: number,
    formaPago?: string,
  ): void {
    const q = this.read();
    q.push({ kind: 'corte', id, puntos, kmManual, minutosEspera, casetas, formaPago });
    this.write(q);
  }

  enqueueCorteCaja(conteoReal: number): void {
    const q = this.read();
    q.push({ kind: 'corte-caja', conteoReal });
    this.write(q);
  }

  flush(): void {
    if (this.flushing || !navigator.onLine) return;
    const q = this.read();
    if (!q.length) return;
    this.flushing = true;
    void this.drain(q).finally(() => {
      this.flushing = false;
    });
  }

  private async drain(initial: QueueItem[]): Promise<void> {
    const remaining: QueueItem[] = [...initial];
    while (remaining.length && navigator.onLine) {
      const item = remaining[0];
      try {
        if (item.kind === 'corte') {
          await firstValueFrom(
            this.api.corte(
              item.id,
              item.puntos,
              item.kmManual,
              item.minutosEspera,
              item.casetas,
              item.formaPago,
            ),
          );
        } else {
          await firstValueFrom(this.api.corteCaja(item.conteoReal));
        }
        remaining.shift();
        this.write(remaining);
      } catch {
        break;
      }
    }
  }

  private read(): QueueItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueueItem[];
    } catch {
      return [];
    }
  }

  private write(items: QueueItem[]): void {
    if (!items.length) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }
}
