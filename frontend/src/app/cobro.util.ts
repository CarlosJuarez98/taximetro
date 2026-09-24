import { Tarifa } from './modelos';

export interface PuntoLocal {
  lat: number;
  lng: number;
  t: number;
}

export interface ResultadoCobro {
  cobro: number;
  metros: number;
  duracionSegundos: number;
  segundosEspera: number;
  nocturno: boolean;
}

export function haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcularCobro(
  tarifa: Tarifa,
  puntos: PuntoLocal[],
  inicioMs: number,
  finMs: number,
): ResultadoCobro {
  let desde = inicioMs;
  let hasta = finMs;
  if (hasta < desde) hasta = desde;

  let metros = 0;
  let esperaMs = 0;
  const umbral = tarifa.umbralEsperaKmh ?? 12;

  if (puntos.length >= 2) {
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1];
      const b = puntos[i];
      const d = haversineMetros(a.lat, a.lng, b.lat, b.lng);
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      metros += d;
      const kmh = (d * 3600) / dt;
      if (kmh < umbral) esperaMs += dt;
    }
  } else {
    esperaMs = Math.max(0, hasta - desde);
  }

  return armarCobro(tarifa, metros, Math.floor(esperaMs / 1000), desde, hasta);
}

/** Cotiza con los km que tú pones (Maps/Waze) + espera opcional. */
export function calcularCobroPorKm(
  tarifa: Tarifa,
  km: number,
  minutosEspera = 0,
  instanteMs = Date.now(),
  /** true=noche, false=día, null/undefined=según la hora de instanteMs */
  forzarNoche: boolean | null = null,
): ResultadoCobro {
  const metros = Math.max(0, Number(km) || 0) * 1000;
  const segundosEspera = Math.max(0, Number(minutosEspera) || 0) * 60;
  return armarCobro(tarifa, metros, segundosEspera, instanteMs, instanteMs, forzarNoche);
}

function armarCobro(
  tarifa: Tarifa,
  metros: number,
  segundosEspera: number,
  desdeMs: number,
  hastaMs: number,
  forzarNoche: boolean | null = null,
): ResultadoCobro {
  const duracionSegundos = Math.max(0, Math.floor((hastaMs - desdeMs) / 1000));
  const km = metros / 1000;
  let cobro =
    n(tarifa.banderazo) +
    n(tarifa.precioPorKm) * km +
    n(tarifa.precioEsperaMinuto) * (segundosEspera / 60);

  const nocturno =
    forzarNoche === true ? true : forzarNoche === false ? false : esNoche(tarifa, desdeMs);
  if (nocturno && n(tarifa.recargoNocturnoPct) > 0) {
    cobro *= 1 + n(tarifa.recargoNocturnoPct) / 100;
  }
  cobro = Math.max(cobro, n(tarifa.tarifaMinima));
  cobro = redondearPago(cobro, tarifa.redondearPesos !== false);
  return { cobro, metros, duracionSegundos, segundosEspera, nocturno };
}

/**
 * Redondea hacia arriba a número cerrado (múltiplos de $5) para facilitar el pago.
 * Si redondearCerrado es false, solo sube al peso entero.
 */
export function redondearPago(monto: number, redondearCerrado = true): number {
  const x = Math.max(0, Number(monto) || 0);
  if (redondearCerrado) {
    return Math.ceil(x / 5) * 5;
  }
  return Math.ceil(x);
}

export function esNoche(tarifa: Tarifa, instanteMs: number): boolean {
  const hora = Number(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(instanteMs)),
  );
  return esHoraNoche(hora, tarifa.nocheDesdeHora, tarifa.nocheHastaHora);
}

/** ¿La hora (0–23) cae en franja nocturna? Soporta rangos que cruzan medianoche. */
export function esHoraNoche(hora: number, desde: number, hasta: number): boolean {
  const h = ((Math.floor(hora) % 24) + 24) % 24;
  const d = ((Math.floor(desde) % 24) + 24) % 24;
  const t = ((Math.floor(hasta) % 24) + 24) % 24;
  if (d === t) return false;
  if (d < t) return h >= d && h < t;
  return h >= d || h < t;
}

export function horasDeFranja(
  franja: 'todas' | 'dia' | 'noche',
  nocheDesde = 22,
  nocheHasta = 6,
): number[] {
  const all = Array.from({ length: 24 }, (_, i) => i);
  if (franja === 'todas') return all;
  if (franja === 'noche') return all.filter((h) => esHoraNoche(h, nocheDesde, nocheHasta));
  return all.filter((h) => !esHoraNoche(h, nocheDesde, nocheHasta));
}

/** Ajusta la hora al rango permitido (día o noche). */
export function clampHoraFranja(
  date: Date,
  franja: 'todas' | 'dia' | 'noche',
  nocheDesde = 22,
  nocheHasta = 6,
): Date {
  if (franja === 'todas') return date;
  const horas = horasDeFranja(franja, nocheDesde, nocheHasta);
  if (!horas.length) return date;
  const h = date.getHours();
  if (horas.includes(h)) return date;
  // Preferir la hora "central" de la franja
  const preferida = franja === 'noche' ? nocheDesde : Math.floor((nocheHasta + nocheDesde) / 2) % 24;
  const pick =
    horas.find((x) => x >= preferida) ??
    horas.reduce((best, x) => (Math.abs(x - h) < Math.abs(best - h) ? x : best), horas[0]);
  const next = new Date(date);
  next.setHours(pick, date.getMinutes(), 0, 0);
  return next;
}

export function duracionLegible(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${m.toString().padStart(2, '0')} min`;
  if (m > 0) return r > 0 ? `${m} min ${r.toString().padStart(2, '0')} s` : `${m} min`;
  return `${r} s`;
}

export function dinero(nro: number, enteros = true): string {
  return nro.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: enteros ? 0 : 2,
    maximumFractionDigits: enteros ? 0 : 2,
  });
}

export function mmss(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

function n(v: number | null | undefined): number {
  return Number(v || 0);
}
