package com.taxi.repositorio;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.taxi.modelo.PuntoGps;
import com.taxi.modelo.Viaje;

public interface PuntoGpsRepository extends JpaRepository<PuntoGps, Long> {

    List<PuntoGps> findByViajeOrderByRegistradoEnAsc(Viaje viaje);

    void deleteByViaje(Viaje viaje);
}
