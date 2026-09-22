package com.taxi.repositorio;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.Reserva;

public interface ReservaRepository extends JpaRepository<Reserva, Long> {

    List<Reserva> findByEstadoAndCuandoGreaterThanEqualOrderByCuandoAsc(Reserva.Estado estado, Instant desde);

    List<Reserva> findByCuandoBetweenOrderByCuandoAsc(Instant desde, Instant hasta);

    List<Reserva> findByEstadoAndCuandoBetweenOrderByCuandoAsc(
            Reserva.Estado estado, Instant desde, Instant hasta);

    List<Reserva> findTop40ByOrderByCuandoDesc();
}
