# Despliegue en la nube — Viaja en el Rojo (taxímetro)

## Ramas

Ver **`BRANCHES.md`**.

- Desarrollo en **`local`**.
- Deploy desde **`prod`**.
- **"sube a la nube"** = merge `local` → `prod` + `scripts/deploy-nube.ps1` (código; sin sync de datos).

## Stack en la VM

- Contenedor único (Angular + Spring Boot), puerto interno **8084**.
- BD: **H2** en volumen Docker `taximetro-h2-data` (ATP cuando se pida).
- HTTPS: Caddy compartido → `https://taxi.163.192.146.143.sslip.io/`
- Health: `GET /api/health`

## Arranque (script)

```powershell
cd A:\Programas-java\Negocios\taxi
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-nube.ps1
```

Manual en la VM:

```bash
cd ~/taximetro
cp .env.cloud.example .env.cloud   # primera vez
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
docker network connect taximetro_default productos-limpieza-caddy
# Bloque taxi ya está en el Caddyfile de productos-limpieza
docker restart productos-limpieza-caddy
```

## Backup H2

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-h2.ps1
```

Cookie Secure en nube: `SERVER_SERVLET_SESSION_COOKIE_SECURE=true` en `.env.cloud`.

## URL

https://taxi.163.192.146.143.sslip.io/
