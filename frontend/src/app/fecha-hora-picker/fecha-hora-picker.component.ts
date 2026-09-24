import {
  AfterViewInit,
  Component,
  ElementRef,
  effect,
  forwardRef,
  input,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { clampHoraFranja, horasDeFranja } from '../cobro.util';

export type FranjaHoras = 'todas' | 'dia' | 'noche';

@Component({
  selector: 'app-fecha-hora-picker',
  standalone: true,
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
export class FechaHoraPickerComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('horasStrip') horasStrip?: ElementRef<HTMLElement>;

  readonly compact = input(false);
  readonly franja = input<FranjaHoras>('todas');
  readonly nocheDesde = input(22);
  readonly nocheHasta = input(6);

  horas: number[] = Array.from({ length: 24 }, (_, i) => i);
  readonly minutos = [0, 15, 30, 45];
  readonly semanaLbl = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  /** Lunes de la semana visible. */
  semanaInicio = this.lunesDe(new Date());
  seleccionado = this.roundNow();
  diasSemana: Date[] = [];
  weekKey = 0;
  weekDir: 'izq' | 'der' = 'der';
  disabled = false;
  popped = false;
  franjaHint = '';

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  private writing = false;

  constructor() {
    this.rebuildSemana();
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
        this.semanaInicio = this.lunesDe(clamped);
        this.rebuildSemana();
        if (!this.writing) this.emit();
      }
      queueMicrotask(() => this.scrollHoraActiva(false));
    });
  }

  ngAfterViewInit(): void {
    this.scrollHoraActiva(false);
  }

  writeValue(value: string | null): void {
    this.writing = true;
    if (value) {
      const d = this.parseLocal(value);
      if (!Number.isNaN(d.getTime())) {
        this.snapMinutos(d);
        this.seleccionado = clampHoraFranja(d, this.franja(), this.nocheDesde(), this.nocheHasta());
        this.semanaInicio = this.lunesDe(this.seleccionado);
      }
    }
    this.rebuildSemana();
    this.writing = false;
    queueMicrotask(() => this.scrollHoraActiva(false));
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

  get semanaTitulo(): string {
    const a = this.diasSemana[0];
    const b = this.diasSemana[6];
    if (!a || !b) return '';
    const mesA = a.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    const mesB = b.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    if (a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${mesA} ${a.getFullYear()}`;
    }
    return `${a.getDate()} ${mesA} – ${b.getDate()} ${mesB}`;
  }

  get displayDia(): string {
    return this.seleccionado.getDate().toString().padStart(2, '0');
  }

  get displaySemana(): string {
    return this.seleccionado.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
  }

  get displayMes(): string {
    return this.seleccionado.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  }

  get displayHora(): string {
    return `${this.pad(this.seleccionado.getHours())}:${this.pad(this.seleccionado.getMinutes())}`;
  }

  semanaAnterior(): void {
    if (this.disabled) return;
    this.weekDir = 'izq';
    const d = new Date(this.semanaInicio);
    d.setDate(d.getDate() - 7);
    this.semanaInicio = d;
    this.weekKey++;
    this.rebuildSemana();
  }

  semanaSiguiente(): void {
    if (this.disabled) return;
    this.weekDir = 'der';
    const d = new Date(this.semanaInicio);
    d.setDate(d.getDate() + 7);
    this.semanaInicio = d;
    this.weekKey++;
    this.rebuildSemana();
  }

  elegirDia(d: Date): void {
    if (this.disabled || this.esPasado(d)) return;
    let next = new Date(d);
    next.setHours(this.seleccionado.getHours(), this.seleccionado.getMinutes(), 0, 0);
    next = clampHoraFranja(next, this.franja(), this.nocheDesde(), this.nocheHasta());
    this.seleccionado = next;
    this.pop();
    this.emit();
  }

  setHora(h: number): void {
    if (this.disabled || !this.horas.includes(h)) return;
    const next = new Date(this.seleccionado);
    next.setHours(h);
    this.seleccionado = next;
    this.pop();
    this.emit();
    this.scrollHoraActiva(true);
  }

  setMinuto(m: number): void {
    if (this.disabled) return;
    const next = new Date(this.seleccionado);
    next.setMinutes(m, 0, 0);
    this.seleccionado = next;
    this.pop();
    this.emit();
  }

  rapido(dias: number): void {
    if (this.disabled) return;
    const base = this.roundNow();
    base.setDate(base.getDate() + dias);
    base.setHours(this.seleccionado.getHours(), this.seleccionado.getMinutes(), 0, 0);
    this.seleccionado = clampHoraFranja(base, this.franja(), this.nocheDesde(), this.nocheHasta());
    this.semanaInicio = this.lunesDe(this.seleccionado);
    this.weekKey++;
    this.pop();
    this.rebuildSemana();
    this.emit();
  }

  esHoy(d: Date): boolean {
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  esSel(d: Date): boolean {
    return (
      d.getFullYear() === this.seleccionado.getFullYear() &&
      d.getMonth() === this.seleccionado.getMonth() &&
      d.getDate() === this.seleccionado.getDate()
    );
  }

  esPasado(d: Date): boolean {
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x < n;
  }

  private rebuildSemana(): void {
    const start = this.lunesDe(this.semanaInicio);
    this.semanaInicio = start;
    this.diasSemana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  private lunesDe(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    return x;
  }

  private scrollHoraActiva(smooth: boolean): void {
    const strip = this.horasStrip?.nativeElement;
    if (!strip) return;
    const activo = strip.querySelector('.h-btn.activo') as HTMLElement | null;
    activo?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
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

  private emit(): void {
    this.onTouched();
    this.onChange(this.toLocal(this.seleccionado));
  }

  private pop(): void {
    this.popped = false;
    requestAnimationFrame(() => {
      this.popped = true;
      setTimeout(() => (this.popped = false), 280);
    });
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

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
