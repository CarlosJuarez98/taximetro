package com.taxi.repositorio;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.Tarifa;

public interface TarifaRepository extends JpaRepository<Tarifa, Long> {

    Optional<Tarifa> findFirstByUsuarioId(Long usuarioId);

    Optional<Tarifa> findFirstByUsuarioIdIsNullOrderByIdAsc();
}
