package com.taxi.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = { "/", "/viaje", "/hoy", "/tarifas", "/agenda", "/login", "/usuarios" })
    public String forwardSpa() {
        return "forward:/index.html";
    }
}
