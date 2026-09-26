package com.taxi.controlador;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.Test;

class HealthControllerTest {

    @Test
    void healthUp() {
        Map<String, Object> body = new HealthController().health();
        assertEquals("UP", body.get("status"));
        assertEquals("taxi-huamantla", body.get("app"));
    }
}
