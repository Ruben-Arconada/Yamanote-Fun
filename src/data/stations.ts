// Real Yamanote Line stations, in loop order (sotomawari / clockwise direction).
// Distances are approximate real-world inter-station distances in km, used only
// to give the loop a stylized, non-uniform rhythm — this is an artistic
// interpretation of the line, not a to-scale map of Tokyo.

export type StationTheme = {
  buildingColor: number
  accentColor: number
  district: 'business' | 'downtown' | 'shitamachi' | 'green' | 'youth' | 'bay'
}

export interface StationDef {
  id: string
  nameEn: string
  nameJa: string
  distanceToNextKm: number
  landmark: boolean
  theme: StationTheme
  blurb: string
}

const THEMES: Record<StationTheme['district'], StationTheme> = {
  business: { buildingColor: 0x445064, accentColor: 0x8fa3c4, district: 'business' },
  downtown: { buildingColor: 0x51465c, accentColor: 0xe0559a, district: 'downtown' },
  shitamachi: { buildingColor: 0x5c4a3c, accentColor: 0xd98f4a, district: 'shitamachi' },
  green: { buildingColor: 0x3f5540, accentColor: 0x8fce6a, district: 'green' },
  youth: { buildingColor: 0x4a3f5c, accentColor: 0xff5da2, district: 'youth' },
  bay: { buildingColor: 0x3a4a58, accentColor: 0x5ad1e0, district: 'bay' },
}

export const STATIONS: StationDef[] = [
  { id: 'tokyo', nameEn: 'Tokyo', nameJa: '東京', distanceToNextKm: 1.3, landmark: true, theme: THEMES.business, blurb: 'La fachada de ladrillo rojo y el corazón ferroviario de Japón.' },
  { id: 'kanda', nameEn: 'Kanda', nameJa: '神田', distanceToNextKm: 1.2, landmark: false, theme: THEMES.business, blurb: 'Callejones de oficinistas bajo las vías elevadas.' },
  { id: 'akihabara', nameEn: 'Akihabara', nameJa: '秋葉原', distanceToNextKm: 1.4, landmark: true, theme: THEMES.downtown, blurb: 'Neones, anime y electrónica hasta donde alcanza la vista.' },
  { id: 'okachimachi', nameEn: 'Okachimachi', nameJa: '御徒町', distanceToNextKm: 0.6, landmark: false, theme: THEMES.shitamachi, blurb: 'El bullicio del mercado de Ameyoko justo al lado.' },
  { id: 'ueno', nameEn: 'Ueno', nameJa: '上野', distanceToNextKm: 1.1, landmark: true, theme: THEMES.green, blurb: 'La estación puerta al gran parque y sus cerezos.' },
  { id: 'uguisudani', nameEn: 'Uguisudani', nameJa: '鶯谷', distanceToNextKm: 1.4, landmark: false, theme: THEMES.shitamachi, blurb: 'Un rincón tranquilo entre templos.' },
  { id: 'nippori', nameEn: 'Nippori', nameJa: '日暮里', distanceToNextKm: 0.7, landmark: false, theme: THEMES.shitamachi, blurb: 'Barrio textil de calles estrechas.' },
  { id: 'nishi-nippori', nameEn: 'Nishi-Nippori', nameJa: '西日暮里', distanceToNextKm: 1.2, landmark: false, theme: THEMES.shitamachi, blurb: 'Vistas sobre un mar de tejados bajos.' },
  { id: 'tabata', nameEn: 'Tabata', nameJa: '田端', distanceToNextKm: 1.4, landmark: false, theme: THEMES.shitamachi, blurb: 'Cruce silencioso de líneas hacia el norte.' },
  { id: 'komagome', nameEn: 'Komagome', nameJa: '駒込', distanceToNextKm: 1.2, landmark: false, theme: THEMES.green, blurb: 'Cerca de jardines japoneses centenarios.' },
  { id: 'sugamo', nameEn: 'Sugamo', nameJa: '巣鴨', distanceToNextKm: 1.9, landmark: false, theme: THEMES.shitamachi, blurb: 'La calle comercial favorita de las abuelas de Tokio.' },
  { id: 'otsuka', nameEn: 'Otsuka', nameJa: '大塚', distanceToNextKm: 1.8, landmark: false, theme: THEMES.shitamachi, blurb: 'Uno de los últimos tranvías de la ciudad cruza aquí.' },
  { id: 'ikebukuro', nameEn: 'Ikebukuro', nameJa: '池袋', distanceToNextKm: 0.9, landmark: true, theme: THEMES.downtown, blurb: 'Rascacielos, grandes almacenes y la torre Sunshine.' },
  { id: 'mejiro', nameEn: 'Mejiro', nameJa: '目白', distanceToNextKm: 1.6, landmark: false, theme: THEMES.green, blurb: 'Un respiro arbolado junto a un campus universitario.' },
  { id: 'takadanobaba', nameEn: 'Takadanobaba', nameJa: '高田馬場', distanceToNextKm: 1.1, landmark: false, theme: THEMES.youth, blurb: 'Estudiantes y sonidos de guitarra callejera.' },
  { id: 'shin-okubo', nameEn: 'Shin-Okubo', nameJa: '新大久保', distanceToNextKm: 0.9, landmark: false, theme: THEMES.youth, blurb: 'El barrio coreano más animado de Tokio.' },
  { id: 'shinjuku', nameEn: 'Shinjuku', nameJa: '新宿', distanceToNextKm: 1.4, landmark: true, theme: THEMES.downtown, blurb: 'El nudo de trenes más transitado del planeta.' },
  { id: 'yoyogi', nameEn: 'Yoyogi', nameJa: '代々木', distanceToNextKm: 1.0, landmark: false, theme: THEMES.business, blurb: 'Entre el bullicio de Shinjuku y la calma del parque.' },
  { id: 'harajuku', nameEn: 'Harajuku', nameJa: '原宿', distanceToNextKm: 1.4, landmark: true, theme: THEMES.youth, blurb: 'Moda excéntrica junto a la puerta del santuario Meiji.' },
  { id: 'shibuya', nameEn: 'Shibuya', nameJa: '渋谷', distanceToNextKm: 2.1, landmark: true, theme: THEMES.youth, blurb: 'Pantallas gigantes y el cruce peatonal más famoso del mundo.' },
  { id: 'ebisu', nameEn: 'Ebisu', nameJa: '恵比寿', distanceToNextKm: 1.2, landmark: false, theme: THEMES.business, blurb: 'Antigua fábrica de cerveza reconvertida en barrio elegante.' },
  { id: 'meguro', nameEn: 'Meguro', nameJa: '目黒', distanceToNextKm: 1.6, landmark: false, theme: THEMES.green, blurb: 'Río de cerezos y calles en cuesta.' },
  { id: 'gotanda', nameEn: 'Gotanda', nameJa: '五反田', distanceToNextKm: 1.6, landmark: false, theme: THEMES.business, blurb: 'Oficinas silenciosas junto al río Meguro.' },
  { id: 'osaki', nameEn: 'Osaki', nameJa: '大崎', distanceToNextKm: 0.9, landmark: false, theme: THEMES.business, blurb: 'Torres de cristal donde antes hubo fábricas.' },
  { id: 'shinagawa', nameEn: 'Shinagawa', nameJa: '品川', distanceToNextKm: 1.6, landmark: true, theme: THEMES.bay, blurb: 'Puerta hacia la bahía y el Shinkansen.' },
  { id: 'takanawa-gateway', nameEn: 'Takanawa Gateway', nameJa: '高輪ゲートウェイ', distanceToNextKm: 1.3, landmark: false, theme: THEMES.bay, blurb: 'La estación más joven de la línea, toda cristal y madera.' },
  { id: 'tamachi', nameEn: 'Tamachi', nameJa: '田町', distanceToNextKm: 1.5, landmark: false, theme: THEMES.business, blurb: 'Oficinas frente a la bahía de Tokio.' },
  { id: 'hamamatsucho', nameEn: 'Hamamatsucho', nameJa: '浜松町', distanceToNextKm: 1.2, landmark: false, theme: THEMES.bay, blurb: 'La torre de Tokio se asoma entre los edificios.' },
  { id: 'shimbashi', nameEn: 'Shimbashi', nameJa: '新橋', distanceToNextKm: 1.1, landmark: false, theme: THEMES.business, blurb: 'El bar bajo las vías donde los oficinistas brindan al salir.' },
  { id: 'yurakucho', nameEn: 'Yurakucho', nameJa: '有楽町', distanceToNextKm: 0.9, landmark: false, theme: THEMES.business, blurb: 'A un paso del Palacio Imperial y Ginza.' },
]

export const TOTAL_LOOP_KM = STATIONS.reduce((sum, s) => sum + s.distanceToNextKm, 0)

export function nextStationIndex(i: number): number {
  return (i + 1) % STATIONS.length
}
