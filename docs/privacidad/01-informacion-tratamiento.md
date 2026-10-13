# 1. Información sobre el tratamiento de datos personales

> Borrador de la información que exige el art. 13 del RGPD. Completar y revisar
> antes de usarlo. ⚖️ **Revisión jurídica de todo el documento.**

## 1. Responsable del tratamiento

- **Responsable:** [COMPLETAR: nombre legal de la escuela, NIF/CIF]
- **Dirección:** [COMPLETAR]
- **Contacto para protección de datos:** [COMPLETAR: correo y/o teléfono]
- **Delegado de protección de datos (si lo hay):** [COMPLETAR o «no designado»]
  ⚖️ Confirmar si es obligatorio designarlo.

⚖️ **Papel de ÉVORA PADEL.** La plataforma es la herramienta con la que la
escuela evalúa a sus jugadores. Si quien desarrolla o gestiona ÉVORA es una
persona o entidad distinta de la escuela, actuaría normalmente como **encargado
del tratamiento** y haría falta un contrato del art. 28 RGPD entre ambas.
[COMPLETAR: quién gestiona la plataforma durante el piloto]

## 2. Finalidades

1. Hacer el **seguimiento deportivo** de cada jugador: nivel, grupo, puntuaciones
   de 1 a 5 por competencia, fortalezas, áreas de mejora, observaciones y
   objetivos.
2. Organizar los **grupos** de entrenamiento y quién los entrena.
3. Elaborar **informes de evaluación** en PDF para entregarlos a la familia o al
   propio jugador.
4. Gestionar el **acceso** de la dirección y los entrenadores a la plataforma
   (cuentas de usuario).

No se toman decisiones automatizadas ni se elaboran perfiles con efectos
jurídicos: todas las puntuaciones las pone una persona. No se usan los datos
para publicidad ni se ceden con fines comerciales.

## 3. Base legal — [ELEGIR, con revisión jurídica ⚖️]

No se ha decidido todavía. Opciones habituales para revisar:

| Opción | Cuándo podría encajar | A tener en cuenta |
|---|---|---|
| **A. Ejecución del contrato** (art. 6.1.b) | Si la evaluación forma parte del servicio de escuela que contratan las familias | Debe constar en las condiciones de inscripción. |
| **B. Consentimiento** (art. 6.1.a) | Si el seguimiento con la plataforma es opcional | Menores de 14 años: lo dan quienes ejercen la patria potestad o tutela (art. 7 LOPDGDD). Se puede retirar en cualquier momento. Ver documento 3. |
| **C. Interés legítimo** (art. 6.1.f) | Organización interna de grupos | Requiere una ponderación documentada; con menores, su interés pesa especialmente. |

Las cuentas de usuario de la dirección y los entrenadores se basarían en la
relación con la escuela. [COMPLETAR]

⚖️ **Datos de salud.** La app **no** está pensada para datos de salud (lesiones,
diagnósticos, tratamientos), que son una categoría especial (art. 9 RGPD). Hay
que indicar a los entrenadores que no los escriban en observaciones, fortalezas
ni mejoras. La competencia «Condición física» se refiere al rendimiento
deportivo observado, no a datos médicos.

## 4. Datos que se tratan

Ver el inventario (documento 5). Resumen:

- **Del jugador:** nombre; fecha de nacimiento (opcional); mano dominante,
  nivel, posición y foco de trabajo (opcionales); grupos; y evaluaciones
  (fecha, tipo, puntuaciones, fortalezas, áreas de mejora, observaciones y
  objetivos).
- **De la dirección y los entrenadores:** correo electrónico, contraseña
  (guardada cifrada por el proveedor), nombre visible y función en la escuela.

La app **no** guarda teléfonos, direcciones, fotos ni datos de las familias.

## 5. Destinatarios y encargados del tratamiento

- **Personal de la escuela con cuenta:** dirección y entrenadores. Hoy, cualquier
  miembro de la escuela puede ver a todos sus jugadores y evaluaciones.
  [ELEGIR: mantenerlo o restringirlo en el futuro a los grupos de cada
  entrenador]
- **Proveedores tecnológicos (encargados):**
  - Supabase: base de datos y cuentas.
  - Vercel: alojamiento de la aplicación.

  Ver el documento 6 para contratos y ubicaciones. [COMPLETAR tras verificarlos]
- **Familias / jugador:** reciben su propio informe.
- No se ceden datos a terceros salvo obligación legal.

## 6. Transferencias internacionales — [COMPLETAR tras verificar 🔧]

Supabase y Vercel son empresas con sede en EE. UU. Hay que comprobar dos cosas:
- **Dónde se alojan los datos:** región del proyecto de Supabase y región de las
  funciones de Vercel.
- **Garantías de sus contratos:** por ejemplo, el Marco de Privacidad de Datos
  UE-EE. UU. o cláusulas contractuales tipo.

No afirmar nada aquí hasta haberlo verificado (documento 6). ⚖️

## 7. Conservación

[COMPLETAR según el documento 4.] Mientras el jugador esté en la escuela y,
después, durante el plazo que decida la escuela. Al terminar se suprimen
siguiendo el procedimiento del documento 4.

## 8. Derechos

Cualquier persona interesada (o, en el caso de menores, quienes ejercen la
patria potestad o tutela) puede ejercer sus derechos escribiendo a
[COMPLETAR: contacto]:
- **acceso;**
- **rectificación;**
- **supresión;**
- **oposición;**
- **limitación del tratamiento;**
- **portabilidad**, cuando proceda;
- y, si la base es el consentimiento, **retirarlo** en cualquier momento.

Se responderá en el plazo de un mes, ampliable en los casos previstos en el
art. 12.3 RGPD (procedimiento en el documento 7).

También se puede presentar una reclamación ante la **Agencia Española de
Protección de Datos** (www.aepd.es).

## 9. Seguridad (resumen técnico)

- Acceso solo con cuenta creada por la escuela.
- Cifrado en tránsito (HTTPS).
- Aislamiento entre escuelas en la base de datos.
- Los informes no se almacenan.
- No hay rastreadores.

Ver el README de esta carpeta.
