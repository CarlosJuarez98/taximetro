package com.taxi.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * H2 a veces deja ENUM viejo en ESTADO (sin PENDIENTE) y rompe la agenda.
 * Fuerza VARCHAR y asegura admin.
 */
@Component
public class DbFixRunner implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public DbFixRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbc.execute("ALTER TABLE TX_RESERVA ALTER COLUMN ESTADO VARCHAR(20)");
        } catch (Exception ignored) {
            /* ya es varchar o no aplica */
        }
        try {
            jdbc.execute("ALTER TABLE TX_VIAJE ALTER COLUMN ESTADO VARCHAR(20)");
        } catch (Exception ignored) {
            /* ignore */
        }
        try {
            jdbc.execute(
                    "UPDATE TX_RESERVA SET USUARIO_ID = (SELECT MIN(ID) FROM TX_USUARIO) WHERE USUARIO_ID IS NULL");
            jdbc.execute(
                    "UPDATE TX_VIAJE SET USUARIO_ID = (SELECT MIN(ID) FROM TX_USUARIO) WHERE USUARIO_ID IS NULL");
            jdbc.execute(
                    "UPDATE TX_CAJA_DIA SET USUARIO_ID = (SELECT MIN(ID) FROM TX_USUARIO) WHERE USUARIO_ID IS NULL");
        } catch (Exception ignored) {
            /* columnas nuevas aún no existen en algún arranque */
        }
    }
}
