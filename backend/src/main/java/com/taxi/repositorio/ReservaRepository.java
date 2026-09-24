package com.taxi.repositorio;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.Reserva;

public interface ReservaRepository extends JpaRepository<Reserva, Long> {

    List<Reserva> findByUsuarioIdAndEstadoAndCuandoGreaterThanEqualOrderByCuandoAsc(
            Long usuarioId, Reserva.Estado estado, Instant desde);

    List<Reserva> findByUsuarioIdAndCuandoBetweenOrderByCuandoAsc(Long usuarioId, Instant desde, Instant hasta);

    List<Reserva> findByUsuarioIdAndEstadoAndCuandoBetweenOrderByCuandoAsc(
            Long usuarioId, Reserva.Estado estado, Instant desde, Instant hasta);

    List<Reserva> findTop40ByUsuarioIdOrderByCuandoDesc(Long usuarioId);

    Optional<Reserva> findByIdAndUsuarioId(Long id, Long usuarioId);
}
