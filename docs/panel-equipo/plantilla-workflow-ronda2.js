export const meta = {
  name: 'reunion-equipo-v015-ronda2',
  description: 'Ronda 2: los 7 del estudio re-puntúan v0.1.5 tras los arreglos',
  phases: [{ title: 'Revisión R2' }],
}

const BRIEF = '/private/tmp/claude-501/-Users-clickcom-tokyo-loop/07f4210c-a92d-4f2e-86f0-a53836d68854/scratchpad/brief-v015.md'
const SHOTS = '/private/tmp/claude-501/-Users-clickcom-tokyo-loop/07f4210c-a92d-4f2e-86f0-a53836d68854/scratchpad/shots'

const SCHEMA = {
  type: 'object',
  properties: {
    nombre: { type: 'string' },
    nota: { type: 'number', minimum: 1, maximum: 10 },
    veredicto: { type: 'string' },
    mejoras: { type: 'array', items: { type: 'string' } },
  },
  required: ['nombre', 'nota', 'veredicto', 'mejoras'],
  additionalProperties: false,
}

const JUDGES = [
  { key: 'aiko', nombre: 'Aiko Tanabe', aspecto: 'Dirección creativa e inmersión', r1: 'Diste un 6.5: otoño indistinguible de primavera, terreno sin virar, milagro de Komagome sin testigo, invierno contradicho por el primer plano, parcelas sin vida.' },
  { key: 'marco', nombre: 'Marco Ferretti', aspecto: 'Rendimiento y solidez técnica', r1: 'Diste un 8.5: pediste gradeYAt analítico, lerpKeyframes sin clones, comentario honesto de uniforms, y apagar fuentes de lluvia a gain 0.' },
  { key: 'yui', nombre: 'Yui Sakamoto', aspecto: 'Arte y ambientación', r1: 'Diste un 7: suelo olivo muerto en tres estaciones, otoño sin momiji en el encuadre b, nieve rota en primer término, nubes de nevada como hollín.' },
  { key: 'diego', nombre: 'Diego Reyes', aspecto: 'Diseño de sonido', r1: 'Diste un 8: nevada sonando a aguacero, cigarras imposibles de abril, mute binario de insectos, lluvia sin respiración, suzumushi sin identidad.' },
  { key: 'haruto', nombre: 'Haruto Endo', aspecto: 'Rigor ferroviario y japonesidad', r1: 'Diste un 7.5: franja junto a vía verde en invierno, balasto sin nevar, cordillera primaveral en el encuadre de otoño, casas todas de cara, 駅名標 ilegible, nubes de nevada oscuras.' },
  { key: 'lena', nombre: 'Lena Vogt', aspecto: 'UX e interfaz', r1: 'Diste un 6.5: solape en portrait ≤465, pickers sin cierre exterior, chips sin :active, anclaje frágil por offsets fijos, sin aria-expanded.' },
  { key: 'sam', nombre: 'Sam Okafor', aspecto: 'Producción y cohesión del lanzamiento', r1: 'Diste un 8: pediste captura de invierno despejado, encuadre con momiji+sakura juntos, y escucha de audio pendiente.' },
]

phase('Revisión R2')
const results = await parallel(JUDGES.map((j) => () =>
  agent(
    `RONDA 2 de la revisión del equipo de Tokyo Loop. Eres ${j.nombre}. Tu aspecto: **${j.aspecto}**.\n\n` +
    `En la ronda 1: ${j.r1}\n\n` +
    `El equipo ha aplicado arreglos y ha regenerado las capturas. Lee el dossier COMPLETO (la sección "RONDA 2" del final lista qué se arregló y responde a tus objeciones): ${BRIEF}\n` +
    `Mira las 7 capturas nuevas en ${SHOTS}/ con Read (todas). Verifica en el código del repo /Users/clickcom/tokyo-loop lo que afecte a tu aspecto (los ficheros están citados en el dossier).\n\n` +
    `Re-puntúa TU aspecto de 1 a 10. Criterio: 8 = listo para publicar con orgullo; sube la nota si tus objeciones se resolvieron de verdad, mantenla o bájala si no. Sé justo en ambos sentidos: ni regales el 8, ni muevas la portería pidiendo cosas nuevas de otra escala (una mejora menor pendiente no impide un 8 si lo grande está resuelto; anótala en mejoras). Devuelve nota, veredicto (2-3 frases) y mejoras pendientes. En español.`,
    { label: `juez-r2:${j.key}`, phase: 'Revisión R2', schema: SCHEMA },
  ),
))

const votes = results.filter(Boolean)
const aprobado = votes.length === JUDGES.length && votes.every((v) => v.nota >= 8)
log(`R2: ${votes.map((v) => `${v.nombre.split(' ')[0]} ${v.nota}`).join(' · ')} → ${aprobado ? 'CONSENSO' : 'sin consenso'}`)
return { aprobado, votes }