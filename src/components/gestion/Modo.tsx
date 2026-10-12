/** Indica que la pantalla muestra datos REALES de la escuela (no la demo). */
export function IndicadorDatosReales() {
  return (
    <p className="mb-6 rounded-xl border border-electrico/40 bg-electrico/10 px-3 py-2 text-xs text-blanco/85">
      <strong className="font-bold text-electrico">Datos reales de tu escuela.</strong> Evaluaciones y objetivos
      todavía solo están en la demostración (menú «Demo»), con datos ficticios.
    </p>
  );
}
