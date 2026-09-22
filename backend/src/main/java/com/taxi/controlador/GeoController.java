package com.taxi.controlador;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.taxi.dto.LugarDto;
import com.taxi.servicio.GeoService;

@RestController
@RequestMapping("/api/geo")
public class GeoController {

    private final GeoService geo;

    public GeoController(GeoService geo) {
        this.geo = geo;
    }

    @GetMapping("/buscar")
    public LugarDto.Lista buscar(@RequestParam String q) {
        return geo.buscar(q);
    }

    @GetMapping("/reverso")
    public LugarDto reverso(@RequestParam double lat, @RequestParam double lng) {
        return geo.reverso(lat, lng);
    }

    @GetMapping("/salud")
    public Map<String, Object> salud() {
        return Map.of(
                "ok", true,
                "ciudad", "Huamantla",
                "lat", GeoService.HUAMANTLA_LAT,
                "lng", GeoService.HUAMANTLA_LNG);
    }
}
