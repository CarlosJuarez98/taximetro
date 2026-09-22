package com.taxi.servicio;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriBuilder;

import com.taxi.dto.EstimacionDto;
import com.taxi.dto.LugarDto;

@Service
public class GeoService {

    /** Centro de Huamantla, Tlaxcala. */
    public static final double HUAMANTLA_LAT = 19.3142;
    public static final double HUAMANTLA_LNG = -97.9250;

    /** Lugares fuera del casco de Huamantla: no forzar sesgo local. */
    private static final Set<String> LUGARES_LEJOS = Set.of(
            "apizaco", "puebla", "tlaxcala", "cholula", "santa ana", "chiauhtempan",
            "calpulalpan", "zacatelco", "san martin", "san martín", "texmelucan",
            "cdmx", "ciudad de mexico", "ciudad de méxico", "mexico city",
            "orizaba", "veracruz", "xalapa", "cuautla", "cuernavaca",
            "teziutlan", "teziutlán", "huauchinango", "atlixco", "izucar",
            "tehuacan", "tehuacán", "ameca", "libres", "oriental");

    /**
     * Puntos conocidos de Huamantla (siempre disponibles, sin internet externo).
     * Nominatim/Photon suelen fallar o limitar; esto cubre lo que pide el taxista a diario.
     */
    private static final List<LugarDto> LUGARES_LOCALES = List.of(
            lugar("Zócalo / Plaza Principal", 19.31420, -97.92500),
            lugar("Mercado Municipal", 19.31477, -97.92120),
            lugar("Parroquia de San Luis Obispo", 19.31450, -97.92460),
            lugar("Hospital General de Huamantla", 19.30639, -97.94057),
            lugar("Hospital Regional de Alta Especialidad", 19.31777, -97.93433),
            lugar("Central de Autobuses Huamantla", 19.30980, -97.91850),
            lugar("Terminal ADO / Autobuses", 19.30980, -97.91850),
            lugar("IMSS Huamantla", 19.31280, -97.93050),
            lugar("Cruz Roja Huamantla", 19.31550, -97.92280),
            lugar("Universidad Politécnica de Tlaxcala (UPTx)", 19.33500, -97.91000),
            lugar("TecNM / Instituto Tecnológico de Huamantla", 19.30150, -97.91580),
            lugar("Parque Juárez", 19.31580, -97.92350),
            lugar("Museo Nacional del Títere", 19.31490, -97.92380),
            lugar("Iglesia de la Virgen de la Caridad", 19.31320, -97.92780),
            lugar("Casa de Cultura", 19.31440, -97.92420),
            lugar("Palacio Municipal", 19.31410, -97.92540),
            lugar("Cancha de basquet / Deportiva", 19.31850, -97.92000),
            lugar("Panteón Municipal", 19.30800, -97.93200),
            lugar("Gasolinera Pemex centro", 19.31620, -97.92850),
            lugar("Walmart / Bodega Aurrera zona", 19.32000, -97.93500),
            lugar("Soriana / plaza comercial", 19.31880, -97.93300),
            lugar("Colonia Centro", 19.31420, -97.92500),
            lugar("Ignacio Zaragoza (entrada)", 19.30500, -97.91000),
            lugar("San Francisco Tecoac", 19.34500, -97.95500),
            lugar("San Lucas Tecopilco (rumbo)", 19.28000, -97.96000),
            lugar("Apizaco (centro)", 19.41556, -98.14000),
            lugar("Tlaxcala capital (centro)", 19.31900, -98.23700),
            lugar("Santa Ana Chiautempan", 19.31200, -98.21800),
            lugar("Puebla centro histórico", 19.04370, -98.19800));

    private final RestClient http;

    public GeoService(@Value("${app.geo.user-agent}") String userAgent) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(6));
        this.http = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", userAgent)
                .defaultHeader("Accept-Language", "es-MX,es;q=0.9")
                .build();
    }

    public LugarDto.Lista buscar(String q) {
        LugarDto.Lista lista = new LugarDto.Lista();
        if (q == null || q.isBlank()) {
            return lista;
        }
        String original = q.trim();
        Map<String, LugarDto> unidos = new LinkedHashMap<>();

        for (LugarDto local : filtrarLocales(original)) {
            poner(unidos, local);
        }

        boolean cerca = esBusquedaLocal(original);
        List<LugarDto> photon = buscarPhoton(original, cerca);
        for (LugarDto l : photon) {
            poner(unidos, l);
        }

        if (unidos.size() < 4) {
            for (LugarDto l : buscarNominatim(original, cerca)) {
                poner(unidos, l);
            }
        }

        lista.lugares.addAll(unidos.values());
        if (lista.lugares.size() > 10) {
            lista.lugares = new ArrayList<>(lista.lugares.subList(0, 10));
        }
        return lista;
    }

    private static void poner(Map<String, LugarDto> mapa, LugarDto l) {
        String key = String.format(Locale.US, "%.4f,%.4f", l.lat, l.lng);
        mapa.putIfAbsent(key, l);
    }

    private static List<LugarDto> filtrarLocales(String q) {
        String needle = normalizar(q);
        if (needle.length() < 2) {
            return List.of();
        }
        List<LugarDto> out = new ArrayList<>();
        for (LugarDto l : LUGARES_LOCALES) {
            if (normalizar(l.etiqueta).contains(needle)) {
                out.add(l);
            }
        }
        return out;
    }

    private static String normalizar(String s) {
        return s.toLowerCase(Locale.ROOT)
                .replace('á', 'a').replace('é', 'e').replace('í', 'i')
                .replace('ó', 'o').replace('ú', 'u').replace('ü', 'u')
                .replace('ñ', 'n');
    }

    private static LugarDto lugar(String etiqueta, double lat, double lng) {
        LugarDto l = new LugarDto();
        l.etiqueta = etiqueta + ", Huamantla, Tlaxcala";
        if (etiqueta.toLowerCase(Locale.ROOT).contains("apizaco")
                || etiqueta.toLowerCase(Locale.ROOT).contains("puebla")
                || etiqueta.toLowerCase(Locale.ROOT).contains("tlaxcala capital")
                || etiqueta.toLowerCase(Locale.ROOT).contains("chiautempan")) {
            l.etiqueta = etiqueta;
        }
        l.lat = lat;
        l.lng = lng;
        return l;
    }

    @SuppressWarnings("unchecked")
    private List<LugarDto> buscarPhoton(String original, boolean cerca) {
        List<LugarDto> out = new ArrayList<>();
        String query = original;
        if (cerca
                && !normalizar(query).contains("huamantla")
                && !normalizar(query).contains("tlaxcala")) {
            query = query + " Huamantla";
        }
        final String q = query;
        try {
            Map<String, Object> raw = http.get()
                    .uri(uri -> {
                        UriBuilder b = uri.scheme("https")
                                .host("photon.komoot.io")
                                .path("/api/")
                                .queryParam("q", q)
                                .queryParam("limit", 8)
                                .queryParam("lang", "es");
                        if (cerca) {
                            b.queryParam("lat", HUAMANTLA_LAT)
                                    .queryParam("lon", HUAMANTLA_LNG);
                        }
                        return b.build();
                    })
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (raw == null) {
                return out;
            }
            List<Map<String, Object>> features = (List<Map<String, Object>>) raw.get("features");
            if (features == null) {
                return out;
            }
            for (Map<String, Object> f : features) {
                Map<String, Object> geometry = (Map<String, Object>) f.get("geometry");
                Map<String, Object> props = (Map<String, Object>) f.get("properties");
                if (geometry == null || props == null) {
                    continue;
                }
                List<Number> coords = (List<Number>) geometry.get("coordinates");
                if (coords == null || coords.size() < 2) {
                    continue;
                }
                String country = String.valueOf(props.getOrDefault("countrycode", "MX"));
                if (!"MX".equalsIgnoreCase(country) && props.containsKey("countrycode")) {
                    continue;
                }
                LugarDto l = new LugarDto();
                l.lng = coords.get(0).doubleValue();
                l.lat = coords.get(1).doubleValue();
                l.etiqueta = etiquetaPhoton(props);
                out.add(l);
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static String etiquetaPhoton(Map<String, Object> props) {
        String name = str(props.get("name"));
        String street = str(props.get("street"));
        String housenumber = str(props.get("housenumber"));
        String city = str(props.get("city"));
        if (city.isBlank()) {
            city = str(props.get("locality"));
        }
        if (city.isBlank()) {
            city = str(props.get("county"));
        }
        String state = str(props.get("state"));
        StringBuilder sb = new StringBuilder();
        if (!name.isBlank()) {
            sb.append(name);
        } else if (!street.isBlank()) {
            sb.append(street);
            if (!housenumber.isBlank()) {
                sb.append(' ').append(housenumber);
            }
        } else {
            sb.append("Lugar");
        }
        if (!city.isBlank()) {
            sb.append(", ").append(city);
        }
        if (!state.isBlank()) {
            sb.append(", ").append(state);
        }
        return sb.toString();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private List<LugarDto> buscarNominatim(String original, boolean cerca) {
        List<LugarDto> out = new ArrayList<>();
        String consulta = original;
        if (cerca
                && !consulta.toLowerCase(Locale.ROOT).contains("huamantla")
                && !consulta.toLowerCase(Locale.ROOT).contains("tlaxcala")) {
            consulta = consulta + " Huamantla Tlaxcala";
        }
        final String query = consulta;
        final boolean sesgoLocal = cerca;
        try {
            List<Map<String, Object>> raw = http.get()
                    .uri(uri -> construirNominatim(uri, query, sesgoLocal))
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (raw == null || raw.isEmpty()) {
                if (sesgoLocal) {
                    raw = http.get()
                            .uri(uri -> construirNominatim(uri, original + " México", false))
                            .accept(MediaType.APPLICATION_JSON)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {
                            });
                }
            }
            if (raw == null) {
                return out;
            }
            for (Map<String, Object> item : raw) {
                LugarDto l = new LugarDto();
                l.etiqueta = String.valueOf(item.getOrDefault("display_name", query));
                l.lat = Double.parseDouble(String.valueOf(item.get("lat")));
                l.lng = Double.parseDouble(String.valueOf(item.get("lon")));
                out.add(l);
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static boolean esBusquedaLocal(String q) {
        String lower = q.toLowerCase(Locale.ROOT);
        for (String lugar : LUGARES_LEJOS) {
            if (lower.contains(lugar)) {
                if ("tlaxcala".equals(lugar) && lower.contains("huamantla")) {
                    continue;
                }
                return false;
            }
        }
        return true;
    }

    private static java.net.URI construirNominatim(UriBuilder uri, String query, boolean sesgoLocal) {
        UriBuilder b = uri.scheme("https")
                .host("nominatim.openstreetmap.org")
                .path("/search")
                .queryParam("format", "jsonv2")
                .queryParam("q", query)
                .queryParam("limit", 8)
                .queryParam("addressdetails", 1)
                .queryParam("countrycodes", "mx");
        if (sesgoLocal) {
            b.queryParam("viewbox", "-98.25,19.55,-97.55,19.10")
                    .queryParam("bounded", 0);
        }
        return b.build();
    }

    public LugarDto reverso(double lat, double lng) {
        LugarDto l = new LugarDto();
        l.lat = lat;
        l.lng = lng;
        l.etiqueta = String.format(Locale.US, "Punto %.5f, %.5f", lat, lng);
        try {
            Map<String, Object> raw = http.get()
                    .uri(uri -> uri.scheme("https")
                            .host("nominatim.openstreetmap.org")
                            .path("/reverse")
                            .queryParam("format", "jsonv2")
                            .queryParam("lat", lat)
                            .queryParam("lon", lng)
                            .queryParam("zoom", 17)
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (raw != null && raw.get("display_name") != null) {
                l.etiqueta = String.valueOf(raw.get("display_name"));
            }
        } catch (Exception ignored) {
        }
        return l;
    }

    @SuppressWarnings("unchecked")
    public EstimacionDto.Respuesta ruta(double origenLat, double origenLng, double destinoLat, double destinoLng) {
        EstimacionDto.Respuesta r = new EstimacionDto.Respuesta();
        try {
            String coords = origenLng + "," + origenLat + ";" + destinoLng + "," + destinoLat;
            Map<String, Object> raw = http.get()
                    .uri("https://router.project-osrm.org/route/v1/driving/" + coords
                            + "?overview=full&geometries=geojson")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (raw != null && "Ok".equals(raw.get("code"))) {
                List<Map<String, Object>> routes = (List<Map<String, Object>>) raw.get("routes");
                if (routes != null && !routes.isEmpty()) {
                    Map<String, Object> route = routes.get(0);
                    r.distanciaMetros = ((Number) route.get("distance")).doubleValue();
                    r.duracionSegundos = ((Number) route.get("duration")).longValue();
                    Map<String, Object> geometry = (Map<String, Object>) route.get("geometry");
                    List<List<Number>> coordsGeo = (List<List<Number>>) geometry.get("coordinates");
                    for (List<Number> c : coordsGeo) {
                        r.ruta.add(new double[] { c.get(1).doubleValue(), c.get(0).doubleValue() });
                    }
                    r.aproximada = false;
                    return r;
                }
            }
        } catch (Exception ignored) {
        }
        return fallbackLinea(origenLat, origenLng, destinoLat, destinoLng);
    }

    public EstimacionDto.Respuesta fallbackLinea(double oLat, double oLng, double dLat, double dLng) {
        EstimacionDto.Respuesta r = new EstimacionDto.Respuesta();
        double metros = CobroService.haversineMetros(oLat, oLng, dLat, dLng) * 1.3;
        r.distanciaMetros = metros;
        r.duracionSegundos = Duration.ofSeconds(Math.round((metros / 1000d) / 25d * 3600d)).toSeconds();
        r.ruta.add(new double[] { oLat, oLng });
        r.ruta.add(new double[] { dLat, dLng });
        r.aproximada = true;
        return r;
    }
}
