package com.taxi.repositorio;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.Viaje;

public interface ViajeRepository extends JpaRepository<Viaje, Long> {

    Optional<Viaje> findFirstByUsuarioIdAndEstadoOrderByInicioDesc(Long usuarioId, Viaje.Estado estado);

    List<Viaje> findByUsuarioIdAndInicioGreaterThanEqualOrderByInicioDesc(Long usuarioId, Instant desde);

    List<Viaje> findTop80ByUsuarioIdOrderByInicioDesc(Long usuarioId);

    Optional<Viaje> findByIdAndUsuarioId(Long id, Long usuarioId);
}
