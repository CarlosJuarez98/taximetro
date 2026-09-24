package com.taxi.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.taxi.modelo.Tarifa;

@Service
public class CobroService {

    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    public record Punto(double lat, double lng, Instant t) {
    }

    public record Resultado(
            BigDecimal cobro,
            double metros,
            long duracionSegundos,
            long segundosEspera,
            boolean nocturno) {
    }

    public Resultado calcular(Tarifa tarifa, List<Punto> puntos, Instant inicio, Instant fin) {
        Instant desde = inicio != null ? inicio : Instant.now();
        Instant hasta = fin != null ? fin : Instant.now();
        if (hasta.isBefore(desde)) {
            hasta = desde;
        }

        double metros = 0;
        long esperaMs = 0;
        double umbral = tarifa.getUmbralEsperaKmh() == null
                ? 12d
                : tarifa.getUmbralEsperaKmh().doubleValue();

        if (puntos != null && puntos.size() >= 2) {
            for (int i = 1; i < puntos.size(); i++) {
                Punto a = puntos.get(i - 1);
                Punto b = puntos.get(i);
                if (a == null || b == null || a.t() == null || b.t() == null) {
                    continue;
                }
                double d = haversineMetros(a.lat(), a.lng(), b.lat(), b.lng());
                long dt = b.t().toEpochMilli() - a.t().toEpochMilli();
                if (dt <= 0) {
                    continue;
                }
                metros += d;
                double kmh = d * 3600d / dt;
                if (kmh < umbral) {
                    esperaMs += dt;
                }
            }
        } else {
            esperaMs = Math.max(0, hasta.toEpochMilli() - desde.toEpochMilli());
        }

        long duracionSeg = Math.max(0, (hasta.toEpochMilli() - desde.toEpochMilli()) / 1000);
        long esperaSeg = esperaMs / 1000;
        double km = metros / 1000d;

        BigDecimal cobro = nvl(tarifa.getBanderazo())
                .add(nvl(tarifa.getPrecioPorKm()).multiply(BigDecimal.valueOf(km)))
                .add(nvl(tarifa.getPrecioEsperaMinuto())
                        .multiply(BigDecimal.valueOf(esperaSeg / 60.0)));

        boolean noche = esNoche(tarifa, desde);
        if (noche && tarifa.getRecargoNocturnoPct() != null
                && tarifa.getRecargoNocturnoPct().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal factor = BigDecimal.ONE.add(
                    tarifa.getRecargoNocturnoPct().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
            cobro = cobro.multiply(factor);
        }

        BigDecimal minimo = nvl(tarifa.getTarifaMinima());
        if (cobro.compareTo(minimo) < 0) {
            cobro = minimo;
        }

        cobro = cobro.setScale(0, RoundingMode.CEILING);
        cobro = redondearCerradoArriba(cobro, tarifa);

        return new Resultado(cobro, metros, duracionSeg, esperaSeg, noche);
    }

    /** Cobro con km manuales (Maps/Waze) y minutos de espera opcionales. */
    public Resultado calcularPorKm(Tarifa tarifa, double km, double minutosEspera, Instant inicio, Instant fin) {
        Instant desde = inicio != null ? inicio : Instant.now();
        Instant hasta = fin != null ? fin : Instant.now();
        if (hasta.isBefore(desde)) {
            hasta = desde;
        }
        double metros = Math.max(0d, km) * 1000d;
        long esperaSeg = Math.round(Math.max(0d, minutosEspera) * 60d);
        long duracionSeg = Math.max(0, (hasta.toEpochMilli() - desde.toEpochMilli()) / 1000);

        BigDecimal cobro = nvl(tarifa.getBanderazo())
                .add(nvl(tarifa.getPrecioPorKm()).multiply(BigDecimal.valueOf(Math.max(0d, km))))
                .add(nvl(tarifa.getPrecioEsperaMinuto())
                        .multiply(BigDecimal.valueOf(esperaSeg / 60.0)));

        boolean noche = esNoche(tarifa, desde);
        if (noche && tarifa.getRecargoNocturnoPct() != null
                && tarifa.getRecargoNocturnoPct().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal factor = BigDecimal.ONE.add(
                    tarifa.getRecargoNocturnoPct().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
            cobro = cobro.multiply(factor);
        }

        BigDecimal minimo = nvl(tarifa.getTarifaMinima());
        if (cobro.compareTo(minimo) < 0) {
            cobro = minimo;
        }

        cobro = cobro.setScale(0, RoundingMode.CEILING);
        cobro = redondearCerradoArriba(cobro, tarifa);

        return new Resultado(cobro, metros, duracionSeg, esperaSeg, noche);
    }

    /** Siempre hacia arriba a múltiplos de $5 (pago fácil). */
    static BigDecimal redondearCerradoArriba(BigDecimal cobro, Tarifa tarifa) {
        if (cobro == null) {
            return BigDecimal.ZERO;
        }
        if (tarifa != null && !tarifa.isRedondearPesos()) {
            return cobro.setScale(0, RoundingMode.CEILING);
        }
        BigDecimal paso = BigDecimal.valueOf(5);
        return cobro.divide(paso, 0, RoundingMode.CEILING).multiply(paso);
    }

    public boolean esNoche(Tarifa tarifa, Instant instante) {
        ZonedDateTime z = instante.atZone(ZONA);
        int hora = z.getHour();
        int desde = tarifa.getNocheDesdeHora();
        int hasta = tarifa.getNocheHastaHora();
        if (desde == hasta) {
            return false;
        }
        if (desde < hasta) {
            return hora >= desde && hora < hasta;
        }
        return hora >= desde || hora < hasta;
    }

    public static double haversineMetros(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371000d;
        double p1 = Math.toRadians(lat1);
        double p2 = Math.toRadians(lat2);
        double dp = Math.toRadians(lat2 - lat1);
        double dl = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dp / 2) * Math.sin(dp / 2)
                + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
