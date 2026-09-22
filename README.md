Viaja en el Rojo
================

Taxímetro digital para el Chevrolet Sonic RS (Huamantla, Tlaxcala).
Navegas en Maps/Waze; aquí el cobro, espera y casetas.

Stack
-----
- Frontend: Angular 19 (puerto 4203)
- API: Spring Boot 3.4 / Java 17 (puerto 8084)
- Datos locales: H2 en backend/data (sandbox)
- Nube: https://taxi.163.192.146.143.sslip.io/ (rama `prod`, ver DEPLOY-NUBE.md)
- Repo: https://github.com/CarlosJuarez98/taximetro.git

Arranque
--------
Doble clic en iniciar.bat
o:
  Front  http://127.0.0.1:4203/
  API    http://127.0.0.1:8084/

Celular (misma Wi‑Fi que la PC)
-------------------------------
1. Arranca con iniciar.bat (front escucha en 0.0.0.0:4203).
2. En el teléfono abre http://IP-DE-TU-PC:4203/
   (ej. http://192.168.1.83:4203/).
3. Chrome/Safari → “Agregar a pantalla de inicio” para usarla como app
   (PWA: sin barra del navegador, logo Viaja en el Rojo).
4. Botones grandes táctiles; Banderazo/Corte quedan fijos abajo al hacer scroll.

Uso
---
1. Cotiza por tramos: con cliente + vacío casa→cliente + vacío destino→casa (0/50/100%).
2. Noche (22–6): +20% sobre tarifa (ajustable en Tarifa). Badge “Noche +20%”.
3. Casetas: las pone el cliente. Del regreso: Nada / 50% / 100%.
4. Banderazo → en viaje usa “Cliente no sale” / “Tráfico” para espera automática.
5. Corte y WhatsApp con desglose. Hoy / Tarifa para el día y precios.
