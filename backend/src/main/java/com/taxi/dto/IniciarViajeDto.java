package com.taxi.dto;

import java.math.BigDecimal;
import java.util.List;

public class IniciarViajeDto {

    public double origenLat;
    public double origenLng;
    public String origenTexto;
    public Double destinoLat;
    public Double destinoLng;
    public String destinoTexto;
    public List<double[]> ruta;
    public BigDecimal cobroEstimado;
}
