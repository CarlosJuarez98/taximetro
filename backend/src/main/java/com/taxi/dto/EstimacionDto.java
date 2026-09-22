package com.taxi.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class EstimacionDto {

    public double origenLat;
    public double origenLng;
    public Double destinoLat;
    public Double destinoLng;
    public String destinoTexto;

    public static class Respuesta {
        public double distanciaMetros;
        public long duracionSegundos;
        public BigDecimal cobroEstimado;
        public String origenTexto;
        public String destinoTexto;
        public List<double[]> ruta = new ArrayList<>();
        public boolean aproximada;
    }
}
