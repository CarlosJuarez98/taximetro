package com.taxi.controlador;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.taxi.dto.UsuarioDto;
import com.taxi.servicio.UsuarioService;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService servicio;

    public UsuarioController(UsuarioService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<UsuarioDto> listar() {
        return servicio.listar();
    }

    @PostMapping
    public UsuarioDto crear(@RequestBody UsuarioDto dto) {
        return servicio.crear(dto);
    }

    @PutMapping("/{id}")
    public UsuarioDto actualizar(@PathVariable Long id, @RequestBody UsuarioDto dto) {
        return servicio.actualizar(id, dto);
    }

    @PostMapping("/{id}/activo")
    public UsuarioDto activo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        boolean activo = body != null && Boolean.TRUE.equals(body.get("activo"));
        return servicio.setActivo(id, activo);
    }
}
