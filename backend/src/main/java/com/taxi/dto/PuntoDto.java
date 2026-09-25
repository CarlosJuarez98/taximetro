package com.taxi.dto;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class PuntoDto {

    public double lat;
    public double lng;
    public Instant t;

    public static class Lote {
        public List<PuntoDto> puntos = new ArrayList<>();
        /** Km leídos de Maps/Waze; si viene, el cobro usa esto en lugar del GPS. */
        public Double kmManual;
        public Double minutosEspera;
        /** Total casetas (ida + regreso si aplica) que absorbe el cliente. */
        public Double casetas;
        /** EFECTIVO o TRANSFER. */
        public String formaPago;
    }
}
