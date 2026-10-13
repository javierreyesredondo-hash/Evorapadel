# 4. Política de conservación y procedimiento de supresión

> Los **plazos no están decididos**: hay que elegirlos [ELEGIR] y validarlos ⚖️.
> El procedimiento técnico sí está preparado y **probado en local** con datos
> sintéticos (nunca en producción).

## 1. Plazos de conservación — [ELEGIR]

| Datos | Opción A | Opción B | Opción C |
|---|---|---|---|
| Jugador y evaluaciones | Mientras entrene en la escuela + **[N] meses** tras su baja | Hasta el final de la temporada en que cause baja | Mientras entrene; supresión inmediata al darse de baja |
| Cuentas de dirección y entrenadores | Mientras tengan relación con la escuela | — | — |
| Documentos de consentimiento (si los hay) | Mientras se traten los datos + plazo de prescripción ⚖️ | — | — |
| Registro de solicitudes de derechos (documento 7) | [COMPLETAR] ⚖️ | — | — |

⚖️ Confirmar si alguna obligación legal (por ejemplo, contable o de seguros)
exige conservar algún dato más tiempo. Los datos de seguimiento deportivo no
deberían conservarse «por si acaso».

**Plazo elegido:** [COMPLETAR] · **Revisión periódica:** [COMPLETAR: por
ejemplo, al final de cada trimestre o temporada] · **Responsable:**
[COMPLETAR]

## 2. Archivar no es suprimir

- **«Archivar»** (botón de la ficha del jugador) solo oculta al jugador de las
  listas de activos. Sus datos **siguen guardados** y se pueden reactivar.
- **Suprimir** borra el jugador y todas sus evaluaciones. La app **no** tiene
  todavía un botón de supresión: es una acción irreversible y se hará con el
  procedimiento del apartado 3. Un botón en la app se diseñará más adelante,
  con sus permisos y pruebas.

## 3. Procedimiento de supresión de un jugador

Lo ejecuta **la dirección** en el *SQL Editor* de Supabase (proyecto de
producción). Los archivos están en [`sql/`](sql/).

1. **Revisión periódica** (solo lectura). Con
   [`0-revisar-archivados.sql`](sql/0-revisar-archivados.sql), lista los
   archivados que superan el plazo.
2. **Localizar** (solo lectura). Con
   [`1-localizar-jugador.sql`](sql/1-localizar-jugador.sql), comprobar que es la
   persona correcta y anotar `id_escuela` e `id_jugador`.
3. **Copia, solo si se necesita** (solo lectura). Con
   [`2-exportar-jugador.sql`](sql/2-exportar-jugador.sql), cuando se haya pedido
   el acceso o haya que entregar los datos. Entregarla de forma segura
   (documento 7) y **no guardar** copias más allá de lo necesario.
4. **Suprimir** (escritura, irreversible). Con
   [`3-suprimir-jugador.sql`](sql/3-suprimir-jugador.sql), sustituyendo los dos
   identificadores:
   - borra el jugador, sus asignaciones a grupos y sus evaluaciones con notas y
     objetivos (borrado en cascada de la base de datos);
   - si no encuentra **exactamente un** jugador de esa escuela, se detiene y
     **no borra nada**.
5. **Verificar** (solo lectura). Con
   [`4-verificar-supresion.sql`](sql/4-verificar-supresion.sql), los tres
   recuentos deben ser 0.
6. **Registrar** la supresión (fecha, motivo, quién la hizo) en el registro del
   documento 7, **sin** copiar los datos borrados.

### Comprobado en local (Supabase en Docker, datos sintéticos)

| Prueba | Resultado |
|---|---|
| Exportar | JSON con el jugador, su grupo, la evaluación, 6 puntuaciones y el objetivo |
| Suprimir con una escuela equivocada | Se detiene: «… serían 0. No se ha borrado nada.»; los datos siguen intactos |
| Suprimir | Borrados el jugador, su grupo, su evaluación, sus notas y sus objetivos (0 huérfanos) |
| Otro jugador de la misma escuela | Intacto |
| Repetir la supresión | Se detiene sin efecto |
| Prueba automática de la base de datos | «Borrar un jugador borra sus evaluaciones y notas» (`supabase/tests/20_evaluaciones.sql`) |

## 4. Lo que el procedimiento no alcanza

- **Copias de seguridad de Supabase.** Los datos borrados pueden seguir en las
  copias hasta que caduquen según el plan contratado. 🔧 Ver el documento 6 e
  indicarlo al interesado: [COMPLETAR: plazo de retención de las copias].
- **PDF ya enviados.** Los informes compartidos por WhatsApp o correo están en
  los dispositivos de quien los recibió y la escuela no puede borrarlos.
  Recomendación: borrar de los propios dispositivos los PDF descargados una vez
  enviados.
- **Registros técnicos de los proveedores.** Los registros de peticiones de
  Vercel y Supabase pueden contener la URL con identificadores (no nombres)
  durante su periodo de retención. 🔧 Ver el documento 6.

## 5. Cuentas de entrenadores que dejan la escuela

Para retirar el acceso, borrar el usuario en *Authentication → Users* de
Supabase. Se borran su perfil y su membresía. Sus evaluaciones **se conservan
sin autor**: lo comprueba una prueba automática («al quitar la membresía del
autor, la evaluación se conserva»). En el piloto solo existe la cuenta del
director.
