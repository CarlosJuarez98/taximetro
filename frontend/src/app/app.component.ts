import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly links = [
    { path: '/viaje', label: 'Viaje', icon: '▣' },
    { path: '/agenda', label: 'Agenda', icon: '◷' },
    { path: '/hoy', label: 'Hoy', icon: '◈' },
    { path: '/tarifas', label: 'Tarifa', icon: '$' },
  ];
}
