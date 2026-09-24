package com.taxi.seguridad;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.taxi.modelo.Usuario;
import com.taxi.repositorio.UsuarioRepository;

@Component
public class AuthSupport {

    private final UsuarioRepository usuarios;

    public AuthSupport(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    public Usuario actual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null
                || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sin sesión");
        }
        return usuarios.findByUsernameIgnoreCase(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sin sesión"));
    }

    public Long actualId() {
        return actual().getId();
    }

    public boolean esAdmin() {
        return actual().getRol() == Usuario.Rol.ADMIN;
    }
}
