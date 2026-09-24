package com.taxi.seguridad;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.taxi.modelo.Usuario;
import com.taxi.repositorio.UsuarioRepository;

@Service
public class DbUserDetailsService implements UserDetailsService {

    private final UsuarioRepository repo;

    public DbUserDetailsService(UsuarioRepository repo) {
        this.repo = repo;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Usuario u = repo.findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));
        if (!u.isActivo()) {
            throw new UsernameNotFoundException("Usuario desactivado");
        }
        return new User(
                u.getUsername(),
                u.getPasswordHash(),
                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRol().name())));
    }
}
