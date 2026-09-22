package com.taxi.servicio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.taxi.modelo.Tarifa;

class CobroServiceTest {

    private final CobroService cobro = new CobroService();

    @Test
    void banderazoSiNoHayRecorrido() {
        Tarifa t = new Tarifa();
        Instant a = Instant.parse("2026-09-17T15:00:00Z");
        CobroService.Resultado r = cobro.calcular(t, List.of(), a, a.plusSeconds(10));
        // sin km aplica tarifa mínima ($50)
        assertEquals(0, new BigDecimal("50").compareTo(r.cobro()));
    }

    @Test
    void sumaKilometros() {
        Tarifa t = new Tarifa();
        Instant a = Instant.parse("2026-09-17T15:00:00Z");
        List<CobroService.Punto> pts = List.of(
                new CobroService.Punto(19.3142, -97.9250, a),
                new CobroService.Punto(19.3142, -97.9154, a.plusSeconds(120)));
        CobroService.Resultado r = cobro.calcular(t, pts, a, a.plusSeconds(120));
        assertTrue(r.metros() > 900 && r.metros() < 1200);
        assertTrue(r.cobro().doubleValue() >= 50);
        assertEquals(0, r.cobro().scale());
    }

    @Test
    void cobroPorKmManual() {
        Tarifa t = new Tarifa();
        t.setBanderazo(new BigDecimal("25"));
        t.setPrecioPorKm(new BigDecimal("5.00"));
        t.setTarifaMinima(new BigDecimal("50"));
        t.setRedondearPesos(true);
        Instant a = Instant.parse("2026-09-17T15:00:00Z");
        CobroService.Resultado r = cobro.calcularPorKm(t, 8, 0, a, a.plusSeconds(600));
        // 25 + 8*5 = 65
        assertEquals(0, new BigDecimal("65").compareTo(r.cobro()));
        assertEquals(8000d, r.metros(), 0.01);
    }

    @Test
    void viajeCortoConRegresoVacioTipoHuamantla() {
        Tarifa t = new Tarifa();
        Instant a = Instant.parse("2026-09-17T15:00:00Z");
        // 2.3 + 4.3 vacío = 6.6 → 25 + 33 = 58 (cerca del $50 real, competitivo)
        CobroService.Resultado r = cobro.calcularPorKm(t, 6.6, 0, a, a.plusSeconds(600));
        assertEquals(0, new BigDecimal("58").compareTo(r.cobro()));
    }
}
