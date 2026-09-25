package com.taxi.dto;

import java.math.BigDecimal;

import com.taxi.modelo.TarifaFija;

public class TarifaFijaDto {

    public Long id;
    public String nombre;
    public BigDecimal cobro;
    public BigDecimal km;
    public String notas;
    public boolean activo = true;

    public static TarifaFijaDto de(TarifaFija t) {
        TarifaFijaDto d = new TarifaFijaDto();
        d.id = t.getId();
        d.nombre = t.getNombre();
        d.cobro = t.getCobro();
        d.km = t.getKm();
        d.notas = t.getNotas();
        d.activo = t.isActivo();
        return d;
    }
}
