import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  esLogin = false;
  esViaje = false;
  sesionActiva = false;
  esAdmin = false;
  nombre = '';

  readonly links = [
    { path: '/viaje', label: 'Viaje', icon: '▣' },
    { path: '/agenda', label: 'Agenda', icon: '◷' },
    { path: '/hoy', label: 'Hoy', icon: '◈' },
    { path: '/tarifas', label: 'Tarifa', icon: '$' },
  ];

  ngOnInit(): void {
    this.syncRuta(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.syncRuta((e as NavigationEnd).urlAfterRedirects);
    });
    this.auth.authChanges$.subscribe((m) => {
      this.sesionActiva = !!m?.authenticated;
      this.esAdmin = m?.rol === 'ADMIN';
      this.nombre = m?.nombre || m?.username || '';
    });
    this.auth.me().subscribe();
  }

  private syncRuta(url: string): void {
    const path = url.split('?')[0];
    this.esLogin = path.startsWith('/login');
    this.esViaje = path === '/' || path.startsWith('/viaje');
  }

  get dockLinks() {
    const base = [...this.links];
    if (this.esAdmin) {
      base.push({ path: '/usuarios', label: 'Users', icon: '◎' });
    }
    return base;
  }

  salir(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
