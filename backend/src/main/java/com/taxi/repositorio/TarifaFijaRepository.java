package com.taxi.repositorio;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.TarifaFija;

public interface TarifaFijaRepository extends JpaRepository<TarifaFija, Long> {

    List<TarifaFija> findByUsuarioIdAndActivoTrueOrderByNombreAsc(Long usuarioId);

    List<TarifaFija> findByUsuarioIdIsNullAndActivoTrueOrderByNombreAsc();
}
