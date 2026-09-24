/** Utilidades de límite de meses en calendarios (min/max). */

export function isoDePartes(y: number, m1: number, d: number): string {
  return `${y}-${String(m1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** True si el mes (0-11) tiene al menos un día no bloqueado. */
export function mesTieneDiaPermitido(
  anio: number,
  mes0: number,
  bloqueada: (iso: string) => boolean
): boolean {
  const dias = new Date(anio, mes0 + 1, 0).getDate();
  for (let d = 1; d <= dias; d++) {
    if (!bloqueada(isoDePartes(anio, mes0 + 1, d))) return true;
  }
  return false;
}

/** Desplaza un mes; delta = -1 | +1. */
export function desplazarMes(anio: number, mes0: number, delta: number): { anio: number; mes: number } {
  let m = mes0 + delta;
  let y = anio;
  if (m < 0) {
    m = 11;
    y -= 1;
  } else if (m > 11) {
    m = 0;
    y += 1;
  }
  return { anio: y, mes: m };
}

/**
 * Si el mes actual no tiene días elegibles, salta al mes de preferIso
 * o al primer mes con días libres cerca de preferIso/hoy.
 */
export function ajustarVistaAMesPermitido(
  anio: number,
  mes0: number,
  bloqueada: (iso: string) => boolean,
  preferIso?: string | null
): { anio: number; mes: number } {
  if (mesTieneDiaPermitido(anio, mes0, bloqueada)) {
    return { anio, mes: mes0 };
  }
  if (preferIso && /^\d{4}-\d{2}-\d{2}$/.test(preferIso)) {
    const [y, m] = preferIso.split('-').map(Number);
    if (mesTieneDiaPermitido(y, m - 1, bloqueada)) {
      return { anio: y, mes: m - 1 };
    }
  }
  for (let i = 1; i <= 24; i++) {
    const atras = desplazarMes(anio, mes0, -i);
    if (mesTieneDiaPermitido(atras.anio, atras.mes, bloqueada)) return atras;
    const adel = desplazarMes(anio, mes0, i);
    if (mesTieneDiaPermitido(adel.anio, adel.mes, bloqueada)) return adel;
  }
  return { anio, mes: mes0 };
}
