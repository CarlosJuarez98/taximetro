package com.taxi.controlador;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.taxi.dto.TarifaDto;
import com.taxi.servicio.TarifaService;

@RestController
@RequestMapping("/api/tarifa")
public class TarifaController {

    private final TarifaService servicio;

    public TarifaController(TarifaService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public TarifaDto leer() {
        return servicio.leer();
    }

    @PutMapping
    public TarifaDto guardar(@RequestBody TarifaDto dto) {
        return servicio.guardar(dto);
    }
}
