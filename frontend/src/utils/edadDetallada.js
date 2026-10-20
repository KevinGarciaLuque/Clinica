import dayjs from "dayjs";
import { hoyClinica } from "./zonaClinica";

/**
 * Edad con años y meses (y días en bebés menores de 1 año), contada a la fecha de
 * hoy de la clínica. Ej.: "4 años y 7 meses", "8 meses y 12 días", "35 años".
 */
export function edadDetallada(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const nac = dayjs(String(fechaNacimiento).slice(0, 10));
  const hoy = dayjs(hoyClinica());
  if (!nac.isValid() || nac.isAfter(hoy)) return "";
  const anios = hoy.diff(nac, "year");
  const meses = hoy.diff(nac.add(anios, "year"), "month");
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (anios === 0) {
    const dias = hoy.diff(nac.add(meses, "month"), "day");
    if (meses === 0) return plural(dias, "día", "días");
    return dias ? `${plural(meses, "mes", "meses")} y ${plural(dias, "día", "días")}` : plural(meses, "mes", "meses");
  }
  if (anios >= 18 || meses === 0) return plural(anios, "año", "años");
  return `${plural(anios, "año", "años")} y ${plural(meses, "mes", "meses")}`;
}
