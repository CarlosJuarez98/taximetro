package com.taxi.controlador;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.taxi.modelo.Usuario;
import com.taxi.repositorio.UsuarioRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String ATTR_TIMEOUT = "viaja.sessionTimeoutSec";
    public static final int TIMEOUT_NORMAL_SEC = 20 * 60;
    public static final int TIMEOUT_RECORDAR_SEC = 7 * 24 * 60 * 60;

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            AuthenticationManager authenticationManager,
            SecurityContextRepository securityContextRepository,
            UsuarioRepository usuarios,
            PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
    }

    public record LoginRequest(String username, String password, Boolean recordar) {
    }

    public record PasswordChangeRequest(String actual, String nueva) {
    }

    @PostMapping("/login")
    public Map<String, Object> login(
            @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        if (body == null || body.username() == null || body.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta usuario o contraseña");
        }
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            body.username().trim().toLowerCase(),
                            body.password()));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);

            HttpSession old = request.getSession(false);
            if (old != null) {
                old.invalidate();
            }
            int timeout = Boolean.TRUE.equals(body.recordar()) ? TIMEOUT_RECORDAR_SEC : TIMEOUT_NORMAL_SEC;
            HttpSession session = request.getSession(true);
            session.setAttribute(ATTR_TIMEOUT, timeout);
            session.setMaxInactiveInterval(timeout);
            securityContextRepository.saveContext(context, request, response);

            Usuario u = usuarios.findByUsernameIgnoreCase(auth.getName()).orElse(null);
            String rol = rolDe(auth);
            return Map.of(
                    "ok", true,
                    "username", auth.getName(),
                    "nombre", u != null ? u.getNombre() : auth.getName(),
                    "rol", rol,
                    "usuarioId", u != null ? u.getId() : 0,
                    "recordar", Boolean.TRUE.equals(body.recordar()));
        } catch (AuthenticationException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos");
        }
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return Map.of("ok", true);
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object stored = session.getAttribute(ATTR_TIMEOUT);
            int timeout = stored instanceof Integer i ? i : TIMEOUT_NORMAL_SEC;
            session.setMaxInactiveInterval(timeout);
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean loggedIn = auth != null
                && auth.isAuthenticated()
                && auth.getPrincipal() != null
                && !"anonymousUser".equals(auth.getPrincipal());
        if (!loggedIn) {
            return Map.of("authenticated", false);
        }
        Usuario u = usuarios.findByUsernameIgnoreCase(auth.getName()).orElse(null);
        return Map.of(
                "authenticated", true,
                "username", auth.getName(),
                "nombre", u != null ? u.getNombre() : auth.getName(),
                "rol", rolDe(auth),
                "usuarioId", u != null ? u.getId() : 0);
    }

    @PutMapping("/password")
    public ResponseEntity<?> cambiarPassword(
            @RequestBody PasswordChangeRequest body,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "No autenticado"));
        }
        if (body == null || body.actual() == null || body.nueva() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falta contraseña actual o nueva"));
        }
        Usuario entity = usuarios.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!passwordEncoder.matches(body.actual(), entity.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "La contraseña actual no es correcta"));
        }
        String nueva = body.nueva().trim();
        if (nueva.length() < 8) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "La nueva contraseña debe tener al menos 8 caracteres"));
        }
        entity.setPasswordHash(passwordEncoder.encode(nueva));
        usuarios.save(entity);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private static String rolDe(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .findFirst()
                .orElse("TAXISTA");
    }
}
