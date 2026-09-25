package com.taxi.modelo;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "TX_CAJA_DIA",
        uniqueConstraints = @UniqueConstraint(columnNames = { "fecha", "usuario_id" }))
public class CajaDia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(name = "usuario_id")
    private Long usuarioId;

    /** Billete / cambio con el que arrancas el día. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal fondoInicial = BigDecimal.ZERO;

    /** Conteo físico al hacer el corte (null = aún no cortado). */
    @Column(precision = 12, scale = 2)
    private BigDecimal conteoReal;

    private Instant cortadaEn;

    @Column(length = 240)
    private String notas;

    /** Gasolina del día. */
    @Column(precision = 12, scale = 2)
    private BigDecimal gastosGasolina = BigDecimal.ZERO;

    /** Otros gastos (comida, lavado…). */
    @Column(precision = 12, scale = 2)
    private BigDecimal gastosOtros = BigDecimal.ZERO;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public void setFecha(LocalDate fecha) {
        this.fecha = fecha;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public BigDecimal getFondoInicial() {
        return fondoInicial;
    }

    public void setFondoInicial(BigDecimal fondoInicial) {
        this.fondoInicial = fondoInicial;
    }

    public BigDecimal getConteoReal() {
        return conteoReal;
    }

    public void setConteoReal(BigDecimal conteoReal) {
        this.conteoReal = conteoReal;
    }

    public Instant getCortadaEn() {
        return cortadaEn;
    }

    public void setCortadaEn(Instant cortadaEn) {
        this.cortadaEn = cortadaEn;
    }

    public String getNotas() {
        return notas;
    }

    public void setNotas(String notas) {
        this.notas = notas;
    }

    public BigDecimal getGastosGasolina() {
        return gastosGasolina;
    }

    public void setGastosGasolina(BigDecimal gastosGasolina) {
        this.gastosGasolina = gastosGasolina;
    }

    public BigDecimal getGastosOtros() {
        return gastosOtros;
    }

    public void setGastosOtros(BigDecimal gastosOtros) {
        this.gastosOtros = gastosOtros;
    }
}
