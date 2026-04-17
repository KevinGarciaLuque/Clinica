-- ============================================================
-- Migración 023: Seed medicamentos más comunes en Honduras
-- Se ejecuta una sola vez; se usa INSERT IGNORE para no duplicar
-- ============================================================

ALTER TABLE medicamentos
  ADD COLUMN codigo_cie_sugerido VARCHAR(10) NULL
    COMMENT 'Código CIE-10 para el que se suele prescribir este medicamento'
  AFTER instrucciones_default;

-- ─────────────────────────────────────────────────────────────
-- ANALGÉSICOS / ANTIINFLAMATORIOS
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO medicamentos (nombre_generico, nombre_comercial, presentacion, via_administracion, dosis_default, duracion_default, cantidad_default, instrucciones_default, codigo_cie_sugerido) VALUES
('Paracetamol', 'Tempra / Tylenol', 'Tableta 500mg', 'Oral', '500-1000mg c/6-8h', '5 días', '20 tabletas', 'Tomar con alimentos o agua. No superar 4g/día.', 'R51'),
('Paracetamol pediátrico', 'Tempra gotas', 'Gotas 100mg/mL', 'Oral', '10-15mg/kg c/6-8h', '5 días', '1 frasco', 'Administrar según peso. No superar 5 dosis en 24h.', 'R50.9'),
('Ibuprofeno', 'Motrin / Advil', 'Tableta 400mg', 'Oral', '400mg c/8h con alimentos', '5-7 días', '21 tabletas', 'Tomar con alimentos para proteger el estómago.', 'M79.3'),
('Ibuprofeno pediátrico', 'Ibuprofeno jarabe', 'Suspensión 200mg/5mL', 'Oral', '5-10mg/kg c/8h', '5 días', '1 frasco 120mL', 'Agitar antes de usar. Con alimentos.', 'R50.9'),
('Diclofenaco', 'Voltaren / Cataflam', 'Tableta 50mg', 'Oral', '50mg c/8h con alimentos', '5 días', '15 tabletas', 'Tomar con alimentos. Evitar en úlcera péptica.', 'M54.5'),
('Naproxeno', 'Naprosyn', 'Tableta 500mg', 'Oral', '500mg c/12h', '7 días', '14 tabletas', 'Tomar con alimentos.', 'M79.0'),
('Ketorolaco', 'Toradol', 'Tableta 10mg', 'Oral', '10mg c/6-8h', '5 días máx', '15 tabletas', 'No usar más de 5 días. Con alimentos.', 'R52.2'),
('Metamizol (Dipirona)', 'Novalgin', 'Tableta 500mg', 'Oral', '500-1000mg c/8h', '3-5 días', '15 tabletas', 'Solo si hay fiebre alta o dolor moderado-severo.', 'R50.9'),

-- ─────────────────────────────────────────────────────────────
-- ANTIBIÓTICOS
-- ─────────────────────────────────────────────────────────────
('Amoxicilina', 'Amoxil', 'Cápsula 500mg', 'Oral', '500mg c/8h', '7 días', '21 cápsulas', 'Completar el tratamiento aunque haya mejoría.', 'J06.9'),
('Amoxicilina pediátrica', 'Amoxil suspensión', 'Suspensión 250mg/5mL', 'Oral', '40-50mg/kg/día dividido c/8h', '7 días', '1 frasco 120mL', 'Refrigerar. Completar el tratamiento.', 'J06.9'),
('Amoxicilina + Ácido clavulánico', 'Augmentine', 'Tableta 875/125mg', 'Oral', '875mg c/12h', '7-10 días', '14 tabletas', 'Con alimentos. Completar tratamiento.', 'J06.9'),
('Azitromicina', 'Zithromax', 'Tableta 500mg', 'Oral', '500mg 1 vez/día', '3-5 días', '3-5 tabletas', 'Puede tomarse con o sin alimentos.', 'J22'),
('Ciprofloxacino', 'Ciprobay', 'Tableta 500mg', 'Oral', '500mg c/12h', '7 días', '14 tabletas', 'Con abundante agua. Evitar lácteos 2h antes/después.', 'N39.0'),
('Trimetoprim/Sulfametoxazol', 'Bactrim / Septrin', 'Tableta 160/800mg', 'Oral', '1 tableta c/12h', '7 días', '14 tabletas', 'Tomar con abundante agua.', 'N39.0'),
('Metronidazol', 'Flagyl', 'Tableta 500mg', 'Oral', '500mg c/8h', '7 días', '21 tabletas', 'Evitar alcohol durante el tratamiento.', 'A09'),
('Claritromicina', 'Klaricid', 'Tableta 500mg', 'Oral', '500mg c/12h', '7-14 días', '14 tabletas', 'Con o sin alimentos.', 'J22'),
('Doxiciclina', 'Vibramycin', 'Cápsula 100mg', 'Oral', '100mg c/12h', '7 días', '14 cápsulas', 'Con abundante agua, no acostarse 30min después.', 'A75.9'),
('Clindamicina', 'Dalacin C', 'Cápsula 300mg', 'Oral', '300mg c/8h', '7-10 días', '21 cápsulas', 'Con vaso lleno de agua.', 'L03.0'),

-- ─────────────────────────────────────────────────────────────
-- ANTIPARASITARIOS / ANTIPROTOZOARIOS
-- ─────────────────────────────────────────────────────────────
('Albendazol', 'Zentel', 'Tableta 400mg', 'Oral', '400mg dosis única', '1 día', '1 tableta', 'Masticar o tomar con alimentos grasos para mejor absorción.', 'B82.0'),
('Mebendazol', 'Vermox', 'Tableta 500mg', 'Oral', '500mg dosis única', '1 día', '1 tableta', 'Masticar antes de tragar.', 'B82.0'),
('Metronidazol suspensión', 'Flagyl suspensión', 'Suspensión 200mg/5mL', 'Oral', '30mg/kg/día dividido c/8h', '7 días', '1 frasco', 'Para giardiasis o amebiasis en niños.', 'A07.1'),
('Ivermectina', 'Ivexterm', 'Tableta 6mg', 'Oral', '200mcg/kg dosis única', '1 día', '2-4 tabletas', 'En ayunas o con agua. Repetir en 2 semanas si necesario.', 'B77.9'),

-- ─────────────────────────────────────────────────────────────
-- ANTIHIPERTENSIVOS
-- ─────────────────────────────────────────────────────────────
('Enalapril', 'Vasotec / Renitec', 'Tableta 10mg', 'Oral', '10mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'Revisar presión regularmente.', 'I10'),
('Losartán', 'Cozaar', 'Tableta 50mg', 'Oral', '50mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'Puede tomarse con o sin alimentos.', 'I10'),
('Amlodipino', 'Norvasc', 'Tableta 5mg', 'Oral', '5mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'A la misma hora cada día.', 'I10'),
('Hidroclorotiazida', 'Microzide', 'Tableta 25mg', 'Oral', '25mg 1 vez/día (mañana)', 'Tratamiento crónico', '30 tabletas', 'Por las mañanas para evitar diuresis nocturna.', 'I10'),
('Metoprolol', 'Lopressor', 'Tableta 50mg', 'Oral', '50mg c/12h', 'Tratamiento crónico', '60 tabletas', 'No suspender abruptamente.', 'I10'),
('Verapamilo', 'Isoptin', 'Tableta 80mg', 'Oral', '80mg c/8h', 'Tratamiento crónico', '90 tabletas', 'Con alimentos.', 'I10'),

-- ─────────────────────────────────────────────────────────────
-- ANTIDIABÉTICOS
-- ─────────────────────────────────────────────────────────────
('Metformina', 'Glucophage', 'Tableta 850mg', 'Oral', '850mg c/12h con alimentos', 'Tratamiento crónico', '60 tabletas', 'Con las comidas para reducir efectos GI. No suspender solo.', 'E11.9'),
('Glibenclamida', 'Daonil', 'Tableta 5mg', 'Oral', '5mg antes del desayuno', 'Tratamiento crónico', '30 tabletas', 'Antes del desayuno principal.', 'E11.9'),
('Glimepirida', 'Amaryl', 'Tableta 2mg', 'Oral', '2mg 1 vez/día con las comidas', 'Tratamiento crónico', '30 tabletas', 'Con la primera comida del día.', 'E11.9'),
('Insulina NPH', 'Insulina NPH 100UI/mL', 'Frasco 10mL', 'SC', 'Según indicación médica (UI)', 'Tratamiento crónico', '1 frasco', 'Refrigerar. Rotar sitios de inyección.', 'E11.9'),

-- ─────────────────────────────────────────────────────────────
-- ANTIHISTAMÍNICOS / ALERGIA
-- ─────────────────────────────────────────────────────────────
('Loratadina', 'Claritin', 'Tableta 10mg', 'Oral', '10mg 1 vez/día', '7-10 días', '10 tabletas', 'Preferiblemente en la noche.', 'J30.1'),
('Cetirizina', 'Zyrtec', 'Tableta 10mg', 'Oral', '10mg 1 vez/día', '7-10 días', '10 tabletas', 'Con o sin alimentos.', 'J30.1'),
('Difenhidramina', 'Benadryl', 'Cápsula 25mg', 'Oral', '25-50mg c/6-8h', '3-5 días', '12 cápsulas', 'Puede causar somnolencia. No manejar.', 'L50.0'),
('Dexametasona', 'Decadron', 'Tableta 0.5mg', 'Oral', '0.5-4mg c/6h según caso', '5-7 días', '20 tabletas', 'Con alimentos. No suspender bruscamente.', 'J45.9'),
('Prednisolona', 'Prelone', 'Tableta 5mg', 'Oral', '1mg/kg/día (máx 40mg)', '5-7 días', '30 tabletas', 'Con alimentos en la mañana.', 'J45.9'),

-- ─────────────────────────────────────────────────────────────
-- GASTROINTESTINALES
-- ─────────────────────────────────────────────────────────────
('Omeprazol', 'Prilosec / Losec', 'Cápsula 20mg', 'Oral', '20mg 1 vez/día en ayunas', '14-28 días', '14-28 cápsulas', '30 min antes del desayuno.', 'K21.0'),
('Ranitidina', 'Zantac', 'Tableta 150mg', 'Oral', '150mg c/12h', '14 días', '28 tabletas', 'Antes de las comidas.', 'K25.9'),
('Metoclopramida', 'Plasil', 'Tableta 10mg', 'Oral', '10mg 30 min antes de las comidas', '5-7 días', '15 tabletas', '30 min antes de comer. No más de 5 días.', 'R11'),
('Dimenhidrinato', 'Dramamine', 'Tableta 50mg', 'Oral', '50mg c/4-6h si náuseas', 'según necesidad', '10 tabletas', 'Puede causar somnolencia.', 'R11'),
('Loperamida', 'Imodium', 'Cápsula 2mg', 'Oral', '4mg inicial, luego 2mg después de cada evacuación. Máx 16mg/día', '2-3 días', '8 cápsulas', 'Solo sintomático. Hidratarse bien.', 'A09'),
('Salbutamol (gotas orales)', 'Ventolin', 'Jarabe 2mg/5mL', 'Oral', '2-4mg c/8h', '7 días', '1 frasco', 'Para espasmo bronquial leve.', 'J45.9'),
('Simeticona', 'Gas-X / Mylicon', 'Tableta 80mg', 'Oral', '80mg c/8h después de comer', '7 días', '21 tabletas', 'Masticar bien antes de tragar.', 'R14'),
('Hidróxido de aluminio + Mg', 'Maalox', 'Tableta masticable', 'Oral', '2 tabletas 1h después de comidas', '14 días', '30 tabletas', 'Masticar bien.', 'K25.9'),

-- ─────────────────────────────────────────────────────────────
-- RESPIRATORIOS / ANTIASMÁTICOS
-- ─────────────────────────────────────────────────────────────
('Salbutamol aerosol', 'Ventolin', 'Inhalador 100mcg/dosis', 'Inhalada', '2 puffs c/4-6h o según necesidad', 'según necesidad', '1 inhalador', 'Agitar antes de usar. Enjuagar boca después.', 'J45.9'),
('Fluticasona + Salmeterol', 'Seretide', 'Aerosol 250/25mcg', 'Inhalada', '2 puffs c/12h', 'Tratamiento crónico', '1 inhalador', 'Enjuagar boca después de cada uso.', 'J45.1'),
('Budesonida', 'Pulmicort', 'Inhalador 200mcg', 'Inhalada', '200-400mcg c/12h', 'Tratamiento crónico', '1 inhalador', 'Enjuagar boca. No suspender solo.', 'J45.1'),
('Ambroxol', 'Mucosolvan', 'Jarabe 30mg/5mL', 'Oral', '30mg c/8h', '7-10 días', '1 frasco 120mL', 'Con abundante agua. Facilita expectoración.', 'J22'),
('Bromuro de ipratropio', 'Atrovent', 'Inhalador 20mcg/dosis', 'Inhalada', '2 puffs c/6-8h', '7-14 días', '1 inhalador', 'Para EPOC o broncoespasmo crónico.', 'J44.1'),

-- ─────────────────────────────────────────────────────────────
-- VITAMINAS / SUPLEMENTOS (muy usados en Honduras)
-- ─────────────────────────────────────────────────────────────
('Sulfato ferroso', 'Fer-In-Sol', 'Tableta 300mg', 'Oral', '300mg c/12h en ayunas', '3 meses', '90 tabletas', 'En ayunas o con jugo de naranja. Puede obscurecer heces.', 'D50.9'),
('Ácido fólico', 'Folacin', 'Tableta 5mg', 'Oral', '5mg 1 vez/día', '3 meses', '90 tabletas', 'Importante en embarazo y anemia megaloblástica.', 'D52.9'),
('Vitamina C', 'Cebión', 'Tableta 500mg', 'Oral', '500mg 1 vez/día', '30 días', '30 tabletas', 'Con alimentos.', 'E54'),
('Calcio + Vitamina D3', 'Calcio 600 + D3', 'Tableta 600mg/400UI', 'Oral', '1 tableta c/12h con alimentos', 'Tratamiento crónico', '60 tabletas', 'Con alimentos. Separar 2h de hierro.', 'E55.9'),
('Complejo B', 'Benexol', 'Tableta', 'Oral', '1 tableta al día', '30 días', '30 tabletas', 'Con alimentos.', 'E53.9'),
('Zinc + Vitamina C', 'Zincovit', 'Tableta', 'Oral', '1 tableta al día', '1 mes', '30 tabletas', 'Con alimentos.', 'E60'),
('Vitamina A + D', 'Aquasol A', 'Gotas 5000UI/0.1mL', 'Oral', '5000UI diarias', '30 días', '1 frasco', 'Fundamental en desnutrición infantil.', 'E50.9'),

-- ─────────────────────────────────────────────────────────────
-- ANTIFÚNGICOS
-- ─────────────────────────────────────────────────────────────
('Fluconazol', 'Diflucan', 'Cápsula 150mg', 'Oral', '150mg dosis única', '1 día', '1 cápsula', 'Dosis única para candidiasis vaginal.', 'B37.3'),
('Clotrimazol crema', 'Canesten', 'Crema 1% tópica', 'Tópica', 'Aplicar 2-3 veces al día', '2-4 semanas', '1 tubo 20g', 'Limpiar y secar la zona antes de aplicar.', 'B35.4'),
('Itraconazol', 'Sporanox', 'Cápsula 100mg', 'Oral', '100-200mg c/12h', '7-14 días', '14-28 cápsulas', 'Con alimentos abundantes.', 'B36.1'),

-- ─────────────────────────────────────────────────────────────
-- CARDIOVASCULARES
-- ─────────────────────────────────────────────────────────────
('Atorvastatina', 'Lipitor', 'Tableta 20mg', 'Oral', '20mg 1 vez/día (noche)', 'Tratamiento crónico', '30 tabletas', 'Preferentemente en la noche.', 'E78.0'),
('Simvastatina', 'Zocor', 'Tableta 20mg', 'Oral', '20mg en la noche', 'Tratamiento crónico', '30 tabletas', 'Tomar por la noche.', 'E78.0'),
('Ácido acetilsalicílico', 'Aspirina', 'Tableta 100mg', 'Oral', '100mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'Con alimentos o protector gástrico.', 'Z79.1'),
('Digoxina', 'Lanoxin', 'Tableta 0.25mg', 'Oral', '0.25mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'Control de pulso antes de administrar. No < 60 lpm.', 'I48.9'),
('Furosemida', 'Lasix', 'Tableta 40mg', 'Oral', '40mg 1 vez/día (mañana)', 'según indicación', '30 tabletas', 'Por las mañanas. Control de K+.', 'I50.9'),
('Espironolactona', 'Aldactone', 'Tableta 25mg', 'Oral', '25-50mg 1 vez/día', 'Tratamiento crónico', '30 tabletas', 'Con alimentos. Control de K+.', 'I50.9'),

-- ─────────────────────────────────────────────────────────────
-- SALUD MENTAL / NEUROLÓGICOS
-- ─────────────────────────────────────────────────────────────
('Diazepam', 'Valium', 'Tableta 5mg', 'Oral', '5mg c/8-12h', 'máx 4 semanas', '30 tabletas', 'Puede causar dependencia. No manejar.', 'F41.1'),
('Alprazolam', 'Xanax', 'Tableta 0.5mg', 'Oral', '0.5mg c/12h', 'máx 4 semanas', '30 tabletas', 'Riesgo de dependencia. Solo bajo vigilancia médica.', 'F41.1'),
('Amitriptilina', 'Elavil', 'Tableta 25mg', 'Oral', '25mg en la noche', '4-8 semanas mín', '30 tabletas', 'En la noche. Inicio lento del efecto (2-4 sem).', 'F32.9'),
('Haloperidol', 'Haldol', 'Tableta 5mg', 'Oral', '5mg c/12h', 'según indicación', '60 tabletas', 'Bajo vigilancia estrecha. Riesgo de reacciones extrapiramidales.', 'F20.9'),
('Carbamazepina', 'Tegretol', 'Tableta 200mg', 'Oral', '200mg c/12h (ajustar)', 'Tratamiento crónico', '60 tabletas', 'No suspender abruptamente. Control de niveles séricos.', 'G40.9'),
('Clonazepam', 'Rivotril', 'Tableta 0.5mg', 'Oral', '0.5mg c/12h (ajustar)', 'Tratamiento crónico', '60 tabletas', 'No suspender abruptamente.', 'G40.9'),

-- ─────────────────────────────────────────────────────────────
-- GINECOLOGÍA / OBSTETRICIA
-- ─────────────────────────────────────────────────────────────
('Oxitocina', 'Pitocin', 'Ampolla 10UI/mL', 'IV/IM', 'Según protocolo obstétrico', 'según indicación', '1 ampolla', 'Solo uso hospitalario bajo supervisión.', 'O62.0'),
('Micronazol vaginal', 'Monistat', 'Óvulo 100mg', 'Vaginal', '1 óvulo diario en la noche', '7 noches', '7 óvulos', 'Insertar profundo. Continuar en menstruación.', 'B37.3'),
('Progesterona', 'Utrogestan', 'Cápsula 200mg', 'Oral/Vaginal', '200mg en la noche', 'según indicación', '30 cápsulas', 'Uso en amenaza de aborto, etc. Según indicación.', 'O20.0'),

-- ─────────────────────────────────────────────────────────────
-- USO TÓPICO / DERMATOLOGÍA
-- ─────────────────────────────────────────────────────────────
('Hidrocortisona crema', 'Cortaid', 'Crema 1% tópica', 'Tópica', 'Aplicar 2 veces/día', '7-14 días', '1 tubo 30g', 'No aplicar en cara ni en pliegues prolongadamente.', 'L30.9'),
('Mupirocina', 'Bactroban', 'Ungüento 2% tópico', 'Tópica', 'Aplicar 3 veces/día', '5-10 días', '1 tubo 15g', 'Limpiar la zona antes de aplicar.', 'L01.0'),
('Ketoconazol champú', 'Nizoral', 'Champú 2%', 'Tópica', '2 veces/semana', '4 semanas', '1 frasco 120mL', 'Dejar actuar 3-5 min antes de enjuagar.', 'B36.0'),
('Tretinoína crema', 'Retin-A', 'Crema 0.025%', 'Tópica', 'Aplicar en noche cada 2-3 días', '3-6 meses', '1 tubo 30g', 'Evitar sol. Iniciar con baja frecuencia.', 'L70.0'),
('Peróxido de benzoilo', 'Benzac', 'Gel 5%', 'Tópica', 'Aplicar 1-2 veces/día', '6-8 semanas', '1 tubo 40g', 'Puede decolorar ropa. Protector solar de día.', 'L70.0');
