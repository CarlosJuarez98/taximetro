import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const withCreds = req.clone({ withCredentials: true });
  return next(withCreds).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const url = req.url || '';
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/me')) {
          auth.marcarNoAutenticado();
          if (!router.url.split('?')[0].startsWith('/login')) {
            void router.navigateByUrl('/login');
          }
        }
      }
      return throwError(() => err);
    }),
  );
};
