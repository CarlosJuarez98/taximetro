package com.taxi.servicio;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.taxi.dto.TarifaDto;
import com.taxi.modelo.Tarifa;
import com.taxi.repositorio.TarifaRepository;

import jakarta.annotation.PostConstruct;

@Service
public class TarifaService {

    private final TarifaRepository repo;

    public TarifaService(TarifaRepository repo) {
        this.repo = repo;
    }

    @PostConstruct
    void semilla() {
        if (repo.count() == 0) {
            Tarifa t = new Tarifa();
            t.setNombre("Viaja en el Rojo");
            repo.save(t);
            return;
        }
        // Migra tarifas anteriores a la equilibrada (competitiva, no cara)
        Tarifa t = actual();
        boolean viejaAlta = eq(t.getBanderazo(), "40.00") && eq(t.getPrecioPorKm(), "6.50");
        boolean viejaBaja = eq(t.getBanderazo(), "20.00") && eq(t.getPrecioPorKm(), "4.50");
        if (viejaAlta || viejaBaja) {
            t.setBanderazo(new BigDecimal("25.00"));
            t.setPrecioPorKm(new BigDecimal("5.00"));
            t.setTarifaMinima(new BigDecimal("50.00"));
            repo.save(t);
        }
    }

    private static boolean eq(BigDecimal v, String esperado) {
        return v != null && v.compareTo(new BigDecimal(esperado)) == 0;
    }

    public Tarifa actual() {
        return repo.findAll().stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No hay tarifa configurada"));
    }

    public TarifaDto leer() {
        return aDto(actual());
    }

    @Transactional
    public TarifaDto guardar(TarifaDto dto) {
        Tarifa t = actual();
        if (dto.nombre != null && !dto.nombre.isBlank()) {
            t.setNombre(dto.nombre.trim());
        }
        if (dto.banderazo != null) {
            t.setBanderazo(dto.banderazo);
        }
        if (dto.precioPorKm != null) {
            t.setPrecioPorKm(dto.precioPorKm);
        }
        if (dto.precioEsperaMinuto != null) {
            t.setPrecioEsperaMinuto(dto.precioEsperaMinuto);
        }
        if (dto.tarifaMinima != null) {
            t.setTarifaMinima(dto.tarifaMinima);
        }
        if (dto.umbralEsperaKmh != null) {
            t.setUmbralEsperaKmh(dto.umbralEsperaKmh);
        }
        if (dto.recargoNocturnoPct != null) {
            t.setRecargoNocturnoPct(dto.recargoNocturnoPct);
        }
        t.setNocheDesdeHora(dto.nocheDesdeHora);
        t.setNocheHastaHora(dto.nocheHastaHora);
        t.setRedondearPesos(true);
        return aDto(repo.save(t));
    }

    public static TarifaDto aDto(Tarifa t) {
        TarifaDto dto = new TarifaDto();
        dto.id = t.getId();
        dto.nombre = t.getNombre();
        dto.banderazo = t.getBanderazo();
        dto.precioPorKm = t.getPrecioPorKm();
        dto.precioEsperaMinuto = t.getPrecioEsperaMinuto();
        dto.tarifaMinima = t.getTarifaMinima();
        dto.umbralEsperaKmh = t.getUmbralEsperaKmh();
        dto.recargoNocturnoPct = t.getRecargoNocturnoPct();
        dto.nocheDesdeHora = t.getNocheDesdeHora();
        dto.nocheHastaHora = t.getNocheHastaHora();
        dto.redondearPesos = true;
        return dto;
    }
}
