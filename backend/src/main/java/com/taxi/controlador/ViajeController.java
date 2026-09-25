package com.taxi.controlador;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.taxi.dto.EstimacionDto;
import com.taxi.dto.IniciarViajeDto;
import com.taxi.dto.PuntoDto;
import com.taxi.dto.ResumenHoyDto;
import com.taxi.dto.ViajeDto;
import com.taxi.servicio.ViajeService;

@RestController
@RequestMapping("/api/viajes")
public class ViajeController {

    private final ViajeService servicio;

    public ViajeController(ViajeService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/en-curso")
    public Object enCurso() {
        ViajeDto v = servicio.enCurso();
        return v == null ? Map.of() : v;
    }

    @GetMapping("/hoy")
    public ResumenHoyDto hoy() {
        return servicio.hoy();
    }

    @GetMapping("/hoy/lista")
    public List<ViajeDto> listaHoy() {
        return servicio.listaHoy();
    }

    @PutMapping("/hoy/fondo")
    public ResumenHoyDto fondo(@RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("fondoInicial");
        java.math.BigDecimal fondo = raw == null
                ? java.math.BigDecimal.ZERO
                : new java.math.BigDecimal(String.valueOf(raw));
        return servicio.guardarFondo(fondo);
    }

    @PostMapping("/hoy/corte-caja")
    public ResumenHoyDto corteCaja(@RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("conteoReal");
        if (raw == null) {
            throw new IllegalArgumentException("Pon cuánto contaste en la caja");
        }
        java.math.BigDecimal conteo = new java.math.BigDecimal(String.valueOf(raw));
        return servicio.corteCaja(conteo);
    }

    @PutMapping("/hoy/gastos")
    public ResumenHoyDto gastos(@RequestBody Map<String, Object> body) {
        java.math.BigDecimal gas = decimal(body, "gastosGasolina");
        java.math.BigDecimal otros = decimal(body, "gastosOtros");
        return servicio.guardarGastos(gas, otros);
    }

    private static java.math.BigDecimal decimal(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            return java.math.BigDecimal.ZERO;
        }
        return new java.math.BigDecimal(String.valueOf(body.get(key)));
    }

    @GetMapping
    public List<ViajeDto> recientes() {
        return servicio.recientes();
    }

    @GetMapping("/{id}")
    public ViajeDto uno(@PathVariable Long id) {
        return servicio.uno(id);
    }

    @PostMapping("/estimar")
    public EstimacionDto.Respuesta estimar(@RequestBody EstimacionDto req) {
        return servicio.estimar(req);
    }

    @PostMapping
    public ViajeDto iniciar(@RequestBody IniciarViajeDto req) {
        return servicio.iniciar(req);
    }

    @PostMapping("/{id}/puntos")
    public ViajeDto puntos(@PathVariable Long id, @RequestBody(required = false) PuntoDto.Lote lote) {
        return servicio.agregarPuntos(id, lote == null ? new PuntoDto.Lote() : lote);
    }

    @PostMapping("/{id}/corte")
    public ViajeDto corte(@PathVariable Long id, @RequestBody(required = false) PuntoDto.Lote lote) {
        return servicio.corte(id, lote);
    }

    @PostMapping("/{id}/cancelar")
    public ViajeDto cancelar(@PathVariable Long id) {
        return servicio.cancelar(id);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> eliminar(@PathVariable Long id) {
        servicio.eliminar(id);
        return Map.of("ok", true);
    }
}
