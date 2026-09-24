import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  error = '';
  cargando = false;

  enviar(): void {
    this.error = '';
    const u = this.username.trim();
    if (!u || !this.password) {
      this.error = 'Escribe usuario y contraseña';
      return;
    }
    this.cargando = true;
    this.auth.login(u, this.password).subscribe({
      next: () => {
        this.cargando = false;
        void this.router.navigateByUrl('/viaje');
      },
      error: () => {
        this.cargando = false;
        this.error = 'Usuario o contraseña incorrectos';
      },
    });
  }
}
