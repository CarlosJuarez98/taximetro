import { Routes } from '@angular/router';
import { ViajeComponent } from './paginas/viaje/viaje.component';
import { HoyComponent } from './paginas/hoy/hoy.component';
import { TarifasComponent } from './paginas/tarifas/tarifas.component';
import { AgendaComponent } from './paginas/agenda/agenda.component';
import { LoginComponent } from './paginas/login/login.component';
import { UsuariosComponent } from './paginas/usuarios/usuarios.component';
import { adminGuard, authGuard, guestGuard } from './auth.guards';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'viaje' },
  { path: 'viaje', component: ViajeComponent, canActivate: [authGuard] },
  { path: 'agenda', component: AgendaComponent, canActivate: [authGuard] },
  { path: 'hoy', component: HoyComponent, canActivate: [authGuard] },
  { path: 'tarifas', component: TarifasComponent, canActivate: [authGuard] },
  { path: 'usuarios', component: UsuariosComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'viaje' },
];
