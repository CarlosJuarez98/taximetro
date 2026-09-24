import {
  ApplicationRef,
  Component,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  NgZone,
  OnDestroy,
  TemplateRef,
  ViewChild,
  effect,
  forwardRef,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { clampHoraFranja, horasDeFranja } from '../cobro.util';
import {
  ajustarVistaAMesPermitido,
  desplazarMes,
  mesTieneDiaPermitido,
} from '../calendario-limites.util';

export type FranjaHoras = 'todas' | 'dia' | 'noche';

type Celda = {
  iso: string;
  dia: number;
  fueraMes: boolean;
  disabled: boolean;
};

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'] as const;
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Calendario mensual (estilo productos-limpieza) + selector de hora. Valor: yyyy-MM-ddTHH:mm */
@Component({
  selector: 'app-fecha-hora-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fecha-hora-picker.component.html',
  styleUrl: './fecha-hora-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FechaHoraPickerComponent),
      multi: true,
    },
  ],
})
export class FechaHoraPickerComponent implements ControlValueAccessor, OnDestroy {
  @ViewChild('popTpl') popTpl!: TemplateRef<void>;

  readonly compact = input(false);
  readonly franja = input<FranjaHoras>('todas');
  readonly nocheDesde = input(22);
  readonly nocheHasta = input(6);
  readonly min = input<string | null>(null);
  readonly ariaLabel = input('Fecha y hora');

  readonly diasSemana = DIAS;
  readonly minutos = [0, 15, 30, 45];

  horas: number[] = Array.from({ length: 24 }, (_, i) => i);
  seleccionado = this.roundNow();
  abierto = false;
  disabled = false;
  vistaAnio = 0;
  vistaMes = 0;
  hoyIso = '';
  franjaHint = '';
  popStyle: Record<string, string> = {};

  private embedded?: EmbeddedViewRef<void>;
  private escuchandoScroll = false;
  private writing = false;
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly onScrollCapture = (): void => {
    if (this.abierto) this.ngZone.run(() => this.cerrar());
  };

  constructor(
    private host: ElementRef<HTMLElement>,
    private appRef: ApplicationRef,
    private ngZone: NgZone
  ) {
    this.hoyIso = this.isoDe(new Date());
    this.vistaAnio = this.seleccionado.getFullYear();
    this.vistaMes = this.seleccionado.getMonth();

    effect(() => {
      const f = this.franja();
      const desde = this.nocheDesde();
      const hasta = this.nocheHasta();
      this.horas = horasDeFranja(f, desde, hasta);
      this.franjaHint =
        f === 'dia' ? 'Solo horario de día' : f === 'noche' ? 'Solo horario de noche' : '';
      const clamped = clampHoraFranja(this.seleccionado, f, desde, hasta);
      if (clamped.getTime() !== this.seleccionado.getTime()) {
        this.seleccionado = clamped;
        if (!this.writing) this.emit();
      }
    });
  }

  ngOnDestroy(): void {
    this.cerrar();
  }

  writeValue(value: string | null): void {
    this.writing = true;
    if (value) {
      const d = this.parseLocal(value);
      if (!Number.isNaN(d.getTime())) {
        this.snapMinutos(d);
        this.seleccionado = clampHoraFranja(d, this.franja(), this.nocheDesde(), this.nocheHasta());
        this.vistaAnio = this.seleccionado.getFullYear();
        this.vistaMes = this.seleccionado.getMonth();
      }
    }
    this.writing = false;
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  get textoFecha(): string {
    return this.seleccionado.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  get textoHora(): string {
    return `${this.pad(this.seleccionado.getHours())}:${this.pad(this.seleccionado.getMinutes())}`;
  }

  get tituloMes(): string {
    return `${MESES[this.vistaMes]} ${this.vistaAnio}`;
  }

  get puedeMesAnterior(): boolean {
    const p = desplazarMes(this.vistaAnio, this.vistaMes, -1);
    return mesTieneDiaPermitido(p.anio, p.mes, (iso) => this.fechaBloqueada(iso));
  }

  get puedeMesSiguiente(): boolean {
    const p = desplazarMes(this.vistaAnio, this.vistaMes, 1);
    return mesTieneDiaPermitido(p.anio, p.mes, (iso) => this.fechaBloqueada(iso));
  }

  get celdas(): Celda[] {
    const first = new Date(this.vistaAnio, this.vistaMes, 1);
    const weekday = (first.getDay() + 6) % 7;
    const start = new Date(this.vistaAnio, this.vistaMes, 1 - weekday);
    const out: Celda[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = this.isoDe(d);
      out.push({
        iso,
        dia: d.getDate(),
        fueraMes: d.getMonth() !== this.vistaMes,
        disabled: this.fechaBloqueada(iso),
      });
    }
    return out;
  }

  get valorIso(): string {
    return this.isoDe(this.seleccionado);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.abierto) return;
    const t = ev.target as Node;
    if (this.host.nativeElement.contains(t)) return;
    if (this.embedded?.rootNodes.some((n) => n instanceof Node && n.contains(t))) return;
    this.cerrar();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.abierto) this.cerrar();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.abierto) this.reposicionar();
  }

  toggle(ev?: Event): void {
    ev?.stopPropagation();
    if (this.disabled) return;
    if (this.abierto) {
      this.cerrar();
      return;
    }
    this.abrir();
  }

  abrir(): void {
    this.vistaAnio = this.seleccionado.getFullYear();
    this.vistaMes = this.seleccionado.getMonth();
    const vista = ajustarVistaAMesPermitido(
      this.vistaAnio,
      this.vistaMes,
      (iso) => this.fechaBloqueada(iso),
      this.valorIso || this.hoyIso
    );
    this.vistaAnio = vista.anio;
    this.vistaMes = vista.mes;
    this.abierto = true;
    this.montarPop();
    this.ponerScrollListener();
    requestAnimationFrame(() => {
      this.reposicionar();
      this.embedded?.detectChanges();
    });
  }

  cerrar(): void {
    this.abierto = false;
    this.popStyle = {};
    this.desmontarPop();
    this.quitarScrollListener();
    this.onTouched();
  }

  mesAnterior(): void {
    if (!this.puedeMesAnterior) return;
    const p = desplazarMes(this.vistaAnio, this.vistaMes, -1);
    this.vistaAnio = p.anio;
    this.vistaMes = p.mes;
    this.embedded?.detectChanges();
  }

  mesSiguiente(): void {
    if (!this.puedeMesSiguiente) return;
    const p = desplazarMes(this.vistaAnio, this.vistaMes, 1);
    this.vistaAnio = p.anio;
    this.vistaMes = p.mes;
    this.embedded?.detectChanges();
  }

  elegir(c: Celda): void {
    if (c.disabled) return;
    const [y, m, d] = c.iso.split('-').map(Number);
    let next = new Date(y, m - 1, d, this.seleccionado.getHours(), this.seleccionado.getMinutes(), 0, 0);
    next = clampHoraFranja(next, this.franja(), this.nocheDesde(), this.nocheHasta());
    this.seleccionado = next;
    this.emit();
    this.cerrar();
  }

  setHora(h: number): void {
    if (this.disabled || !this.horas.includes(h)) return;
    const next = new Date(this.seleccionado);
    next.setHours(h);
    this.seleccionado = next;
    this.emit();
  }

  setMinuto(m: number): void {
    if (this.disabled) return;
    const next = new Date(this.seleccionado);
    next.setMinutes(m, 0, 0);
    this.seleccionado = next;
    this.emit();
  }

  onSelectHora(ev: Event): void {
    const v = Number((ev.target as HTMLSelectElement).value);
    this.setHora(v);
  }

  onSelectMinuto(ev: Event): void {
    const v = Number((ev.target as HTMLSelectElement).value);
    this.setMinuto(v);
  }

  private montarPop(): void {
    this.desmontarPop();
    if (!this.popTpl) return;
    this.embedded = this.popTpl.createEmbeddedView(undefined as void);
    this.appRef.attachView(this.embedded);
    for (const node of this.embedded.rootNodes) {
      if (node instanceof HTMLElement) document.body.appendChild(node);
    }
    this.embedded.detectChanges();
  }

  private desmontarPop(): void {
    if (!this.embedded) return;
    this.appRef.detachView(this.embedded);
    this.embedded.destroy();
    this.embedded = undefined;
  }

  private reposicionar(): void {
    const trigger = this.host.nativeElement.querySelector('.fecha-trigger') as HTMLElement | null;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(19.5 * 16, window.innerWidth - 24);
    let left = r.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    if (left < 12) left = 12;

    const popH = 22 * 16;
    let top = r.bottom + gap;
    if (top + Math.min(popH, 360) > window.innerHeight - 12) {
      const arriba = r.top - gap - Math.min(popH, 360);
      if (arriba >= 12) top = arriba;
      else top = Math.max(12, window.innerHeight - Math.min(popH, 360) - 12);
    }

    this.popStyle = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      zIndex: '10050',
    };
    this.embedded?.detectChanges();
  }

  private ponerScrollListener(): void {
    if (this.escuchandoScroll) return;
    document.addEventListener('scroll', this.onScrollCapture, true);
    this.escuchandoScroll = true;
  }

  private quitarScrollListener(): void {
    if (!this.escuchandoScroll) return;
    document.removeEventListener('scroll', this.onScrollCapture, true);
    this.escuchandoScroll = false;
  }

  private fechaBloqueada(iso: string): boolean {
    const min = this.min() || this.hoyIso;
    if (min && iso < min) return true;
    return false;
  }

  private emit(): void {
    this.onTouched();
    this.onChange(this.toLocal(this.seleccionado));
  }

  private snapMinutos(d: Date): void {
    const m = d.getMinutes();
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else {
      d.setMinutes(snapped, 0, 0);
    }
  }

  private roundNow(): Date {
    const d = new Date();
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    const next = Math.ceil(m / 15) * 15;
    if (next === 60) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else {
      d.setMinutes(next, 0, 0);
    }
    return d;
  }

  private parseLocal(v: string): Date {
    const [datePart, timePart = '00:00'] = v.split('T');
    const [yy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    return new Date(yy, (mm || 1) - 1, dd || 1, hh || 0, mi || 0, 0, 0);
  }

  private toLocal(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}T${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
  }

  private isoDe(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
