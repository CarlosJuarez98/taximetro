package com.taxi.repositorio;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.CajaDia;

public interface CajaDiaRepository extends JpaRepository<CajaDia, Long> {

    Optional<CajaDia> findByFechaAndUsuarioId(LocalDate fecha, Long usuarioId);
}
