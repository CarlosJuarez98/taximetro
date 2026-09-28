# Ramas

| Rama | Uso |
|------|-----|
| `local` | Desarrollo diario (PC, H2, Angular :4203) |
| `prod` | Listo para Oracle Cloud (compose cloud + HTTPS) |

## Flujo
1. Trabajas en **`local`**.
2. Cuando digas **"sube a la nube"** / **"lleva a la nube"**:
   - merge `local` → `prod`
   - **sin** deploy automático — tú corres `deploy-nube.bat` o `SUBIR-A-LA-NUBE.bat`
   - **sin** sync de datos (local = pruebas; nube = datos reales)
3. No hagas cambios solo-prod en `local` salvo configs compartidas (proxy + `/api` relativo).
