package com.taxi.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.taxi.dto.TarifaFijaDto;
import com.taxi.modelo.TarifaFija;
import com.taxi.repositorio.TarifaFijaRepository;
import com.taxi.seguridad.AuthSupport;

import jakarta.annotation.PostConstruct;

@Service
public class TarifaFijaService {

    private final TarifaFijaRepository repo;
    private final AuthSupport auth;

    public TarifaFijaService(TarifaFijaRepository repo, AuthSupport auth) {
        this.repo = repo;
        this.auth = auth;
    }

    @PostConstruct
    void semillaGlobalSiVacio() {
        if (repo.count() > 0) {
            return;
        }
        // Semilla plantilla (usuario null); cada taxista la copia al listar
        sembrar(null, "Apizaco", 180, 28.0);
        sembrar(null, "Puebla", 450, 70.0);
        sembrar(null, "ADO / Central", 80, 8.0);
        sembrar(null, "Hospital", 60, 5.0);
        sembrar(null, "Feria (evento)", 100, null);
    }

    private void sembrar(Long uid, String nombre, double cobro, Double km) {
        TarifaFija t = new TarifaFija();
        t.setUsuarioId(uid);
        t.setNombre(nombre);
        t.setCobro(BigDecimal.valueOf(cobro).setScale(0, RoundingMode.HALF_UP));
        if (km != null) {
            t.setKm(BigDecimal.valueOf(km));
        }
        t.setActivo(true);
        repo.save(t);
    }

    public List<TarifaFijaDto> listar() {
        Long uid = auth.actualId();
        List<TarifaFija> mias = repo.findByUsuarioIdAndActivoTrueOrderByNombreAsc(uid);
        if (!mias.isEmpty()) {
            return mias.stream().map(TarifaFijaDto::de).toList();
        }
        // Primera vez: clona plantillas globales
        List<TarifaFija> plantilla = repo.findByUsuarioIdIsNullAndActivoTrueOrderByNombreAsc();
        if (plantilla.isEmpty()) {
            return List.of();
        }
        for (TarifaFija p : plantilla) {
            TarifaFija c = new TarifaFija();
            c.setUsuarioId(uid);
            c.setNombre(p.getNombre());
            c.setCobro(p.getCobro());
            c.setKm(p.getKm());
            c.setNotas(p.getNotas());
            c.setActivo(true);
            repo.save(c);
        }
        return repo.findByUsuarioIdAndActivoTrueOrderByNombreAsc(uid).stream()
                .map(TarifaFijaDto::de)
                .toList();
    }

    @Transactional
    public TarifaFijaDto guardar(TarifaFijaDto dto) {
        Long uid = auth.actualId();
        TarifaFija t;
        if (dto.id != null) {
            t = repo.findById(dto.id)
                    .filter(x -> uid.equals(x.getUsuarioId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarifa fija no encontrada"));
        } else {
            t = new TarifaFija();
            t.setUsuarioId(uid);
        }
        if (dto.nombre == null || dto.nombre.isBlank()) {
            throw new IllegalArgumentException("Pon un nombre (ej. Apizaco)");
        }
        if (dto.cobro == null || dto.cobro.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Pon el cobro");
        }
        t.setNombre(dto.nombre.trim());
        t.setCobro(dto.cobro.setScale(0, RoundingMode.HALF_UP));
        t.setKm(dto.km);
        t.setNotas(dto.notas == null || dto.notas.isBlank() ? null : dto.notas.trim());
        t.setActivo(true);
        return TarifaFijaDto.de(repo.save(t));
    }

    @Transactional
    public void eliminar(Long id) {
        Long uid = auth.actualId();
        TarifaFija t = repo.findById(id)
                .filter(x -> uid.equals(x.getUsuarioId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarifa fija no encontrada"));
        t.setActivo(false);
        repo.save(t);
    }
}
