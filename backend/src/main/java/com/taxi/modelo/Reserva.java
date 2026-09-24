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
import jakarta.persistence.Table;

@Entity
@Table(name = "TX_RESERVA")
public class Reserva {

    public enum Estado {
        /** Cotización / aún no confirmada con el cliente. */
        PENDIENTE,
        /** Confirmada: ocupa hueco en la agenda. */
        RESERVADA,
        HECHA,
        CANCELADA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant cuando;

    @Column(nullable = false, length = 120)
    private String cliente = "";

    @Column(length = 40)
    private String telefono;

    @Column(length = 240)
    private String destinoTexto;

    @Column(precision = 10, scale = 2)
    private BigDecimal kmEstimado = BigDecimal.ZERO;

    @Column(precision = 12, scale = 2)
    private BigDecimal cobroEstimado = BigDecimal.ZERO;

    @Column(precision = 12, scale = 2)
    private BigDecimal casetas = BigDecimal.ZERO;

    private boolean nocturno;

    /** Minutos estimados ocupados (viaje + margen). */
    private int minutosOcupados = 60;

    @Column(length = 400)
    private String notas;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    private Estado estado = Estado.RESERVADA;

    @Column(nullable = false)
    private Instant creadaEn = Instant.now();

    @Column(name = "usuario_id")
    private Long usuarioId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getCuando() {
        return cuando;
    }

    public void setCuando(Instant cuando) {
        this.cuando = cuando;
    }

    public String getCliente() {
        return cliente;
    }

    public void setCliente(String cliente) {
        this.cliente = cliente;
    }

    public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    public String getDestinoTexto() {
        return destinoTexto;
    }

    public void setDestinoTexto(String destinoTexto) {
        this.destinoTexto = destinoTexto;
    }

    public BigDecimal getKmEstimado() {
        return kmEstimado;
    }

    public void setKmEstimado(BigDecimal kmEstimado) {
        this.kmEstimado = kmEstimado;
    }

    public BigDecimal getCobroEstimado() {
        return cobroEstimado;
    }

    public void setCobroEstimado(BigDecimal cobroEstimado) {
        this.cobroEstimado = cobroEstimado;
    }

    public BigDecimal getCasetas() {
        return casetas;
    }

    public void setCasetas(BigDecimal casetas) {
        this.casetas = casetas;
    }

    public boolean isNocturno() {
        return nocturno;
    }

    public void setNocturno(boolean nocturno) {
        this.nocturno = nocturno;
    }

    public int getMinutosOcupados() {
        return minutosOcupados;
    }

    public void setMinutosOcupados(int minutosOcupados) {
        this.minutosOcupados = minutosOcupados;
    }

    public String getNotas() {
        return notas;
    }

    public void setNotas(String notas) {
        this.notas = notas;
    }

    public Estado getEstado() {
        return estado;
    }

    public void setEstado(Estado estado) {
        this.estado = estado;
    }

    public Instant getCreadaEn() {
        return creadaEn;
    }

    public void setCreadaEn(Instant creadaEn) {
        this.creadaEn = creadaEn;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }
}
