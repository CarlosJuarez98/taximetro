package com.taxi.dto;

import java.math.BigDecimal;

public class ResumenHoyDto {

    public long viajes;
    public BigDecimal cobrado = BigDecimal.ZERO;
    public BigDecimal km = BigDecimal.ZERO;
    public long minutos;

    /** Cambio / billete con el que arrancaste. */
    public BigDecimal fondoInicial = BigDecimal.ZERO;
    /** fondo + cobrado → cuánto debería haber en la caja. */
    public BigDecimal esperadoEnCaja = BigDecimal.ZERO;
    /** Lo que contaste al cortar (null si aún no). */
    public BigDecimal conteoReal;
    /** conteo − esperado (positivo = sobra, negativo = falta). */
    public BigDecimal diferencia;
    public boolean cortada;
}
