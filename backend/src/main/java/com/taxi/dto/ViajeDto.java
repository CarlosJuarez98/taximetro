package com.taxi.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.taxi.modelo.Viaje;

public class ViajeDto {

    public Long id;
    public Viaje.Estado estado;
    public Instant inicio;
    public Instant fin;
    public double origenLat;
    public double origenLng;
    public String origenTexto;
    public Double destinoLat;
    public Double destinoLng;
    public String destinoTexto;
    public BigDecimal distanciaMetros;
    public long duracionSegundos;
    public long segundosEspera;
    public BigDecimal cobro;
    public BigDecimal casetas;
    public String notas;
    public List<double[]> ruta;
    public String formaPago;
    public Long reservaId;

    public static ViajeDto de(Viaje v, List<double[]> ruta) {
        ViajeDto dto = new ViajeDto();
        dto.id = v.getId();
        dto.estado = v.getEstado();
        dto.inicio = v.getInicio();
        dto.fin = v.getFin();
        dto.origenLat = v.getOrigenLat();
        dto.origenLng = v.getOrigenLng();
        dto.origenTexto = v.getOrigenTexto();
        dto.destinoLat = v.getDestinoLat();
        dto.destinoLng = v.getDestinoLng();
        dto.destinoTexto = v.getDestinoTexto();
        dto.distanciaMetros = v.getDistanciaMetros();
        dto.duracionSegundos = v.getDuracionSegundos();
        dto.segundosEspera = v.getSegundosEspera();
        dto.cobro = v.getCobro();
        dto.casetas = v.getCasetas() == null ? BigDecimal.ZERO : v.getCasetas();
        dto.notas = v.getNotas();
        dto.ruta = ruta;
        dto.formaPago = v.getFormaPago() == null ? "EFECTIVO" : v.getFormaPago();
        dto.reservaId = v.getReservaId();
        return dto;
    }
}
