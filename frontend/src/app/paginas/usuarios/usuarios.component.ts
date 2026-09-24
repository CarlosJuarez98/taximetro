import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface UsuarioRow {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  private readonly http = inject(HttpClient);

  lista: UsuarioRow[] = [];
  error = '';
  ok = '';
  guardando = false;

  form = {
    username: '',
    nombre: '',
    password: '',
    rol: 'TAXISTA',
  };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.http.get<UsuarioRow[]>('/api/usuarios').subscribe({
      next: (l) => (this.lista = l || []),
      error: () => (this.error = 'No se pudieron cargar los usuarios.'),
    });
  }

  crear(): void {
    if (this.guardando) return;
    if (!this.form.username.trim() || !this.form.password) {
      this.error = 'Usuario y contraseña obligatorios.';
      return;
    }
    this.guardando = true;
    this.error = '';
    this.ok = '';
    this.http
      .post<UsuarioRow>('/api/usuarios', {
        username: this.form.username.trim(),
        nombre: this.form.nombre.trim() || this.form.username.trim(),
        password: this.form.password,
        rol: this.form.rol,
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          this.ok = 'Usuario creado.';
          this.form = { username: '', nombre: '', password: '', rol: 'TAXISTA' };
          this.cargar();
        },
        error: (e) => {
          this.guardando = false;
          this.error = e?.error?.error || 'No se pudo crear.';
        },
      });
  }

  toggle(u: UsuarioRow): void {
    this.http.post<UsuarioRow>(`/api/usuarios/${u.id}/activo`, { activo: !u.activo }).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e?.error?.error || 'No se pudo cambiar.'),
    });
  }

  resetPass(u: UsuarioRow): void {
    const pass = prompt(`Nueva contraseña para ${u.username}:`);
    if (!pass) return;
    this.http.put<UsuarioRow>(`/api/usuarios/${u.id}`, { password: pass }).subscribe({
      next: () => (this.ok = `Contraseña de ${u.username} actualizada.`),
      error: (e) => (this.error = e?.error?.error || 'No se pudo cambiar la clave.'),
    });
  }
}
