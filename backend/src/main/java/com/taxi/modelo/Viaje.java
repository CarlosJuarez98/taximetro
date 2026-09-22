package com.taxi.modelo;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "TX_VIAJE")
public class Viaje {

    public enum Estado {
        EN_CURSO, CERRADO, CANCELADO
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Estado estado = Estado.EN_CURSO;

    @Column(nullable = false)
    private Instant inicio = Instant.now();

    private Instant fin;

    @Column(nullable = false)
    private double origenLat;

    @Column(nullable = false)
    private double origenLng;

    @Column(length = 240)
    private String origenTexto;

    private Double destinoLat;
    private Double destinoLng;

    @Column(length = 240)
    private String destinoTexto;

    @Column(precision = 14, scale = 2)
    private BigDecimal distanciaMetros = BigDecimal.ZERO;

    private long duracionSegundos;
    private long segundosEspera;

    @Column(precision = 12, scale = 2)
    private BigDecimal cobro = BigDecimal.ZERO;

    /** Casetas que absorbe el cliente (ida y, si aplica, regreso). */
    @Column(precision = 12, scale = 2)
    private BigDecimal casetas = BigDecimal.ZERO;

    @Column(length = 400)
    private String notas;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String rutaGeoJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Estado getEstado() {
        return estado;
    }

    public void setEstado(Estado estado) {
        this.estado = estado;
    }

    public Instant getInicio() {
        return inicio;
    }

    public void setInicio(Instant inicio) {
        this.inicio = inicio;
    }

    public Instant getFin() {
        return fin;
    }

    public void setFin(Instant fin) {
        this.fin = fin;
    }

    public double getOrigenLat() {
        return origenLat;
    }

    public void setOrigenLat(double origenLat) {
        this.origenLat = origenLat;
    }

    public double getOrigenLng() {
        return origenLng;
    }

    public void setOrigenLng(double origenLng) {
        this.origenLng = origenLng;
    }

    public String getOrigenTexto() {
        return origenTexto;
    }

    public void setOrigenTexto(String origenTexto) {
        this.origenTexto = origenTexto;
    }

    public Double getDestinoLat() {
        return destinoLat;
    }

    public void setDestinoLat(Double destinoLat) {
        this.destinoLat = destinoLat;
    }

    public Double getDestinoLng() {
        return destinoLng;
    }

    public void setDestinoLng(Double destinoLng) {
        this.destinoLng = destinoLng;
    }

    public String getDestinoTexto() {
        return destinoTexto;
    }

    public void setDestinoTexto(String destinoTexto) {
        this.destinoTexto = destinoTexto;
    }

    public BigDecimal getDistanciaMetros() {
        return distanciaMetros;
    }

    public void setDistanciaMetros(BigDecimal distanciaMetros) {
        this.distanciaMetros = distanciaMetros;
    }

    public long getDuracionSegundos() {
        return duracionSegundos;
    }

    public void setDuracionSegundos(long duracionSegundos) {
        this.duracionSegundos = duracionSegundos;
    }

    public long getSegundosEspera() {
        return segundosEspera;
    }

    public void setSegundosEspera(long segundosEspera) {
        this.segundosEspera = segundosEspera;
    }

    public BigDecimal getCobro() {
        return cobro;
    }

    public void setCobro(BigDecimal cobro) {
        this.cobro = cobro;
    }

    public BigDecimal getCasetas() {
        return casetas;
    }

    public void setCasetas(BigDecimal casetas) {
        this.casetas = casetas;
    }

    public String getNotas() {
        return notas;
    }

    public void setNotas(String notas) {
        this.notas = notas;
    }

    public String getRutaGeoJson() {
        return rutaGeoJson;
    }

    public void setRutaGeoJson(String rutaGeoJson) {
        this.rutaGeoJson = rutaGeoJson;
    }
}
