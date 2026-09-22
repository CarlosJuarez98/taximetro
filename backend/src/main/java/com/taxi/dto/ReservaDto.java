package com.taxi.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.taxi.modelo.Reserva;

public class ReservaDto {

    public Long id;
    public Instant cuando;
    public String cliente;
    public String telefono;
    public String destinoTexto;
    public BigDecimal kmEstimado;
    public BigDecimal cobroEstimado;
    public BigDecimal casetas;
    public boolean nocturno;
    public int minutosOcupados;
    public String notas;
    public Reserva.Estado estado;
    public Instant creadaEn;
    /** true si choca con otra reserva confirmada. */
    public boolean conflicto;
    /** Horarios libres para ofrecer al cliente si hay empalme. */
    public List<Instant> propuestas;

    public static ReservaDto de(Reserva r) {
        ReservaDto dto = new ReservaDto();
        dto.id = r.getId();
        dto.cuando = r.getCuando();
        dto.cliente = r.getCliente();
        dto.telefono = r.getTelefono();
        dto.destinoTexto = r.getDestinoTexto();
        dto.kmEstimado = r.getKmEstimado();
        dto.cobroEstimado = r.getCobroEstimado();
        dto.casetas = r.getCasetas();
        dto.nocturno = r.isNocturno();
        dto.minutosOcupados = r.getMinutosOcupados();
        dto.notas = r.getNotas();
        dto.estado = r.getEstado();
        dto.creadaEn = r.getCreadaEn();
        return dto;
    }
}
