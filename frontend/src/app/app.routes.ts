import { Routes } from '@angular/router';
import { ViajeComponent } from './paginas/viaje/viaje.component';
import { HoyComponent } from './paginas/hoy/hoy.component';
import { TarifasComponent } from './paginas/tarifas/tarifas.component';
import { AgendaComponent } from './paginas/agenda/agenda.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'viaje' },
  { path: 'viaje', component: ViajeComponent },
  { path: 'agenda', component: AgendaComponent },
  { path: 'hoy', component: HoyComponent },
  { path: 'tarifas', component: TarifasComponent },
  { path: '**', redirectTo: 'viaje' },
];
