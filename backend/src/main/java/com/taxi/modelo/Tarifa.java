package com.taxi.modelo;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "TX_TARIFA")
public class Tarifa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String nombre = "Huamantla";

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal banderazo = new BigDecimal("25.00");

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal precioPorKm = new BigDecimal("5.00");

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal precioEsperaMinuto = new BigDecimal("1.50");

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal tarifaMinima = new BigDecimal("50.00");

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal umbralEsperaKmh = new BigDecimal("12.00");

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal recargoNocturnoPct = new BigDecimal("20.00");

    @Column(nullable = false)
    private int nocheDesdeHora = 22;

    @Column(nullable = false)
    private int nocheHastaHora = 6;

    @Column(nullable = false)
    private boolean redondearPesos = true;

    /** Dueño de esta tarifa (cada taxista la suya). Null = plantilla legacy. */
    @Column(name = "usuario_id")
    private Long usuarioId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public BigDecimal getBanderazo() {
        return banderazo;
    }

    public void setBanderazo(BigDecimal banderazo) {
        this.banderazo = banderazo;
    }

    public BigDecimal getPrecioPorKm() {
        return precioPorKm;
    }

    public void setPrecioPorKm(BigDecimal precioPorKm) {
        this.precioPorKm = precioPorKm;
    }

    public BigDecimal getPrecioEsperaMinuto() {
        return precioEsperaMinuto;
    }

    public void setPrecioEsperaMinuto(BigDecimal precioEsperaMinuto) {
        this.precioEsperaMinuto = precioEsperaMinuto;
    }

    public BigDecimal getTarifaMinima() {
        return tarifaMinima;
    }

    public void setTarifaMinima(BigDecimal tarifaMinima) {
        this.tarifaMinima = tarifaMinima;
    }

    public BigDecimal getUmbralEsperaKmh() {
        return umbralEsperaKmh;
    }

    public void setUmbralEsperaKmh(BigDecimal umbralEsperaKmh) {
        this.umbralEsperaKmh = umbralEsperaKmh;
    }

    public BigDecimal getRecargoNocturnoPct() {
        return recargoNocturnoPct;
    }

    public void setRecargoNocturnoPct(BigDecimal recargoNocturnoPct) {
        this.recargoNocturnoPct = recargoNocturnoPct;
    }

    public int getNocheDesdeHora() {
        return nocheDesdeHora;
    }

    public void setNocheDesdeHora(int nocheDesdeHora) {
        this.nocheDesdeHora = nocheDesdeHora;
    }

    public int getNocheHastaHora() {
        return nocheHastaHora;
    }

    public void setNocheHastaHora(int nocheHastaHora) {
        this.nocheHastaHora = nocheHastaHora;
    }

    public boolean isRedondearPesos() {
        return redondearPesos;
    }

    public void setRedondearPesos(boolean redondearPesos) {
        this.redondearPesos = redondearPesos;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }
}
