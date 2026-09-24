import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Reserva } from './modelos';

const KEY_MINS = 'viaja_aviso_mins';
const KEY_SHOWN = 'viaja_aviso_shown';

/** Avisos locales 5/10 min antes de un viaje en agenda (Notification API). */
@Injectable({ providedIn: 'root' })
export class RecordatorioService {
  private readonly api = inject(ApiService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private arrancado = false;

  /** Minutos de anticipación: 5 o 10. */
  get minutosAntes(): number {
    const n = Number(localStorage.getItem(KEY_MINS) || 10);
    return n === 5 ? 5 : 10;
  }

  set minutosAntes(v: number) {
    localStorage.setItem(KEY_MINS, String(v === 5 ? 5 : 10));
  }

  get permiso(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  get activo(): boolean {
    return this.permiso === 'granted';
  }

  start(): void {
    if (this.arrancado) return;
    this.arrancado = true;
    this.checar();
    this.timer = setInterval(() => this.checar(), 25_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.arrancado = false;
  }

  async pedirPermiso(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') {
      this.start();
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const r = await Notification.requestPermission();
    if (r === 'granted') {
      this.start();
      return true;
    }
    return false;
  }

  private checar(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    this.api.reservasProximas().subscribe({
      next: (lista) => this.revisarLista(lista || []),
      error: () => {},
    });
  }

  private revisarLista(lista: Reserva[]): void {
    const ahora = Date.now();
    const margen = this.minutosAntes * 60_000;
    const shown = this.leidos();

    for (const r of lista) {
      if (!r.id || r.estado !== 'RESERVADA') continue;
      const cuando = new Date(r.cuando).getTime();
      if (Number.isNaN(cuando)) continue;
      // Ventana: desde (viaje - N min) hasta el viaje
      if (ahora < cuando - margen || ahora >= cuando) continue;
      const key = `${r.id}@${r.cuando}`;
      if (shown.has(key)) continue;
      this.mostrar(r);
      shown.add(key);
      this.guardarLeidos(shown);
    }
  }

  private mostrar(r: Reserva): void {
    const hora = new Date(r.cuando).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dest = (r.destinoTexto || '').trim();
    const body = dest
      ? `${r.cliente} · ${dest} · ${hora}`
      : `${r.cliente} · ${hora}`;
    try {
      const n = new Notification('Viaje en ~' + this.minutosAntes + ' min', {
        body,
        tag: `reserva-${r.id}`,
        icon: '/logo.png',
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* iOS / sin soporte */
    }
  }

  private leidos(): Set<string> {
    try {
      const raw = sessionStorage.getItem(KEY_SHOWN);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }

  private guardarLeidos(s: Set<string>): void {
    const arr = [...s].slice(-80);
    sessionStorage.setItem(KEY_SHOWN, JSON.stringify(arr));
  }
}
