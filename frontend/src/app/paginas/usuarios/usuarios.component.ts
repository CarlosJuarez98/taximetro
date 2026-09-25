import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../auth.service';

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
  private readonly auth = inject(AuthService);

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

  adminsActivos(): number {
    return this.lista.filter((u) => u.activo && String(u.rol).toUpperCase() === 'ADMIN').length;
  }

  esUnicoAdminActivo(u: UsuarioRow): boolean {
    return (
      u.activo &&
      String(u.rol).toUpperCase() === 'ADMIN' &&
      this.adminsActivos() <= 1
    );
  }

  esYo(u: UsuarioRow): boolean {
    const yo = this.auth.username;
    return !!yo && yo.toLowerCase() === (u.username || '').toLowerCase();
  }

  puedeDesactivar(u: UsuarioRow): boolean {
    if (!u.activo) return true;
    if (this.esUnicoAdminActivo(u)) return false;
    return true;
  }

  tituloActivo(u: UsuarioRow): string {
    if (!u.activo) return 'Activar';
    if (this.esUnicoAdminActivo(u)) {
      return 'No se puede desactivar: es el único admin';
    }
    return 'Desactivar';
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
    this.error = '';
    this.ok = '';
    if (u.activo && !this.puedeDesactivar(u)) {
      this.error = this.tituloActivo(u);
      return;
    }
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

  eliminar(u: UsuarioRow): void {
    this.error = '';
    this.ok = '';
    if (this.esUnicoAdminActivo(u)) {
      this.error = 'No se puede eliminar: es el único admin.';
      return;
    }
    if (this.esYo(u)) {
      this.error = 'No puedes eliminar tu propio usuario.';
      return;
    }
    if (!confirm(`¿Eliminar a «${u.nombre || u.username}»?`)) return;
    this.http.delete<{ ok?: boolean }>(`/api/usuarios/${u.id}`).subscribe({
      next: () => {
        this.ok = `Usuario ${u.username} eliminado.`;
        this.cargar();
      },
      error: (e) => (this.error = e?.error?.error || 'No se pudo eliminar.'),
    });
  }
}
