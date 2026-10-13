# 7. Procedimiento para atender los derechos de las personas

> Procedimiento interno para responder a solicitudes de acceso, rectificación,
> supresión y otros derechos. ⚖️ Revisar plazos, la verificación de identidad y
> los modelos de respuesta.

## 1. Recepción

- **Canal:** [COMPLETAR: correo de contacto del documento 1].
- **Plazo:** responder **sin demora y como máximo en un mes** desde la
  recepción. Se puede ampliar dos meses más en casos complejos, avisando dentro
  del primer mes (art. 12.3 RGPD).
- **Coste:** gratuito, salvo solicitudes manifiestamente infundadas o
  excesivas. ⚖️
- **Responsable de atenderlas:** [COMPLETAR].

## 2. Verificar la identidad (antes de dar o borrar datos)

- **Jugador menor de 14 años:** la solicitud debe venir de quien ejerce la
  patria potestad o tutela. Verificar esa relación con los datos de inscripción
  de la escuela.
- **Jugador de 14 años o más:** puede ejercer sus derechos por sí mismo. ⚖️
  Definir cómo actuar si lo pide la familia.
- **Si hay dudas:** pedir información adicional proporcionada. Nunca enviar
  datos a un contacto distinto del que consta en la escuela.

## 3. Cómo atender cada derecho

| Derecho | Qué hacer | Herramienta |
|---|---|---|
| **Acceso** (qué datos tenemos) | Entregar copia de los datos y la información del documento 2 | [`sql/2-exportar-jugador.sql`](sql/2-exportar-jugador.sql) (todo en un archivo) y/o los informes PDF de cada evaluación desde la app («Ver informe PDF») |
| **Rectificación** (corregir) | Corregir el dato inexacto | En la app: ficha del jugador → «Editar», o la evaluación → «Editar evaluación» (la dirección puede editar todas). Los PDF enviados antes no cambian: si conviene, enviar uno nuevo. |
| **Supresión** (borrar) | Borrar el jugador y sus evaluaciones si procede ⚖️ | Procedimiento del documento 4, apartado 3 ([`sql/3-suprimir-jugador.sql`](sql/3-suprimir-jugador.sql)), e informar de lo que no se alcanza (copias de seguridad, PDF ya enviados). |
| **Oposición / limitación** | Dejar de tratar los datos mientras se resuelve | Medida provisional: «Archivar» al jugador en la app y no evaluarlo. ⚖️ Confirmar si basta o procede suprimir. |
| **Portabilidad** (si la base es consentimiento o contrato) | Entregar los datos en formato estructurado | El JSON de [`sql/2-exportar-jugador.sql`](sql/2-exportar-jugador.sql) |
| **Retirar el consentimiento** (si es la base legal) | Dejar de evaluar y, si lo pide, suprimir | Archivar o suprimir, como arriba |

### Entrega segura de la copia

- Enviarla **solo** al contacto verificado del apartado 2.
- Preferiblemente en mano o por un canal ya usado con la familia.
- No guardar copias adicionales una vez entregada.

## 4. Registro de solicitudes

Sin copiar los datos del jugador; solo lo necesario para acreditar que se
atendió.

| Fecha de recepción | Derecho | Solicitante (relación) | Identidad verificada | Acción realizada | Fecha de respuesta | Atendida por |
|---|---|---|---|---|---|---|
| | | | ☐ | | | |

[COMPLETAR: dónde se guarda este registro y durante cuánto tiempo (documento 4)]

## 5. Brechas de seguridad

Si se pierde un móvil con informes, se envía un PDF a quien no corresponde o se
sospecha un acceso indebido:
1. Avisar de inmediato a [COMPLETAR: responsable].
2. Cambiar la contraseña y cerrar sesiones si hace falta (*Authentication →
   Users* en Supabase).
3. Valorar si hay que notificarlo a la AEPD en un plazo de **72 horas** y a
   las familias afectadas (arts. 33 y 34 RGPD). ⚖️
