package com.taxi.repositorio;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.Tarifa;

public interface TarifaRepository extends JpaRepository<Tarifa, Long> {
}
