package com.taxi.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.taxi.dto.ReservaDto;
import com.taxi.modelo.Reserva;
import com.taxi.repositorio.ReservaRepository;

@Service
public class ReservaService {

    private final ReservaRepository repo;

    public ReservaService(ReservaRepository repo) {
        this.repo = repo;
    }

    /** Agenda: solo confirmadas. */
    public List<ReservaDto> proximas() {
        Instant ahora = Instant.now().minus(Duration.ofHours(2));
        return repo.findByEstadoAndCuandoGreaterThanEqualOrderByCuandoAsc(Reserva.Estado.RESERVADA, ahora)
                .stream()
                .map(this::conConflicto)
                .toList();
    }

    /** Cotizaciones pendientes de confirmar. */
    public List<ReservaDto> pendientes() {
        Instant ahora = Instant.now().minus(Duration.ofHours(2));
        return repo.findByEstadoAndCuandoGreaterThanEqualOrderByCuandoAsc(Reserva.Estado.PENDIENTE, ahora)
                .stream()
                .map(this::conConflictoYPropuestas)
                .toList();
    }

    public List<ReservaDto> recientes() {
        return repo.findTop40ByOrderByCuandoDesc().stream().map(ReservaDto::de).toList();
    }

    public List<ReservaDto> entre(Instant desde, Instant hasta) {
        return repo.findByCuandoBetweenOrderByCuandoAsc(desde, hasta).stream()
                .map(this::conConflicto)
                .toList();
    }

    /**
     * ¿Hay otra reserva CONFIRMADA que se empalme?
     * Las pendientes no bloquean la agenda.
     */
    public boolean hayConflicto(Instant cuando, int minutosOcupados, Long excluirId) {
        if (cuando == null) {
            return false;
        }
        int mins = Math.max(30, minutosOcupados);
        Instant ini = cuando.minus(Duration.ofMinutes(30));
        Instant fin = cuando.plus(Duration.ofMinutes(mins));
        List<Reserva> cercanas = repo.findByEstadoAndCuandoBetweenOrderByCuandoAsc(
                Reserva.Estado.RESERVADA,
                ini.minus(Duration.ofHours(3)),
                fin.plus(Duration.ofHours(3)));
        for (Reserva otra : cercanas) {
            if (excluirId != null && excluirId.equals(otra.getId())) {
                continue;
            }
            Instant oIni = otra.getCuando();
            Instant oFin = oIni.plus(Duration.ofMinutes(Math.max(30, otra.getMinutosOcupados())));
            if (ini.isBefore(oFin) && fin.isAfter(oIni)) {
                return true;
            }
        }
        return false;
    }

    /** Hasta 4 horarios libres cercanos para ofrecerle al cliente. */
    public List<Instant> proponerHorarios(Instant cuando, int minutosOcupados, Long excluirId) {
        List<Instant> out = new ArrayList<>();
        if (cuando == null) {
            return out;
        }
        int[] offsetsMin = { 30, -30, 60, -60, 90, 120, -90, 150, 180, 240, -120, 300, 360 };
        for (int off : offsetsMin) {
            Instant cand = cuando.plus(Duration.ofMinutes(off));
            if (cand.isBefore(Instant.now().minus(Duration.ofMinutes(15)))) {
                continue;
            }
            if (!hayConflicto(cand, minutosOcupados, excluirId) && !out.contains(cand)) {
                out.add(cand);
            }
            if (out.size() >= 4) {
                break;
            }
        }
        // Si sigue vacío, busca huecos cada hora hacia adelante
        Instant cursor = cuando.plus(Duration.ofHours(1));
        for (int i = 0; i < 48 && out.size() < 4; i++) {
            if (!hayConflicto(cursor, minutosOcupados, excluirId) && !out.contains(cursor)) {
                out.add(cursor);
            }
            cursor = cursor.plus(Duration.ofHours(1));
        }
        return out;
    }

    @Transactional
    public ReservaDto crear(ReservaDto dto) {
        validar(dto);
        Reserva.Estado estado = dto.estado == Reserva.Estado.RESERVADA
                ? Reserva.Estado.RESERVADA
                : Reserva.Estado.PENDIENTE;
        int mins = dto.minutosOcupados > 0 ? dto.minutosOcupados : estimarMinutos(dto.kmEstimado);

        // Agenda confirmada: no guardar si choca; devolver propuestas
        if (estado == Reserva.Estado.RESERVADA && hayConflicto(dto.cuando, mins, null)) {
            ReservaDto out = new ReservaDto();
            out.cuando = dto.cuando;
            out.cliente = dto.cliente;
            out.estado = Reserva.Estado.PENDIENTE;
            out.conflicto = true;
            out.propuestas = proponerHorarios(dto.cuando, mins, null);
            out.minutosOcupados = mins;
            return out;
        }

        Reserva r = new Reserva();
        aplicar(r, dto);
        r.setEstado(estado);
        r.setCreadaEn(Instant.now());
        return enriquecer(repo.save(r));
    }

    @Transactional
    public ReservaDto actualizar(Long id, ReservaDto dto) {
        Reserva r = obtener(id);
        if (r.getEstado() != Reserva.Estado.PENDIENTE && r.getEstado() != Reserva.Estado.RESERVADA) {
            throw new IllegalArgumentException("Solo se editan pendientes o confirmadas");
        }
        validar(dto);
        aplicar(r, dto);
        return enriquecer(repo.save(r));
    }

    /**
     * Confirma pendiente → agenda.
     * Si el horario está ocupado y no mandan otro, no confirma: regresa propuestas.
     * Si mandan {@code nuevoCuando}, lo aplica y confirma si queda libre.
     */
    @Transactional
    public ReservaDto confirmar(Long id, Instant nuevoCuando) {
        Reserva r = obtener(id);
        if (r.getEstado() != Reserva.Estado.PENDIENTE) {
            throw new IllegalArgumentException("Solo se confirman cotizaciones pendientes");
        }
        if (nuevoCuando != null) {
            r.setCuando(nuevoCuando);
        }
        if (hayConflicto(r.getCuando(), r.getMinutosOcupados(), r.getId())) {
            ReservaDto out = ReservaDto.de(r);
            out.conflicto = true;
            out.propuestas = proponerHorarios(r.getCuando(), r.getMinutosOcupados(), r.getId());
            return out;
        }
        r.setEstado(Reserva.Estado.RESERVADA);
        return enriquecer(repo.save(r));
    }

    @Transactional
    public ReservaDto cancelar(Long id) {
        Reserva r = obtener(id);
        r.setEstado(Reserva.Estado.CANCELADA);
        return ReservaDto.de(repo.save(r));
    }

    @Transactional
    public ReservaDto marcarHecha(Long id) {
        Reserva r = obtener(id);
        if (r.getEstado() != Reserva.Estado.RESERVADA) {
            throw new IllegalArgumentException("Solo se marcan hechas las de la agenda");
        }
        r.setEstado(Reserva.Estado.HECHA);
        return ReservaDto.de(repo.save(r));
    }

    private ReservaDto enriquecer(Reserva r) {
        ReservaDto dto = ReservaDto.de(r);
        dto.conflicto = hayConflicto(r.getCuando(), r.getMinutosOcupados(), r.getId());
        if (dto.conflicto) {
            dto.propuestas = proponerHorarios(r.getCuando(), r.getMinutosOcupados(), r.getId());
        }
        return dto;
    }

    private ReservaDto conConflicto(Reserva r) {
        ReservaDto dto = ReservaDto.de(r);
        if (r.getEstado() == Reserva.Estado.RESERVADA || r.getEstado() == Reserva.Estado.PENDIENTE) {
            dto.conflicto = hayConflicto(r.getCuando(), r.getMinutosOcupados(), r.getId());
        }
        return dto;
    }

    private ReservaDto conConflictoYPropuestas(Reserva r) {
        ReservaDto dto = conConflicto(r);
        if (dto.conflicto) {
            dto.propuestas = proponerHorarios(r.getCuando(), r.getMinutosOcupados(), r.getId());
        }
        return dto;
    }

    private void validar(ReservaDto dto) {
        if (dto == null || dto.cuando == null) {
            throw new IllegalArgumentException("Falta la fecha y hora");
        }
        if (dto.cliente == null || dto.cliente.isBlank()) {
            throw new IllegalArgumentException("Pon el nombre del cliente");
        }
    }

    private void aplicar(Reserva r, ReservaDto dto) {
        r.setCuando(dto.cuando);
        r.setCliente(dto.cliente.trim());
        r.setTelefono(texto(dto.telefono));
        r.setDestinoTexto(texto(dto.destinoTexto));
        r.setKmEstimado(nvl(dto.kmEstimado));
        r.setCobroEstimado(nvl(dto.cobroEstimado).setScale(0, RoundingMode.HALF_UP));
        r.setCasetas(nvl(dto.casetas).setScale(0, RoundingMode.HALF_UP));
        r.setNocturno(dto.nocturno);
        int mins = dto.minutosOcupados > 0 ? dto.minutosOcupados : estimarMinutos(dto.kmEstimado);
        r.setMinutosOcupados(mins);
        r.setNotas(texto(dto.notas));
    }

    private static int estimarMinutos(BigDecimal km) {
        double k = km == null ? 0 : km.doubleValue();
        return (int) Math.max(45, Math.round(k * 2.2 + 40));
    }

    private Reserva obtener(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reserva no encontrada"));
    }

    private static String texto(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
