-- Reinicia únicamente los datos del portal Factura Bonita.
-- Conserva las tablas y la configuración estructural de la base.
-- Úsalo solo si deseas eliminar las cuentas y ventas de prueba.

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM portal_integraciones;
DELETE FROM portal_clientes;
DELETE FROM portal_sesiones;
DELETE FROM portal_ventas;
DELETE FROM portal_perfiles;
DELETE FROM portal_usuarios;
SET FOREIGN_KEY_CHECKS = 1;

-- Verificación
SELECT COUNT(*) AS usuarios FROM portal_usuarios;
SELECT COUNT(*) AS ventas FROM portal_ventas;
