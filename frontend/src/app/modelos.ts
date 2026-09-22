export interface Tarifa {
  id?: number;
  nombre: string;
  banderazo: number;
  precioPorKm: number;
  precioEsperaMinuto: number;
  tarifaMinima: number;
  umbralEsperaKmh: number;
  recargoNocturnoPct: number;
  nocheDesdeHora: number;
  nocheHastaHora: number;
  redondearPesos: boolean;
}

export interface Lugar {
  etiqueta: string;
  lat: number;
  lng: number;
}

export interface Estimacion {
  distanciaMetros: number;
  duracionSegundos: number;
  cobroEstimado: number;
  destinoTexto?: string;
  ruta: number[][];
  aproximada: boolean;
}

export interface Viaje {
  id: number;
  estado: 'EN_CURSO' | 'CERRADO' | 'CANCELADO';
  inicio: string;
  fin?: string | null;
  origenLat: number;
  origenLng: number;
  origenTexto?: string;
  destinoLat?: number | null;
  destinoLng?: number | null;
  destinoTexto?: string | null;
  distanciaMetros: number;
  duracionSegundos: number;
  segundosEspera: number;
  cobro: number;
  casetas?: number;
  notas?: string | null;
  ruta?: number[][];
}

export interface ResumenHoy {
  viajes: number;
  cobrado: number;
  km: number;
  minutos: number;
  fondoInicial?: number;
  esperadoEnCaja?: number;
  conteoReal?: number | null;
  diferencia?: number | null;
  cortada?: boolean;
}

export interface Reserva {
  id?: number;
  cuando: string;
  cliente: string;
  telefono?: string | null;
  destinoTexto?: string | null;
  kmEstimado?: number;
  cobroEstimado?: number;
  casetas?: number;
  nocturno?: boolean;
  minutosOcupados?: number;
  notas?: string | null;
  estado?: 'PENDIENTE' | 'RESERVADA' | 'HECHA' | 'CANCELADA';
  creadaEn?: string;
  conflicto?: boolean;
  /** ISO de horarios libres si hay empalme. */
  propuestas?: string[];
}

export interface PuntoGps {
  lat: number;
  lng: number;
  t: string;
}

export const HUAMANTLA = { lat: 19.3142, lng: -97.925 };

/** Cotización pendiente para crear reserva en Agenda. */
export const RESERVA_BORRADOR_KEY = 'viaja_reserva_borrador';

export interface ReservaBorrador {
  cuandoLocal?: string;
  cliente?: string;
  telefono?: string;
  destinoTexto?: string;
  kmEstimado?: number;
  cobroEstimado?: number;
  casetas?: number;
  nocturno?: boolean;
  notas?: string;
  paraCuando?: string;
}
