package com.taxi.controlador;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.taxi.dto.ReservaDto;
import com.taxi.servicio.ReservaService;

@RestController
@RequestMapping("/api/reservas")
public class ReservaController {

    private final ReservaService servicio;

    public ReservaController(ReservaService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/proximas")
    public List<ReservaDto> proximas() {
        return servicio.proximas();
    }

    @GetMapping("/pendientes")
    public List<ReservaDto> pendientes() {
        return servicio.pendientes();
    }

    @GetMapping
    public List<ReservaDto> listar(
            @RequestParam(required = false) Instant desde,
            @RequestParam(required = false) Instant hasta) {
        if (desde != null && hasta != null) {
            return servicio.entre(desde, hasta);
        }
        return servicio.recientes();
    }

    @GetMapping("/conflicto")
    public Map<String, Object> conflicto(
            @RequestParam Instant cuando,
            @RequestParam(defaultValue = "60") int minutos,
            @RequestParam(required = false) Long excluirId) {
        boolean hay = servicio.hayConflicto(cuando, minutos, excluirId);
        List<Instant> propuestas = hay
                ? servicio.proponerHorarios(cuando, minutos, excluirId)
                : List.of();
        return Map.of("conflicto", hay, "propuestas", propuestas);
    }

    @GetMapping("/propuestas")
    public Map<String, Object> propuestas(
            @RequestParam Instant cuando,
            @RequestParam(defaultValue = "60") int minutos,
            @RequestParam(required = false) Long excluirId) {
        return Map.of("propuestas", servicio.proponerHorarios(cuando, minutos, excluirId));
    }

    @PostMapping
    public ReservaDto crear(@RequestBody ReservaDto dto) {
        return servicio.crear(dto);
    }

    @PutMapping("/{id}")
    public ReservaDto actualizar(@PathVariable Long id, @RequestBody ReservaDto dto) {
        return servicio.actualizar(id, dto);
    }

    @PostMapping("/{id}/confirmar")
    public ReservaDto confirmar(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Instant nuevo = null;
        if (body != null && body.get("cuando") != null) {
            nuevo = Instant.parse(String.valueOf(body.get("cuando")));
        }
        return servicio.confirmar(id, nuevo);
    }

    @PostMapping("/{id}/cancelar")
    public ReservaDto cancelar(@PathVariable Long id) {
        return servicio.cancelar(id);
    }

    @PostMapping("/{id}/hecha")
    public ReservaDto hecha(@PathVariable Long id) {
        return servicio.marcarHecha(id);
    }
}
