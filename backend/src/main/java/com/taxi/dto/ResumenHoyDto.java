package com.taxi.dto;

import java.math.BigDecimal;

public class ResumenHoyDto {

    public long viajes;
    public BigDecimal cobrado = BigDecimal.ZERO;
    public BigDecimal cobradoEfectivo = BigDecimal.ZERO;
    public BigDecimal cobradoTransfer = BigDecimal.ZERO;
    public BigDecimal km = BigDecimal.ZERO;
    public long minutos;

    /** Cambio / billete con el que arrancaste. */
    public BigDecimal fondoInicial = BigDecimal.ZERO;
    /** fondo + efectivo − gastos → cuánto debería haber en la caja física. */
    public BigDecimal esperadoEnCaja = BigDecimal.ZERO;
    public BigDecimal gastosGasolina = BigDecimal.ZERO;
    public BigDecimal gastosOtros = BigDecimal.ZERO;
    /** cobrado − gasolina − otros. */
    public BigDecimal neto = BigDecimal.ZERO;
    /** Lo que contaste al cortar (null si aún no). */
    public BigDecimal conteoReal;
    /** conteo − esperado (positivo = sobra, negativo = falta). */
    public BigDecimal diferencia;
    public boolean cortada;
}
