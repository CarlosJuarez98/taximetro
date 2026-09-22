package com.taxi.dto;

import java.math.BigDecimal;

public class TarifaDto {

    public Long id;
    public String nombre;
    public BigDecimal banderazo;
    public BigDecimal precioPorKm;
    public BigDecimal precioEsperaMinuto;
    public BigDecimal tarifaMinima;
    public BigDecimal umbralEsperaKmh;
    public BigDecimal recargoNocturnoPct;
    public int nocheDesdeHora;
    public int nocheHastaHora;
    public boolean redondearPesos;
}
