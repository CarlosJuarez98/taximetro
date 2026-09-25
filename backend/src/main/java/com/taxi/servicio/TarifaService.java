package com.taxi.servicio;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.taxi.dto.TarifaDto;
import com.taxi.modelo.Tarifa;
import com.taxi.repositorio.TarifaRepository;
import com.taxi.seguridad.AuthSupport;

import jakarta.annotation.PostConstruct;

@Service
public class TarifaService {

    private final TarifaRepository repo;
    private final AuthSupport auth;

    public TarifaService(TarifaRepository repo, AuthSupport auth) {
        this.repo = repo;
        this.auth = auth;
    }

    @PostConstruct
    void semilla() {
        if (repo.count() == 0) {
            Tarifa t = nuevaDefault(null);
            t.setNombre("Viaja en el Rojo");
            repo.save(t);
            return;
        }
        Tarifa t = repo.findFirstByUsuarioIdIsNullOrderByIdAsc().orElseGet(() -> repo.findAll().get(0));
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

    /** Tarifa del taxista actual (clona plantilla si es la primera vez). */
    public Tarifa actual() {
        Long uid = auth.actualId();
        return repo.findFirstByUsuarioId(uid).orElseGet(() -> clonarPara(uid));
    }

    private Tarifa clonarPara(Long uid) {
        Tarifa plantilla = repo.findFirstByUsuarioIdIsNullOrderByIdAsc()
                .or(() -> repo.findAll().stream().findFirst())
                .orElseGet(() -> nuevaDefault(null));
        Tarifa copia = nuevaDefault(uid);
        copia.setNombre(plantilla.getNombre());
        copia.setBanderazo(plantilla.getBanderazo());
        copia.setPrecioPorKm(plantilla.getPrecioPorKm());
        copia.setPrecioEsperaMinuto(plantilla.getPrecioEsperaMinuto());
        copia.setTarifaMinima(plantilla.getTarifaMinima());
        copia.setUmbralEsperaKmh(plantilla.getUmbralEsperaKmh());
        copia.setRecargoNocturnoPct(plantilla.getRecargoNocturnoPct());
        copia.setNocheDesdeHora(plantilla.getNocheDesdeHora());
        copia.setNocheHastaHora(plantilla.getNocheHastaHora());
        copia.setRedondearPesos(plantilla.isRedondearPesos());
        return repo.save(copia);
    }

    private static Tarifa nuevaDefault(Long uid) {
        Tarifa t = new Tarifa();
        t.setUsuarioId(uid);
        t.setNombre("Viaja en el Rojo");
        t.setBanderazo(new BigDecimal("25.00"));
        t.setPrecioPorKm(new BigDecimal("5.00"));
        t.setPrecioEsperaMinuto(new BigDecimal("1.50"));
        t.setTarifaMinima(new BigDecimal("50.00"));
        t.setUmbralEsperaKmh(new BigDecimal("12.00"));
        t.setRecargoNocturnoPct(new BigDecimal("20.00"));
        t.setNocheDesdeHora(22);
        t.setNocheHastaHora(6);
        t.setRedondearPesos(true);
        return t;
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
        t.setRedondearPesos(dto.redondearPesos);
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
        dto.redondearPesos = t.isRedondearPesos();
        return dto;
    }
}
