import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../api.service';
import { FechaHoraPickerComponent } from '../../fecha-hora-picker/fecha-hora-picker.component';
import { SugerenciaCampoComponent } from '../../sugerencia-campo.component';
import { RecordatorioService } from '../../recordatorio.service';
import { RESERVA_BORRADOR_KEY, Reserva, ReservaBorrador } from '../../modelos';
import { dinero } from '../../cobro.util';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [FormsModule, FechaHoraPickerComponent, SugerenciaCampoComponent],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.css',
})
export class AgendaComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly avisos = inject(RecordatorioService);

  reservas: Reserva[] = [];
  pendientes: Reserva[] = [];
  clientesHist: string[] = [];
  destinosHist: string[] = [];
  error = '';
  ok = '';
  guardando = false;
  conflicto = false;
  propuestasForm: string[] = [];
  mostrarForm = false;
  /** Propuestas al confirmar una pendiente ocupada. */
  propuestasPorId: Record<number, string[]> = {};

  form = {
    cuandoLocal: '',
    cliente: '',
    telefono: '',
    destinoTexto: '',
    kmEstimado: null as number | null,
    cobroEstimado: null as number | null,
    casetas: 0,
    nocturno: false,
    minutosOcupados: 60,
    notas: '',
    /** 1 = solo ese día; 7 = diario una semana. */
    repetirDias: 1,
  };

  ngOnInit(): void {
    this.cargar();
    this.cargarHistorial();
    this.route.queryParamMap.subscribe((q) => {
      if (q.get('nueva') === '1') {
        this.cargarBorrador();
        this.mostrarForm = true;
      }
      if (q.get('pendientes') === '1') {
        this.ok = 'Cotización en pendientes. Confirma cuando el cliente diga que sí.';
      }
    });
  }

  cargar(): void {
    this.api.reservasProximas().subscribe({
      next: (lista) => (this.reservas = lista || []),
      error: () => (this.error = 'No se pudo cargar la agenda.'),
    });
    this.api.reservasPendientes().subscribe({
      next: (lista) => {
        this.pendientes = lista || [];
        this.propuestasPorId = {};
        for (const r of this.pendientes) {
          if (r.id && r.conflicto && r.propuestas?.length) {
            this.propuestasPorId[r.id] = r.propuestas;
          }
        }
      },
      error: () => {},
    });
  }

  cargarHistorial(): void {
    this.api.historialClientes().subscribe({
      next: (l) => (this.clientesHist = l || []),
      error: () => {},
    });
    this.api.historialDestinos().subscribe({
      next: (l) => (this.destinosHist = l || []),
      error: () => {},
    });
  }

  nueva(): void {
    this.limpiarForm();
    if (!this.form.cuandoLocal) {
      this.form.cuandoLocal = this.defaultLocalDatetime();
    }
    this.mostrarForm = true;
    this.ok = '';
    this.error = '';
    this.conflicto = false;
    this.propuestasForm = [];
  }

  cancelarForm(): void {
    this.mostrarForm = false;
    this.limpiarForm();
    void this.router.navigate(['/agenda']);
  }

  onCuandoChange(): void {
    this.checarConflicto();
  }

  setRepetir(dias: number): void {
    this.form.repetirDias = dias;
  }

  async activarAvisos(): Promise<void> {
    const ok = await this.avisos.pedirPermiso();
    this.ok = ok
      ? `Avisos activos: ${this.avisos.minutosAntes} min antes del viaje.`
      : 'No se pudo activar. En el celular, instala la app (Agregar a inicio) y permite notificaciones.';
  }

  setAvisoMins(mins: number): void {
    this.avisos.minutosAntes = mins;
    this.ok = `Te avisaré ${mins} min antes.`;
  }

  guardar(): void {
    if (this.guardando) return;
    if (!this.form.cuandoLocal) {
      this.error = 'Pon fecha y hora.';
      return;
    }
    if (!(this.form.cliente || '').trim()) {
      this.error = 'Pon el nombre del cliente.';
      return;
    }
    this.guardando = true;
    this.error = '';
    this.ok = '';
    const cuando = new Date(this.form.cuandoLocal).toISOString();
    const dias = Math.max(1, Math.min(31, this.form.repetirDias || 1));
    const dto: Reserva = {
      cuando,
      cliente: this.form.cliente.trim(),
      telefono: this.form.telefono.trim() || null,
      destinoTexto: this.form.destinoTexto.trim() || null,
      kmEstimado: this.form.kmEstimado ?? 0,
      cobroEstimado: this.form.cobroEstimado ?? 0,
      casetas: this.form.casetas || 0,
      nocturno: this.form.nocturno,
      minutosOcupados: this.form.minutosOcupados || 60,
      notas: this.form.notas.trim() || null,
      estado: 'RESERVADA',
      repetirDias: dias,
    };
    this.api.crearReserva(dto).subscribe({
      next: (r) => {
        this.guardando = false;
        if (dias === 1 && r.conflicto && r.propuestas?.length) {
          this.conflicto = true;
          this.propuestasForm = r.propuestas;
          this.error = 'Esa hora está ocupada. Elige otra abajo o cámbiala.';
          return;
        }
        this.mostrarForm = false;
        this.limpiarForm();
        sessionStorage.removeItem(RESERVA_BORRADOR_KEY);
        this.ok =
          dias > 1
            ? `Serie de ${dias} días creada. Revisa agenda y pendientes si hubo empalmes.`
            : 'Viaje en agenda.';
        this.cargar();
        this.cargarHistorial();
        void this.router.navigate(['/agenda']);
      },
      error: (e) => {
        this.guardando = false;
        this.error = e?.error?.error || 'No se pudo reservar.';
      },
    });
  }

  usarPropuestaForm(iso: string): void {
    this.form.cuandoLocal = this.toLocalInput(iso);
    this.checarConflicto();
  }

  confirmar(r: Reserva, cuandoIso?: string): void {
    if (!r.id) return;
    this.error = '';
    this.ok = '';
    this.api.confirmarReserva(r.id, cuandoIso).subscribe({
      next: (res) => {
        if (res.conflicto && res.estado === 'PENDIENTE') {
          this.propuestasPorId[r.id!] = res.propuestas || [];
          this.error = 'Esa hora ya está ocupada. Propón otra al cliente:';
          this.ok = '';
          return;
        }
        this.ok = 'Confirmada · ya está en la agenda.';
        this.cargar();
      },
      error: (e) => {
        this.error = e?.error?.error || 'No se pudo confirmar.';
      },
    });
  }

  marcarHecha(r: Reserva): void {
    if (!r.id) return;
    this.api.reservaHecha(r.id).subscribe({
      next: () => this.cargar(),
      error: () => (this.error = 'No se pudo marcar.'),
    });
  }

  cancelarReserva(r: Reserva): void {
    if (!r.id) return;
    this.api.cancelarReserva(r.id).subscribe({
      next: () => this.cargar(),
      error: () => (this.error = 'No se pudo cancelar.'),
    });
  }

  textoPropuestaCliente(r: Reserva): string {
    const props = (r.id && this.propuestasPorId[r.id]) || r.propuestas || [];
    if (!props.length) return '';
    const horas = props.slice(0, 3).map((p) => this.cuandoTxtIso(p)).join(', ');
    return `Esa hora ya la tengo ocupada. ¿Te late alguna de estas? ${horas}`;
  }

  copiarPropuesta(r: Reserva): void {
    const t = this.textoPropuestaCliente(r);
    if (!t) return;
    void navigator.clipboard?.writeText(t).then(
      () => (this.ok = 'Mensaje copiado para el cliente.'),
      () => (this.ok = t),
    );
  }

  cobroTxt(r: Reserva): string {
    return dinero(Number(r.cobroEstimado || 0));
  }

  cuandoTxt(r: Reserva): string {
    return this.cuandoTxtIso(r.cuando);
  }

  cuandoTxtIso(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  private checarConflicto(): void {
    if (!this.form.cuandoLocal || this.form.repetirDias > 1) {
      this.conflicto = false;
      this.propuestasForm = [];
      return;
    }
    const cuando = new Date(this.form.cuandoLocal).toISOString();
    this.api.reservaConflicto(cuando, this.form.minutosOcupados || 60).subscribe({
      next: (r) => {
        this.conflicto = !!r.conflicto;
        this.propuestasForm = r.propuestas || [];
      },
      error: () => {
        this.conflicto = false;
        this.propuestasForm = [];
      },
    });
  }

  private cargarBorrador(): void {
    try {
      const raw = sessionStorage.getItem(RESERVA_BORRADOR_KEY);
      if (!raw) {
        this.form.cuandoLocal = this.defaultLocalDatetime();
        return;
      }
      const b = JSON.parse(raw) as ReservaBorrador;
      this.form.cuandoLocal = b.cuandoLocal || this.defaultLocalDatetime();
      this.form.cliente = b.cliente || '';
      this.form.telefono = b.telefono || '';
      this.form.destinoTexto = b.destinoTexto || '';
      this.form.kmEstimado = b.kmEstimado ?? null;
      this.form.cobroEstimado = b.cobroEstimado ?? null;
      this.form.casetas = b.casetas ?? 0;
      this.form.nocturno = !!b.nocturno;
      this.form.notas = b.notas || b.paraCuando || '';
      this.checarConflicto();
    } catch {
      this.form.cuandoLocal = this.defaultLocalDatetime();
    }
  }

  private limpiarForm(): void {
    this.form = {
      cuandoLocal: '',
      cliente: '',
      telefono: '',
      destinoTexto: '',
      kmEstimado: null,
      cobroEstimado: null,
      casetas: 0,
      nocturno: false,
      minutosOcupados: 60,
      notas: '',
      repetirDias: 1,
    };
    this.propuestasForm = [];
  }

  private defaultLocalDatetime(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return this.toLocalInput(d.toISOString());
  }

  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
