package com.taxi.dto;

import com.taxi.modelo.Usuario;

public class UsuarioDto {

    public Long id;
    public String username;
    public String nombre;
    public String rol;
    public boolean activo;
    /** Solo al crear/cambiar. Nunca se devuelve. */
    public String password;

    public static UsuarioDto de(Usuario u) {
        UsuarioDto dto = new UsuarioDto();
        dto.id = u.getId();
        dto.username = u.getUsername();
        dto.nombre = u.getNombre();
        dto.rol = u.getRol().name();
        dto.activo = u.isActivo();
        return dto;
    }
}
