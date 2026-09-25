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

import com.taxi.dto.TarifaFijaDto;
import com.taxi.servicio.TarifaFijaService;

@RestController
@RequestMapping("/api/tarifas-fijas")
public class TarifaFijaController {

    private final TarifaFijaService servicio;

    public TarifaFijaController(TarifaFijaService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<TarifaFijaDto> listar() {
        return servicio.listar();
    }

    @PostMapping
    public TarifaFijaDto crear(@RequestBody TarifaFijaDto dto) {
        dto.id = null;
        return servicio.guardar(dto);
    }

    @PutMapping("/{id}")
    public TarifaFijaDto actualizar(@PathVariable Long id, @RequestBody TarifaFijaDto dto) {
        dto.id = id;
        return servicio.guardar(dto);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> eliminar(@PathVariable Long id) {
        servicio.eliminar(id);
        return Map.of("ok", true);
    }
}
