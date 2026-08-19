-- 059_factura_items_descuento.sql
-- Agrega descuento por línea (monto fijo en Lempiras) a los ítems de factura/recibo.
ALTER TABLE factura_items ADD COLUMN descuento DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_unit;
