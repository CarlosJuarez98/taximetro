# Despliegue en la nube — Viaja en el Rojo (taxímetro)

## Ramas

Ver **`BRANCHES.md`**.

- Desarrollo en **`local`**.
- Deploy desde **`prod`**.
- **"sube a la nube"** = merge `local` → `prod` + deploy de **código** (sin sync de datos).

## Stack en la VM

- Contenedor único (Angular + Spring Boot), puerto interno **8084**.
- BD: **H2** en volumen Docker `taximetro-h2-data` (misma app que local; ATP cuando se pida).
- HTTPS: Caddy compartido → `https://taxi.163.192.146.143.sslip.io/`

## Arranque

```bash
cd ~/taximetro
cp .env.cloud.example .env.cloud   # primera vez
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
docker network connect taximetro_default productos-limpieza-caddy
# Añadir bloque de ./Caddyfile al Caddyfile de productos-limpieza y:
docker restart productos-limpieza-caddy
```

## URL

https://taxi.163.192.146.143.sslip.io/
