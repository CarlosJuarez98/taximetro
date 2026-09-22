import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { Tarifa } from '../../modelos';

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
  error = '';
  ok = '';
  guardando = false;

  ngOnInit(): void {
    this.api.tarifa().subscribe({
      next: (t) => (this.tarifa = t),
      error: () => (this.error = 'No se pudo cargar la tarifa.'),
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
}
