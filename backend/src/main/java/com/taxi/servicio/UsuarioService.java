package com.taxi.servicio;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.taxi.dto.UsuarioDto;
import com.taxi.modelo.Usuario;
import com.taxi.repositorio.UsuarioRepository;

import jakarta.annotation.PostConstruct;

@Service
public class UsuarioService {

    private final UsuarioRepository repo;
    private final PasswordEncoder encoder;

    public UsuarioService(UsuarioRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    @PostConstruct
    void semillaAdmin() {
        var opt = repo.findByUsernameIgnoreCase("admin");
        if (opt.isEmpty()) {
            Usuario admin = new Usuario();
            admin.setUsername("admin");
            admin.setNombre("Admin");
            admin.setRol(Usuario.Rol.ADMIN);
            admin.setActivo(true);
            admin.setPasswordHash(encoder.encode("1Taxi23"));
            admin.setCreadoEn(Instant.now());
            repo.save(admin);
            return;
        }
        // Asegura la clave conocida si el hash quedó mal / vacío
        Usuario admin = opt.get();
        if (admin.getPasswordHash() == null
                || admin.getPasswordHash().isBlank()
                || !encoder.matches("1Taxi23", admin.getPasswordHash())) {
            admin.setPasswordHash(encoder.encode("1Taxi23"));
            admin.setActivo(true);
            admin.setRol(Usuario.Rol.ADMIN);
            repo.save(admin);
        }
    }

    public List<UsuarioDto> listar() {
        return repo.findAllByOrderByNombreAsc().stream().map(UsuarioDto::de).toList();
    }

    public Usuario porUsername(String username) {
        return repo.findByUsernameIgnoreCase(username.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }

    @Transactional
    public UsuarioDto crear(UsuarioDto dto) {
        validarAlta(dto);
        String user = normalizar(dto.username);
        if (repo.existsByUsernameIgnoreCase(user)) {
            throw new IllegalArgumentException("Ese usuario ya existe");
        }
        if (dto.password == null || dto.password.isBlank()) {
            throw new IllegalArgumentException("Pon una contraseña");
        }
        Usuario u = new Usuario();
        u.setUsername(user);
        u.setNombre(texto(dto.nombre, user));
        u.setRol(parseRol(dto.rol));
        u.setActivo(true);
        u.setPasswordHash(encoder.encode(dto.password));
        u.setCreadoEn(Instant.now());
        return UsuarioDto.de(repo.save(u));
    }

    @Transactional
    public UsuarioDto actualizar(Long id, UsuarioDto dto) {
        Usuario u = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (dto.nombre != null && !dto.nombre.isBlank()) {
            u.setNombre(dto.nombre.trim());
        }
        if (dto.rol != null && !dto.rol.isBlank()) {
            // No quitar el último admin
            if (u.getRol() == Usuario.Rol.ADMIN && parseRol(dto.rol) != Usuario.Rol.ADMIN) {
                long admins = repo.findAll().stream().filter(x -> x.getRol() == Usuario.Rol.ADMIN && x.isActivo()).count();
                if (admins <= 1) {
                    throw new IllegalArgumentException("Debe quedar al menos un admin");
                }
            }
            u.setRol(parseRol(dto.rol));
        }
        if (dto.password != null && !dto.password.isBlank()) {
            u.setPasswordHash(encoder.encode(dto.password));
        }
        return UsuarioDto.de(repo.save(u));
    }

    @Transactional
    public UsuarioDto setActivo(Long id, boolean activo) {
        Usuario u = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (!activo && u.getRol() == Usuario.Rol.ADMIN) {
            long admins = repo.findAll().stream().filter(x -> x.getRol() == Usuario.Rol.ADMIN && x.isActivo()).count();
            if (admins <= 1) {
                throw new IllegalArgumentException("No puedes desactivar el único admin");
            }
        }
        u.setActivo(activo);
        return UsuarioDto.de(repo.save(u));
    }

    private void validarAlta(UsuarioDto dto) {
        if (dto == null || dto.username == null || dto.username.isBlank()) {
            throw new IllegalArgumentException("Falta el usuario");
        }
    }

    private static Usuario.Rol parseRol(String rol) {
        if (rol == null || rol.isBlank()) {
            return Usuario.Rol.TAXISTA;
        }
        try {
            return Usuario.Rol.valueOf(rol.trim().toUpperCase());
        } catch (Exception e) {
            return Usuario.Rol.TAXISTA;
        }
    }

    private static String normalizar(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase();
    }

    private static String texto(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v.trim();
    }
}
