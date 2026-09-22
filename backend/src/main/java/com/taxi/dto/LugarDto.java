package com.taxi.dto;

import java.util.ArrayList;
import java.util.List;

public class LugarDto {

    public String etiqueta;
    public double lat;
    public double lng;

    public static class Lista {
        public List<LugarDto> lugares = new ArrayList<>();
    }
}
