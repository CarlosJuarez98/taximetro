import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((m) => {
      if (m.authenticated) return true;
      return router.createUrlTree(['/login']);
    }),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((m) => {
      if (!m.authenticated) return true;
      return router.createUrlTree(['/viaje']);
    }),
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((m) => {
      if (m.authenticated && m.rol === 'ADMIN') return true;
      if (!m.authenticated) return router.createUrlTree(['/login']);
      return router.createUrlTree(['/viaje']);
    }),
  );
};
