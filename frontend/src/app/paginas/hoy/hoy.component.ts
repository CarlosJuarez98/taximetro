import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { OfflineQueueService } from '../../offline-queue.service';
import { ResumenHoy, Viaje } from '../../modelos';
import { dinero, mmss } from '../../cobro.util';

interface Denominacion {
  valor: number;
  etiqueta: string;
  cantidad: number;
}

@Component({
  selector: 'app-hoy',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './hoy.component.html',
  styleUrl: './hoy.component.css',
})
export class HoyComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflineQueueService);
  resumen: ResumenHoy | null = null;
  viajes: Viaje[] = [];
  error = '';
  ok = '';
  fondoEdit = 0;
  gastosGasEdit = 0;
  gastosOtrosEdit = 0;
  guardando = false;

  billetes: Denominacion[] = [
    { valor: 1000, etiqueta: '1000', cantidad: 0 },
    { valor: 500, etiqueta: '500', cantidad: 0 },
    { valor: 200, etiqueta: '200', cantidad: 0 },
    { valor: 100, etiqueta: '100', cantidad: 0 },
    { valor: 50, etiqueta: '50', cantidad: 0 },
    { valor: 20, etiqueta: '20', cantidad: 0 },
    { valor: 10, etiqueta: '10', cantidad: 0 },
    { valor: 5, etiqueta: '5', cantidad: 0 },
    { valor: 2, etiqueta: '2', cantidad: 0 },
    { valor: 1, etiqueta: '1', cantidad: 0 },
    { valor: 0.5, etiqueta: '0.50', cantidad: 0 },
  ];

  ngOnInit(): void {
    this.cargar();
  }

  get conteoTotal(): number {
    return Math.round(
      this.billetes.reduce((s, b) => s + b.valor * (Math.max(0, Number(b.cantidad) || 0)), 0) * 100,
    ) / 100;
  }

  cargar(): void {
    this.api.hoy().subscribe({
      next: (r) => {
        this.resumen = r;
        this.fondoEdit = Number(r.fondoInicial || 0);
        this.gastosGasEdit = Number(r.gastosGasolina || 0);
        this.gastosOtrosEdit = Number(r.gastosOtros || 0);
      },
      error: () => (this.error = 'No se pudo cargar el resumen.'),
    });
    this.api.viajesHoy().subscribe({
      next: (v) => (this.viajes = v || []),
      error: () => (this.error = 'No se pudo cargar el historial.'),
    });
  }

  mas(b: Denominacion): void {
    b.cantidad = (Number(b.cantidad) || 0) + 1;
  }

  menos(b: Denominacion): void {
    b.cantidad = Math.max(0, (Number(b.cantidad) || 0) - 1);
  }

  onCantidadChange(b: Denominacion): void {
    const n = Math.floor(Number(b.cantidad) || 0);
    b.cantidad = Math.max(0, n);
  }

  limpiarBilletes(): void {
    for (const b of this.billetes) b.cantidad = 0;
  }

  guardarFondo(): void {
    if (this.guardando) return;
    this.guardando = true;
    this.error = '';
    this.ok = '';
    this.api.guardarFondo(Math.max(0, Number(this.fondoEdit) || 0)).subscribe({
      next: (r) => {
        this.guardando = false;
        this.resumen = r;
        this.fondoEdit = Number(r.fondoInicial || 0);
        this.ok = 'Fondo guardado.';
      },
      error: (e) => {
        this.guardando = false;
        this.error = e?.error?.error || 'No se pudo guardar el fondo.';
      },
    });
  }

  guardarGastos(): void {
    if (this.guardando) return;
    this.guardando = true;
    this.error = '';
    this.ok = '';
    const gas = Math.max(0, Number(this.gastosGasEdit) || 0);
    const otros = Math.max(0, Number(this.gastosOtrosEdit) || 0);
    this.api.guardarGastos(gas, otros).subscribe({
      next: (r) => {
        this.guardando = false;
        this.resumen = r;
        this.gastosGasEdit = Number(r.gastosGasolina || 0);
        this.gastosOtrosEdit = Number(r.gastosOtros || 0);
        this.ok = 'Gastos guardados.';
      },
      error: (e) => {
        this.guardando = false;
        this.error = e?.error?.error || 'No se pudieron guardar los gastos.';
      },
    });
  }

  hacerCorteCaja(): void {
    if (this.guardando) return;
    const total = this.conteoTotal;
    if (total < 0) {
      this.error = 'Cuenta los billetes y monedas.';
      return;
    }
    this.guardando = true;
    this.error = '';
    this.ok = '';
    if (!navigator.onLine) {
      this.offline.enqueueCorteCaja(total);
      this.guardando = false;
      this.ok = 'Sin red: corte en cola. Se enviará al volver en línea.';
      return;
    }
    this.api.corteCaja(total).subscribe({
      next: (r) => {
        this.guardando = false;
        this.resumen = r;
        const dif = Number(r.diferencia || 0);
        if (dif === 0) this.ok = 'Corte cuadrado.';
        else if (dif > 0) this.ok = `Corte: sobran ${dinero(dif, false)}.`;
        else this.ok = `Corte: faltan ${dinero(Math.abs(dif), false)}.`;
      },
      error: (e) => {
        this.guardando = false;
        if (!navigator.onLine) {
          this.offline.enqueueCorteCaja(total);
          this.ok = 'Sin red: corte en cola.';
          return;
        }
        this.error = e?.error?.error || 'No se pudo hacer el corte.';
      },
    });
  }

  eliminar(v: Viaje): void {
    if (!v.id || v.estado === 'EN_CURSO') return;
    if (!confirm('¿Borrar este viaje? Ya no contará en el total de hoy.')) return;
    this.api.eliminarViaje(v.id).subscribe({
      next: () => {
        this.ok = 'Viaje borrado.';
        this.cargar();
      },
      error: (e) => {
        this.error = e?.error?.error || 'No se pudo borrar.';
      },
    });
  }

  cobro(v: Viaje): string {
    return dinero(Number(v.cobro || 0), true);
  }

  km(v: Viaje): string {
    return (Number(v.distanciaMetros || 0) / 1000).toFixed(2);
  }

  dur(v: Viaje): string {
    return mmss(v.duracionSegundos || 0);
  }

  cuando(v: Viaje): string {
    return new Date(v.inicio).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  }

  estado(v: Viaje): string {
    if (v.estado === 'CERRADO') return 'Cerrado';
    if (v.estado === 'EN_CURSO') return 'En curso';
    return 'Cancelado';
  }

  totalHoy(): string {
    return dinero(Number(this.resumen?.cobrado || 0), true);
  }

  fondoTxt(): string {
    return dinero(Number(this.resumen?.fondoInicial || 0), false);
  }

  esperadoTxt(): string {
    return dinero(Number(this.resumen?.esperadoEnCaja || 0), false);
  }

  conteoTxt(): string {
    return dinero(this.conteoTotal, false);
  }

  netoTxt(): string {
    return dinero(Number(this.resumen?.neto || 0), true);
  }

  efectivoTxt(): string {
    return dinero(Number(this.resumen?.cobradoEfectivo ?? this.resumen?.cobrado ?? 0), true);
  }

  transferTxt(): string {
    return dinero(Number(this.resumen?.cobradoTransfer || 0), true);
  }

  diferenciaTxt(): string {
    const d = Number(this.resumen?.diferencia || 0);
    if (d === 0) return 'Cuadra';
    if (d > 0) return `+${dinero(d, false)} sobra`;
    return `${dinero(Math.abs(d), false)} falta`;
  }
}
