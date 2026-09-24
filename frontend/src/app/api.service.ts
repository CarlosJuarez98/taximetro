import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Estimacion, Lugar, Reserva, ResumenHoy, Tarifa, Viaje } from './modelos';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  tarifa(): Observable<Tarifa> {
    return this.http.get<Tarifa>('/api/tarifa');
  }

  guardarTarifa(dto: Tarifa): Observable<Tarifa> {
    return this.http.put<Tarifa>('/api/tarifa', dto);
  }

  buscar(q: string): Observable<{ lugares: Lugar[] }> {
    return this.http.get<{ lugares: Lugar[] }>('/api/geo/buscar', {
      params: new HttpParams().set('q', q),
    });
  }

  reverso(lat: number, lng: number): Observable<Lugar> {
    return this.http.get<Lugar>('/api/geo/reverso', {
      params: new HttpParams().set('lat', lat).set('lng', lng),
    });
  }

  estimar(body: {
    origenLat: number;
    origenLng: number;
    destinoLat: number;
    destinoLng: number;
    destinoTexto?: string;
  }): Observable<Estimacion> {
    return this.http.post<Estimacion>('/api/viajes/estimar', body);
  }

  enCurso(): Observable<Partial<Viaje>> {
    return this.http.get<Partial<Viaje>>('/api/viajes/en-curso');
  }

  iniciar(body: Record<string, unknown>): Observable<Viaje> {
    return this.http.post<Viaje>('/api/viajes', body);
  }

  puntos(id: number, puntos: { lat: number; lng: number; t: string }[]): Observable<Viaje> {
    return this.http.post<Viaje>(`/api/viajes/${id}/puntos`, { puntos });
  }

  corte(
    id: number,
    puntos: { lat: number; lng: number; t: string }[],
    kmManual?: number | null,
    minutosEspera?: number,
    casetas?: number,
  ): Observable<Viaje> {
    const body: Record<string, unknown> = { puntos };
    if (kmManual != null && kmManual >= 0) {
      body['kmManual'] = kmManual;
    }
    if (minutosEspera != null && minutosEspera > 0) {
      body['minutosEspera'] = minutosEspera;
    }
    if (casetas != null && casetas > 0) {
      body['casetas'] = casetas;
    }
    return this.http.post<Viaje>(`/api/viajes/${id}/corte`, body);
  }

  cancelar(id: number): Observable<Viaje> {
    return this.http.post<Viaje>(`/api/viajes/${id}/cancelar`, {});
  }

  eliminarViaje(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/viajes/${id}`);
  }

  hoy(): Observable<ResumenHoy> {
    return this.http.get<ResumenHoy>('/api/viajes/hoy');
  }

  viajesHoy(): Observable<Viaje[]> {
    return this.http.get<Viaje[]>('/api/viajes/hoy/lista');
  }

  guardarFondo(fondoInicial: number): Observable<ResumenHoy> {
    return this.http.put<ResumenHoy>('/api/viajes/hoy/fondo', { fondoInicial });
  }

  corteCaja(conteoReal: number): Observable<ResumenHoy> {
    return this.http.post<ResumenHoy>('/api/viajes/hoy/corte-caja', { conteoReal });
  }

  recientes(): Observable<Viaje[]> {
    return this.http.get<Viaje[]>('/api/viajes');
  }

  reservasProximas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>('/api/reservas/proximas');
  }

  reservasPendientes(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>('/api/reservas/pendientes');
  }

  reservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>('/api/reservas');
  }

  crearReserva(dto: Reserva): Observable<Reserva> {
    return this.http.post<Reserva>('/api/reservas', dto);
  }

  cancelarReserva(id: number): Observable<Reserva> {
    return this.http.post<Reserva>(`/api/reservas/${id}/cancelar`, {});
  }

  confirmarReserva(id: number, cuandoIso?: string): Observable<Reserva> {
    const body = cuandoIso ? { cuando: cuandoIso } : {};
    return this.http.post<Reserva>(`/api/reservas/${id}/confirmar`, body);
  }

  reservaHecha(id: number): Observable<Reserva> {
    return this.http.post<Reserva>(`/api/reservas/${id}/hecha`, {});
  }

  reservaConflicto(
    cuandoIso: string,
    minutos = 60,
  ): Observable<{ conflicto: boolean; propuestas?: string[] }> {
    return this.http.get<{ conflicto: boolean; propuestas?: string[] }>('/api/reservas/conflicto', {
      params: new HttpParams().set('cuando', cuandoIso).set('minutos', minutos),
    });
  }

  historialClientes(): Observable<string[]> {
    return this.http.get<string[]>('/api/reservas/historial/clientes');
  }

  historialDestinos(): Observable<string[]> {
    return this.http.get<string[]>('/api/reservas/historial/destinos');
  }
}
