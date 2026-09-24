import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/** En local, un SW viejo deja JS cacheado. Se limpia sin mostrar errores. */
async function purgeDevServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
  if (!local) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* silencioso */
  }
}

purgeDevServiceWorker().finally(() => {
  bootstrapApplication(AppComponent, appConfig).catch(() => {
    /* sin spam en consola de falta async */
  });
});
