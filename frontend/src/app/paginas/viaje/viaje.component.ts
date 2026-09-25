import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { ApiService } from '../../api.service';
import { OfflineQueueService } from '../../offline-queue.service';
import { FechaHoraPickerComponent } from '../../fecha-hora-picker/fecha-hora-picker.component';
import { SugerenciaCampoComponent } from '../../sugerencia-campo.component';
import { FeedbackService } from '../../feedback.service';
import {
  HUAMANTLA,
  CASA_KEY,
  CasaGps,
  RESERVA_BORRADOR_KEY,
  ReservaBorrador,
  Tarifa,
  TarifaFija,
  Viaje,
  Lugar,
  Reserva,
  VIAJE_ESTADO_KEY,
  ViajeEstadoLocal,
  DESDE_RESERVA_KEY,
} from '../../modelos';
import { calcularCobroPorKm, clampHoraFranja, dinero, duracionLegible, esNoche, haversineMetros, mmss, redondearPago } from '../../cobro.util';
import { compartirWhatsappTarjeta, sloganAleatorio } from '../../whatsapp.util';

type MotivoEspera = 'cliente' | 'trafico';
type Proporcion = 'nada' | 'mitad' | 'completo';
/** Cotizar para ahora, de día o de noche (otro día / otra hora). */
type ModoHorario = 'ahora' | 'dia' | 'noche';

@Component({
  selector: 'app-viaje',
  standalone: true,
  imports: [FormsModule, FechaHoraPickerComponent, SugerenciaCampoComponent],
  templateUrl: './viaje.component.html',
  styleUrl: './viaje.component.css',
})
export class ViajeComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly feedback = inject(FeedbackService);
  private readonly offline = inject(OfflineQueueService);

  tarifa: Tarifa | null = null;
  error = '';
  accionando = false;
  enCurso: Viaje | null = null;
  recibo: Viaje | null = null;
  /** Billete con que paga (para calcular cambio). */
  billetePago: number | null = null;
  readonly billetesRapidos = [50, 100, 200, 500, 1000];

  /** Km con el cliente a bordo (GPS en vivo o Maps). */
  kmCliente: number | null = null;
  /** Casa → punto de recogida (vas vacío). */
  kmVacioIda = 0;
  /** Último destino → casa (regresas vacío). */
  kmVacioRegreso = 0;
  /** Cuánto del vacío ida absorbe el cliente. */
  modoVacioIda: Proporcion = 'mitad';
  /** Cuánto del vacío a casa absorbe el cliente. */
  modoVacioRegreso: Proporcion = 'mitad';

  minEsperaCotiza = 0;
  casetasIda = 0;
  modoRegreso: Proporcion = 'nada';
  /** Para estimar un viaje de otro día / otra hora. */
  modoHorario: ModoHorario = 'ahora';
  /** Texto libre legacy / nota corta. */
  paraCuando = '';
  /** Fecha/hora concreta al cotizar día o noche (pendiente). */
  cuandoLocal = '';
  clienteCotiza = '';
  telefonoCotiza = '';
  destinoCotiza = '';
  clientesHist: string[] = [];
  destinosHist: string[] = [];
  okMsg = '';

  cobroVivo = 0;
  segundos = 0;
  /** Texto del último desglose (recibo / WhatsApp). */
  ultimoDesglose = '';
  /** GPS midiendo km en vivo. */
  gpsActivo = false;
  /** GPS falló o no disponible: km editables a mano. */
  gpsFallo = false;
  /** Ya hay casa guardada (para vacío automático). */
  casaLista = false;
  /**
   * vacio = saliste de base / vas por el cliente (GPS → vacío ida).
   * con_cliente = ya lo subiste (GPS → km cobrables con él).
   */
  faseViaje: 'vacio' | 'con_cliente' = 'vacio';

  /** Reserva de agenda ligada al viaje actual. */
  reservaIdActiva?: number;
  formaPagoCorte: 'EFECTIVO' | 'TRANSFER' = 'EFECTIVO';
  cobroFijo: number | null = null;
  tarifasFijas: TarifaFija[] = [];
  destinoBusqueda = '';
  lugaresBusqueda: Lugar[] = [];
  buscandoGeo = false;

  esperaMotivo: MotivoEspera | null = null;
  private esperaAcumuladaSeg = 0;
  private esperaInicioMs = 0;

  private tick?: number;
  private gpsWatchId?: number;
  private gpsSinSenalTimer?: number;
  private metrosGps = 0;
  private lastLat: number | null = null;
  private lastLng: number | null = null;
  private puntosPendientes: { lat: number; lng: number; t: string }[] = [];
  private flushTimer?: number;
  private subs = new Subscription();
  private inicioMs = 0;

  get hayViaje(): boolean {
    return this.enCurso?.estado === 'EN_CURSO';
  }

  /**
   * Km que mide el GPS ahora van bloqueados.
   * Solo se editan a mano si falló el GPS.
   */
  get kmGpsBloqueado(): boolean {
    return this.hayViaje && !this.gpsFallo;
  }

  get kmGpsLabel(): string {
    if (this.gpsFallo) return 'Manual (GPS falló)';
    if (this.gpsActivo) return 'GPS midiendo…';
    return 'GPS';
  }

  /** Vas de la base al cliente (aún no sube). */
  get yendoPorCliente(): boolean {
    return this.hayViaje && this.faseViaje === 'vacio';
  }

  /** Cliente a bordo. */
  get conClienteABordo(): boolean {
    return this.hayViaje && this.faseViaje === 'con_cliente';
  }

  get etiquetaViaje(): string {
    if (!this.hayViaje) return 'Taxímetro';
    if (this.esperando) return this.motivoEsperaTxt;
    if (this.yendoPorCliente) return 'Por el cliente';
    return 'Con cliente';
  }

  get esNocturno(): boolean {
    if (this.hayViaje || this.recibo) {
      return !!this.tarifa && esNoche(this.tarifa, this.inicioMs || Date.now());
    }
    return this.cotizaEsNoche;
  }

  /** Noche forzada en cotización (día / noche / hora actual). */
  get cotizaEsNoche(): boolean {
    if (this.modoHorario === 'noche') return true;
    if (this.modoHorario === 'dia') return false;
    return !!this.tarifa && esNoche(this.tarifa, Date.now());
  }

  get forzarNocheCotiza(): boolean | null {
    if (this.modoHorario === 'noche') return true;
    if (this.modoHorario === 'dia') return false;
    return null;
  }

  get esperando(): boolean {
    return this.esperaMotivo != null;
  }

  get esperaSegundos(): number {
    let s = this.esperaAcumuladaSeg;
    if (this.esperaMotivo && this.esperaInicioMs) {
      s += Math.max(0, Math.floor((Date.now() - this.esperaInicioMs) / 1000));
    }
    return s;
  }

  get minEsperaCobro(): number {
    if (this.hayViaje || this.esperaSegundos > 0) {
      return this.esperaSegundos / 60;
    }
    return Math.max(0, Number(this.minEsperaCotiza) || 0);
  }

  get pctRegreso(): number {
    return this.pctDe(this.modoRegreso);
  }

  get kmCobrables(): number {
    const con = Math.max(0, Number(this.kmCliente) || 0);
    const ida = Math.max(0, Number(this.kmVacioIda) || 0) * (this.pctDe(this.modoVacioIda) / 100);
    const reg = Math.max(0, Number(this.kmVacioRegreso) || 0) * (this.pctDe(this.modoVacioRegreso) / 100);
    return Math.round((con + ida + reg) * 10) / 10;
  }

  get casetasTotal(): number {
    const ida = Math.max(0, Number(this.casetasIda) || 0);
    const regreso = ida * (this.pctRegreso / 100);
    return Math.round(ida + regreso);
  }

  get cobroTxt(): string {
    return dinero(this.cobroVivo);
  }

  get cotizacionTxt(): string {
    if (this.cobroFijo != null && !this.hayViaje) {
      return dinero(this.totalPago(this.cobroFijo));
    }
    if (!this.tarifa || this.kmCliente == null || this.kmCliente < 0) {
      return '—';
    }
    const r = calcularCobroPorKm(
      this.tarifa,
      this.kmCobrables,
      this.minEsperaCobro,
      Date.now(),
      this.forzarNocheCotiza,
    );
    return dinero(this.totalPago(r.cobro));
  }

  get desgloseKm(): string {
    if (this.cobroFijo != null && !this.hayViaje) {
      return `Tarifa fija ${dinero(this.cobroFijo)}`;
    }
    const partes: string[] = [];
    const con = Math.max(0, Number(this.kmCliente) || 0);
    if (con > 0) partes.push(`con cliente ${con} km`);
    const ida = Math.max(0, Number(this.kmVacioIda) || 0);
    if (ida > 0) {
      partes.push(`vacío ida ${ida} km × ${this.pctDe(this.modoVacioIda)}%`);
    }
    const reg = Math.max(0, Number(this.kmVacioRegreso) || 0);
    if (reg > 0) {
      partes.push(`vacío a casa ${reg} km × ${this.pctDe(this.modoVacioRegreso)}%`);
    }
    if (!partes.length) return '';
    return `${partes.join(' · ')} → cobras ${this.kmCobrables} km`;
  }

  get desgloseCasetas(): string {
    if (this.casetasTotal <= 0) return '';
    const ida = Math.max(0, Number(this.casetasIda) || 0);
    if (this.modoRegreso === 'mitad') {
      return `ida ${dinero(ida)} + regreso 50% ${dinero(Math.round(ida / 2))}`;
    }
    if (this.modoRegreso === 'completo') {
      return `ida ${dinero(ida)} + regreso completo ${dinero(ida)}`;
    }
    return `solo ida ${dinero(ida)}`;
  }

  get desgloseTotalCasetas(): string {
    return dinero(this.casetasTotal);
  }

  get dineroRecibo(): string {
    return dinero(Number(this.recibo?.cobro || 0));
  }

  get casetasRecibo(): string {
    return dinero(Number(this.recibo?.casetas || 0));
  }

  get tiempoRecibo(): string {
    return duracionLegible(this.recibo?.duracionSegundos || 0);
  }

  get esperaRecibo(): string {
    return mmss(this.recibo?.segundosEspera || 0);
  }

  get totalReciboNum(): number {
    return Math.round(Number(this.recibo?.cobro || 0));
  }

  get cambioRecibo(): number | null {
    if (this.billetePago == null || this.billetePago <= 0) return null;
    return Math.round(this.billetePago - this.totalReciboNum);
  }

  get cambioTxt(): string {
    const c = this.cambioRecibo;
    if (c == null) return '';
    if (c < 0) return `Faltan ${dinero(-c)}`;
    if (c === 0) return 'Pago exacto';
    return `Cambio ${dinero(c)}`;
  }

  setBillete(n: number): void {
    this.billetePago = n;
  }

  get franjaPicker(): 'dia' | 'noche' | 'todas' {
    if (this.modoHorario === 'dia') return 'dia';
    if (this.modoHorario === 'noche') return 'noche';
    return 'todas';
  }

  get nocheDesdeHora(): number {
    return this.tarifa?.nocheDesdeHora ?? 22;
  }

  get nocheHastaHora(): number {
    return this.tarifa?.nocheHastaHora ?? 6;
  }

  get motivoEsperaTxt(): string {
    if (this.esperaMotivo === 'cliente') return 'Cliente no sale';
    if (this.esperaMotivo === 'trafico') return 'Tráfico';
    return '';
  }

  get nocheTxt(): string {
    if (!this.tarifa) return '';
    const pct = Number(this.tarifa.recargoNocturnoPct || 0);
    if (!this.esNocturno || pct <= 0) return '';
    return `Noche +${pct}%`;
  }

  get horarioCotizaTxt(): string {
    if (this.modoHorario === 'dia') return 'de día';
    if (this.modoHorario === 'noche') return 'de noche';
    return 'ahora';
  }

  get esTransferRecibo(): boolean {
    const fp = (this.recibo?.formaPago || this.formaPagoCorte || 'EFECTIVO').toUpperCase();
    return fp === 'TRANSFER';
  }

  ngOnInit(): void {
    this.casaLista = !!this.leerCasaRaw();
    this.cargarHistorial();
    this.api.tarifasFijas().subscribe({
      next: (l) => (this.tarifasFijas = (l || []).filter((f) => f.activo !== false)),
      error: () => {},
    });
    this.aplicarPrefillReserva();
    this.subs.add(
      this.api.tarifa().subscribe({
        next: (t) => {
          this.tarifa = t;
          this.recalcularVivo();
        },
        error: () => (this.error = 'No se pudo cargar la tarifa. ¿Está la API en 8084?'),
      }),
    );
    this.subs.add(
      this.api.enCurso().subscribe((v) => {
        if (v && v.id && v.estado === 'EN_CURSO') {
          this.reanudar(v as Viaje);
          this.restaurarViajeEstado();
        }
      }),
    );
  }

  setFormaPago(fp: 'EFECTIVO' | 'TRANSFER'): void {
    this.formaPagoCorte = fp;
    if (this.hayViaje) this.persistirViajeEstado();
  }

  aplicarTarifaFija(tf: TarifaFija): void {
    this.cobroFijo = Math.max(0, Number(tf.cobro) || 0);
    this.destinoCotiza = tf.nombre;
    if (tf.km != null && Number(tf.km) > 0) {
      this.kmCliente = Number(tf.km);
    }
    this.recalcularVivo();
  }

  limpiarTarifaFija(): void {
    this.cobroFijo = null;
    this.recalcularVivo();
  }

  buscarDestino(): void {
    const q = this.destinoBusqueda.trim();
    if (q.length < 3) return;
    this.buscandoGeo = true;
    this.api.buscar(q).subscribe({
      next: (r) => {
        this.buscandoGeo = false;
        this.lugaresBusqueda = r.lugares || [];
      },
      error: () => {
        this.buscandoGeo = false;
        this.lugaresBusqueda = [];
      },
    });
  }

  elegirLugar(l: Lugar): void {
    this.lugaresBusqueda = [];
    this.destinoBusqueda = l.etiqueta;
    this.destinoCotiza = l.etiqueta;
    void this.estimarKmHasta(l);
  }

  private async estimarKmHasta(dest: Lugar): Promise<void> {
    const pos = await this.leerUbicacion();
    const origenLat = pos.gps ? pos.lat : HUAMANTLA.lat;
    const origenLng = pos.gps ? pos.lng : HUAMANTLA.lng;
    this.api
      .estimar({
        origenLat,
        origenLng,
        destinoLat: dest.lat,
        destinoLng: dest.lng,
        destinoTexto: dest.etiqueta,
      })
      .subscribe({
        next: (e) => {
          this.kmCliente = Math.round((e.distanciaMetros / 1000) * 10) / 10;
          this.cobroFijo = null;
          this.onKmChange();
        },
        error: () => (this.error = 'No se pudo estimar la ruta.'),
      });
  }

  private aplicarPrefillReserva(): void {
    let r: Reserva | null = null;
    try {
      const raw = sessionStorage.getItem(DESDE_RESERVA_KEY);
      if (raw) r = JSON.parse(raw) as Reserva;
    } catch {
      /* ignore */
    }
    const qId = Number(this.route.snapshot.queryParamMap.get('reserva') || 0);
    if (qId && r?.id && r.id !== qId) {
      /* id en URL manda si no coincide */
    }
    if (!r && qId) {
      r = { id: qId } as Reserva;
    }
    if (!r) return;

    if (r.id) this.reservaIdActiva = r.id;
    if (r.kmEstimado != null && r.kmEstimado > 0) this.kmCliente = Number(r.kmEstimado);
    if (r.destinoTexto) this.destinoCotiza = r.destinoTexto;
    if (r.casetas != null) this.casetasIda = Number(r.casetas) || 0;
    if (r.nocturno) this.modoHorario = 'noche';
    if (r.cliente) this.clienteCotiza = r.cliente;
    if (r.telefono) this.telefonoCotiza = r.telefono;
    if (r.cobroEstimado != null && Number(r.cobroEstimado) > 0) {
      this.cobroFijo = Number(r.cobroEstimado);
      this.okMsg = `Reserva · cobro ref. ${dinero(this.cobroFijo)}`;
    } else {
      this.okMsg = 'Datos de la reserva cargados.';
    }
    this.recalcularVivo();
  }

  private persistirViajeEstado(): void {
    if (!this.enCurso?.id) {
      localStorage.removeItem(VIAJE_ESTADO_KEY);
      return;
    }
    const estado: ViajeEstadoLocal = {
      fase: this.faseViaje,
      kmCliente: this.kmCliente,
      kmVacioIda: this.kmVacioIda,
      kmVacioRegreso: this.kmVacioRegreso,
      modos: {
        vacioIda: this.modoVacioIda,
        vacioRegreso: this.modoVacioRegreso,
        caseta: this.modoRegreso,
      },
      casetas: this.casetasIda,
      esperaSeg: this.esperaSegundos,
      reservaId: this.reservaIdActiva,
      destinoCotiza: this.destinoCotiza || undefined,
      clienteCotiza: this.clienteCotiza || undefined,
      telefono: this.telefonoCotiza || undefined,
      formaPago: this.formaPagoCorte,
      cobroFijo: this.cobroFijo ?? undefined,
    };
    localStorage.setItem(VIAJE_ESTADO_KEY, JSON.stringify(estado));
  }

  private restaurarViajeEstado(): void {
    if (!this.hayViaje) return;
    try {
      const raw = localStorage.getItem(VIAJE_ESTADO_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as ViajeEstadoLocal;
      this.faseViaje = s.fase || this.faseViaje;
      if (s.kmCliente != null) this.kmCliente = s.kmCliente;
      this.kmVacioIda = s.kmVacioIda ?? this.kmVacioIda;
      this.kmVacioRegreso = s.kmVacioRegreso ?? this.kmVacioRegreso;
      if (s.modos) {
        this.modoVacioIda = s.modos.vacioIda ?? this.modoVacioIda;
        this.modoVacioRegreso = s.modos.vacioRegreso ?? this.modoVacioRegreso;
        this.modoRegreso = s.modos.caseta ?? this.modoRegreso;
      }
      this.casetasIda = s.casetas ?? this.casetasIda;
      if (s.esperaSeg > 0) this.esperaAcumuladaSeg = s.esperaSeg;
      if (s.reservaId) this.reservaIdActiva = s.reservaId;
      if (s.destinoCotiza) this.destinoCotiza = s.destinoCotiza;
      if (s.clienteCotiza) this.clienteCotiza = s.clienteCotiza;
      if (s.telefono) this.telefonoCotiza = s.telefono;
      if (s.formaPago) this.formaPagoCorte = s.formaPago;
      if (s.cobroFijo != null) this.cobroFijo = s.cobroFijo;
      this.recalcularVivo();
    } catch {
      /* ignore */
    }
  }

  private limpiarEstadoLocal(): void {
    localStorage.removeItem(VIAJE_ESTADO_KEY);
    sessionStorage.removeItem(DESDE_RESERVA_KEY);
  }

  private cargarHistorial(): void {
    this.subs.add(
      this.api.historialClientes().subscribe({
        next: (l) => (this.clientesHist = l || []),
        error: () => {},
      }),
    );
    this.subs.add(
      this.api.historialDestinos().subscribe({
        next: (l) => (this.destinosHist = l || []),
        error: () => {},
      }),
    );
  }

  marcarCasaAqui(): void {
    this.error = '';
    this.okMsg = '';
    void this.leerUbicacion().then((pos) => {
      if (!pos.gps) {
        this.error = 'Activa el GPS para marcar tu casa.';
        return;
      }
      const casa: CasaGps = { lat: pos.lat, lng: pos.lng };
      localStorage.setItem(CASA_KEY, JSON.stringify(casa));
      this.casaLista = true;
      this.okMsg = 'Casa guardada. Al cortar se calcula el vacío de regreso.';
      if (this.lastLat != null && this.lastLng != null) {
        void this.estimarKmVacioRegreso(this.lastLat, this.lastLng).then((km) => {
          this.kmVacioRegreso = km;
          this.recalcularVivo();
          if (this.hayViaje) this.persistirViajeEstado();
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.limpiarTick();
    this.detenerGps();
  }

  onKmChange(): void {
    this.recalcularVivo();
    if (this.hayViaje) this.persistirViajeEstado();
  }

  setProporcion(campo: 'vacioIda' | 'vacioRegreso' | 'caseta', modo: Proporcion): void {
    if (campo === 'vacioIda') this.modoVacioIda = modo;
    else if (campo === 'vacioRegreso') this.modoVacioRegreso = modo;
    else this.modoRegreso = modo;
    this.recalcularVivo();
    if (this.hayViaje) this.persistirViajeEstado();
  }

  setHorario(modo: ModoHorario): void {
    this.modoHorario = modo;
    if (modo === 'dia' || modo === 'noche') {
      this.cuandoLocal = this.defaultLocalDatetime(modo === 'noche');
    }
    this.recalcularVivo();
  }

  compartirEstimado(): void {
    if (!this.tarifa || this.kmCliente == null || this.kmCliente < 0) {
      this.error = 'Pon al menos los km con el cliente para cotizar.';
      return;
    }
    this.error = '';
    this.okMsg = '';
    const nota = (this.destinoCotiza || this.paraCuando || '').trim();
    void compartirWhatsappTarjeta({
      tipo: 'estimado',
      totalTxt: this.cotizacionTxt,
      nota: nota || undefined,
      slogan: sloganAleatorio(),
    })
      .then((r) => {
        if (r.pegarCaption) {
          this.okMsg =
            'Foto lista. En WhatsApp toca «Añadir mensaje» y pega (el texto ya está copiado).';
        }
      })
      .catch(() => {
        this.error = 'No se pudo armar el mensaje.';
      });
  }

  irAReservar(): void {
    if (!this.tarifa || this.kmCliente == null || this.kmCliente < 0) {
      this.error = 'Pon los km para armar la reserva con el estimado.';
      return;
    }
    this.error = '';
    this.okMsg = '';
    const r = calcularCobroPorKm(
      this.tarifa,
      this.kmCobrables,
      this.minEsperaCobro,
      Date.now(),
      this.forzarNocheCotiza,
    );
    const cobro = this.totalPago(r.cobro);
    const destino =
      (this.destinoCotiza || '').trim() || this.desgloseKm || null;
    const cliente = (this.clienteCotiza || '').trim() || 'Cliente';

    // Día / noche → queda como pendiente; confirmar después en Agenda
    if (this.modoHorario === 'dia' || this.modoHorario === 'noche') {
      if (!this.cuandoLocal) {
        this.error = 'Pon fecha y hora para la cotización.';
        return;
      }
      if (this.accionando) return;
      this.accionando = true;
      this.api
        .crearReserva({
          cuando: new Date(this.cuandoLocal).toISOString(),
          cliente,
          destinoTexto: destino,
          kmEstimado: this.kmCobrables,
          cobroEstimado: cobro,
          casetas: this.casetasTotal,
          nocturno: this.cotizaEsNoche,
          notas: this.paraCuando || this.horarioCotizaTxt,
          estado: 'PENDIENTE',
        })
        .subscribe({
          next: (res) => {
            this.accionando = false;
            if (res.conflicto && res.propuestas?.length) {
              const alt = res.propuestas
                .slice(0, 3)
                .map((p) => this.fmtCorto(p))
                .join(' · ');
              this.okMsg = `Pendiente, pero esa hora está ocupada. Propón: ${alt}`;
            } else {
              this.okMsg = 'Cotización guardada como pendiente.';
            }
            void this.router.navigate(['/agenda'], { queryParams: { pendientes: '1' } });
          },
          error: (e) => {
            this.accionando = false;
            this.error = e?.error?.error || 'No se pudo guardar la pendiente.';
          },
        });
      return;
    }

    const borrador: ReservaBorrador = {
      destinoTexto: destino || undefined,
      kmEstimado: this.kmCobrables,
      cobroEstimado: cobro,
      casetas: this.casetasTotal,
      nocturno: this.cotizaEsNoche,
      paraCuando: this.paraCuando || this.horarioCotizaTxt,
      notas: this.paraCuando || '',
      cuandoLocal: this.cuandoLocal || undefined,
      cliente: this.clienteCotiza || undefined,
    };
    sessionStorage.setItem(RESERVA_BORRADOR_KEY, JSON.stringify(borrador));
    void this.router.navigate(['/agenda'], { queryParams: { nueva: '1' } });
  }

  private fmtCorto(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        weekday: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  private defaultLocalDatetime(noche: boolean): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setDate(d.getDate() + 1);
    const desde = this.tarifa?.nocheDesdeHora ?? 22;
    const hasta = this.tarifa?.nocheHastaHora ?? 6;
    // Día: media mañana; noche: inicio de franja nocturna
    d.setHours(noche ? desde : Math.min(10, (hasta + 4) % 24 || 10), 0, 0, 0);
    const clamped = clampHoraFranja(d, noche ? 'noche' : 'dia', desde, hasta);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${clamped.getFullYear()}-${pad(clamped.getMonth() + 1)}-${pad(clamped.getDate())}T${pad(clamped.getHours())}:${pad(clamped.getMinutes())}`;
  }

  toggleEspera(motivo: MotivoEspera): void {
    if (!this.hayViaje) return;
    if (this.esperaMotivo === motivo) {
      this.pausarEspera();
      return;
    }
    if (this.esperaMotivo) this.pausarEspera();
    this.esperaMotivo = motivo;
    this.esperaInicioMs = Date.now();
    this.error = '';
    this.recalcularVivo();
    if (this.hayViaje) this.persistirViajeEstado();
  }

  pausarEspera(): void {
    if (!this.esperaMotivo) return;
    this.esperaAcumuladaSeg = this.esperaSegundos;
    this.esperaMotivo = null;
    this.esperaInicioMs = 0;
    this.recalcularVivo();
    if (this.hayViaje) this.persistirViajeEstado();
  }
  /** @param clienteAqui true = sube donde estás (sin vacío ida). false = sales de base por él. */
  banderazo(clienteAqui = false): void {
    if (this.accionando) return;
    this.accionando = true;
    this.feedback.tap();
    this.feedback.start(clienteAqui ? 'Arrancando GPS…' : 'Saliendo por el cliente…');
    this.error = '';
    this.okMsg = '';
    this.gpsFallo = false;
    this.recibo = null;
    this.ultimoDesglose = '';
    this.esperaAcumuladaSeg = Math.round(Math.max(0, Number(this.minEsperaCotiza) || 0) * 60);
    this.esperaMotivo = null;
    this.esperaInicioMs = 0;
    this.metrosGps = 0;
    this.lastLat = null;
    this.lastLng = null;
    this.kmCliente = 0;
    this.kmVacioIda = 0;
    this.kmVacioRegreso = 0;
    this.faseViaje = clienteAqui ? 'con_cliente' : 'vacio';

    this.api.enCurso().subscribe({
      next: (v) => {
        const hayOtro = !!(v && v.id && v.estado === 'EN_CURSO');
        if (hayOtro && !confirm('Ya hay un viaje en curso. ¿Forzar nuevo banderazo?')) {
          this.accionando = false;
          this.feedback.stop();
          return;
        }
        void this.ejecutarInicio(clienteAqui, hayOtro);
      },
      error: () => void this.ejecutarInicio(clienteAqui, false),
    });
  }

  private ejecutarInicio(clienteAqui: boolean, forzar: boolean): void {
    void this.leerUbicacion()
      .then((pos) => {
        const body: Record<string, unknown> = {
          origenLat: pos.lat,
          origenLng: pos.lng,
          origenTexto: pos.gps ? 'GPS' : 'Viaja en el Rojo',
        };
        if (forzar) body['forzar'] = true;
        if (this.reservaIdActiva) body['reservaId'] = this.reservaIdActiva;
        this.api.iniciar(body).subscribe({
          next: (v) => {
            this.accionando = false;
            this.feedback.stop();
            this.feedback.ok();
            this.enCurso = v;
            this.inicioMs = Date.now();
            this.segundos = 0;
            this.lastLat = pos.lat;
            this.lastLng = pos.lng;
            this.recalcularVivo();
            this.iniciarTick();
            this.persistirViajeEstado();
            if (pos.gps) {
              this.gpsFallo = false;
              this.iniciarGps();
              this.okMsg = clienteAqui
                ? 'Cliente a bordo. GPS contando. Corte cuando diga “aquí”.'
                : 'Vas por el cliente. Cuando lo subas toca “Recogí cliente”.';
            } else {
              this.marcarGpsFallo('Sin GPS. Pon los km a mano o activa la ubicación.');
            }
          },
          error: (e) => {
            this.accionando = false;
            this.feedback.stop();
            this.feedback.error();
            this.error = e?.error?.error || 'No se pudo dar banderazo.';
          },
        });
      })
      .catch(() => {
        this.accionando = false;
        this.feedback.stop();
        this.feedback.error();
        this.error = 'Activa la ubicación del teléfono para el taxímetro.';
      });
  }

  /** Marca que el cliente ya subió: cierra vacío ida y empieza km con él. */
  recogiCliente(): void {
    if (!this.hayViaje || this.faseViaje === 'con_cliente') return;
    this.feedback.tap();
    this.feedback.ok();
    this.pausarEspera();
    if (!this.gpsFallo) {
      this.kmVacioIda = Math.round((this.metrosGps / 1000) * 100) / 100;
    }
    this.metrosGps = 0;
    this.kmCliente = 0;
    this.lastLat = null;
    this.lastLng = null;
    this.faseViaje = 'con_cliente';
    this.error = '';
    this.okMsg =
      this.kmVacioIda > 0
        ? `Vacío ida ${this.kmVacioIda.toFixed(1)} km. Ahora cobra con el cliente.`
        : 'Cliente a bordo. El GPS cuenta el viaje.';
    // Si el GPS sigue vivo, sigue midiendo; si ya había fallado, sigue manual
    if (!this.gpsFallo && !this.gpsActivo) {
      this.iniciarGps();
    }
    this.recalcularVivo();
    this.persistirViajeEstado();
  }

  corte(): void {
    if (!this.enCurso || this.accionando) return;
    if (this.faseViaje === 'vacio') {
      this.error = 'Primero marca “Recogí cliente” (o cancela si no lo encontraste).';
      return;
    }
    if (this.kmCliente == null || this.kmCliente < 0) {
      this.error = 'Aún no hay km. Espera al GPS o ponlos a mano.';
      return;
    }
    this.feedback.tap();
    this.feedback.start('Cortando viaje…');
    this.pausarEspera();
    this.enviarPuntosPendientes();
    this.detenerGps();
    this.accionando = true;
    this.error = '';
    this.okMsg = '';

    const viajeId = this.enCurso.id;
    const reservaBackup = this.reservaIdActiva;
    const fp = this.formaPagoCorte;

    void this.leerUbicacion().then(async (pos) => {
      if (pos.gps) {
        this.lastLat = pos.lat;
        this.lastLng = pos.lng;
      }
      const lat = pos.gps ? pos.lat : this.lastLat;
      const lng = pos.gps ? pos.lng : this.lastLng;
      if (lat != null && lng != null) {
        this.kmVacioRegreso = await this.estimarKmVacioRegreso(lat, lng);
      }
      this.ultimoDesglose = this.armarDesgloseTexto();
      const minEspera = Math.round((this.esperaSegundos / 60) * 100) / 100;
      const km = this.kmCobrables;
      const casetas = this.casetasTotal;

      if (!navigator.onLine) {
        this.offline.enqueueCorte(viajeId, [], km, minEspera, casetas, fp);
        this.accionando = false;
        this.feedback.stop();
        this.okMsg = 'Sin red: corte en cola. Se enviará al volver en línea.';
        this.finalizarCorteLocal(reservaBackup);
        return;
      }

      this.api.corte(viajeId, [], km, minEspera, casetas, fp).subscribe({
        next: (v) => {
          this.accionando = false;
          this.feedback.stop();
          this.feedback.ok();
          this.recibo = v;
          this.billetePago = null;
          this.cobroVivo = Number(v.cobro);
          this.segundos = v.duracionSegundos;
          this.finalizarCorteLocal(reservaBackup);
        },
        error: (e) => {
          this.accionando = false;
          this.feedback.stop();
          this.feedback.error();
          if (!navigator.onLine) {
            this.offline.enqueueCorte(viajeId, [], km, minEspera, casetas, fp);
            this.okMsg = 'Sin red: corte en cola.';
            this.finalizarCorteLocal(reservaBackup);
            return;
          }
          this.error = e?.error?.error || 'No se pudo cortar el viaje.';
        },
      });
    });
  }

  private finalizarCorteLocal(reservaId?: number): void {
    this.enCurso = null;
    this.faseViaje = 'vacio';
    this.gpsFallo = false;
    this.reservaIdActiva = undefined;
    this.limpiarEstadoLocal();
    this.limpiarTick();
    if (reservaId) {
      this.api.reservaHecha(reservaId).subscribe({ error: () => {} });
    }
  }

  private async estimarKmVacioRegreso(lat: number, lng: number): Promise<number> {
    const casa = this.coordsCasa();
    try {
      const e = await firstValueFrom(
        this.api.estimar({
          origenLat: lat,
          origenLng: lng,
          destinoLat: casa.lat,
          destinoLng: casa.lng,
          destinoTexto: 'Casa',
        }),
      );
      return Math.round((e.distanciaMetros / 1000) * 10) / 10;
    } catch {
      return this.kmHastaCasa(lat, lng);
    }
  }

  cancelar(): void {
    if (!this.enCurso || this.accionando) return;
    this.feedback.tap();
    this.feedback.start('Cancelando…');
    this.pausarEspera();
    this.detenerGps();
    this.accionando = true;
    this.api.cancelar(this.enCurso.id).subscribe({
      next: () => {
        this.accionando = false;
        this.feedback.stop();
        this.feedback.tap();
        this.enCurso = null;
        this.cobroVivo = 0;
        this.segundos = 0;
        this.esperaAcumuladaSeg = 0;
        this.metrosGps = 0;
        this.faseViaje = 'vacio';
        this.gpsFallo = false;
        this.okMsg = '';
        this.limpiarEstadoLocal();
        this.limpiarTick();
      },
      error: (e) => {
        this.accionando = false;
        this.feedback.stop();
        this.feedback.error();
        this.error = e?.error?.error || 'No se pudo cancelar.';
      },
    });
  }

  cerrarRecibo(): void {
    this.recibo = null;
    this.billetePago = null;
  }

  compartirWhatsapp(): void {
    if (!this.recibo) return;
    this.error = '';
    this.okMsg = '';
    void compartirWhatsappTarjeta({
      tipo: 'recibo',
      totalTxt: dinero(Number(this.recibo.cobro)),
      duracionTxt: duracionLegible(this.recibo.duracionSegundos || 0),
    })
      .then((r) => {
        if (r.pegarCaption) {
          this.okMsg =
            'Foto lista. En WhatsApp toca «Añadir mensaje» y pega (el texto ya está copiado).';
        }
      })
      .catch(() => {
        this.error = 'No se pudo armar el recibo.';
      });
  }

  tiempoTxt(): string {
    return mmss(this.segundos);
  }

  esperaTxt(): string {
    return mmss(this.esperaSegundos);
  }

  private pctDe(modo: Proporcion): number {
    if (modo === 'mitad') return 50;
    if (modo === 'completo') return 100;
    return 0;
  }

  private armarDesgloseTexto(): string {
    return this.desgloseKm || `${this.kmCobrables} km`;
  }

  private reanudar(v: Viaje): void {
    this.enCurso = v;
    this.inicioMs = Date.parse(v.inicio);
    this.segundos = Math.max(0, Math.floor((Date.now() - this.inicioMs) / 1000));
    // Al reabrir, asumimos ya con cliente si había distancia
    if (v.distanciaMetros != null && Number(v.distanciaMetros) > 0) {
      this.faseViaje = 'con_cliente';
      this.kmCliente = Number(v.distanciaMetros) / 1000;
      this.metrosGps = Number(v.distanciaMetros);
    } else {
      this.faseViaje = 'vacio';
      this.kmCliente = 0;
      this.metrosGps = 0;
    }
    this.esperaAcumuladaSeg = v.segundosEspera || 0;
    this.recalcularVivo();
    this.iniciarTick();
    this.iniciarGps();
    this.persistirViajeEstado();
  }

  private recalcularVivo(): void {
    if (!this.tarifa) {
      this.cobroVivo = 0;
      return;
    }
    if (!this.hayViaje && this.cobroFijo != null) {
      this.cobroVivo = this.totalPago(this.cobroFijo);
      return;
    }
    if (!this.hayViaje && (this.kmCliente == null || this.kmCliente < 0)) {
      this.cobroVivo = this.totalPago(0);
      return;
    }
    const km = this.kmCliente == null || this.kmCliente < 0 ? 0 : this.kmCobrables;
    const forzar = this.hayViaje ? null : this.forzarNocheCotiza;
    const r = calcularCobroPorKm(
      this.tarifa,
      km,
      this.minEsperaCobro,
      this.inicioMs || Date.now(),
      forzar,
    );
    this.cobroVivo = this.totalPago(r.cobro);
  }

  /** Total a cobrar: km + casetas, redondeado arriba a $5. */
  private totalPago(cobroBase: number): number {
    const cerrado = this.tarifa?.redondearPesos !== false;
    return redondearPago(cobroBase + this.casetasTotal, cerrado);
  }

  private iniciarTick(): void {
    this.limpiarTick();
    this.tick = window.setInterval(() => {
      this.segundos = Math.max(0, Math.floor((Date.now() - this.inicioMs) / 1000));
      this.recalcularVivo();
    }, 1000);
  }

  private limpiarTick(): void {
    if (this.tick) {
      window.clearInterval(this.tick);
      this.tick = undefined;
    }
  }

  private leerUbicacion(): Promise<{ lat: number; lng: number; gps: boolean }> {
    if (!navigator.geolocation) {
      return Promise.resolve({ lat: HUAMANTLA.lat, lng: HUAMANTLA.lng, gps: false });
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, gps: true }),
        () => resolve({ lat: HUAMANTLA.lat, lng: HUAMANTLA.lng, gps: false }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
      );
    });
  }

  /** Km estimados por calle hasta casa (~línea recta × 1.3). */
  private kmHastaCasa(lat: number, lng: number): number {
    const casa = this.coordsCasa();
    const metros = haversineMetros(lat, lng, casa.lat, casa.lng);
    return Math.round((metros / 1000) * 1.3 * 10) / 10;
  }

  private coordsCasa(): CasaGps {
    return this.leerCasaRaw() || { lat: HUAMANTLA.lat, lng: HUAMANTLA.lng };
  }

  private leerCasaRaw(): CasaGps | null {
    try {
      const raw = localStorage.getItem(CASA_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as CasaGps;
      if (typeof c.lat === 'number' && typeof c.lng === 'number') return c;
    } catch {
      /* ignore */
    }
    return null;
  }

  private iniciarGps(): void {
    this.detenerGps();
    this.gpsFallo = false;
    if (!navigator.geolocation) {
      this.marcarGpsFallo('Este teléfono no tiene GPS. Pon los km a mano.');
      return;
    }
    this.gpsActivo = true;
    // Si en 18s no hay señal útil, desbloquea captura manual
    this.gpsSinSenalTimer = window.setTimeout(() => {
      if (!this.hayViaje || this.gpsFallo) return;
      if (this.metrosGps < 8) {
        this.marcarGpsFallo('El GPS no responde. Ya puedes poner los km a mano.');
      }
    }, 18000);

    this.gpsWatchId = navigator.geolocation.watchPosition(
      (p) => {
        if (this.gpsSinSenalTimer != null) {
          window.clearTimeout(this.gpsSinSenalTimer);
          this.gpsSinSenalTimer = undefined;
        }
        // Una vez en modo manual por fallo, no volver a bloquear en este viaje
        if (!this.gpsFallo) {
          this.gpsActivo = true;
        }
        this.onGps(p);
      },
      (err) => {
        this.marcarGpsFallo(this.msgErrorGps(err));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    this.flushTimer = window.setInterval(() => this.enviarPuntosPendientes(), 12000);
  }

  private marcarGpsFallo(msg: string): void {
    this.gpsActivo = false;
    this.gpsFallo = true;
    this.error = msg;
    if (this.gpsSinSenalTimer != null) {
      window.clearTimeout(this.gpsSinSenalTimer);
      this.gpsSinSenalTimer = undefined;
    }
  }

  private msgErrorGps(err: GeolocationPositionError): string {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return 'Permiso de ubicación denegado. Pon los km a mano.';
      case err.POSITION_UNAVAILABLE:
        return 'GPS sin señal. Pon los km a mano.';
      case err.TIMEOUT:
        return 'GPS tardó demasiado. Pon los km a mano.';
      default:
        return 'GPS falló. Pon los km a mano.';
    }
  }

  private detenerGps(): void {
    if (this.gpsWatchId != null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = undefined;
    }
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.gpsSinSenalTimer != null) {
      window.clearTimeout(this.gpsSinSenalTimer);
      this.gpsSinSenalTimer = undefined;
    }
    this.gpsActivo = false;
  }

  private onGps(p: GeolocationPosition): void {
    if (!this.hayViaje || this.gpsFallo) return;
    const acc = p.coords.accuracy ?? 99;
    if (acc > 45) return;
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const t = new Date(p.timestamp || Date.now()).toISOString();

    if (this.lastLat != null && this.lastLng != null) {
      const d = haversineMetros(this.lastLat, this.lastLng, lat, lng);
      if (d >= 8 && d < 180) {
        this.metrosGps += d;
        const km = Math.round((this.metrosGps / 1000) * 100) / 100;
        if (this.faseViaje === 'vacio') {
          this.kmVacioIda = km;
        } else {
          this.kmCliente = km;
        }
        this.recalcularVivo();
      } else if (d < 8) {
        return;
      }
      // d >= 180: glitch, solo actualiza ancla
    }

    this.lastLat = lat;
    this.lastLng = lng;
    this.puntosPendientes.push({ lat, lng, t });
    if (this.puntosPendientes.length >= 8) {
      this.enviarPuntosPendientes();
    }
  }

  private enviarPuntosPendientes(): void {
    if (!this.enCurso?.id || !this.puntosPendientes.length) return;
    const lote = this.puntosPendientes.splice(0, this.puntosPendientes.length);
    this.api.puntos(this.enCurso.id, lote).subscribe({ error: () => {} });
  }
}
