import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from './auth.service';
import { FeedbackService } from './feedback.service';
import { RecordatorioService } from './recordatorio.service';
import { OfflineQueueService } from './offline-queue.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly avisos = inject(RecordatorioService);
  private readonly offline = inject(OfflineQueueService);
  readonly feedback = inject(FeedbackService);

  esLogin = false;
  esViaje = false;
  sesionActiva = false;
  esAdmin = false;
  nombre = '';
  navBusy = false;

  readonly links = [
    { path: '/viaje', label: 'Viaje', icon: '▣' },
    { path: '/agenda', label: 'Agenda', icon: '◷' },
    { path: '/hoy', label: 'Hoy', icon: '◈' },
    { path: '/tarifas', label: 'Tarifa', icon: '$' },
  ];

  ngOnInit(): void {
    this.syncRuta(this.router.url);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.navBusy = true;
        this.feedback.start('Cambiando…');
        this.feedback.tap();
      } else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ) {
        this.navBusy = false;
        this.feedback.stop();
        if (e instanceof NavigationEnd) {
          this.syncRuta(e.urlAfterRedirects);
        }
      }
    });
    this.auth.authChanges$.subscribe((m) => {
      this.sesionActiva = !!m?.authenticated;
      this.esAdmin = m?.rol === 'ADMIN';
      this.nombre = m?.nombre || m?.username || '';
      if (m?.authenticated && this.avisos.activo) {
        this.avisos.start();
        this.offline.flush();
      } else if (!m?.authenticated) {
        this.avisos.stop();
      }
    });
    this.auth.me().subscribe();
    this.offline.flush();
    window.addEventListener('online', () => this.offline.flush());
  }

  onDockClick(): void {
    this.feedback.tap();
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
    this.feedback.tap();
    this.avisos.stop();
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
