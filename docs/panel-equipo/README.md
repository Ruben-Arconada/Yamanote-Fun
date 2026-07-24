# Plantilla del panel del equipo (QA "se reúne el equipo")

`plantilla-workflow-ronda2.js` es el script literal del Workflow que aprobó
v0.1.5 con consenso 7/7 (ronda 2: 8,9,8,9,8,8,9). Para reutilizarlo:

1. Preparar un dossier .md (qué entra, cifras de perf MEDIDAS, rutas de
   capturas JPEG, ficheros de código citados y una sección de "notas
   honestas") + capturas de estados representativos.
2. Adaptar rutas BRIEF/SHOTS y el contexto de cada juez (los 7 salen de
   `src/data/team.ts`; cada uno con su aspecto y su forma de verificar:
   Marco y Diego leen código, Yui y Aiko miran píxeles, Lena lee UI.ts,
   Haruto revisa tipologías japonesas, Sam cierra la cohesión).
3. Criterio fijo: "8 = publicar con orgullo, ni regalar ni mover la
   portería". Consenso = todos ≥8.
4. En rondas sucesivas los prompts DEBEN cambiar (mencionar "RONDA N" y
   responder objeción por objeción en el dossier), o el Workflow devolverá
   resultados cacheados.
5. Aplicar también las mejoras baratas que receten los jueces que YA
   aprueban: sube la calidad real y el commit puede decir "signed off 7/7".
