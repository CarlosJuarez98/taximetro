import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { Tarifa, TarifaFija } from '../../modelos';
import { dinero } from '../../cobro.util';

@Component({
  selector: 'app-tarifas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tarifas.component.html',
  styleUrl: './tarifas.component.css',
})
export class TarifasComponent implements OnInit {
  private readonly api = inject(ApiService);
  tarifa: Tarifa | null = null;
  fijas: TarifaFija[] = [];
  error = '';
  ok = '';
  guardando = false;

  fijaNueva: TarifaFija = { nombre: '', cobro: 0, km: undefined, notas: '', activo: true };
  editId: number | null = null;

  ngOnInit(): void {
    this.api.tarifa().subscribe({
      next: (t) => (this.tarifa = t),
      error: () => (this.error = 'No se pudo cargar la tarifa.'),
    });
    this.cargarFijas();
  }

  cargarFijas(): void {
    this.api.tarifasFijas().subscribe({
      next: (l) => (this.fijas = (l || []).filter((f) => f.activo !== false)),
      error: () => {},
    });
  }

  guardar(): void {
    if (!this.tarifa || this.guardando) return;
    this.guardando = true;
    this.error = '';
    this.ok = '';
    this.api.guardarTarifa(this.tarifa).subscribe({
      next: (t) => {
        this.tarifa = t;
        this.guardando = false;
        this.ok = 'Tarifa guardada.';
      },
      error: (e) => {
        this.guardando = false;
        this.error = e?.error?.error || 'No se pudo guardar.';
      },
    });
  }

  cobroTxt(n: number): string {
    return dinero(Number(n || 0));
  }

  editarFija(f: TarifaFija): void {
    this.editId = f.id ?? null;
    this.fijaNueva = {
      nombre: f.nombre,
      cobro: Number(f.cobro),
      km: f.km != null ? Number(f.km) : undefined,
      notas: f.notas || '',
      activo: f.activo !== false,
    };
  }

  limpiarFijaForm(): void {
    this.editId = null;
    this.fijaNueva = { nombre: '', cobro: 0, km: undefined, notas: '', activo: true };
  }

  guardarFija(): void {
    if (this.guardando) return;
    const nombre = (this.fijaNueva.nombre || '').trim();
    if (!nombre) {
      this.error = 'Pon nombre de la tarifa fija.';
      return;
    }
    this.guardando = true;
    this.error = '';
    this.ok = '';
    const dto: TarifaFija = {
      nombre,
      cobro: Math.max(0, Number(this.fijaNueva.cobro) || 0),
      km: this.fijaNueva.km != null ? Number(this.fijaNueva.km) : undefined,
      notas: (this.fijaNueva.notas || '').trim() || undefined,
      activo: true,
    };
    const req =
      this.editId != null
        ? this.api.actualizarTarifaFija(this.editId, { ...dto, id: this.editId })
        : this.api.crearTarifaFija(dto);
    req.subscribe({
      next: () => {
        this.guardando = false;
        this.ok = this.editId != null ? 'Tarifa fija actualizada.' : 'Tarifa fija creada.';
        this.limpiarFijaForm();
        this.cargarFijas();
      },
      error: (e) => {
        this.guardando = false;
        this.error = e?.error?.error || 'No se pudo guardar la tarifa fija.';
      },
    });
  }

  borrarFija(f: TarifaFija): void {
    if (!f.id || !confirm(`¿Quitar "${f.nombre}"?`)) return;
    this.api.eliminarTarifaFija(f.id).subscribe({
      next: () => {
        this.ok = 'Tarifa fija eliminada.';
        this.cargarFijas();
      },
      error: () => (this.error = 'No se pudo eliminar.'),
    });
  }
}
