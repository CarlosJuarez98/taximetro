package com.taxi.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taxi.dto.EstimacionDto;
import com.taxi.dto.IniciarViajeDto;
import com.taxi.dto.PuntoDto;
import com.taxi.dto.ResumenHoyDto;
import com.taxi.dto.ViajeDto;
import com.taxi.modelo.CajaDia;
import com.taxi.modelo.PuntoGps;
import com.taxi.modelo.Tarifa;
import com.taxi.modelo.Viaje;
import com.taxi.repositorio.CajaDiaRepository;
import com.taxi.repositorio.PuntoGpsRepository;
import com.taxi.repositorio.ViajeRepository;
import com.taxi.seguridad.AuthSupport;

@Service
public class ViajeService {

    private final ViajeRepository viajes;
    private final PuntoGpsRepository puntos;
    private final CajaDiaRepository cajas;
    private final TarifaService tarifas;
    private final CobroService cobro;
    private final GeoService geo;
    private final ObjectMapper json;
    private final AuthSupport auth;

    public ViajeService(
            ViajeRepository viajes,
            PuntoGpsRepository puntos,
            CajaDiaRepository cajas,
            TarifaService tarifas,
            CobroService cobro,
            GeoService geo,
            ObjectMapper json,
            AuthSupport auth) {
        this.viajes = viajes;
        this.puntos = puntos;
        this.cajas = cajas;
        this.tarifas = tarifas;
        this.cobro = cobro;
        this.geo = geo;
        this.json = json;
        this.auth = auth;
    }

    public EstimacionDto.Respuesta estimar(EstimacionDto req) {
        if (req == null || req.destinoLat == null || req.destinoLng == null) {
            throw new IllegalArgumentException("Falta el destino");
        }
        EstimacionDto.Respuesta r = geo.ruta(req.origenLat, req.origenLng, req.destinoLat, req.destinoLng);
        Tarifa tarifa = tarifas.actual();
        Instant ahora = Instant.now();
        long esperaEstimada = Math.round(r.duracionSegundos * 0.12);
        BigDecimal extraEspera = nvl(tarifa.getPrecioEsperaMinuto())
                .multiply(BigDecimal.valueOf(esperaEstimada / 60.0));
        BigDecimal estimado = nvl(tarifa.getBanderazo())
                .add(nvl(tarifa.getPrecioPorKm()).multiply(BigDecimal.valueOf(r.distanciaMetros / 1000d)))
                .add(extraEspera);
        if (cobro.esNoche(tarifa, ahora) && tarifa.getRecargoNocturnoPct() != null
                && tarifa.getRecargoNocturnoPct().compareTo(BigDecimal.ZERO) > 0) {
            estimado = estimado.multiply(BigDecimal.ONE.add(
                    tarifa.getRecargoNocturnoPct().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)));
        }
        if (estimado.compareTo(nvl(tarifa.getTarifaMinima())) < 0) {
            estimado = nvl(tarifa.getTarifaMinima());
        }
        estimado = estimado.setScale(0, RoundingMode.HALF_UP);
        r.cobroEstimado = estimado;
        r.destinoTexto = req.destinoTexto;
        return r;
    }

    public ViajeDto enCurso() {
        Long uid = auth.actualId();
        return viajes.findFirstByUsuarioIdAndEstadoOrderByInicioDesc(uid, Viaje.Estado.EN_CURSO)
                .map(this::aDto)
                .orElse(null);
    }

    @Transactional
    public ViajeDto iniciar(IniciarViajeDto req) {
        Long uid = auth.actualId();
        viajes.findFirstByUsuarioIdAndEstadoOrderByInicioDesc(uid, Viaje.Estado.EN_CURSO).ifPresent(abierto -> {
            abierto.setEstado(Viaje.Estado.CANCELADO);
            abierto.setFin(Instant.now());
            abierto.setNotas("Cancelado al iniciar otro viaje");
            viajes.save(abierto);
        });
        Viaje v = new Viaje();
        v.setEstado(Viaje.Estado.EN_CURSO);
        v.setUsuarioId(uid);
        v.setInicio(Instant.now());
        v.setOrigenLat(req.origenLat);
        v.setOrigenLng(req.origenLng);
        v.setOrigenTexto(texto(req.origenTexto, "Origen"));
        v.setDestinoLat(req.destinoLat);
        v.setDestinoLng(req.destinoLng);
        v.setDestinoTexto(req.destinoTexto);
        if (req.ruta != null && !req.ruta.isEmpty()) {
            v.setRutaGeoJson(escribirJson(req.ruta));
        }
        v = viajes.save(v);

        PuntoGps p = new PuntoGps();
        p.setViaje(v);
        p.setLat(req.origenLat);
        p.setLng(req.origenLng);
        p.setRegistradoEn(v.getInicio());
        puntos.save(p);
        return aDto(v);
    }

    @Transactional
    public ViajeDto agregarPuntos(Long id, PuntoDto.Lote lote) {
        Viaje v = obtener(id);
        exigirEnCurso(v);
        if (lote != null && lote.puntos != null) {
            for (PuntoDto p : lote.puntos) {
                PuntoGps g = new PuntoGps();
                g.setViaje(v);
                g.setLat(p.lat);
                g.setLng(p.lng);
                g.setRegistradoEn(p.t != null ? p.t : Instant.now());
                puntos.save(g);
            }
        }
        return recalcular(v, false);
    }

    @Transactional
    public ViajeDto corte(Long id, PuntoDto.Lote lote) {
        Viaje v = obtener(id);
        exigirEnCurso(v);
        if (lote != null && lote.puntos != null && !lote.puntos.isEmpty()) {
            agregarPuntos(id, lote);
            v = obtener(id);
        }
        v.setFin(Instant.now());
        v.setEstado(Viaje.Estado.CERRADO);
        if (lote != null && lote.kmManual != null && lote.kmManual >= 0) {
            double esperaMin = lote.minutosEspera == null ? 0d : Math.max(0d, lote.minutosEspera);
            double casetas = lote.casetas == null ? 0d : Math.max(0d, lote.casetas);
            return aplicarKmManual(v, lote.kmManual, esperaMin, casetas);
        }
        return recalcular(v, true);
    }

    private ViajeDto aplicarKmManual(Viaje v, double km, double minutosEspera, double casetas) {
        Instant fin = v.getFin() != null ? v.getFin() : Instant.now();
        CobroService.Resultado res = cobro.calcularPorKm(tarifas.actual(), km, minutosEspera, v.getInicio(), fin);
        BigDecimal casetasBd = BigDecimal.valueOf(casetas).setScale(0, RoundingMode.HALF_UP);
        v.setDistanciaMetros(BigDecimal.valueOf(res.metros()).setScale(2, RoundingMode.HALF_UP));
        v.setDuracionSegundos(res.duracionSegundos());
        v.setSegundosEspera(res.segundosEspera());
        v.setCasetas(casetasBd);
        BigDecimal total = res.cobro().add(casetasBd);
        v.setCobro(CobroService.redondearCerradoArriba(total, tarifas.actual()));
        if (casetasBd.compareTo(BigDecimal.ZERO) > 0) {
            String nota = "Casetas $" + casetasBd.toPlainString() + " (cliente)";
            v.setNotas(v.getNotas() == null || v.getNotas().isBlank() ? nota : v.getNotas() + " · " + nota);
        }
        return aDto(viajes.save(v));
    }

    @Transactional
    public ViajeDto cancelar(Long id) {
        Viaje v = obtener(id);
        exigirEnCurso(v);
        v.setEstado(Viaje.Estado.CANCELADO);
        v.setFin(Instant.now());
        return aDto(viajes.save(v));
    }

    @Transactional
    public void eliminar(Long id) {
        Viaje v = obtener(id);
        if (v.getEstado() == Viaje.Estado.EN_CURSO) {
            throw new IllegalArgumentException("Cancela el viaje en curso antes de borrarlo");
        }
        puntos.deleteByViaje(v);
        viajes.delete(v);
    }

    public List<ViajeDto> recientes() {
        Long uid = auth.actualId();
        return viajes.findTop80ByUsuarioIdOrderByInicioDesc(uid).stream().map(this::aDto).toList();
    }

    public List<ViajeDto> listaHoy() {
        Instant desde = inicioHoy();
        Long uid = auth.actualId();
        return viajes.findByUsuarioIdAndInicioGreaterThanEqualOrderByInicioDesc(uid, desde).stream()
                .map(this::aDto)
                .toList();
    }

    public ResumenHoyDto hoy() {
        Instant desde = inicioHoy();
        Long uid = auth.actualId();
        List<Viaje> lista = viajes.findByUsuarioIdAndInicioGreaterThanEqualOrderByInicioDesc(uid, desde);
        ResumenHoyDto r = new ResumenHoyDto();
        BigDecimal cobrado = BigDecimal.ZERO;
        BigDecimal metros = BigDecimal.ZERO;
        long segundos = 0;
        long n = 0;
        for (Viaje v : lista) {
            if (v.getEstado() != Viaje.Estado.CERRADO) {
                continue;
            }
            n++;
            cobrado = cobrado.add(nvl(v.getCobro()));
            metros = metros.add(nvl(v.getDistanciaMetros()));
            segundos += v.getDuracionSegundos();
        }
        r.viajes = n;
        r.cobrado = cobrado.setScale(0, RoundingMode.HALF_UP);
        r.km = metros.divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP);
        r.minutos = segundos / 60;
        aplicarCaja(r, cobrado);
        return r;
    }

    @Transactional
    public ResumenHoyDto guardarFondo(BigDecimal fondo) {
        CajaDia caja = cajaHoy();
        BigDecimal f = nvl(fondo).setScale(2, RoundingMode.HALF_UP);
        if (f.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El fondo no puede ser negativo");
        }
        caja.setFondoInicial(f);
        // Si ya había corte, al cambiar fondo se invalida el conteo
        if (caja.getCortadaEn() != null) {
            caja.setConteoReal(null);
            caja.setCortadaEn(null);
        }
        cajas.save(caja);
        return hoy();
    }

    @Transactional
    public ResumenHoyDto corteCaja(BigDecimal conteoReal) {
        CajaDia caja = cajaHoy();
        BigDecimal c = nvl(conteoReal).setScale(2, RoundingMode.HALF_UP);
        if (c.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El conteo no puede ser negativo");
        }
        caja.setConteoReal(c);
        caja.setCortadaEn(Instant.now());
        cajas.save(caja);
        return hoy();
    }

    private void aplicarCaja(ResumenHoyDto r, BigDecimal cobrado) {
        Long uid = auth.actualId();
        CajaDia caja = cajas.findByFechaAndUsuarioId(LocalDate.now(CobroService.ZONA), uid).orElse(null);
        BigDecimal fondo = caja == null ? BigDecimal.ZERO : nvl(caja.getFondoInicial());
        fondo = fondo.setScale(2, RoundingMode.HALF_UP);
        BigDecimal esperado = fondo.add(nvl(cobrado)).setScale(2, RoundingMode.HALF_UP);
        r.fondoInicial = fondo;
        r.esperadoEnCaja = esperado;
        if (caja != null && caja.getConteoReal() != null) {
            r.conteoReal = caja.getConteoReal().setScale(2, RoundingMode.HALF_UP);
            r.diferencia = r.conteoReal.subtract(esperado).setScale(2, RoundingMode.HALF_UP);
            r.cortada = true;
        } else {
            r.conteoReal = null;
            r.diferencia = null;
            r.cortada = false;
        }
    }

    private CajaDia cajaHoy() {
        Long uid = auth.actualId();
        LocalDate hoy = LocalDate.now(CobroService.ZONA);
        return cajas.findByFechaAndUsuarioId(hoy, uid).orElseGet(() -> {
            CajaDia n = new CajaDia();
            n.setFecha(hoy);
            n.setUsuarioId(uid);
            n.setFondoInicial(BigDecimal.ZERO);
            return n;
        });
    }

    private Instant inicioHoy() {
        return LocalDate.now(CobroService.ZONA)
                .atStartOfDay(CobroService.ZONA)
                .toInstant();
    }

    public ViajeDto uno(Long id) {
        return aDto(obtener(id));
    }

    private ViajeDto recalcular(Viaje v, boolean persistir) {
        List<PuntoGps> gps = puntos.findByViajeOrderByRegistradoEnAsc(v);
        List<CobroService.Punto> pts = new ArrayList<>();
        for (PuntoGps p : gps) {
            pts.add(new CobroService.Punto(p.getLat(), p.getLng(), p.getRegistradoEn()));
        }
        Instant fin = v.getFin() != null ? v.getFin() : Instant.now();
        CobroService.Resultado res = cobro.calcular(tarifas.actual(), pts, v.getInicio(), fin);
        v.setDistanciaMetros(BigDecimal.valueOf(res.metros()).setScale(2, RoundingMode.HALF_UP));
        v.setDuracionSegundos(res.duracionSegundos());
        v.setSegundosEspera(res.segundosEspera());
        v.setCobro(res.cobro());
        if (persistir || v.getEstado() == Viaje.Estado.EN_CURSO) {
            viajes.save(v);
        }
        return aDto(v);
    }

    private ViajeDto aDto(Viaje v) {
        return ViajeDto.de(v, leerRuta(v.getRutaGeoJson()));
    }

    private Viaje obtener(Long id) {
        Long uid = auth.actualId();
        return viajes.findByIdAndUsuarioId(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Viaje no encontrado"));
    }

    private void exigirEnCurso(Viaje v) {
        if (v.getEstado() != Viaje.Estado.EN_CURSO) {
            throw new IllegalArgumentException("El viaje ya no está en curso");
        }
    }

    private String escribirJson(List<double[]> ruta) {
        try {
            return json.writeValueAsString(ruta);
        } catch (Exception e) {
            return null;
        }
    }

    private List<double[]> leerRuta(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return json.readValue(raw, new TypeReference<>() {
            });
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String texto(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v.trim();
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
