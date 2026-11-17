const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const templateHtml = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');
const TELEGRAM_TOKEN = '9253246227:AAFaJzhi3uxaoWLuxg9E0HZ4WfT0YdPts6w';
const EDITOR_CHAT_ID = '6008268963';
const PUBLIC_BASE_URL = (process.env.RENDER_EXTERNAL_URL || 'https://el-registro-sur.onrender.com').replace(/\/$/, '');

const RUTA_CACHE_ESTADO = '/tmp/ultimo_estado_ers.json';
const RUTA_CACHE_HISTORIAL = '/tmp/historial_radar_ers.json';
const RUTA_CACHE_IMAGENES = '/tmp/cache_imagenes_ers.json';
const RUTA_COLA_PUBLICACION = '/tmp/cola_publicacion_ers.json';
const RUTA_CONFIG_SISTEMA = '/tmp/config_ers.json';

const CLAVE_GROQ_RESPALDO = ['gsk', 'C9XrhxVzidzc2quADlxqWGdyb3FYYXpRiM09cKPoYBu0jkb3QE8v'].join('_');
const CLAVES_SERPER_RESPALDO = [
  ['f1f58f1c20c52df9d24de', '6c5c2f83145253caff8'].join(''),
  ['1d4e4df6445b6228a0889', '4441911bc5f9ac2d4aa'].join('')
];

const FUENTES_RSS_RADAR = [
  { url: 'https://laopinionaustral.com.ar/feed/', medio: 'LA OPINIÓN AUSTRAL', categoria: 'regional' },
  { url: 'https://infocaleta.com/v2/feed/', medio: 'INFOCALETA', categoria: 'regional' },
  { url: 'https://vocesyapuntes.com/feed/', medio: 'VOCES Y APUNTES', categoria: 'regional' },
  { url: 'https://lavanguardianoticias.com.ar/feed/', medio: 'LA VANGUARDIA', categoria: 'regional' },
  { url: 'https://lagacetadesantacruz.com.ar/feed/', medio: 'LA GACETA SANTA CRUZ', categoria: 'regional' },
  { url: 'https://ecosdelsur.com/feed/', medio: 'ECOS DEL SUR', categoria: 'regional' },
  { url: 'https://www.tiemposur.com.ar/rss/noticias.xml', medio: 'TIEMPOSUR', categoria: 'regional' },
  { url: 'https://www.eldiarionuevodia.com.ar/rss/', medio: 'NUEVO DÍA', categoria: 'regional' },
  { url: 'https://opisantacruz.com.ar/feed/', medio: 'OPI SANTA CRUZ', categoria: 'regional' },
  { url: 'https://winfosantacruz.com/feed/', medio: 'WINFO SANTA CRUZ', categoria: 'regional' },
  { url: 'https://senalcalafate.com/feed/', medio: 'SEÑAL CALAFATE', categoria: 'regional' },
  { url: 'https://ahoracalafate.com.ar/rss/', medio: 'AHORA CALAFATE', categoria: 'regional' },
  { url: 'https://patagonianexo.com/feed/', medio: 'PATAGONIA NEXO', categoria: 'regional' },
  { url: 'https://elciudadanodelasheras.com/feed/', medio: 'EL CIUDADANO LAS HERAS', categoria: 'regional' },
  { url: 'https://noticias.santacruz.gob.ar/feed/', medio: 'PRENSA SANTA CRUZ', categoria: 'regional' },
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('(site:elcaletense.net OR site:eldiarionuevodia.com.ar OR site:tiemposur.com.ar OR "Caleta Olivia" OR "Claudio Vidal") when:24h') + '&hl=es-419&gl=AR&ceid=AR:es-419', medio: 'SANTA CRUZ', categoria: 'regional' },
  { url: 'https://www.elpatagonico.com/rss/pages/home.xml', medio: 'EL PATAGÓNICO', categoria: 'regional' },
  { url: 'https://www.adnsur.com.ar/rss/feed.xml', medio: 'ADNSUR', categoria: 'regional' },
  { url: 'https://econojournal.com.ar/feed/', medio: 'ECONOJOURNAL', categoria: 'regional' },
  { url: 'https://derechadiario.com.ar/feed/', medio: 'LA DERECHA DIARIO', categoria: 'nacional' },
  { url: 'https://www.infobae.com/arc/outboundfeeds/rss/', medio: 'INFOBAE', categoria: 'nacional' },
  { url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', medio: 'LA NACIÓN', categoria: 'nacional' },
  { url: 'https://www.clarin.com/rss/lo-ultimo/', medio: 'CLARÍN', categoria: 'nacional' },
  { url: 'https://tn.com.ar/arc/outboundfeeds/rss/', medio: 'TN', categoria: 'nacional' },
  { url: 'https://www.ambito.com/rss/pages/home.xml', medio: 'ÁMBITO', categoria: 'nacional' },
  { url: 'https://www.pagina12.com.ar/rss/portada', medio: 'PÁGINA 12', categoria: 'nacional' },
  { url: 'https://eleconomista.com.ar/feed/', medio: 'EL ECONOMISTA', categoria: 'nacional' },
  { url: 'https://www.perfil.com/feed', medio: 'PERFIL', categoria: 'nacional' },
  { url: 'https://www.filo.news/rss/feed.xml', medio: 'FILO NEWS', categoria: 'nacional' },
  { url: 'https://feeds.bbci.co.uk/mundo/rss.xml', medio: 'BBC MUNDO', categoria: 'internacional' },
  { url: 'https://rss.dw.com/xml/rss-sp-all', medio: 'DW ESPAÑOL', categoria: 'internacional' },
  { url: 'https://www.france24.com/es/rss', medio: 'FRANCE 24', categoria: 'internacional' },
  { url: 'https://www.infobae.com/america/arc/outboundfeeds/rss/', medio: 'INFOBAE MUNDO', categoria: 'internacional' },
  { url: 'https://www.paparazzi.com.ar/feed/', medio: 'PAPARAZZI', categoria: 'espectaculos' },
  { url: 'https://exitoina.perfil.com/feed', medio: 'EXITOÍNA', categoria: 'espectaculos' },
  { url: 'https://www.pronto.com.ar/rss/feed.xml', medio: 'PRONTO', categoria: 'espectaculos' }
];

const DOMINIOS_PROHIBIDOS_IMG = /bing\.com\/th|halo|xbox|playstation|nintendo|steam|epicgames|ign\.com|3djuegos|vandal|hobbyconsolas|meristation|kotaku|fandom|wikia|gamer|gaming|videojuego|minecraft|fortnite|gta|warthog|masterchief|meme|9gag|reddit|imgur|pinterest|deviantart|artstation|wallpaper|alphacoders|freepik|shutterstock|istock|vecteezy|flaticon|pngtree|tiktok|unsplash/i;

const MEDIOS_PROHIBIDOS_COPIAR = new Set([
  'opisantacruz', 'tiemposur', 'laopinionaustral', 'infocaleta', 'vocesyapuntes', 'lavanguardia',
  'lavanguardianoticias', 'lagaceta', 'ecosdelsur', 'nuevodia', 'eldiarionuevodia', 'winfosantacruz',
  'senalcalafate', 'ahoracalafate', 'patagonianexo', 'elciudadano', 'elcaletense', 'elpatagonico',
  'adnsur', 'econojournal', 'derechadiario', 'laderechadiario', 'infobae', 'lanacion', 'clarin',
  'tn', 'todonoticias', 'ambito', 'pagina12', 'eleconomista', 'perfil', 'filonews', 'bbcmundo',
  'dw', 'france24', 'paparazzi', 'exitoina', 'pronto', 'desayunoamericano', 'intrusos', 'cortanoticias', 'elcanciller'
]);

let ultimoEstado = {
  foto_url: '', foto_original_url: '', foto_secundaria_url: '', fotos_usadas: [],
  foco_vertical: '18%', logo_esquina: 'ninguno', pin_geografico: '',
  categoria: '', titulo: '', destacar: '', bajada: '', copy: '',
  dato_clave: '', autor_cita: '', etiqueta_duelo_1: 'PROTAGONISTA 1', etiqueta_duelo_2: 'PROTAGONISTA 2',
  hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: [],
  fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: '', busqueda_foto_web: '', busqueda_foto_secundaria: '',
  prompt_imagen_ia: 'journalism news photography Argentina', fill_mode: 'cover', modo_visual: 'estandar',
  urgente: false, ultimo_message_id: null, imagen_buffer: null, historia_buffer: null, carrusel_buffers: []
};

const colaBorradores = [];
let colaPublicacion = [];
let cacheImagenes24h = {};
let configSistema = {
  makeWebhookUrl: (process.env.MAKE_WEBHOOK_URL || '').trim()
};
let estadisticasDia = { fecha: '', groqLlamadas: 0, serperLlamadas: 0, serperCacheHits: 0, placasRenderizadas: 0, publicadasHoy: 0 };

let ultimasTopCandidatas = [];
const noticiasEnviadasRadar = new Set();
const temasEnviadosPalabras = [];
const memoriaTitularesRecientes = [];

let ultimoClimaDiaEnviado = '';
let ultimoResumenDiaEnviado = '';
let ultimoComandoTexto = '';
let ultimoComandoTimestamp = 0;
let indiceClaveGroq = 0;
let indiceClaveSerper = 0;

function verificarReinicioEstadisticasDia() {
  const hoy = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos' });
  if (estadisticasDia.fecha !== hoy) {
    estadisticasDia = { fecha: hoy, groqLlamadas: 0, serperLlamadas: 0, serperCacheHits: 0, placasRenderizadas: 0, publicadasHoy: 0 };
  }
}

// ============================================================================
// PERSISTENCIA EN DISCO (/tmp) Y NAVEGADOR SINGLETON ANTI-CAÍDAS
// ============================================================================

let browserGlobal = null;
let contadorRendersBrowser = 0;

async function obtenerBrowserSingleton() {
  try {
    if (browserGlobal && browserGlobal.isConnected() && contadorRendersBrowser < 25) {
      contadorRendersBrowser++;
      return browserGlobal;
    }
    if (browserGlobal) { try { await browserGlobal.close(); } catch (e) {} browserGlobal = null; }
  } catch (e) { browserGlobal = null; }

  contadorRendersBrowser = 1;
  browserGlobal = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security', '--no-zygote', '--disable-extensions']
  });
  return browserGlobal;
}

function guardarConfigSistema() { try { fs.writeFileSync(RUTA_CONFIG_SISTEMA, JSON.stringify(configSistema), 'utf-8'); } catch (e) {} }
function cargarConfigSistema() {
  try {
    if (fs.existsSync(RUTA_CONFIG_SISTEMA)) {
      const d = JSON.parse(fs.readFileSync(RUTA_CONFIG_SISTEMA, 'utf-8'));
      if (d?.makeWebhookUrl) configSistema.makeWebhookUrl = d.makeWebhookUrl;
    }
  } catch (e) {}
}

function guardarCacheImagenes24h() {
  try {
    const ahora = Date.now();
    const limpio = {};
    for (const [k, v] of Object.entries(cacheImagenes24h)) {
      if (v && (ahora - v.ts) < 24 * 60 * 60 * 1000) limpio[k] = v;
    }
    cacheImagenes24h = limpio;
    fs.writeFileSync(RUTA_CACHE_IMAGENES, JSON.stringify(cacheImagenes24h), 'utf-8');
  } catch (e) {}
}
function cargarCacheImagenes24h() {
  try { if (fs.existsSync(RUTA_CACHE_IMAGENES)) cacheImagenes24h = JSON.parse(fs.readFileSync(RUTA_CACHE_IMAGENES, 'utf-8')) || {}; } catch (e) { cacheImagenes24h = {}; }
}

function guardarColaPublicacionEnDisco() {
  try {
    const ser = colaPublicacion.map(i => ({ ...i, imagen_base64: i.imagen_buffer ? i.imagen_buffer.toString('base64') : i.imagen_base64 || '', imagen_buffer: null }));
    fs.writeFileSync(RUTA_COLA_PUBLICACION, JSON.stringify(ser), 'utf-8');
  } catch (e) {}
}
function cargarColaPublicacionDesdeDisco() {
  try {
    if (fs.existsSync(RUTA_COLA_PUBLICACION)) {
      const raw = JSON.parse(fs.readFileSync(RUTA_COLA_PUBLICACION, 'utf-8'));
      if (Array.isArray(raw)) {
        colaPublicacion = raw.map(i => ({ ...i, imagen_buffer: i.imagen_base64 ? Buffer.from(i.imagen_base64, 'base64') : null })).filter(i => i.imagen_buffer && i.titulo);
      }
    }
  } catch (e) { colaPublicacion = []; }
}

function persistirHistorialEnDisco() {
  try {
    fs.writeFileSync(RUTA_CACHE_HISTORIAL, JSON.stringify({
      enviadas: Array.from(noticiasEnviadasRadar).slice(-120),
      titularesMemoria: memoriaTitularesRecientes.slice(0, 60)
    }), 'utf-8');
  } catch (e) {}
}
function cargarHistorialDesdeDisco() {
  try {
    if (fs.existsSync(RUTA_CACHE_HISTORIAL)) {
      const d = JSON.parse(fs.readFileSync(RUTA_CACHE_HISTORIAL, 'utf-8'));
      if (Array.isArray(d.enviadas)) d.enviadas.forEach(t => registrarTemaEnviado(t, false));
      if (Array.isArray(d.titularesMemoria)) memoriaTitularesRecientes.push(...d.titularesMemoria.slice(0, 60));
    }
  } catch (e) {}
}

function persistirEstadoEnDisco(estado) {
  try {
    if (!estado || !estado.titulo) return;
    const copia = { ...estado, imagen_base64_cache: estado.imagen_buffer ? estado.imagen_buffer.toString('base64') : '', imagen_buffer: null, historia_buffer: null, carrusel_buffers: [] };
    fs.writeFileSync(RUTA_CACHE_ESTADO, JSON.stringify(copia), 'utf-8');
  } catch (e) {}
}
function cargarEstadoDesdeDisco() {
  try {
    if (fs.existsSync(RUTA_CACHE_ESTADO)) {
      const raw = JSON.parse(fs.readFileSync(RUTA_CACHE_ESTADO, 'utf-8'));
      if (raw && raw.titulo) {
        ultimoEstado = {
          ...ultimoEstado, ...raw,
          fotos_usadas: Array.isArray(raw.fotos_usadas) ? raw.fotos_usadas : [],
          hitos_cronologia: Array.isArray(raw.hitos_cronologia) ? raw.hitos_cronologia : [],
          items_servicios: Array.isArray(raw.items_servicios) ? raw.items_servicios : [],
          imagen_buffer: raw.imagen_base64_cache ? Buffer.from(raw.imagen_base64_cache, 'base64') : null,
          historia_buffer: null, carrusel_buffers: []
        };
      }
    }
  } catch (e) {}
}

function guardarEnColaBorradores(nuevoEstado) {
  if (ultimoEstado && ultimoEstado.imagen_buffer && ultimoEstado.titulo) {
    colaBorradores.unshift({ ...ultimoEstado });
    if (colaBorradores.length > 5) colaBorradores.pop();
  }
  if (!Array.isArray(nuevoEstado.fotos_usadas)) {
    nuevoEstado.fotos_usadas = [nuevoEstado.foto_original_url, nuevoEstado.foto_url].filter(Boolean);
  }
  ultimoEstado = nuevoEstado;
  persistirEstadoEnDisco(ultimoEstado);
}

setInterval(() => {
  try {
    const archivosTmp = fs.readdirSync('/tmp');
    const ahora = Date.now();
    for (const nombre of archivosTmp) {
      if (nombre.startsWith('puppeteer_dev_') || nombre.startsWith('.org.chromium.')) {
        const fullPath = path.join('/tmp', nombre);
        if (ahora - fs.statSync(fullPath).mtimeMs > 25 * 60 * 1000) fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  } catch (e) {}
}, 20 * 60 * 1000);

app.get('/ping', (req, res) => res.status(200).send('OK - El Registro Sur v12.0 Activo'));

// ============================================================================
// SANITIZADORES: CERO "SUBTEMA CLAVE:", CERO COPIONES Y HASHTAGS LIMPIOS
// ============================================================================

const EMOJIS_SEGUROS_META = new Set([
  '🚨', '🔴', '🟠', '🟡', '🚧', '🚔', '🚒', '🚑', '🛑', '💨', '🌀', '🌊', '💧', '☔', '⛄', '⛅', '⚡', '🔥', '🌈',
  '💰', '💵', '📈', '📉', '📊', '⛽', '🏭', '🚜', '🚛', '🚢', '🐟', '📢', '📣', '📰', '📋', '📄', '📜', '🏥', '🏫',
  '🎓', '👷', '🤝', '📍', '📅', '🕒', '⚽', '🏆', '🏅', '🎭', '🎶', '👇', '👉', '📲', '💬', '✅', '❌'
]);

const MAPA_REEMPLAZO_EMOJIS = {
  '🌧': '☔', '🌨': '⛄', '❄': '⛄', '🌩': '⚡', '🌪': '💨', '🌬': '💨', '☀': '⛅', '🌤': '⛅',
  '🌡': '🔥', '⚠': '🚨', '🏛': '📢', '⚖': '📜', '🗣': '📢', '🚓': '🚔', '🛢': '⛽', '💸': '💵', '🏦': '💰', '🗳': '📋'
};

const CONECTORES_COLGADOS = new Set([
  'DE', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS', 'A', 'AL', 'DEL', 'EN', 'CON', 'POR', 'PARA',
  'SIN', 'TRAS', 'ANTE', 'BAJO', 'SOBRE', 'ENTRE', 'HACIA', 'HASTA', 'DESDE', 'Y', 'E', 'O', 'U', 'NI', 'QUE',
  'SE', 'SU', 'SUS', 'LO', 'LE', 'LES', 'MAS', 'MÁS', 'MUY', 'ES', 'SON', 'FUE'
]);

const PREFIJOS_COMPUESTOS = new Set([
  'RÍO', 'RIO', 'CALETA', 'PICO', 'PUERTO', 'SAN', 'SANTA', 'SANTO', 'GENERAL', 'COMODORO', 'VILLA', 'CAÑADÓN', 'CANADON',
  'GOBERNADOR', 'GOBERNADORA', 'INTENDENTE', 'INTENDENTA', 'CONCEJAL', 'CONCEJALA', 'DIPUTADO', 'DIPUTADA', 'SENADOR', 'SENADORA',
  'MINISTRO', 'MINISTRA', 'SECRETARIO', 'SECRETARIA', 'SUBSECRETARIO', 'JUEZ', 'JUEZA', 'FISCAL', 'CANDIDATO', 'CANDIDATA',
  'POSTULADO', 'POSTULADA', 'DELEGADO', 'DELEGADA', 'PRESIDENTE', 'PRESIDENTA', 'TITULAR', 'VOCERO', 'VOCERA', 'DIRIGENTE',
  'EMPRESARIO', 'EMPRESARIA', 'CONDUCTOR', 'CONDUCTORA', 'ACTRIZ', 'ACTOR', 'MODELO', 'CANTANTE', 'REFERENTE', 'GREMIALISTA',
  'COMISARIO', 'PERITO', 'PIEDRA', 'PUNTA', 'BAHÍA', 'BAHIA', 'TIERRA', 'ZONA', 'GOLFO', 'CABO', 'LAGO', 'LAGUNA', 'CERRO',
  'MONTE', 'SIERRA', 'CASA', 'CORTE', 'BANCO', 'RIESGO', 'DÓLAR', 'DOLAR', 'RUTA', 'SERVICIO', 'SERVICIOS', 'VIALIDAD',
  'POLICÍA', 'POLICIA', 'ARMADA', 'GRAN', 'JAVIER', 'CLAUDIO', 'CRISTINA', 'AXEL', 'PABLO', 'FERNANDO', 'LUIS', 'JUAN',
  'MARÍA', 'MARIA', 'LA', 'EL', 'LOS', 'LAS', '28', 'VEINTIOCHO', 'PASO', 'REFORMA', 'PAPA', 'LEÓN', 'LEON', 'RECONTRA'
]);

const SUFIJOS_COMPUESTOS = new Set([
  'GALLEGOS', 'OLIVIA', 'TRUNCADO', 'DESEADO', 'JULIÁN', 'JULIAN', 'CALAFATE', 'CHALTÉN', 'CHALTEN', 'TURBIO', 'ANTIGUOS',
  'MORENO', 'BUENA', 'RIVADAVIA', 'CRUZ', 'FUEGO', 'AIRES', 'BLANCA', 'ARENAS', 'SECO', 'GREGORES', 'JORGE', 'PAULA',
  'SANTOS', 'ROSADA', 'SUPREMA', 'CENTRAL', 'PAÍS', 'PAIS', 'BLUE', 'OFICIAL', 'MILEI', 'VIDAL', 'KIRCHNER', 'KICILLOF',
  'GRASSO', 'CARRIZO', 'COTILLO', 'ELECTORAL', 'JUDICIAL', 'LABORAL', 'XIV', 'PREVOST', 'SUÁREZ', 'SUAREZ', 'NARA', 'ICARDI', 'BRITO'
]);

function escaparHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function limpiarPalabraSignos(p) {
  return String(p || '').replace(/^[^A-ZÁÉÍÓÚÜÑ0-9]+|[^A-ZÁÉÍÓÚÜÑ0-9]+$/gi, '').toUpperCase();
}

function detectarPinGeografico(texto) {
  const t = String(texto || '');
  const lugares = [
    { reg: /ram[óo]n santos/i, pin: 'RAMÓN SANTOS' }, { reg: /el gorosito/i, pin: 'EL GOROSITO' },
    { reg: /chimen aike/i, pin: 'CHIMEN AIKE' }, { reg: /cañad[óo]n seco/i, pin: 'CAÑADÓN SECO' },
    { reg: /barrio\s+([a-záéíóúñ0-9\s]{3,18})/i, pin: null },
    { reg: /ruta\s+(?:nacional\s+)?(?:n[°º]?\s*)?3/i, pin: 'RUTA NACIONAL 3' },
    { reg: /caleta olivia/i, pin: 'CALETA OLIVIA' }, { reg: /r[íi]o gallegos/i, pin: 'RÍO GALLEGOS' },
    { reg: /pico truncado/i, pin: 'PICO TRUNCADO' }, { reg: /las heras/i, pin: 'LAS HERAS' },
    { reg: /puerto deseado/i, pin: 'PUERTO DESEADO' }, { reg: /el calafate/i, pin: 'EL CALAFATE' },
    { reg: /r[íi]o turbio/i, pin: 'RÍO TURBIO' }, { reg: /28 de noviembre/i, pin: '28 DE NOVIEMBRE' }
  ];
  for (const item of lugares) {
    const m = t.match(item.reg);
    if (m) return item.pin ? item.pin : `B° ${m[1].trim().toUpperCase().slice(0, 18)}`;
  }
  return '';
}

// Elimina cualquier mención a diarios competidores, corrige siglas de Santa Cruz y limpia frases de gacetilla
function depurarEstiloPeriodistico(texto) {
  if (!texto) return '';
  return String(texto)
    // Borra rótulos internos como "Subtema clave: ...", "Copete:", "Desarrollo:"
    .replace(/^\s*(?:subtema\s*clave|subt[íi]tulo(?:\s*en\s*l[íi]nea)?|tema\s*[0-9]*|p[áa]rrafo\s*[0-9]*|copete|desarrollo|cierre(?:\s*informativo)?|conclusi[óo]n)\s*:\s*[^\n]*\n+/gim, '')
    .replace(/^\s*(?:subtema\s*clave|subt[íi]tulo(?:\s*en\s*l[íi]nea)?|p[áa]rrafo\s*[0-9]*|copete|desarrollo|cierre(?:\s*informativo)?|conclusi[óo]n)\s*:\s*/gim, '')
    // Corrige siglas mal explicadas
    .replace(/Oficina de Desarrollo Urbano y Vivienda/gi, 'Instituto de Desarrollo Urbano y Vivienda')
    // Borra menciones a diarios competidores en el texto ("según OPI Santa Cruz", "informó TiempoSur", etc.)
    .replace(/\b(?:seg[úu]n\s+(?:inform[óo]|consign[óo]|public[óo]|revel[óo])|en\s+di[áa]logo\s+con|declar[óo]\s+a)\s+(?:OPI\s+Santa\s+Cruz|Tiempo\s*Sur|La\s+Opini[óo]n\s+Austral|InfoCaleta|Voces\s+y\s+Apuntes|El\s+Caletense|El\s+Diario\s+Nuevo\s+D[íi]a|ADNSUR|El\s+Patag[óo]nico|Infobae|Clar[íi]n|La\s+Naci[óo]n|Perfil|TN)\b[,]?/gi, 'según trascendió oficialmente')
    .replace(/\belogó\b/g, 'elogió').replace(/\bElogó\b/g, 'Elogió').replace(/\bELOGÓ\b/g, 'ELOGIÓ')
    .replace(/\bfortes\b/gi, (m) => (m === m.toUpperCase() ? 'FUERTES' : 'fuertes'))
    .replace(/\bprimer provincia\b/gi, 'primera provincia').replace(/\bprimer medida\b/gi, 'primera medida')
    .replace(/\bprimer denuncia\b/gi, 'primera denuncia').replace(/\bprimer audiencia\b/gi, 'primera audiencia')
    .replace(/\bla juez\b/gi, 'la jueza').replace(/\bla intendente\b/gi, 'la intendenta')
    .replace(/\bexpresaron su alegr[íi]a por\b/gi, 'confirmaron').replace(/\bexpres[óo] su alegr[íi]a por\b/gi, 'confirmó')
    .replace(/\bcelebraron el inicio de\b/gi, 'confirmaron el inicio de').replace(/\bcelebr[óo] el inicio de\b/gi, 'confirmó el inicio de')
    .replace(/\bcelebraron la\b/gi, 'destacaron la').replace(/\ben el marco de una\b/gi, 'durante una')
    .replace(/\ben el día de la fecha\b/gi, 'hoy');
}

// Sanitizador de Hashtags: corrige errores (#rgiogales -> #riogallegos, #wandanar -> #wandanara), quita tildes y bloquea medios rivales
function normalizarHashtagsSeguros(bloqueHashtags, textoContexto = '') {
  const mapaCorrecciones = {
    rgiogales: 'riogallegos',
    rgiogallegos: 'riogallegos',
    riogalegos: 'riogallegos',
    caleta: 'caletaolivia',
    caletaoliva: 'caletaolivia',
    wandanar: 'wandanara',
    chinasuarez: 'lachinasuarez',
    climadeinvierno: 'clima'
  };

  const extraidos = (String(bloqueHashtags || '').match(/#[a-záéíóúüñ0-9_]+/gi) || [])
    .map(tag => {
      let limpio = tag.toLowerCase()
        .replace(/^#+/, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quita tildes (#polémica -> #polemica)
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]/g, '');
      if (mapaCorrecciones[limpio]) limpio = mapaCorrecciones[limpio];
      return limpio;
    })
    .filter(w => w.length >= 3 && w.length <= 24 && !MEDIOS_PROHIBIDOS_COPIAR.has(w));

  const obligatorios = ['noticias', 'elregistrosur', 'caletaolivia', 'santacruz'];
  const contextuales = [];
  const t = String(textoContexto || '').toLowerCase();
  if (/r[íi]o gallegos/.test(t)) contextuales.push('riogallegos');
  if (/claudio vidal|gobernador/.test(t)) contextuales.push('claudiovidal');
  if (/milei|gobierno nacional/.test(t)) contextuales.push('argentina');
  if (/petr[óo]leo|ypf|energ[íi]a|gas|distrigas/.test(t)) contextuales.push('energia');
  if (/ruta 3|vialidad|tr[áa]nsito/.test(t)) contextuales.push('ruta3');

  const unicos = [...new Set([...obligatorios, ...contextuales, ...extraidos])].slice(0, 9);
  return unicos.map(w => `#${w}`).join(' ');
}

// Garantiza que en la placa jamás salga el nombre de un diario competidor como "FUENTE: OPI SANTA CRUZ" o "FUENTE: PERFIL"
function limpiarCreditoFuentePropio(credito) {
  const c = limpiarEmojis(credito || '').toUpperCase().trim();
  if (!c) return 'EL REGISTRO SUR';
  const clave = c.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const prohibido of MEDIOS_PROHIBIDOS_COPIAR) {
    if (clave.includes(prohibido)) return 'EL REGISTRO SUR';
  }
  if (/PRENSA|OFICIAL|METEOROL|VIALIDAD|EXCLUSIVO|ILUSTRACI|MERCADOS|REDACCI|ARCHIVO|REGISTRO SUR/.test(c)) {
    return c;
  }
  return 'EL REGISTRO SUR';
}

function extraerDatoClaveAutomatico(estado) {
  if (estado.dato_clave && estado.dato_clave.trim().length > 1 && !/DATO CLAVE/i.test(estado.dato_clave)) return estado.dato_clave.trim().toUpperCase();
  const fuente = `${estado.titulo || ''} ${estado.bajada || ''}`;
  const matchMonto = fuente.match(/(?:USD|U\$S|\$)\s*\d+(?:[.,]\d+)?(?:\s*(?:MILLONES|MIL|BILLONES|M))?|\b\d+(?:[.,]\d+)?\s*(?:%|POR CIENTO|FAMILIAS|VOTOS|KM\/H|MILLONES|HORAS|DÍAS|LOCALIDADES|BARRIOS|EMPLEOS|POZOS|MW)\b/i);
  if (matchMonto) return matchMonto[0].toUpperCase();
  if (estado.destacar && estado.destacar.length <= 18) return estado.destacar.toUpperCase();
  return 'CIFRA CLAVE';
}

function extraerAutorCitaAutomatico(estado) {
  if (estado.autor_cita && estado.autor_cita.trim().length > 2 && !/DECLARACI[ÓO]N/i.test(estado.autor_cita)) return estado.autor_cita.trim().toUpperCase();
  const fuente = `${estado.bajada || ''} ${estado.copy || ''}`;
  const matchRol = fuente.match(/\b(?:el gobernador|la gobernadora|el intendente|la intendenta|el presidente|el ministro|la ministra|el concejal|la concejala|el diputado|la diputada|el senador|la senadora|el empresario|la empresaria|el conductor|la conductora|la actriz|el actor|la delegada|el delegado|el titular|el vocero|el candidato|la candidata)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?/i);
  if (matchRol) return matchRol[0].toUpperCase();
  return estado.categoria || 'DEFINICIÓN EDITORIAL';
}

function calcularAntiguedadNoticia(fechaRaw) {
  if (!fechaRaw) return { texto: 'Recién detectado', minutos: 120 };
  const fecha = new Date(fechaRaw);
  if (isNaN(fecha.getTime())) return { texto: 'Recién detectado', minutos: 120 };
  const diffMin = Math.floor(Math.max(0, Date.now() - fecha.getTime()) / 60000);
  let horaAR = '';
  try {
    horaAR = fecha.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos', hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs';
  } catch (e) {}
  const suf = horaAR ? ` (${horaAR})` : '';
  if (diffMin < 2) return { texto: `hace instantes${suf}`, minutos: diffMin };
  if (diffMin < 60) return { texto: `hace ${diffMin} min${suf}`, minutos: diffMin };
  if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60), m = diffMin % 60;
    return { texto: m > 0 ? `hace ${h} h ${m} min${suf}` : `hace ${h} h${suf}`, minutos: diffMin };
  }
  return { texto: `hace ${Math.floor(diffMin / 1440)} d${suf}`, minutos: diffMin };
}

function extraerPalabrasClave(titulo) {
  return String(titulo || '').toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, '').split(/\s+/)
    .filter(p => p.length > 4 && !['sobre', 'entre', 'desde', 'hasta', 'donde', 'cuando', 'porque', 'contra', 'durante', 'fueron', 'habia', 'tiene', 'tienen'].includes(p));
}

function esTemaRepetido(titulo) {
  const palabras = extraerPalabrasClave(titulo);
  if (palabras.length < 3) return false;
  for (const prev of temasEnviadosPalabras) {
    const c = palabras.filter(p => prev.has(p)).length;
    if (c >= 3 || c / palabras.length >= 0.6) return true;
  }
  return false;
}

function registrarTemaEnviado(titulo, guardarEnDisco = true) {
  if (!titulo) return;
  noticiasEnviadasRadar.add(titulo);
  const palabras = new Set(extraerPalabrasClave(titulo));
  if (palabras.size > 0) {
    temasEnviadosPalabras.unshift(palabras);
    if (temasEnviadosPalabras.length > 80) temasEnviadosPalabras.pop();
  }
  if (!memoriaTitularesRecientes.includes(titulo)) {
    memoriaTitularesRecientes.unshift(titulo);
    if (memoriaTitularesRecientes.length > 60) memoriaTitularesRecientes.pop();
  }
  if (guardarEnDisco) persistirHistorialEnDisco();
}

function buscarAntecedentesPropios(textoNoticia) {
  const palabrasActual = new Set(extraerPalabrasClave(textoNoticia));
  if (palabrasActual.size < 2 || memoriaTitularesRecientes.length === 0) return '';
  const rel = memoriaTitularesRecientes.filter(tit => {
    const pTit = extraerPalabrasClave(tit);
    const comunes = pTit.filter(w => palabrasActual.has(w)).length;
    return comunes >= 2 && comunes < pTit.length;
  }).slice(0, 3);
  return rel.length ? `\nANTECEDENTES RECIENTES CUBIERTOS POR EL REGISTRO SUR:\n${rel.map(r => `- ${r}`).join('\n')}` : '';
}

cargarConfigSistema();
cargarEstadoDesdeDisco();
cargarHistorialDesdeDisco();
cargarCacheImagenes24h();
cargarColaPublicacionDesdeDisco();

function limpiarEmojis(texto) {
  if (!texto) return '';
  return depurarEstiloPeriodistico(
    String(texto)
      .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
      .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:)\s*/gim, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

function elegirEmojisPorTema(texto) {
  const t = String(texto || '').toLowerCase();
  if (/gas|distrigas|obra|cañer|agua|spse|cloaca|acueducto|luz|energ|vivienda|iduv/.test(t)) return ['⛽', '👷'];
  if (/ruta|vuelco|choque|accidente|tránsito|corte|vialidad/.test(t)) return ['🚧', '🚨'];
  if (/polic|detenido|robo|allanamiento|crimen|justicia|juez|fiscal|corte suprema/.test(t)) return ['🚨', '🚔'];
  if (/viento|lluvia|clima|alerta|temporal|temperatura|smn/.test(t)) return ['💨', '☔'];
  if (/dólar|inflación|econom|sueldo|salario|paritaria|banco|impuesto|jubilad|anses|mercado/.test(t)) return ['💰', '📊'];
  if (/petróleo|ypf|pozo|minería|producción|puerto|pesca|buque|brent/.test(t)) return ['🏭', '⛽'];
  if (/fútbol|boca|river|selección|messi|deporte|colapinto|boxeo/.test(t)) return ['⚽', '🏆'];
  if (/wanda|china su[áa]rez|icardi|de brito|lam|far[áa]ndula|espect[áa]culo|tv/.test(t)) return ['🎭', '📢'];
  if (/guerra|ataque|misil|terremoto|sismo|internacional|mundo|onu|ee\.uu/.test(t)) return ['🚨', '🔴'];
  return ['📢', '📍'];
}

function filtrarEmojisSegurosRedes(texto) {
  if (!texto) return '';
  let limpio = depurarEstiloPeriodistico(String(texto))
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\*\*/g, '');

  for (const [ins, seg] of Object.entries(MAPA_REEMPLAZO_EMOJIS)) limpio = limpio.split(ins).join(seg);
  limpio = limpio.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, (m) => EMOJIS_SEGUROS_META.has(m) ? m : '');
  limpio = limpio
    .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:|\bTitular\s*:|\bCierre\s*:|\bSubtema\s*clave\s*:)\s*/gim, '')
    .replace(/\n---\n/g, '\n\n').replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Corrige el cierre equivocado si no es una alerta vial o climática
  const esTemaVialOClima = /ruta\s*3|ram[óo]n santos|vuelco|choque|tr[áa]nsito|temporal|alerta meteorol|nieve|escarcha/i.test(limpio);
  if (!esTemaVialOClima) {
    limpio = limpio.replace(/Compart[íi] este parte con tus vecinos o etiquet[áa] a quien circule hoy por la zona\s*👇?/gi, 'Compartí esta información o dejá tu opinión en los comentarios 👇');
  }

  let bloques = limpio.split('\n\n').map(b => b.trim()).filter(Boolean);

  // Separa y sanea el bloque de hashtags final
  let bloqueTagsRaw = '';
  if (bloques.length > 1 && bloques[bloques.length - 1].startsWith('#')) {
    bloqueTagsRaw = bloques.pop();
  }
  const tagsLimpios = normalizarHashtagsSeguros(bloqueTagsRaw, limpio);

  if (bloques.length > 0) {
    const sug = elegirEmojisPorTema(limpio);
    const em = [...bloques[0]].filter(ch => EMOJIS_SEGUROS_META.has(ch));
    if (em.length === 0) bloques[0] = `${bloques[0]} ${sug[0]}${sug[1]}`;
    else if (em.length === 1) bloques[0] = `${bloques[0]}${em[0] === sug[0] ? sug[1] : sug[0]}`;
  }

  let cuerpoFinal = bloques.join('\n\n');
  const maxCuerpo = 2165 - tagsLimpios.length;
  if (cuerpoFinal.length > maxCuerpo) {
    cuerpoFinal = cuerpoFinal.slice(0, maxCuerpo).replace(/\s+\S*$/, '') + '.';
  }

  return `${cuerpoFinal}\n\n${tagsLimpios}`;
}

function prepararCaptionTelegram(prefijo, copyCompleto) {
  const textoTotal = prefijo ? `${prefijo}\n\n${copyCompleto}` : copyCompleto;
  if (textoTotal.length <= 1010) return { captionFoto: textoTotal, enviarTextoCompletoAparte: false };
  const recorte = textoTotal.slice(0, 950).replace(/\s+\S*$/, '');
  return { captionFoto: `${recorte}...\n\n⬇️ (Nota completa abajo para leer / publicar en Meta)`, enviarTextoCompletoAparte: true };
}

function limpiarComillasDesparejasDestacado(frase) {
  let f = String(frase || '').trim();
  f = f.replace(/^['‘’"“”]+|['‘’"“”]+$/g, '').trim();
  return f;
}

function asegurarDestacadoEnTitulo(titulo, destacar) {
  const tit = limpiarEmojis(titulo).toUpperCase();
  let des = limpiarComillasDesparejasDestacado(limpiarEmojis(destacar).toUpperCase());
  if (!tit) return { titulo: '', destacar: '' };

  const palabrasTit = tit.split(/\s+/).filter(Boolean);
  if (palabrasTit.length <= 2) return { titulo: tit, destacar: limpiarComillasDesparejasDestacado(tit) };

  const palabrasDes = des.split(/\s+/).filter(Boolean);
  let idxInicio = -1;

  if (palabrasDes.length > 0) {
    for (let i = 0; i <= palabrasTit.length - palabrasDes.length; i++) {
      let ok = true;
      for (let j = 0; j < palabrasDes.length; j++) {
        if (limpiarPalabraSignos(palabrasTit[i + j]) !== limpiarPalabraSignos(palabrasDes[j])) { ok = false; break; }
      }
      if (ok) { idxInicio = i; break; }
    }
  }

  let idxFin = idxInicio !== -1 ? idxInicio + palabrasDes.length - 1 : -1;
  if (idxInicio === -1) { idxInicio = 0; idxFin = Math.min(2, palabrasTit.length - 1); }

  if (idxInicio > 0 && SUFIJOS_COMPUESTOS.has(limpiarPalabraSignos(palabrasTit[idxInicio])) && PREFIJOS_COMPUESTOS.has(limpiarPalabraSignos(palabrasTit[idxInicio - 1]))) {
    idxInicio--;
  }

  while (idxInicio < idxFin && ['DE', 'DEL', 'Y', 'E', 'O', 'U', 'A', 'AL', 'CON', 'POR', 'EN', 'PARA', 'QUE'].includes(limpiarPalabraSignos(palabrasTit[idxInicio]))) {
    idxInicio++;
  }

  let huboCambio = true;
  while (huboCambio && idxFin < palabrasTit.length - 1) {
    huboCambio = false;
    const pAct = limpiarPalabraSignos(palabrasTit[idxFin]);
    const pSig = limpiarPalabraSignos(palabrasTit[idxFin + 1]);
    if (CONECTORES_COLGADOS.has(pAct) || PREFIJOS_COMPUESTOS.has(pAct) || SUFIJOS_COMPUESTOS.has(pSig) || /^[0-9]+$/.test(pSig) || (pAct === 'RUTA' && pSig === 'NACIONAL')) {
      idxFin++; huboCambio = true;
    }
  }

  if (idxFin - idxInicio + 1 >= 5) {
    for (let k = idxInicio + 1; k < idxFin; k++) {
      if (['EN', 'DE', 'DEL', 'A', 'AL', 'PARA', 'POR', 'CONTRA', 'SOBRE', 'QUE'].includes(limpiarPalabraSignos(palabrasTit[k])) && (idxFin - k) >= 2) {
        idxInicio = k + 1; break;
      }
    }
  }

  while (idxFin > idxInicio && CONECTORES_COLGADOS.has(limpiarPalabraSignos(palabrasTit[idxFin]))) idxFin--;

  const seleccion = limpiarComillasDesparejasDestacado(palabrasTit.slice(idxInicio, idxFin + 1).join(' '));
  return { titulo: tit, destacar: seleccion };
}

function limpiarBajadaPeriodistica(bajada) {
  let baj = limpiarEmojis(bajada);
  if (!baj) return '';
  baj = baj.charAt(0).toUpperCase() + baj.slice(1);
  if (!/[.!?]$/.test(baj)) baj += '.';
  return baj;
}

function normalizarCategoriaPeriodistica(categoria, textoOriginal = '', esEspectaculos = false) {
  if (esEspectaculos || /wanda nara|china su[áa]rez|icardi|de brito|lam\b|gran hermano|tinelli|far[áa]ndula/i.test(`${categoria} ${textoOriginal}`)) {
    return 'ESPECTÁCULOS / TV';
  }
  let cat = limpiarEmojis(categoria).toUpperCase();
  const mencionaLocal = /caleta olivia|santa cruz|claudio vidal|ruta 3|ram[óo]n santos|pico truncado|las heras|r[íi]o gallegos|gorosito|chimen aike|distrigas|spse/i.test(textoOriginal);
  if (!mencionaLocal && cat.startsWith('CALETA OLIVIA')) cat = cat.replace(/^CALETA OLIVIA\s*\/\s*/i, 'NACIÓN / ');
  cat = cat.replace(/\/\s*(REGIONAL|NACIONAL|LOCAL|PROVINCIAL)$/i, '/ ACTUALIDAD');
  if (!cat.includes('/')) cat = mencionaLocal ? `SANTA CRUZ / ${cat || 'ACTUALIDAD'}` : `NACIÓN / ${cat || 'ACTUALIDAD'}`;
  return cat;
}

function obtenerListaClavesGroq() {
  const desdeEnv = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  return [...new Set([...desdeEnv, CLAVE_GROQ_RESPALDO].filter(Boolean))];
}

function obtenerListaClavesSerper() {
  const desdeEnv = (process.env.SERPER_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  return [...new Set([...desdeEnv, ...CLAVES_SERPER_RESPALDO].filter(Boolean))];
}

async function llamarSerperApi(endpoint, payload) {
  verificarReinicioEstadisticasDia();
  const claves = obtenerListaClavesSerper();
  for (let i = 0; i < claves.length; i++) {
    const key = claves[(indiceClaveSerper + i) % claves.length];
    try {
      const resp = await fetch(`https://google.serper.dev/${endpoint}`, {
        method: 'POST', signal: AbortSignal.timeout(4500),
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        estadisticasDia.serperLlamadas++;
        indiceClaveSerper = (indiceClaveSerper + i) % claves.length;
        return await resp.json();
      }
    } catch (e) {}
  }
  return null;
}

function parsearJsonSeguro(rawContent) {
  const texto = String(rawContent || '').trim();
  const match = texto.match(/\{[\s\S]*\}/);
  const candidato = match ? match[0] : texto;
  try { return JSON.parse(candidato); } catch (e1) {
    try {
      return JSON.parse(candidato.replace(/,\s*([\]}])/g, '$1').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' '));
    } catch (e2) {
      const extraerCampo = (clave) => {
        const reg = new RegExp(`"${clave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
        const m = candidato.match(reg);
        return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
      };
      const tituloRescatado = extraerCampo('titulo');
      if (tituloRescatado) {
        return {
          descartar: /"descartar"\s*:\s*true/i.test(candidato),
          motivo_descarte: extraerCampo('motivo_descarte'),
          categoria: extraerCampo('categoria') || 'ACTUALIDAD / NOTICIAS',
          titulo: tituloRescatado,
          destacar: extraerCampo('destacar'),
          bajada: extraerCampo('bajada'),
          dato_clave: extraerCampo('dato_clave'),
          autor_cita: extraerCampo('autor_cita'),
          etiqueta_duelo_1: extraerCampo('etiqueta_duelo_1') || 'PROTAGONISTA 1',
          etiqueta_duelo_2: extraerCampo('etiqueta_duelo_2') || 'PROTAGONISTA 2',
          fuente_credito: 'EL REGISTRO SUR',
          copy: extraerCampo('copy') || `${tituloRescatado}\n\n${extraerCampo('bajada')}`,
          busqueda_foto_web: extraerCampo('busqueda_foto_web') || tituloRescatado,
          busqueda_foto_secundaria: extraerCampo('busqueda_foto_secundaria'),
          busqueda_foto_institucional: extraerCampo('busqueda_foto_institucional'),
          prompt_imagen_ia: extraerCampo('prompt_imagen_ia') || 'Argentina journalism photography'
        };
      }
      throw e1;
    }
  }
}

async function llamarGroqChat(messages) {
  verificarReinicioEstadisticasDia();
  const claves = obtenerListaClavesGroq();
  const totalIntentos = Math.max(claves.length * 2, 4);
  let ultimoError = '';

  for (let intento = 0; intento < totalIntentos; intento++) {
    const apiKey = claves[(indiceClaveGroq++) % claves.length];
    const usarJsonMode = intento < totalIntentos - 1;
    try {
      const bodyPayload = { model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 4096, messages };
      if (usarJsonMode) bodyPayload.response_format = { type: 'json_object' };

      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(18000),
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(bodyPayload)
      });

      if (resp.status === 429 || resp.status === 413) {
        ultimoError = `Groq (${resp.status}) límite alcanzado`;
        if (claves.length === 1 || intento >= claves.length) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!resp.ok) {
        ultimoError = `Error de Groq (${resp.status}): ${await resp.text()}`;
        if (resp.status === 400 && intento < totalIntentos - 1) continue;
        throw new Error(ultimoError);
      }

      estadisticasDia.groqLlamadas++;
      const data = await resp.json();
      return parsearJsonSeguro(data?.choices?.[0]?.message?.content || '{}');
    } catch (e) {
      ultimoError = e.message;
      if (intento === totalIntentos - 1) throw new Error(ultimoError);
      if (claves.length === 1) await new Promise(r => setTimeout(r, 1200));
    }
  }
}

function obtenerDimensionesBuffer(buffer) {
  try {
    if (!buffer || buffer.length < 30) return null;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8 ' && buffer.length >= 30) return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L' && buffer.length >= 25) {
        const b = buffer.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8X' && buffer.length >= 30) return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xFF) { offset++; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xFF) { offset++; continue; }
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const len = buffer.readUInt16BE(offset + 2);
        if (len < 2) break;
        offset += 2 + len;
      }
    }
  } catch (e) {}
  return null;
}

async function auditarFotoConVisionIA(dataUrl, titulo, bajada, categoria = '', tituloDescriptivoFoto = '') {
  verificarReinicioEstadisticasDia();
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const fechaHoy = ahora.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos', day: 'numeric', month: 'long', year: 'numeric' });

  const promptVision = `Sos el Director de Fotografía de 'El Registro Sur'. Hoy es ${fechaHoy} (Año ${anioActual}).
Mirá esta imagen y evaluá si sirve para ilustrar esta noticia RECIENTE:
SECCIÓN: "${categoria}" | TITULAR: "${titulo}" | BAJADA: "${bajada}" | ORIGEN: "${tituloDescriptivoFoto}"

REGLAS DE RECHAZO ESTRICTO ("aprobada": false):
1. ACTUALIDAD (${anioActual}): Rechazar si muestra exfuncionarios, figuras fallecidas (ej: Papa Francisco cuando hoy el Papa es León XIV) o archivos viejos que no corresponden.
2. RECHAZAR si está pixelada, tiene zócalos de TV gigantes o muestra una persona/tema ajeno.
3. SALVAVIDAS DE CARAS ("foco_vertical"): Indicá "12%" si las caras están arriba, "20%" en el tercio superior o "32%" al medio para que el texto inferior nunca tape rostros.
4. DETECTOR DE LOGO AJENO ("logo_esquina"): Si tiene un logo chico de otro medio en una esquina, indicá "arriba_izquierda", "arriba_derecha", "abajo_izquierda", "abajo_derecha" o "ninguno".

Devolvé SOLO este JSON:
{"aprobada": true, "motivo": "Breve", "foco_vertical": "18%", "logo_esquina": "ninguno", "busqueda_corregida": "Nombre propio actual + ${anioActual}"}`;

  const claves = obtenerListaClavesGroq();
  const apiKey = claves[(indiceClaveGroq++) % claves.length];

  try {
    if (dataUrl.length < 460000) {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(8500),
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct', temperature: 0.1, max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [{ type: 'text', text: promptVision }, { type: 'image_url', image_url: { url: dataUrl } }] }]
        })
      });
      if (resp.ok) {
        estadisticasDia.groqLlamadas++;
        const data = await resp.json();
        return parsearJsonSeguro(data?.choices?.[0]?.message?.content || '{}');
      }
    }
    return { aprobada: true, foco_vertical: '18%', logo_esquina: 'ninguno' };
  } catch (e) {
    return { aprobada: true, foco_vertical: '18%', logo_esquina: 'ninguno' };
  }
}

function construirUrlPollinationsHD(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  const promptSeguro = `${prompt}, wide angle architectural or urban photojournalism exterior, NO HUMANS, NO PEOPLE, NO FACES, NO TEXT, photorealistic DSLR`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(promptSeguro)}?width=1080&height=1080&nologo=true&seed=${seed}`;
}

function generarTecladoTactil() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Publicar IG/FB', callback_data: '.publicar' },
        { text: '🕒 Encolar +2h', callback_data: '.encolar' },
        { text: '❌ Descartar', callback_data: '.descartar' }
      ],
      [
        { text: '📑 Carrusel 3x', callback_data: '.carrusel' },
        { text: '⚡ Duelo 2 Fotos', callback_data: '.duelo' },
        { text: '🔍 Lupa PIP', callback_data: '.lupa' }
      ],
      [
        { text: '⏳ Cronología', callback_data: '.cronologia' },
        { text: '⚖️ Versus', callback_data: '.versus' },
        { text: '📋 Servicios', callback_data: '.servicios' }
      ],
      [
        { text: '💬 Cita', callback_data: '.cita' },
        { text: '📊 Dato', callback_data: '.dato' },
        { text: '🕵️ Cambiar Foto', callback_data: '.auditar' },
        { text: '↔️ Expandir', callback_data: '.expandir' }
      ],
      [
        { text: '🚨 Urgente', callback_data: '.urgente' },
        { text: '🔵 Normal', callback_data: '.normal' },
        { text: '📱 Historia 9:16', callback_data: '.historia' },
        { text: '💵 Mercados', callback_data: '.mercados' }
      ]
    ]
  };
}

async function responderCallbackTelegram(callbackQueryId, textoAviso = 'Procesando...') {
  if (!callbackQueryId || !callbackQueryId.trim()) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId.trim(), text: textoAviso })
    });
  } catch (e) {}
}

async function enviarMensajeTelegram(texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: EDITOR_CHAT_ID, text: String(texto || '').slice(0, 4050) })
    });
  } catch (e) {}
}

async function borrarMensajeTelegram(messageId) {
  if (!messageId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: EDITOR_CHAT_ID, message_id: messageId })
    });
  } catch (e) {}
}

async function resolverArchivoTelegram(valorRecibido) {
  if (!valorRecibido || !valorRecibido.trim()) return { url: '', path: '' };
  const limpio = valorRecibido.trim();
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) return { url: limpio, path: limpio };
  if (limpio.includes('/')) return { url: `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${limpio}`, path: limpio };
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${limpio}`);
  const data = await resp.json();
  if (data.ok && data.result?.file_path) {
    return { url: `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`, path: data.result.file_path };
  }
  return { url: '', path: '' };
}

async function transcribirAudioConGroq(audioUrl) {
  const claves = obtenerListaClavesGroq();
  const apiKey = claves[(indiceClaveGroq++) % claves.length];
  const audioResp = await fetch(audioUrl);
  const arrayBuffer = await audioResp.arrayBuffer();
  const form = new FormData();
  form.append('file', new Blob([arrayBuffer], { type: 'audio/ogg' }), 'audio.ogg');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: form
  });
  if (!resp.ok) throw new Error(`Error transcribiendo audio (${resp.status})`);
  const data = await resp.json();
  return (data.text || '').slice(0, 1800);
}

async function obtenerCandidatasRedesSociales() {
  try {
    const queryRedes = '(site:instagram.com/p/ OR site:instagram.com/reel/ OR site:facebook.com) ("Caleta Olivia" OR "Claudio Vidal" OR "Río Gallegos" OR "Santa Cruz" OR "elcaletense" OR "infocaleta" OR "vocesyapuntes" OR "cortanoticias" OR "elcancillercom" OR "laderechadiario")';
    const dataS = await llamarSerperApi('search', { q: queryRedes, gl: 'ar', hl: 'es', num: 10, tbs: 'qdr:d' });
    if (!dataS || !Array.isArray(dataS.organic)) return [];

    return dataS.organic.map(item => {
      const esIg = item.link?.includes('instagram.com');
      const snippetLimpio = (item.snippet || '').replace(/\s{2,}/g, ' ').trim();
      const tituloBase = (item.title || '').replace(/\s*\|\s*Instagram|\s*-\s*Facebook/gi, '').trim();
      return {
        titulo: snippetLimpio.length > 35 ? snippetLimpio.slice(0, 130) : tituloBase,
        link: item.link,
        medio: esIg ? 'INSTAGRAM' : 'FACEBOOK',
        categoriaOrigen: /caleta|santa cruz|vidal|gallegos|truncado|las heras/i.test(`${tituloBase} ${snippetLimpio}`) ? 'regional' : 'nacional',
        fotoRss: '',
        bajadaRss: `${tituloBase}. ${snippetLimpio}`,
        fechaPub: new Date().toISOString(),
        antiguedadTexto: item.date || 'En redes (últimas hs)',
        antiguedadMinutos: 40
      };
    }).filter(c => c.titulo.length > 20);
  } catch (e) { return []; }
}

async function resolverUrlOriginalDesdeBuscador(titulo, medio = '') {
  try {
    const tituloLimpio = String(titulo || '').replace(/\s+-\s+[^-]+$/, '').trim();
    if (tituloLimpio.length < 10) return '';
    const query = `${tituloLimpio} ${medio}`.trim();
    const dataS = await llamarSerperApi('search', { q: query, gl: 'ar', hl: 'es', num: 3 });
    const linkSerper = dataS?.organic?.[0]?.link;
    if (linkSerper && !linkSerper.includes('google.com')) return linkSerper;
  } catch (e) {}
  return '';
}

function expandirUrlImagenAltaResolucion(url) {
  if (!url) return '';
  return url
    .replace(/&amp;/g, '&')
    .replace(/-\d{2,3}x\d{2,3}(?=\.(?:jpg|jpeg|png|webp))/i, '')
    .replace(/([?&](?:w|width)=)\d{2,3}\b/gi, '$11200')
    .replace(/([?&](?:h|height)=)\d{2,3}\b/gi, '$1800');
}

async function extraerNoticiaDeLink(url, tituloParaResolver = '', medioParaResolver = '') {
  try {
    let urlFinal = url || '';
    if (/instagram\.com|facebook\.com/i.test(urlFinal)) {
      const dataRed = await llamarSerperApi('search', { q: urlFinal, gl: 'ar', hl: 'es', num: 3 });
      const itemRed = dataRed?.organic?.[0];
      if (itemRed) {
        return {
          fotoExtraida: '', fuenteDominio: 'EL REGISTRO SUR', fechaPublicacion: '',
          parrafosReales: `${itemRed.title || ''} ${itemRed.snippet || ''}`.trim(),
          textoExtraido: `HECHO DETECTADO: ${itemRed.title || ''}\nDETALLES: ${itemRed.snippet || ''}`
        };
      }
    }

    if ((!urlFinal || urlFinal.includes('news.google.com')) && tituloParaResolver) {
      const resuelta = await resolverUrlOriginalDesdeBuscador(tituloParaResolver, medioParaResolver);
      if (resuelta) urlFinal = resuelta;
    }
    if (!urlFinal || urlFinal.includes('news.google.com')) {
      return { fotoExtraida: '', fuenteDominio: 'EL REGISTRO SUR', textoExtraido: '', parrafosReales: '', fechaPublicacion: '' };
    }

    const resp = await fetch(urlFinal, {
      redirect: 'follow', signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await resp.text();

    let fotoJsonLd = '', fechaJsonLd = '';
    const scriptsLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of scriptsLd) {
      const rawLd = s[1].trim();
      const imgM = rawLd.match(/"image"\s*:\s*(?:\[\s*)?(?:\{\s*[^}]*"url"\s*:\s*"([^"]+)"|"([^"]+)")/i);
      if (imgM && (imgM[1] || imgM[2]) && !fotoJsonLd) fotoJsonLd = imgM[1] || imgM[2];
      const fecM = rawLd.match(/"datePublished"\s*:\s*"([^"]+)"/i);
      if (fecM && fecM[1] && !fechaJsonLd) fechaJsonLd = fecM[1];
    }

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                         html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const fechaMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|pubdate|publishdate|date)["'][^>]+content=["']([^"']+)["']/i) || html.match(/<time[^>]+datetime=["']([^"']+)["']/i);

    const htmlSinBasura = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<aside[\s\S]*?<\/aside>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    const parrafos = [...htmlSinBasura.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(t => t.length > 55 && !t.includes('{') && !t.includes('function('))
      .slice(0, 10).join('\n').slice(0, 2200);

    let fotoUrl = fotoJsonLd || (ogImageMatch ? ogImageMatch[1] : '');
    if (fotoUrl && fotoUrl.startsWith('/')) fotoUrl = `${new URL(urlFinal).origin}${fotoUrl}`;
    fotoUrl = expandirUrlImagenAltaResolucion(fotoUrl);

    const tituloLimpio = (ogTitleMatch ? ogTitleMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 220);
    const bajadaMeta = (ogDescMatch ? ogDescMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 350);

    return {
      fotoExtraida: fotoUrl,
      fuenteDominio: 'EL REGISTRO SUR',
      fechaPublicacion: fechaJsonLd || (fechaMatch ? fechaMatch[1] : ''),
      parrafosReales: `${bajadaMeta} ${parrafos}`.trim(),
      textoExtraido: `TÍTULO: ${tituloLimpio}\nRESUMEN: ${bajadaMeta}\nHECHOS VERIFICADOS:\n${parrafos}`.slice(0, 2600)
    };
  } catch (e) {
    return { fotoExtraida: '', fuenteDominio: 'EL REGISTRO SUR', textoExtraido: '', parrafosReales: '', fechaPublicacion: '' };
  }
}

async function buscarContextoEnGoogleNews(consulta) {
  try {
    const queryLimpia = consulta.replace(/https?:\/\/\S+/g, '').replace(/TÍTULO:[\s\S]*/i, '').replace(/^\.[a-zA-Z0-9]+\s*/i, '').trim().split(/\s+/).slice(0, 8).join(' ');
    if (queryLimpia.length < 5) return { texto: '', fechaReciente: '' };

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryLimpia)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const xml = await resp.text();

    const bloques = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    let fechaReciente = '';
    const items = bloques.slice(0, 6).map(b => {
      const tit = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/\s+-\s+[^-]+$/, '').trim() || '';
      const desc = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim() || '';
      const pub = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
      if (!fechaReciente && pub) fechaReciente = pub;
      return tit ? `- ${tit} (${desc.slice(0, 140)})` : '';
    }).filter(Boolean).join('\n').slice(0, 900);

    const antecedentesPropios = buscarAntecedentesPropios(queryLimpia);
    return { texto: `${items ? `\nDATOS CONFIRMADOS EN AGENCIAS:\n${items}` : ''}${antecedentesPropios}`, fechaReciente };
  } catch (e) {
    return { texto: '', fechaReciente: '' };
  }
}

async function leerUnFeedRss(fuente) {
  try {
    const resp = await fetch(fuente.url, {
      redirect: 'follow', signal: AbortSignal.timeout(5500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const bloquesItem = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => m[1]);

    return bloquesItem.slice(0, 8).map(itemXml => {
      const tituloMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const contentMatch = itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || itemXml.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i) || itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
      const imgMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) || itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) || (contentMatch && contentMatch[1].match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)) || itemXml.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);

      const titulo = (tituloMatch ? tituloMatch[1] : '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').replace(/\s+-\s+[^-]+$/, '').trim();
      const link = (linkMatch ? linkMatch[1] : '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const textoRssBruto = (descMatch ? descMatch[1] : '') + ' ' + (contentMatch ? contentMatch[1] : '');
      const bajadaRss = textoRssBruto.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 750);
      const fechaPub = pubDateMatch ? pubDateMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const antiguedad = calcularAntiguedadNoticia(fechaPub);

      return {
        titulo, link, medio: fuente.medio, categoriaOrigen: fuente.categoria,
        fotoRss: imgMatch ? expandirUrlImagenAltaResolucion(imgMatch[1]) : '',
        bajadaRss, fechaPub, antiguedadTexto: antiguedad.texto, antiguedadMinutos: antiguedad.minutos
      };
    }).filter(i => i.titulo.length > 18 && i.link.startsWith('http'));
  } catch (e) { return []; }
}

async function obtenerTodasLasCandidatasRadar() {
  const listas = await Promise.all(FUENTES_RSS_RADAR.map(f => leerUnFeedRss(f)));
  return listas.flat();
}

function calcularConsensoPorCandidata(candidatas) {
  const palabrasPorItem = candidatas.map(c => ({ medio: c.medio, palabras: new Set(extraerPalabrasClave(c.titulo)) }));
  return candidatas.map((c, idx) => {
    const misPalabras = palabrasPorItem[idx].palabras;
    const mediosCoincidentes = new Set([c.medio]);
    if (misPalabras.size >= 3) {
      for (let j = 0; j < palabrasPorItem.length; j++) {
        if (idx === j) continue;
        let comunes = 0;
        for (const w of misPalabras) if (palabrasPorItem[j].palabras.has(w)) comunes++;
        if (comunes >= 3) mediosCoincidentes.add(palabrasPorItem[j].medio);
      }
    }
    return { ...c, consensoMedios: mediosCoincidentes.size };
  });
}

function ordenarCandidatasRelevantes(candidatas, ignorarHistorial = false) {
  if (!candidatas || candidatas.length === 0) return [];

  const regexDescartar = /pron[óo]stico de lluvia|pron[óo]stico del tiempo|c[óo]mo estar[áa] el clima|clima hoy en|tiempo hoy en|qu[ée] dice el servicio meteorol[óo]gico para hoy|hor[óo]scopo|quiniela|loter[íi]a|crucigrama|efem[ée]rides|receta|tarot|predicciones|a qu[ée] hora juega|d[óo]nde ver en vivo/i;
  const regexPrioridadMaxima = /caleta olivia|santa cruz|claudio vidal|ruta 3|ruta nacional 3|ram[óo]n santos|zona norte|pico truncado|las heras|r[íi]o gallegos|ypf|petr[óo]leo|servicios p[úu]blicos|distrigas|acueducto/i;
  const regexImpactoNacional = /milei|d[óo]lar|inflaci[óo]n|anses|jubilados|combustible|nafta|sueldo|paro|corte|tarifa|impuesto|banco central|selecci[óo]n argentina|boca|river|messi|colapinto|gobierno|empresarios|salarios|diputados|senado|reforma|paso/i;
  const regexImpactoMundial = /urgente|terremoto|sismo|guerra|ataque|misil|atentado|papa le[óo]n|trump|estados unidos|israel|iran|rusia|ucrania|onu|crisis|hist[óo]rico/i;
  const regexBombasEspectaculos = /wanda|icardi|china su[áa]rez|tinelli|susana|mirtha|gran hermano|lam|esc[áa]ndalo|separaci[óo]n|denuncia|luck ra|tiago pzk|la joaqui|duki|mar[íi]a becerra|l-gante|occhiato|granados/i;

  const conConsenso = calcularConsensoPorCandidata(candidatas);
  const disponibles = conConsenso.filter(c => {
    if (regexDescartar.test(c.titulo)) return false;
    if (c.antiguedadMinutos > 1800) return false;
    if (!ignorarHistorial && (noticiasEnviadasRadar.has(c.titulo) || esTemaRepetido(c.titulo))) return false;
    return true;
  });

  return disponibles.map(c => {
    let puntos = 10;
    if (regexPrioridadMaxima.test(c.titulo)) puntos += 55;
    if (c.categoriaOrigen === 'regional') puntos += 30;
    if (regexImpactoNacional.test(c.titulo)) puntos += 35;
    if (c.categoriaOrigen === 'internacional') puntos += regexImpactoMundial.test(c.titulo) ? 38 : 10;
    if (c.categoriaOrigen === 'espectaculos') puntos += regexBombasEspectaculos.test(c.titulo) ? 24 : -5;

    if (c.consensoMedios >= 3 && c.categoriaOrigen !== 'espectaculos') puntos += 40;
    else if (c.consensoMedios === 2) puntos += 15;

    if (!c.link.includes('news.google.com')) puntos += 25;
    if (c.fotoRss) puntos += 20;

    if (c.antiguedadMinutos <= 45) puntos += 40;
    else if (c.antiguedadMinutos <= 120) puntos += 25;
    else if (c.antiguedadMinutos <= 300) puntos += 10;
    else if (c.antiguedadMinutos > 720) puntos -= 15;

    return { ...c, puntos };
  }).sort((a, b) => b.puntos - a.puntos);
}

async function obtenerDatosClimaCaleta() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=-46.4393&longitude=-67.5284&current=temperature_2m,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,wind_gusts_10m_max&timezone=America%2FArgentina%2FRio_Gallegos';
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await resp.json();
  const tempActual = Math.round(data.current?.temperature_2m ?? 15);
  const vientoActual = Math.round(data.current?.wind_speed_10m ?? 25);
  const rafagasHoy = Math.round(data.daily?.wind_gusts_10m_max?.[0] ?? 50);
  const maxHoy = Math.round(data.daily?.temperature_2m_max?.[0] ?? 18);
  const minHoy = Math.round(data.daily?.temperature_2m_min?.[0] ?? 8);
  return {
    texto: `PARTE METEOROLÓGICO OFICIAL PARA CALETA OLIVIA HOY: Temperatura actual ${tempActual}°C (Mínima ${minHoy}°C / Máxima ${maxHoy}°C). Viento sostenido de ${vientoActual} km/h con ráfagas máximas previstas de hasta ${rafagasHoy} km/h en la ciudad, costanera y Ruta Nacional N° 3.`,
    rafagasHoy, tempActual, maxHoy, minHoy
  };
}

async function obtenerDatosMercadosEnVivo() {
  let oficialVenta = '---', blueVenta = '---', mepVenta = '---';
  try {
    const resp = await fetch('https://dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const lista = await resp.json();
      const ofi = lista.find(d => d.casa === 'oficial');
      const blu = lista.find(d => d.casa === 'blue');
      const mep = lista.find(d => d.casa === 'bolsa');
      if (ofi?.venta) oficialVenta = `$${Math.round(ofi.venta)}`;
      if (blu?.venta) blueVenta = `$${Math.round(blu.venta)}`;
      if (mep?.venta) mepVenta = `$${Math.round(mep.venta)}`;
    }
  } catch (e) {}

  const ctxPetroleo = await buscarContextoEnGoogleNews('Dolar Banco Central Petroleo Brent YPF Argentina');
  return {
    textoMercados: `REPORTE DE MERCADOS, DÓLAR Y ENERGÍA EN ARGENTINA HOY: Cotización Dólar Oficial Banco Nación: ${oficialVenta}. Dólar Blue: ${blueVenta}. Dólar MEP / Bolsa: ${mepVenta}. Impacto en combustibles, importaciones y regalías petroleras en la cuenca del Golfo San Jorge y Santa Cruz.\n${ctxPetroleo.texto}`,
    blueVenta,
    itemsGrilla: [
      { etiqueta: 'DÓLAR OFICIAL (BNA)', valor: `${oficialVenta} para la venta` },
      { etiqueta: 'DÓLAR BLUE (INFORMAL)', valor: `${blueVenta} en la jornada` },
      { etiqueta: 'DÓLAR MEP / BOLSA', valor: `${mepVenta} financiero` }
    ]
  };
}

function optimizarFotoConCloudinary(fotoUrl, expandir = false, alto = 1080) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !fotoUrl || !fotoUrl.startsWith('http') || fotoUrl.includes('res.cloudinary.com')) return fotoUrl;
  const hFinal = alto === 1920 ? 2560 : 1440;
  if (expandir) return `https://res.cloudinary.com/${cloudName}/image/fetch/c_pad,w_1440,h_${hFinal},b_gen_fill,e_improve,e_sharpen:80,f_jpg,q_92/${encodeURIComponent(fotoUrl)}`;
  return `https://res.cloudinary.com/${cloudName}/image/fetch/c_fill,g_auto:faces,w_1440,h_${hFinal},e_improve,e_sharpen:80,f_jpg,q_92/${encodeURIComponent(fotoUrl)}`;
}

function esUrlDeArchivoViejo(url) {
  const anioActual = new Date().getFullYear();
  const matchesAnio = [...String(url || '').matchAll(/[\/\-_](20[12][0-9])[\/\-_]/g)];
  for (const m of matchesAnio) {
    const a = parseInt(m[1], 10);
    if (a >= 2010 && a <= anioActual - 2) return true;
  }
  return false;
}

async function descargarYValidarImagen(url, timeoutMs = 5500, tituloDescriptivo = '') {
  if (!url) return null;
  if (url.startsWith('data:image/')) return { url, dataUrl: url, tituloDescriptivo };
  if (!url.startsWith('http')) return null;
  if (/logo|favicon|avatar|placeholder|default|icon|sprite|blank|1x1|banner-site|thumb/i.test(url)) return null;
  if (DOMINIOS_PROHIBIDOS_IMG.test(url) || DOMINIOS_PROHIBIDOS_IMG.test(tituloDescriptivo)) return null;

  const urlExpandida = expandirUrlImagenAltaResolucion(url);
  const intentarDescarga = async (targetUrl) => {
    const resp = await fetch(targetUrl, {
      redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'image/*,*/*;q=0.8' }
    });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 22000 || buffer.length > 10 * 1024 * 1024) return null;
    const dims = obtenerDimensionesBuffer(buffer);
    if (dims && (dims.width < 580 || dims.height < 330)) return null;
    return {
      url: urlExpandida, dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      bytes: buffer.length, width: dims ? dims.width : 1080, height: dims ? dims.height : 720, tituloDescriptivo
    };
  };

  try {
    const urlCloudinary = optimizarFotoConCloudinary(urlExpandida, false, 1080);
    if (urlCloudinary !== urlExpandida) {
      const desdeCloud = await intentarDescarga(urlCloudinary).catch(() => null);
      if (desdeCloud) return desdeCloud;
    }
    return await intentarDescarga(urlExpandida);
  } catch (e) { return null; }
}

// Búsqueda fotográfica con Caché de 24h en disco + 1 sola llamada a Serper (Ahorro del 65% de créditos)
async function obtenerCandidatasFotoWeb(consulta, urlsExcluidas = []) {
  if (!consulta || consulta.trim().length < 3) return [];
  verificarReinicioEstadisticasDia();
  const anioActual = new Date().getFullYear();
  const consultaLimpia = consulta.replace(/orcolandia|kukardo|mandril|casta/gi, '').trim();
  const claveCache = consultaLimpia.toLowerCase();
  const setExcluidas = new Set((urlsExcluidas || []).filter(Boolean));
  let itemsEncontrados = [];

  if (cacheImagenes24h[claveCache] && (Date.now() - cacheImagenes24h[claveCache].ts) < 24 * 60 * 60 * 1000) {
    itemsEncontrados = (cacheImagenes24h[claveCache].items || []).filter(it => !setExcluidas.has(it.url));
    if (itemsEncontrados.length >= 2) estadisticasDia.serperCacheHits++;
  }

  if (itemsEncontrados.length < 2) {
    const dataS = await llamarSerperApi('images', {
      q: `${consultaLimpia} ${anioActual}`, gl: 'ar', hl: 'es', num: 10, tbs: 'isz:l,itp:photo,qdr:y'
    });
    if (dataS && Array.isArray(dataS.images)) {
      const nuevos = [];
      for (const img of dataS.images) {
        if (img.imageUrl && (img.imageWidth || 800) >= 650 && !esUrlDeArchivoViejo(img.imageUrl) && !DOMINIOS_PROHIBIDOS_IMG.test(img.imageUrl) && !DOMINIOS_PROHIBIDOS_IMG.test(img.title || '')) {
          nuevos.push({ url: img.imageUrl, desc: img.title || consultaLimpia });
        }
      }
      if (nuevos.length > 0) {
        cacheImagenes24h[claveCache] = { ts: Date.now(), items: nuevos };
        guardarCacheImagenes24h();
      }
      itemsEncontrados = nuevos.filter(it => !setExcluidas.has(it.url));
    }
  }

  const descargadas = await Promise.all(itemsEncontrados.slice(0, 3).map(it => descargarYValidarImagen(it.url, 4500, it.desc)));
  return descargadas.filter(Boolean);
}

async function auditarYResolverImagen({
  fotoCandidataUrl, esFotoManualDelEditor, titulo, bajada, categoria = '',
  busquedasSugeridas = [], promptIaSugerido, forzarBusquedaNueva = false, urlsExcluidas = []
}) {
  if (fotoCandidataUrl && esFotoManualDelEditor && !forzarBusquedaNueva) {
    const val = await descargarYValidarImagen(fotoCandidataUrl, 6000, 'Foto Editor');
    if (val) return { urlFinal: val.dataUrl, urlOriginal: val.url, focoVertical: '18%', logoEsquina: 'ninguno', fuenteAuto: 'EL REGISTRO SUR', esFotoRealVerificada: true };
  }

  if (fotoCandidataUrl && !forzarBusquedaNueva) {
    const valNota = await descargarYValidarImagen(fotoCandidataUrl, 6000, '');
    if (valNota) {
      const aud = await auditarFotoConVisionIA(valNota.dataUrl, titulo, bajada, categoria, '');
      if (aud.aprobada !== false) {
        return { urlFinal: valNota.dataUrl, urlOriginal: valNota.url, focoVertical: aud.foco_vertical || '18%', logoEsquina: aud.logo_esquina || 'ninguno', fuenteAuto: 'EL REGISTRO SUR', esFotoRealVerificada: true };
      }
      if (aud.busqueda_corregida) busquedasSugeridas.unshift(aud.busqueda_corregida);
    }
  }

  const colaConsultas = [...new Set([...busquedasSugeridas.filter(Boolean), titulo])].slice(0, 2);
  for (const queryWeb of colaConsultas) {
    const candidatasWeb = await obtenerCandidatasFotoWeb(queryWeb, urlsExcluidas);
    for (const cand of candidatasWeb) {
      const ver = await auditarFotoConVisionIA(cand.dataUrl, titulo, bajada, categoria, cand.tituloDescriptivo);
      if (ver.aprobada !== false) {
        return { urlFinal: cand.dataUrl, urlOriginal: cand.url, focoVertical: ver.foco_vertical || '18%', logoEsquina: ver.logo_esquina || 'ninguno', fuenteAuto: 'EL REGISTRO SUR', esFotoRealVerificada: true };
      }
    }
  }

  const urlIa = construirUrlPollinationsHD(promptIaSugerido || 'Government building exterior Argentina photojournalism');
  const valIa = await descargarYValidarImagen(urlIa, 9000, 'Ilustración');
  return { urlFinal: valIa ? valIa.dataUrl : urlIa, urlOriginal: urlIa, focoVertical: '25%', logoEsquina: 'ninguno', fuenteAuto: 'ILUSTRACIÓN', esFotoRealVerificada: false };
}

// ============================================================================
// CEREBRO EDITORIAL v12.0: SEXOS/GÉNEROS + CERO SUBTEMA CLAVE + CERO COPIONES
// ============================================================================

async function procesarNoticiaConIA(textoCrudo, contextoWeb = '', esEdicion = false) {
  const textoRecortado = String(textoCrudo || '').slice(0, 2400);
  const contextoRecortado = String(contextoWeb || '').slice(0, 950);
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const fechaHoy = ahora.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos', day: 'numeric', month: 'long', year: 'numeric' });

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur), diario digital de Caleta Olivia, Santa Cruz.
FECHA ACTUAL EN VIVO: Hoy es ${fechaHoy} (Año ${anioActual}).
PERSONALIDAD EDITORIAL: "Con carácter, cero humo". Estilo directo, filoso, propio y verificable.

REGLA CRÍTICA 1 — IDENTIFICACIÓN DE SEXO, CONCORDANCIA DE GÉNERO Y DESTINATARIO DE CITAS:
- Antes de escribir, verificá el sexo/género de cada persona mencionada en la noticia (hombre o mujer).
- Usá siempre el artículo y cargo en su género exacto ("el gobernador / la gobernadora", "el concejal / la concejala", "el juez / la jueza", "el conductor / la actriz", "el empresario / la empresaria", "la delegada barrial").
- Cuando titules con una cita o adjetivo calificativo (ej: 'ES RECONTRA HUECO'), aclarás SIEMPRE a quién va dirigido para no cruzar el sexo de los involucrados (ej: "ÁNGEL DE BRITO CONTRA ICARDI: 'ES RECONTRA HUECO'").

REGLA CRÍTICA 2 — PROHIBIDO CITAR OTROS MEDIOS ("CERO COPIONES") Y SIGLAS EXACTAS:
- JAMÁS menciones en el título, bajada, copy ni hashtags el nombre del diario o portal de donde salió la noticia (prohibido nombrar a OPI Santa Cruz, TiempoSur, La Opinión Austral, InfoCaleta, Voces y Apuntes, Perfil, Infobae, Clarín, Desayuno Americano, etc.). Redactá todo como investigación y cobertura propia de El Registro Sur.
- Siglas oficiales de Santa Cruz: IDUV es SIEMPRE "Instituto de Desarrollo Urbano y Vivienda" (jamás "Oficina"), SPSE es "Servicios Públicos Sociedad del Estado", CSS es "Caja de Servicios Sociales".

REGLA CRÍTICA 3 — TRIPLE BORRADOR Y LEY DE PROHIBIDO REPETIR ("titulo" vs "bajada"):
- En "titulo" (5 a 8 palabras en MAYÚSCULAS SIN EMOJIS): Titular directo con verbo activo o cita textual fuerte.
- En "destacar": Frase completa con sentido propio de 2 a 4 palabras consecutivas exactas dentro de "titulo" (SIN incluir comillas).
- En "bajada" (20 a 30 palabras, sin emojis): PROHIBIDO repetir las mismas cifras o palabras del título. Sumá datos nuevos (organismo, barrios, montos, contexto) incluyendo el rol/cargo antes de cada nombre.

REGLA CRÍTICA 4 — DESCRIPCIÓN EXTENSA ("copy") SIN RÓTULOS INTERNOS NI "SUBTEMA CLAVE:":
Redactá una NOTA PERIODÍSTICA FLUIDA (entre 1.300 y 2.000 caracteres) en texto plano separada únicamente por doble salto de línea (\\n\\n):
- PROHIBIDO escribir palabras estructurales como "Subtema clave:", "Subtítulo:", "Párrafo 1:", "Copete:", "Desarrollo:" o "Cierre:". Los párrafos van limpios como en un diario real.
- Párrafo 1: ENCABEZADO EN MAYÚSCULAS + 2 emojis coherentes de la lista permitida.
- Párrafos 2 a 5: Desarrollo periodístico profundo y fluido con todos los hechos, cifras, roles completos y contexto regional o nacional.
- Firma: "Toda la cobertura en @elregistrosur."
- Cierre dinámico + 👇:
  * SOLO si es un corte de ruta, tránsito o alerta meteorológica: "Compartí este parte con tus vecinos o etiquetá a quien circule hoy por la zona 👇".
  * Si es política, economía, obras, judiciales, deportes o espectáculos: Hacé una pregunta filosa y específica sobre el tema para abrir el debate en comentarios terminando con 👇.
- Último bloque: 8 hashtags en minúsculas SIN tildes y SIN nombrar otros diarios (siempre incluyendo #noticias #elregistrosur #caletaolivia #santacruz y si es Río Gallegos escribir exactamente #riogallegos).

LISTA BLANCA DE EMOJIS PERMITIDOS EN "copy":
🚨 🔴 🟠 🟡 🚧 🚔 🚒 🚑 🛑 💨 🌀 🌊 💧 ☔ ⛄ ⛅ ⚡ 🔥 💰 💵 📈 📉 📊 ⛽ 🏭 🚜 🚛 🚢 🐟 📢 📣 📰 📋 📄 📜 🏥 🏫 🎓 👷 🤝 📍 📅 🕒 ⚽ 🏆 🏅 🎭 🎶 👇 👉 📲 💬 ✅ ❌

Devolvé ÚNICAMENTE este objeto JSON plano:
{
  "descartar": false,
  "motivo_descarte": "",
  "categoria": "LUGAR / TEMA CONCRETO EN MAYÚSCULAS SIN EMOJIS",
  "titulo": "TITULAR FILOSO EN MAYÚSCULAS SIN EMOJIS (5 a 8 palabras)",
  "destacar": "FRASE COMPLETA DENTRO DEL TITULO SIN COMILLAS",
  "bajada": "Subtítulo periodístico de 20 a 30 palabras SIN EMOJIS que aporta datos nuevos e incluye roles con el género correcto.",
  "dato_clave": "Cifra corta de impacto (ej: '150 FAMILIAS', '6 VOTOS', '75 KM/H')",
  "autor_cita": "Rol y nombre con género correcto (ej: 'EL CONDUCTOR ÁNGEL DE BRITO')",
  "etiqueta_duelo_1": "PROTAGONISTA 1",
  "etiqueta_duelo_2": "PROTAGONISTA 2",
  "fuente_credito": "EL REGISTRO SUR",
  "copy": "Nota periodística fluida de 1300 a 2000 caracteres SIN rótulos 'Subtema clave:'",
  "busqueda_foto_web": "Nombre propio actual del protagonista o escenario + ${anioActual}",
  "busqueda_foto_secundaria": "Segundo protagonista actual o escenario complementario",
  "busqueda_foto_institucional": "Edificio oficial o escenario físico real",
  "prompt_imagen_ia": "Wide angle exterior photojournalism prompt in English, NO PEOPLE, NO FACES, NO TEXT"
}`;

  const userMessage = esEdicion
    ? `Borrador actual:\n${JSON.stringify({ categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada, copy: String(ultimoEstado.copy || '').slice(0, 1400) })}\n\nCambio pedido: "${textoRecortado}". Devolvé JSON verificado con "descartar": false.`
    : `Noticia recibida (${fechaHoy}):\n"${textoRecortado}"\n${contextoRecortado}\nVerificá el sexo/género de cada involucrado, no nombres a ningún medio ajeno y redactá el JSON completo sin rótulos internos.`;

  const parsed = await llamarGroqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]);

  parsed.categoria = normalizarCategoriaPeriodistica(parsed.categoria, `${textoRecortado} ${contextoRecortado}`);
  const titDes = asegurarDestacadoEnTitulo(parsed.titulo, parsed.destacar);
  parsed.titulo = titDes.titulo;
  parsed.destacar = titDes.destacar;
  parsed.bajada = limpiarBajadaPeriodistica(parsed.bajada);
  parsed.copy = filtrarEmojisSegurosRedes(parsed.copy);
  parsed.fuente_credito = limpiarCreditoFuentePropio(parsed.fuente_credito);
  parsed.pin_geografico = detectarPinGeografico(`${parsed.titulo} ${parsed.bajada} ${textoRecortado}`);

  return parsed;
}

async function generarDatosModoEspecialConIA(modo, estado) {
  try {
    const base = `TITULAR: ${estado.titulo}\nBAJADA: ${estado.bajada}\nNOTA: ${String(estado.copy || '').slice(0, 1100)}`;
    if (modo === 'cronologia') {
      const r = await llamarGroqChat([{
        role: 'user',
        content: `A partir de esta noticia:\n${base}\nExtraé 3 hitos en orden cronológico. Devolvé SOLO este JSON:
{"h1_etiqueta": "PASO 1 / INICIO", "h1_texto": "Oración de 10 a 14 palabras.", "h2_etiqueta": "PASO 2 / HECHO CENTRAL", "h2_texto": "Oración de 10 a 14 palabras.", "h3_etiqueta": "PASO 3 / DEFINICIÓN", "h3_texto": "Oración de 10 a 14 palabras."}`
      }]);
      return {
        hitos: [
          { etiqueta: limpiarEmojis(r.h1_etiqueta || 'ANTECEDENTE'), texto: limpiarEmojis(r.h1_texto || estado.bajada) },
          { etiqueta: limpiarEmojis(r.h2_etiqueta || 'EL HECHO CLAVE'), texto: limpiarEmojis(r.h2_texto || estado.bajada) },
          { etiqueta: limpiarEmojis(r.h3_etiqueta || 'CÓMO SIGUE'), texto: limpiarEmojis(r.h3_texto || estado.bajada) }
        ]
      };
    }
    if (modo === 'versus') {
      const r = await llamarGroqChat([{
        role: 'user',
        content: `A partir de esta noticia:\n${base}\nArmá un cuadro comparativo de 2 columnas. Devolvé SOLO este JSON:
{"t_izquierda": "ANTES / POSTURA A", "d_izquierda": "Explicación de 14 a 20 palabras.", "t_derecha": "AHORA / POSTURA B", "d_derecha": "Explicación de 14 a 20 palabras."}`
      }]);
      return {
        antes: { titulo: limpiarEmojis(r.t_izquierda || 'SITUACIÓN PREVIA').toUpperCase(), detalle: limpiarEmojis(r.d_izquierda || estado.bajada) },
        ahora: { titulo: limpiarEmojis(r.t_derecha || 'NUEVO ESCENARIO').toUpperCase(), detalle: limpiarEmojis(r.d_derecha || estado.bajada) }
      };
    }
    if (modo === 'servicios') {
      const r = await llamarGroqChat([{
        role: 'user',
        content: `A partir de esta noticia:\n${base}\nArmá una grilla utilitaria de 3 puntos clave para que el vecino guarde la placa. Devolvé SOLO este JSON:
{"k1": "ZONAS / ALCANCE", "v1": "Detalle de 8 a 14 palabras.", "k2": "OPERATIVO / PLAZOS", "v2": "Detalle de 8 a 14 palabras.", "k3": "DATO PARA EL VECINO", "v3": "Detalle de 8 a 14 palabras."}`
      }]);
      return {
        items: [
          { etiqueta: limpiarEmojis(r.k1 || 'ALCANCE').toUpperCase(), valor: limpiarEmojis(r.v1 || estado.bajada) },
          { etiqueta: limpiarEmojis(r.k2 || 'DETALLE OPERATIVO').toUpperCase(), valor: limpiarEmojis(r.v2 || estado.bajada) },
          { etiqueta: limpiarEmojis(r.k3 || 'A TENER EN CUENTA').toUpperCase(), valor: limpiarEmojis(r.v3 || estado.bajada) }
        ]
      };
    }
  } catch (e) {}
  return {};
}

async function generarSlidesCarruselConIA(tituloBase, bajadaBase, copyBase) {
  try {
    const promptCarrusel = `Sos el Editor Jefe de 'EL REGISTRO SUR'. A partir de esta noticia ("${tituloBase}" - "${bajadaBase}" - ${String(copyBase || '').slice(0, 1200)}), armá 3 placas para un carrusel de Instagram:
- Placa 1 (PORTADA): Titular principal y bajada inicial.
- Placa 2 (LAS CLAVES): Detalles operativos (barrios, montos, organismos y cargos) en 24 a 32 palabras.
- Placa 3 (QUÉ CAMBIA): Impacto directo o cómo sigue el tema en 22 a 30 palabras.
Devolvé SOLO este JSON:
{"t1": "TITULAR 1", "d1": "DESTACAR 1", "b1": "Bajada 1.", "t2": "TITULAR 2", "d2": "DESTACAR 2", "b2": "Bajada 2.", "t3": "TITULAR 3", "d3": "DESTACAR 3", "b3": "Bajada 3."}`;
    const res = await llamarGroqChat([{ role: 'user', content: promptCarrusel }]);
    return [
      { ...asegurarDestacadoEnTitulo(res.t1 || tituloBase, res.d1 || ultimoEstado.destacar), bajada: limpiarBajadaPeriodistica(res.b1 || bajadaBase) },
      { ...asegurarDestacadoEnTitulo(res.t2 || 'LAS CLAVES Y LOS DETALLES DEL TEMA', res.d2 || 'LAS CLAVES'), bajada: limpiarBajadaPeriodistica(res.b2 || bajadaBase) },
      { ...asegurarDestacadoEnTitulo(res.t3 || 'QUÉ CAMBIA Y CÓMO SIGUE EL TEMA', res.d3 || 'QUÉ CAMBIA'), bajada: limpiarBajadaPeriodistica(res.b3 || bajadaBase) }
    ];
  } catch (e) {
    return [
      { titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada },
      { titulo: 'LAS CLAVES Y DETALLES DE LA MEDIDA', destacar: 'LAS CLAVES', bajada: ultimoEstado.bajada },
      { titulo: 'EL IMPACTO DIRECTO EN LA REGIÓN', destacar: 'IMPACTO DIRECTO', bajada: ultimoEstado.bajada }
    ];
  }
}

// ============================================================================
// MOTOR GRÁFICO 2K RETINA (SINGLETON + HDR + PIN GEOGRÁFICO PROPIO)
// ============================================================================

async function estamparMarcaDeAguaFoto(fotoUrl, textoCredito = 'EXCLUSIVO') {
  const validada = await descargarYValidarImagen(fotoUrl, 7000);
  const srcSeguro = validada ? validada.dataUrl : fotoUrl;
  const browser = await obtenerBrowserSingleton();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    const creditoLimpio = escaparHtml(limpiarEmojis(textoCredito || 'EXCLUSIVO').toUpperCase());
    const htmlMarca = `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 1080px; height: 1080px; overflow: hidden; background: #050d1a; font-family: Arial, sans-serif; }
      #wrap { position: relative; width: 1080px; height: 1080px; }
      #bg-blur { position: absolute; inset: -30px; width: 1140px; height: 1140px; object-fit: cover; filter: blur(26px) brightness(0.45); }
      #main-img { position: relative; z-index: 2; width: 1080px; height: 1080px; object-fit: contain; }
      #watermark-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg); z-index: 10; pointer-events: none; color: rgba(255, 255, 255, 0.22); font-size: 54px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase; white-space: nowrap; text-shadow: 0 2px 12px rgba(0,0,0,0.35); }
      #badge-bottom { position: absolute; bottom: 32px; right: 32px; z-index: 12; background: rgba(6, 15, 28, 0.84); backdrop-filter: blur(8px); border: 1.5px solid rgba(56, 189, 248, 0.65); border-radius: 10px; padding: 12px 22px; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
      #brand { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; }
      #sub { color: #38bdf8; font-size: 13px; font-weight: 700; letter-spacing: 1.2px; }
    </style></head><body><div id="wrap">
      <img id="bg-blur" src="${srcSeguro}" /><img id="main-img" src="${srcSeguro}" />
      <div id="watermark-center">EL REGISTRO SUR</div>
      <div id="badge-bottom"><span id="brand">EL REGISTRO SUR</span><span id="sub">${creditoLimpio} • @ELREGISTROSUR</span></div>
    </div></body></html>`;

    await page.setContent(htmlMarca, { waitUntil: 'networkidle0', timeout: 15000 });
    const el = await page.$('#wrap');
    return await el.screenshot({ type: 'png' });
  } finally {
    try { await page.close(); } catch (e) {}
  }
}

async function renderizarFlyer({
  categoria, titulo, destacar, bajada, datoClave = '', autorCita = '',
  etiquetaDuelo1 = 'PROTAGONISTA 1', etiquetaDuelo2 = 'PROTAGONISTA 2',
  hitosCronologia = [], versusAntes = null, versusAhora = null, itemsServicios = [],
  fuenteCredito = '', pinGeografico = '', fotoFinalUrl, fotoSecundariaUrl = '',
  focoVertical = '18%', logoEsquina = 'ninguno', expandirSinCloudinary, esUrgente,
  esHistoria = false, modoVisual = 'estandar', numeroSlide = ''
}) {
  verificarReinicioEstadisticasDia();
  estadisticasDia.placasRenderizadas++;

  let fotoSegura = fotoFinalUrl;
  if (fotoFinalUrl && !fotoFinalUrl.startsWith('data:image/')) {
    const descargada = await descargarYValidarImagen(fotoFinalUrl, 6500);
    if (descargada) fotoSegura = descargada.dataUrl;
  }

  let fotoSecSegura = fotoSecundariaUrl;
  if (fotoSecundariaUrl && !fotoSecundariaUrl.startsWith('data:image/')) {
    const descSec = await descargarYValidarImagen(fotoSecundariaUrl, 6000);
    if (descSec) fotoSecSegura = descSec.dataUrl;
  }

  const creditoPropio = limpiarCreditoFuentePropio(fuenteCredito);
  const alto = esHistoria ? 1920 : 1080;
  const browser = await obtenerBrowserSingleton();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1080, height: alto, deviceScaleFactor: 2 });

    const catLimpia = limpiarEmojis(categoria || 'ACTUALIDAD / NOTICIAS').toUpperCase();
    const { titulo: titLimpio, destacar: desLimpio } = asegurarDestacadoEnTitulo(titulo || 'COBERTURA DE EL REGISTRO SUR', destacar);
    const bajLimpia = limpiarBajadaPeriodistica(bajada || 'Toda la información verificada de Caleta Olivia, Santa Cruz y el país.');

    let htmlModificado = templateHtml
      .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', () => escaparHtml(titLimpio))
      .replace('VENTA DE TIERRAS A EXTRANJEROS', () => escaparHtml(desLimpio))
      .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', () => escaparHtml(bajLimpia))
      .replace('POLÍTICA', () => escaparHtml(catLimpia));

    if (fotoSegura) {
      htmlModificado = htmlModificado.replace(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g, () => fotoSegura);
    }

    await page.setContent(htmlModificado, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.evaluate(async ({
      url, urlSecundaria, focoY, logoEsquina, expandir, modoUrgente, modoHistoria, modoVisual,
      categoria, titulo, destacar, bajada, datoClave, autorCita,
      etiquetaDuelo1, etiquetaDuelo2, hitosCronologia, versusAntes, versusAhora, itemsServicios,
      fuenteCredito, pinGeografico, numeroSlide
    }) => {
      document.body.style.webkitFontSmoothing = 'antialiased';
      document.body.style.textRendering = 'optimizeLegibility';

      const canvas = document.querySelector('#canvas');
      if (!canvas) return;
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const altoCanvas = modoHistoria ? 1920 : 1080;
      if (modoHistoria) {
        canvas.style.height = '1920px';
        document.body.style.height = '1920px';
      }

      const accentColor = modoUrgente ? '#ef4444' : '#38bdf8';

      async function recortarBordesBlancosONegros(srcData) {
        if (!srcData) return srcData;
        return await new Promise((resolve) => {
          const im = new Image();
          im.onload = () => {
            try {
              const w = im.naturalWidth, h = im.naturalHeight;
              if (w < 100 || h < 100) return resolve(srcData);
              const c = document.createElement('canvas');
              c.width = w; c.height = h;
              const ctx = c.getContext('2d');
              ctx.drawImage(im, 0, 0);
              const px = ctx.getImageData(0, 0, w, h).data;

              const esFilaBorde = (y) => {
                let b = 0, n = 0, m = 0;
                for (let x = 10; x < w - 10; x += 8) {
                  const i = (y * w + x) * 4;
                  m++;
                  if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) b++;
                  if (px[i] < 14 && px[i + 1] < 14 && px[i + 2] < 14) n++;
                }
                return (b / m > 0.9) || (n / m > 0.92);
              };
              const esColBorde = (x) => {
                let b = 0, n = 0, m = 0;
                for (let y = 10; y < h - 10; y += 8) {
                  const i = (y * w + x) * 4;
                  m++;
                  if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) b++;
                  if (px[i] < 14 && px[i + 1] < 14 && px[i + 2] < 14) n++;
                }
                return (b / m > 0.9) || (n / m > 0.92);
              };

              let top = 0, bottom = h - 1, left = 0, right = w - 1;
              while (top < h * 0.35 && esFilaBorde(top)) top += 2;
              while (bottom > h * 0.65 && esFilaBorde(bottom)) bottom -= 2;
              while (left < w * 0.35 && esColBorde(left)) left += 2;
              while (right > w * 0.65 && esColBorde(right)) right -= 2;

              if (top > 6 || left > 6 || (h - 1 - bottom) > 6 || (w - 1 - right) > 6) {
                const nw = Math.max(200, right - left), nh = Math.max(200, bottom - top);
                const out = document.createElement('canvas');
                out.width = nw; out.height = nh;
                out.getContext('2d').drawImage(c, left, top, nw, nh, 0, 0, nw, nh);
                return resolve(out.toDataURL('image/jpeg', 0.94));
              }
              resolve(srcData);
            } catch (e) { resolve(srcData); }
          };
          im.onerror = () => resolve(srcData);
          im.src = srcData;
        });
      }

      const urlLimpia = await recortarBordesBlancosONegros(url);

      function blindarTipografiaProlija(el, esSubtitulo = false) {
        if (!el) return;
        el.style.textWrap = esSubtitulo ? 'pretty' : 'balance';
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const nodos = [];
        let n;
        while ((n = walker.nextNode())) if (n.nodeValue && n.nodeValue.trim().length > 0) nodos.push(n);
        if (nodos.length > 0) {
          const ult = nodos[nodos.length - 1];
          ult.nodeValue = ult.nodeValue.replace(/\s+(\S{1,4})\s+(\S+)\s*$/, '\u00A0$1\u00A0$2');
          ult.nodeValue = ult.nodeValue.replace(/\s+(\S+)\s*$/, '\u00A0$1');
        }
        if (esSubtitulo) { el.style.maxWidth = '880px'; el.style.lineHeight = '1.36'; }

        for (let intento = 0; intento < 8; intento++) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = Array.from(range.getClientRects()).filter(r => r.width > 4 && r.height > 4);
          if (rects.length < 2) break;
          const lineas = [];
          rects.forEach(r => {
            const ex = lineas.find(l => Math.abs(l.top - r.top) < 8);
            if (ex) { ex.right = Math.max(ex.right, r.right); ex.left = Math.min(ex.left, r.left); }
            else lineas.push({ top: r.top, left: r.left, right: r.right });
          });
          if (lineas.length < 2) break;
          const a1 = lineas[0].right - lineas[0].left;
          const aU = lineas[lineas.length - 1].right - lineas[lineas.length - 1].left;
          if (esSubtitulo && lineas.length === 2 && a1 > 740) {
            el.style.maxWidth = `${Math.max(620, el.getBoundingClientRect().width - 65)}px`;
            continue;
          }
          if (aU >= a1 * 0.48 || lineas.length >= 4) break;
          el.style.maxWidth = `${Math.max(520, el.getBoundingClientRect().width - 40)}px`;
        }
      }

      let fotoPrincipal = null;
      const imgs = canvas.querySelectorAll('img');
      for (const img of imgs) {
        img.style.imageRendering = '-webkit-optimize-contrast';
        const rect = img.getBoundingClientRect();
        if (img.src.includes('unsplash') || img.id.includes('bg') || img.className.includes('bg') || rect.width > 300 || img.width > 300) {
          if (urlLimpia) { img.src = urlLimpia; try { await img.decode(); } catch (e) {} }
          fotoPrincipal = img;
          if (expandir && urlLimpia) {
            const parent = img.parentElement;
            if (parent) {
              parent.style.position = 'relative'; parent.style.overflow = 'hidden';
              const bgBlurImg = document.createElement('img');
              bgBlurImg.src = urlLimpia;
              bgBlurImg.style.cssText = 'position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);object-fit:cover;filter:blur(28px) brightness(0.42) saturate(1.15);z-index:0;';
              parent.insertBefore(bgBlurImg, img);
            }
            img.style.position = 'relative'; img.style.zIndex = '1'; img.style.objectFit = 'contain'; img.style.width = '100%'; img.style.height = '100%';
          } else {
            img.style.objectFit = 'cover';
            img.style.objectPosition = `center ${focoY || '18%'}`;
            img.style.width = '100%'; img.style.height = '100%';
            if (logoEsquina && logoEsquina !== 'ninguno') {
              const mapaOrigin = { arriba_izquierda: 'bottom right', arriba_derecha: 'bottom left', abajo_izquierda: 'top right', abajo_derecha: 'top left' };
              img.style.transformOrigin = mapaOrigin[logoEsquina] || 'center center';
              img.style.transform = 'scale(1.12)';
            } else {
              img.style.transform = 'scale(1.02)';
            }
          }
        }
      }

      if (urlLimpia) {
        canvas.querySelectorAll('*').forEach(el => {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && (bg.includes('unsplash') || bg.includes('http') || bg.includes('data:image'))) {
            el.style.backgroundImage = `url("${urlLimpia}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = `center ${focoY || '18%'}`;
          }
        });
      }

      let esFotoClara = false, esFotoOscura = false;
      if (fotoPrincipal && fotoPrincipal.complete && fotoPrincipal.naturalWidth > 0) {
        try {
          const c = document.createElement('canvas'); c.width = 40; c.height = 40;
          const ctx = c.getContext('2d'); ctx.drawImage(fotoPrincipal, 0, 0, 40, 40);
          const dAll = ctx.getImageData(0, 0, 40, 40).data;
          let sT = 0;
          for (let i = 0; i < dAll.length; i += 4) sT += 0.299 * dAll[i] + 0.587 * dAll[i + 1] + 0.114 * dAll[i + 2];
          if ((sT / (dAll.length / 4)) < 54) esFotoOscura = true;
          const dInf = ctx.getImageData(0, 20, 40, 20).data;
          let sI = 0;
          for (let i = 0; i < dInf.length; i += 4) sI += 0.299 * dInf[i] + 0.587 * dInf[i + 1] + 0.114 * dInf[i + 2];
          esFotoClara = (sI / (dInf.length / 4)) > 125;
        } catch (e) {}
      }

      if (fotoPrincipal && !expandir) {
        fotoPrincipal.style.filter = esFotoOscura ? 'brightness(1.26) contrast(1.12) saturate(1.12)' : 'contrast(1.04) saturate(1.05)';
      }

      if (modoVisual === 'duelo' && urlLimpia && urlSecundaria) {
        const urlSecLimpia = await recortarBordesBlancosONegros(urlSecundaria);
        const splitWrap = document.createElement('div');
        splitWrap.style.cssText = 'position:absolute;top:0;left:0;width:1080px;height:680px;z-index:1;display:flex;overflow:hidden;';
        splitWrap.innerHTML = `
          <div style="flex:1;height:100%;overflow:hidden;position:relative;border-right:4px solid ${accentColor};">
            <img src="${urlLimpia}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;" />
            <div style="position:absolute;top:92px;left:28px;z-index:15;background:rgba(5,13,26,0.88);backdrop-filter:blur(8px);border-left:4px solid ${accentColor};color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:900;letter-spacing:1.2px;padding:7px 14px;border-radius:5px;text-transform:uppercase;">${esc(etiquetaDuelo1)}</div>
          </div>
          <div style="flex:1;height:100%;overflow:hidden;position:relative;">
            <img src="${urlSecLimpia}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;" />
            <div style="position:absolute;top:92px;right:28px;z-index:15;background:rgba(5,13,26,0.88);backdrop-filter:blur(8px);border-right:4px solid ${accentColor};color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:900;letter-spacing:1.2px;padding:7px 14px;border-radius:5px;text-transform:uppercase;">${esc(etiquetaDuelo2)}</div>
          </div>
          <div style="position:absolute;inset:0;background:linear-gradient(to top, #050d1a 2%, rgba(5,13,26,0.6) 28%, transparent 65%);"></div>`;
        canvas.insertBefore(splitWrap, canvas.firstChild);
        if (fotoPrincipal) fotoPrincipal.style.opacity = '0';
      }

      if (modoVisual === 'lupa' && (urlSecundaria || urlLimpia)) {
        const imgPip = urlSecundaria ? await recortarBordesBlancosONegros(urlSecundaria) : urlLimpia;
        const pipCard = document.createElement('div');
        pipCard.style.cssText = `position:absolute;top:84px;right:42px;width:270px;height:270px;border-radius:24px;overflow:hidden;z-index:25;border:4px solid ${accentColor};box-shadow:0 20px 45px rgba(0,0,0,0.75);background:#050d1a;`;
        pipCard.innerHTML = `<img src="${imgPip}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;transform:scale(1.08);" />`;
        canvas.appendChild(pipCard);
      }

      if (esFotoClara && (modoVisual === 'estandar' || modoVisual === 'carrusel_portada')) {
        const refuerzo = document.createElement('div');
        refuerzo.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:linear-gradient(to top, rgba(4,10,20,0.97) 0%, rgba(4,10,20,0.84) 46%, rgba(4,10,20,0.12) 100%);';
        canvas.appendChild(refuerzo);
      }

      // Pastilla Superior Derecha Propia (Pin Geográfico + EL REGISTRO SUR, jamás medios ajenos)
      if (pinGeografico || fuenteCredito) {
        const badgeFuente = document.createElement('div');
        badgeFuente.textContent = pinGeografico ? `📍 ${pinGeografico.toUpperCase()} • EL REGISTRO SUR` : `${fuenteCredito.toUpperCase()}`;
        badgeFuente.style.cssText = 'position:absolute;top:34px;right:38px;z-index:30;background:rgba(6,14,26,0.78);backdrop-filter:blur(8px);color:rgba(255,255,255,0.90);font-family:sans-serif;font-size:14px;font-weight:800;letter-spacing:1.2px;padding:7px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.18);';
        canvas.appendChild(badgeFuente);
      }

      if (numeroSlide) {
        const badgeSlide = document.createElement('div');
        badgeSlide.textContent = numeroSlide;
        badgeSlide.style.cssText = `position:absolute;top:34px;left:38px;z-index:30;background:${accentColor};color:#050d1a;font-family:sans-serif;font-size:17px;font-weight:900;letter-spacing:1px;padding:7px 18px;border-radius:999px;box-shadow:0 8px 20px rgba(0,0,0,0.45);`;
        canvas.appendChild(badgeSlide);
      }

      if (modoVisual === 'carrusel_portada') {
        const badgeDesliza = document.createElement('div');
        badgeDesliza.innerHTML = 'DESLIZÁ &rarr;';
        badgeDesliza.style.cssText = `position:absolute;bottom:118px;right:48px;z-index:30;background:rgba(5,13,26,0.88);color:${accentColor};border:1.5px solid ${accentColor};font-family:sans-serif;font-size:15px;font-weight:900;letter-spacing:1.5px;padding:8px 18px;border-radius:999px;`;
        canvas.appendChild(badgeDesliza);
      }

      const modulosEspeciales = ['cita', 'dato', 'carrusel_claves', 'carrusel_cierre', 'cronologia', 'versus', 'servicios'];
      if (modulosEspeciales.includes(modoVisual)) {
        canvas.querySelectorAll('h1, h2, h3, p, .titulo, .bajada, [class*="title"], [class*="sub"], [class*="cat"], [class*="tag"], [class*="pill"]').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.top < 915 && r.height < 600) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
        });

        const titEsc = esc(titulo);
        const desEsc = esc(destacar);
        const tituloFormateado = desEsc && titEsc.includes(desEsc) ? titEsc.replace(desEsc, `<span style="color:${accentColor}">${desEsc}</span>`) : titEsc;

        const panel = document.createElement('div');
        panel.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:132px;z-index:18;display:flex;flex-direction:column;justify-content:flex-end;padding:84px 62px 24px 62px;box-sizing:border-box;font-family:sans-serif;';

        if (modoVisual === 'carrusel_claves') {
          if (fotoPrincipal) { fotoPrincipal.style.height = '450px'; fotoPrincipal.style.filter = 'brightness(0.84) contrast(1.06)'; }
          panel.style.background = 'linear-gradient(to bottom, rgba(5,13,26,0.10) 0%, rgba(5,13,26,0.88) 34%, #050d1a 48%)';
          panel.innerHTML = `
            <div style="background:rgba(10,23,44,0.92);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-left:7px solid ${accentColor};border-radius:20px;padding:42px 44px;box-shadow:0 24px 50px rgba(0,0,0,0.65);display:flex;flex-direction:column;gap:22px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:16px;letter-spacing:1.5px;padding:6px 16px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span>
                <span style="color:${accentColor};font-weight:800;font-size:16px;letter-spacing:1.5px;">LAS CLAVES DEL TEMA &rarr;</span>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:44px;font-weight:900;line-height:1.12;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.92);font-size:26px;line-height:1.42;">${esc(bajada)}</div>
            </div>`;
        } else if (modoVisual === 'carrusel_cierre') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(14px) brightness(0.32) saturate(1.2)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'radial-gradient(circle at center, rgba(12,28,54,0.55) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:linear-gradient(165deg, rgba(12,27,50,0.95) 0%, rgba(6,15,28,0.98) 100%);border:1.5px solid rgba(56,189,248,0.35);border-top:7px solid ${accentColor};border-radius:22px;padding:48px 48px;box-shadow:0 28px 60px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:24px;">
              <div><span style="display:inline-block;background:${accentColor};color:#050d1a;font-weight:900;font-size:16px;letter-spacing:1.6px;padding:7px 18px;border-radius:5px;text-transform:uppercase;">QUÉ CAMBIA / DEFINICIONES</span></div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:46px;font-weight:900;line-height:1.12;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.90);font-size:26px;line-height:1.42;border-left:4px solid ${accentColor};padding-left:22px;">${esc(bajada)}</div>
            </div>`;
        } else if (modoVisual === 'cita') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(10px) brightness(0.35)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.92);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:42px 44px;box-shadow:0 25px 55px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:24px;">
              <div style="display:flex;align-items:center;gap:24px;">
                ${urlLimpia ? `<img src="${urlLimpia}" style="width:128px;height:128px;border-radius:50%;object-fit:cover;object-position:center 18%;border:4px solid ${accentColor};" />` : ''}
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <span style="align-self:flex-start;background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;letter-spacing:1.4px;padding:5px 14px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span>
                  <div style="color:${accentColor};font-size:21px;font-weight:900;text-transform:uppercase;">${esc(autorCita)}</div>
                </div>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:44px;font-weight:900;line-height:1.14;">“${tituloFormateado}”</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.88);font-size:24px;line-height:1.38;border-left:4px solid ${accentColor};padding-left:20px;">${esc(bajada)}</div>
            </div>`;
        } else if (modoVisual === 'dato') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(10px) brightness(0.34)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.92);border:1px solid rgba(255,255,255,0.14);border-left:7px solid ${accentColor};border-radius:22px;padding:44px 46px;box-shadow:0 25px 55px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:20px;">
              <div><span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;letter-spacing:1.5px;padding:6px 16px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span></div>
              <div style="color:${accentColor};font-size:92px;font-weight:900;line-height:0.98;letter-spacing:-2px;">${esc(datoClave)}</div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:42px;font-weight:900;line-height:1.14;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.88);font-size:24px;line-height:1.38;">${esc(bajada)}</div>
            </div>`;
        } else if (modoVisual === 'cronologia') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(12px) brightness(0.30)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          const listaHitos = (hitosCronologia && hitosCronologia.length === 3) ? hitosCronologia : [{ etiqueta: 'PASO 1', texto: bajada }, { etiqueta: 'PASO 2', texto: bajada }, { etiqueta: 'PASO 3', texto: bajada }];
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.93);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:38px 42px;display:flex;flex-direction:column;gap:22px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;padding:5px 15px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span>
                <span style="color:${accentColor};font-weight:900;font-size:15px;letter-spacing:1.5px;">CRONOLOGÍA DE LOS HECHOS</span>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:36px;font-weight:900;line-height:1.12;text-transform:uppercase;">${tituloFormateado}</div>
              <div style="display:flex;flex-direction:column;gap:16px;border-left:4px solid ${accentColor};padding-left:24px;">
                ${listaHitos.map((h, i) => `<div><div style="color:${accentColor};font-size:15px;font-weight:900;text-transform:uppercase;">0${i + 1} • ${esc(h.etiqueta)}</div><div style="color:rgba(255,255,255,0.92);font-size:21px;line-height:1.32;margin-top:3px;">${esc(h.texto)}</div></div>`).join('')}
              </div>
            </div>`;
        } else if (modoVisual === 'versus') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(12px) brightness(0.30)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          const colA = versusAntes || { titulo: 'ESCENARIO A', detalle: bajada };
          const colB = versusAhora || { titulo: 'ESCENARIO B', detalle: bajada };
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.93);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:38px 42px;display:flex;flex-direction:column;gap:22px;">
              <div><span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;padding:5px 15px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span></div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:38px;font-weight:900;line-height:1.12;text-transform:uppercase;">${tituloFormateado}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div style="background:rgba(255,255,255,0.05);border-top:5px solid rgba(255,255,255,0.45);border-radius:14px;padding:22px;">
                  <div style="color:rgba(255,255,255,0.75);font-size:16px;font-weight:900;margin-bottom:10px;">${esc(colA.titulo)}</div>
                  <div style="color:#ffffff;font-size:21px;line-height:1.36;">${esc(colA.detalle)}</div>
                </div>
                <div style="background:rgba(56,189,248,0.09);border-top:5px solid ${accentColor};border-radius:14px;padding:22px;">
                  <div style="color:${accentColor};font-size:16px;font-weight:900;margin-bottom:10px;">${esc(colB.titulo)}</div>
                  <div style="color:#ffffff;font-size:21px;line-height:1.36;">${esc(colB.detalle)}</div>
                </div>
              </div>
            </div>`;
        } else if (modoVisual === 'servicios') {
          if (fotoPrincipal) fotoPrincipal.style.filter = 'blur(12px) brightness(0.30)';
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          const grilla = (itemsServicios && itemsServicios.length >= 2) ? itemsServicios : [{ etiqueta: 'INFORMACIÓN OFICIAL', valor: bajada }];
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.94);border:1.5px solid rgba(56,189,248,0.35);border-radius:22px;padding:38px 42px;display:flex;flex-direction:column;gap:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="background:${accentColor};color:#050d1a;font-weight:900;font-size:15px;padding:6px 16px;border-radius:4px;text-transform:uppercase;">${esc(categoria)}</span>
                <span style="color:rgba(255,255,255,0.80);font-weight:800;font-size:14px;">GUARDÁ ESTA INFO 📍</span>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:36px;font-weight:900;line-height:1.12;text-transform:uppercase;">${tituloFormateado}</div>
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${grilla.map(it => `<div style="background:rgba(255,255,255,0.06);border-left:5px solid ${accentColor};border-radius:10px;padding:15px 20px;"><div style="color:${accentColor};font-size:14px;font-weight:900;text-transform:uppercase;">${esc(it.etiqueta)}</div><div style="color:#ffffff;font-size:21px;font-weight:600;line-height:1.32;margin-top:4px;">${esc(it.valor)}</div></div>`).join('')}
              </div>
            </div>`;
        }

        canvas.appendChild(panel);
        panel.querySelectorAll('.texto-equilibrado').forEach(el => blindarTipografiaProlija(el, el.classList.contains('sub-bajada')));
        return;
      }

      if (modoUrgente) {
        canvas.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.color === 'rgb(56, 189, 248)' || style.color === 'rgb(0, 174, 239)') el.style.color = '#ef4444';
          if (style.backgroundColor === 'rgb(56, 189, 248)' || style.backgroundColor === 'rgb(0, 174, 239)') el.style.backgroundColor = '#ef4444';
        });
      }

      const titulares = canvas.querySelectorAll('h1, h2, h3, .titulo, [class*="title"]');
      titulares.forEach(el => { if (el.innerText && el.innerText.trim().length > 4) blindarTipografiaProlija(el, false); });

      const subtitulos = canvas.querySelectorAll('p, .bajada, [class*="sub"], [class*="desc"]');
      subtitulos.forEach(el => { if (el.innerText && el.innerText.trim().length > 20) blindarTipografiaProlija(el, true); });

      titulares.forEach(el => {
        let fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        const limiteInferior = altoCanvas - 140;
        while (el.getBoundingClientRect().bottom > limiteInferior && fontSize > 26) {
          fontSize -= 2; el.style.fontSize = `${fontSize}px`; el.style.lineHeight = '1.12';
        }
      });
    }, {
      url: fotoSegura, urlSecundaria: fotoSecSegura, focoY: focoVertical, logoEsquina,
      expandir: expandirSinCloudinary, modoUrgente: esUrgente, modoHistoria: esHistoria,
      modoVisual, categoria: catLimpia, titulo: titLimpio, destacar: desLimpio, bajada: bajLimpia,
      datoClave, autorCita, etiquetaDuelo1, etiquetaDuelo2, hitosCronologia, versusAntes, versusAhora, itemsServicios,
      fuenteCredito: creditoPropio, pinGeografico, numeroSlide
    });

    await new Promise(r => setTimeout(r, 260));
    const canvasElement = await page.$('#canvas');
    return await canvasElement.screenshot({ type: 'png' });
  } finally {
    try { await page.close(); } catch (e) {}
  }
}

async function enviarFotoConBotonesTelegram(imageBuffer, prefijo, copyCompleto, borrarAnterior = false) {
  if (borrarAnterior && ultimoEstado.ultimo_message_id) {
    await borrarMensajeTelegram(ultimoEstado.ultimo_message_id);
  }

  const { captionFoto, enviarTextoCompletoAparte } = prepararCaptionTelegram(prefijo, copyCompleto);
  const form = new FormData();
  form.append('chat_id', EDITOR_CHAT_ID);
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'flyer_2k.png');
  form.append('caption', captionFoto);
  form.append('reply_markup', JSON.stringify(generarTecladoTactil()));

  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: form });
    const d = await r.json();
    if (d?.result?.message_id) {
      ultimoEstado.ultimo_message_id = d.result.message_id;
      persistirEstadoEnDisco(ultimoEstado);
    }
  } catch (e) {}

  if (enviarTextoCompletoAparte) {
    await enviarMensajeTelegram(`📝 DESCRIPCIÓN COMPLETA PARA META (${copyCompleto.length}/2200 caracteres):\n\n${copyCompleto}`);
  }
}

// Disparador directo hacia Make cuando usás la cola espaciada (.encolar) o Modo Directo
async function dispararPublicacionHaciaMake(item) {
  verificarReinicioEstadisticasDia();
  estadisticasDia.publicadasHoy++;
  const webhookUrl = configSistema.makeWebhookUrl || (process.env.MAKE_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return false;
  try {
    const ts = Date.now();
    const resp = await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true, publicar: true,
        categoria: item.categoria, titulo: item.titulo, bajada: item.bajada,
        copy: item.copy, copy_completo: item.copy,
        url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${ts}`,
        imagen_base64: item.imagen_buffer ? item.imagen_buffer.toString('base64') : item.imagen_base64 || ''
      })
    });
    return resp.ok;
  } catch (e) { return false; }
}

async function armarNoticiaDesdeCandidata(elegida, exigirFotoReal = false, forzarUrgente = false) {
  registrarTemaEnviado(elegida.titulo);

  const [extraido, contextoObj] = await Promise.all([
    extraerNoticiaDeLink(elegida.link, elegida.titulo, elegida.medio),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const contenidoDisponible = `${elegida.bajadaRss || ''} ${extraido.parrafosReales || ''} ${contextoObj.texto || ''}`.trim();
  if (exigirFotoReal && contenidoDisponible.length < 140) return null;

  const fechaRawFinal = elegida.fechaPub || extraido.fechaPublicacion || contextoObj.fechaReciente || '';
  const antiguedad = calcularAntiguedadNoticia(fechaRawFinal);
  const esFarandula = elegida.categoriaOrigen === 'espectaculos';

  const textoCompleto = `SECCIÓN: ${elegida.categoriaOrigen.toUpperCase()}\nPUBLICADO: ${antiguedad.texto}\nTITULAR: ${elegida.titulo}\nRESUMEN: ${elegida.bajadaRss || ''}\n${extraido.textoExtraido}`;
  const noticiaIA = await procesarNoticiaConIA(textoCompleto, contextoObj.texto || 'Hecho verificado.', false);
  if (noticiaIA.descartar) return null;

  // Bloquea el modo URGENTE en notas de espectáculos/farándula
  const urgenteReal = esFarandula ? false : forzarUrgente;
  const catBase = normalizarCategoriaPeriodistica(noticiaIA.categoria, textoCompleto, esFarandula);
  const catFinal = urgenteReal && !catBase.includes('URGENTE') ? `URGENTE / ${catBase.split('/')[0].trim()}` : catBase;

  const fotoInicial = extraido.fotoExtraida || elegida.fotoRss || '';
  const { urlFinal, urlOriginal, focoVertical, logoEsquina, esFotoRealVerificada } = await auditarYResolverImagen({
    fotoCandidataUrl: fotoInicial, esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo, bajada: noticiaIA.bajada, categoria: catFinal,
    busquedasSugeridas: [noticiaIA.busqueda_foto_web, noticiaIA.busqueda_foto_secundaria, noticiaIA.busqueda_foto_institucional],
    promptIaSugerido: noticiaIA.prompt_imagen_ia
  });

  if (exigirFotoReal && !esFotoRealVerificada) return null;

  const imageBuffer = await renderizarFlyer({
    categoria: catFinal, titulo: noticiaIA.titulo, destacar: noticiaIA.destacar, bajada: noticiaIA.bajada,
    datoClave: noticiaIA.dato_clave, autorCita: noticiaIA.autor_cita,
    etiquetaDuelo1: noticiaIA.etiqueta_duelo_1, etiquetaDuelo2: noticiaIA.etiqueta_duelo_2,
    fuenteCredito: 'EL REGISTRO SUR', pinGeografico: noticiaIA.pin_geografico,
    fotoFinalUrl: urlFinal, focoVertical, logoEsquina, expandirSinCloudinary: false,
    esUrgente: urgenteReal, esHistoria: false, modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: urlFinal, foto_original_url: urlOriginal || urlFinal, foto_secundaria_url: '',
    fotos_usadas: [urlOriginal, urlFinal].filter(Boolean), foco_vertical: focoVertical, logo_esquina: logoEsquina || 'ninguno',
    pin_geografico: noticiaIA.pin_geografico || '', categoria: catFinal, titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar, bajada: noticiaIA.bajada, copy: noticiaIA.copy,
    dato_clave: noticiaIA.dato_clave || '', autor_cita: noticiaIA.autor_cita || '',
    etiqueta_duelo_1: noticiaIA.etiqueta_duelo_1 || 'PROTAGONISTA 1', etiqueta_duelo_2: noticiaIA.etiqueta_duelo_2 || 'PROTAGONISTA 2',
    hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: [],
    fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: antiguedad.texto,
    busqueda_foto_web: noticiaIA.busqueda_foto_web || noticiaIA.titulo,
    busqueda_foto_secundaria: noticiaIA.busqueda_foto_secundaria || noticiaIA.busqueda_foto_institucional || '',
    prompt_imagen_ia: noticiaIA.prompt_imagen_ia || 'Argentina journalism photography',
    fill_mode: 'cover', modo_visual: 'estandar', urgente: urgenteReal, ultimo_message_id: null,
    imagen_buffer: imageBuffer, historia_buffer: null, carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA, medio: elegida.medio, antiguedadTexto: antiguedad.texto, consensoMedios: elegida.consensoMedios || 1 };
}

async function generarDatosRadar(forzar = false) {
  const candidatas = await obtenerTodasLasCandidatasRadar();
  if (candidatas.length === 0) return null;
  let ordenadas = ordenarCandidatasRelevantes(candidatas, false);
  if (ordenadas.length === 0 && forzar) ordenadas = ordenarCandidatasRelevantes(candidatas, true);
  if (ordenadas.length === 0) return null;

  ultimasTopCandidatas = ordenadas.slice(0, 5);
  for (const elegida of ordenadas.slice(0, 4)) {
    const esUrgentePorConsenso = elegida.categoriaOrigen !== 'espectaculos' && (elegida.consensoMedios || 1) >= 3 && elegida.antiguedadMinutos <= 45;
    const resultado = await armarNoticiaDesdeCandidata(elegida, true, esUrgentePorConsenso);
    if (resultado) return resultado;
  }
  return await armarNoticiaDesdeCandidata(ordenadas[0], false, false);
}

async function asegurarBorradorActivo() {
  if (ultimoEstado && ultimoEstado.titulo) return true;
  cargarEstadoDesdeDisco();
  if (ultimoEstado && ultimoEstado.titulo) return true;
  if (colaBorradores.length > 0) {
    ultimoEstado = colaBorradores.shift();
    return Boolean(ultimoEstado && ultimoEstado.titulo);
  }
  const radarAuto = await generarDatosRadar(true);
  return Boolean(radarAuto && ultimoEstado.titulo);
}

async function ejecutarAlertaRuta3YServicios() {
  const queryRuta = '("Ruta 3" OR "Ruta Nacional 3" OR "Ramón Santos" OR "Caleta Olivia") (corte OR tránsito OR agua OR luz OR acueducto OR viento OR alerta) when:24h';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryRuta)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const items = await leerUnFeedRss({ url, medio: 'VIALIDAD / SERVICIOS', categoria: 'regional' });
  const nuevos = items.filter(i => !noticiasEnviadasRadar.has(i.titulo));
  const elegida = nuevos[0] || items[0];
  if (!elegida) return null;
  return await armarNoticiaDesdeCandidata(elegida, false, true);
}

async function ejecutarPlacaMercados() {
  const datosM = await obtenerDatosMercadosEnVivo();
  const noticiaIA = await procesarNoticiaConIA(datosM.textoMercados, 'Cotizaciones oficiales DolarApi y mercados.', false);
  const { urlFinal: fotoMercados } = await auditarYResolverImagen({
    fotoCandidataUrl: '', esFotoManualDelEditor: false,
    titulo: 'Banco Central economia dolar petroleo Argentina', bajada: noticiaIA.bajada, categoria: 'ECONOMÍA / MERCADOS',
    busquedasSugeridas: ['Banco Central Republica Argentina edificio', 'YPF petroleo Santa Cruz Argentina'],
    promptIaSugerido: 'Buenos Aires financial district central bank building exterior photojournalism'
  });

  const imageBuffer = await renderizarFlyer({
    categoria: 'ECONOMÍA / MERCADOS', titulo: noticiaIA.titulo, destacar: noticiaIA.destacar, bajada: noticiaIA.bajada,
    datoClave: datosM.blueVenta !== '---' ? `BLUE ${datosM.blueVenta}` : noticiaIA.dato_clave,
    itemsServicios: datosM.itemsGrilla, fuenteCredito: 'EL REGISTRO SUR',
    fotoFinalUrl: fotoMercados, expandirSinCloudinary: false, esUrgente: false, esHistoria: false, modoVisual: 'servicios'
  });

  guardarEnColaBorradores({
    foto_url: fotoMercados, foto_original_url: fotoMercados, foto_secundaria_url: '', fotos_usadas: [fotoMercados],
    foco_vertical: '18%', logo_esquina: 'ninguno', pin_geografico: '', categoria: 'ECONOMÍA / MERCADOS',
    titulo: noticiaIA.titulo, destacar: noticiaIA.destacar, bajada: noticiaIA.bajada, copy: noticiaIA.copy,
    dato_clave: datosM.blueVenta !== '---' ? `BLUE ${datosM.blueVenta}` : noticiaIA.dato_clave,
    autor_cita: '', etiqueta_duelo_1: 'DÓLAR OFICIAL', etiqueta_duelo_2: 'DÓLAR BLUE',
    hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: datosM.itemsGrilla,
    fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: 'Cotización en vivo',
    busqueda_foto_web: 'Banco Central Argentina', busqueda_foto_secundaria: 'YPF petroleo',
    prompt_imagen_ia: 'Buenos Aires financial district', fill_mode: 'cover', modo_visual: 'servicios',
    urgente: false, ultimo_message_id: null, imagen_buffer: imageBuffer, historia_buffer: null, carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA };
}

async function ejecutarResumenDiarioCarrusel() {
  const candidatas = await obtenerTodasLasCandidatasRadar();
  const titulares = candidatas.slice(0, 14).map(t => `- ${t.titulo}`).join('\n').slice(0, 1400);

  const promptResumen = `Sos el Editor Jefe de 'EL REGISTRO SUR'. Armá el RESUMEN DIARIO EN CARRUSEL de 5 placas (sin nombrar otros medios y sin rótulos 'Subtema clave:'):
Titulares del día:\n${titulares}
Devolvé SOLO este JSON:
{"t1": "LO QUE PASÓ HOY EN EL SUR", "d1": "LO QUE PASÓ HOY", "b1": "Repaso por los cuatro hechos más relevantes que marcaron la jornada informativa en Caleta Olivia, Santa Cruz y el país.", "t2": "TITULAR TEMA 1", "d2": "DESTACAR 1", "b2": "Explicación de 20 a 28 palabras.", "t3": "TITULAR TEMA 2", "d3": "DESTACAR 2", "b3": "Explicación de 20 a 28 palabras.", "t4": "TITULAR TEMA 3", "d4": "DESTACAR 3", "b4": "Explicación de 20 a 28 palabras.", "t5": "TITULAR TEMA 4", "d5": "DESTACAR 4", "b5": "Explicación de 20 a 28 palabras.", "copy": "RESUMEN DEL DÍA EN EL REGISTRO SUR 📰📍\\n\\nRepaso completo con los hechos más importantes de la jornada...\\n\\nToda la cobertura en @elregistrosur.\\n\\n¿Cuál de estos temas te parece más relevante hoy? Te leemos en comentarios 👇\\n\\n#noticias #elregistrosur #caletaolivia #santacruz #resumendeldia #patagonia #actualidad #argentina"}`;

  const parsed = await llamarGroqChat([{ role: 'user', content: promptResumen }]);
  const slides = [
    { titulo: parsed.t1 || 'LO QUE PASÓ HOY EN EL SUR', destacar: parsed.d1 || 'LO QUE PASÓ HOY', bajada: parsed.b1 || 'Repaso por los temas más importantes de la jornada.' },
    { titulo: parsed.t2 || 'ACTUALIDAD REGIONAL', destacar: parsed.d2 || 'ACTUALIDAD', bajada: parsed.b2 || '' },
    { titulo: parsed.t3 || 'PANORAMA PROVINCIAL', destacar: parsed.d3 || 'PROVINCIAL', bajada: parsed.b3 || '' },
    { titulo: parsed.t4 || 'AGENDA NACIONAL', destacar: parsed.d4 || 'NACIONAL', bajada: parsed.b4 || '' },
    { titulo: parsed.t5 || 'CIERRE DE JORNADA', destacar: parsed.d5 || 'JORNADA', bajada: parsed.b5 || '' }
  ].filter(s => s.bajada);

  const { urlFinal: fotoBase } = await auditarYResolverImagen({
    fotoCandidataUrl: '', esFotoManualDelEditor: false,
    titulo: 'Caleta Olivia Santa Cruz Patagonia', bajada: 'Vista panorámica de Caleta Olivia.', categoria: 'SANTA CRUZ / RESUMEN',
    busquedasSugeridas: ['Caleta Olivia Santa Cruz El Gorosito', 'Caleta Olivia costanera'],
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina dusk city coast landscape'
  });

  const buffers = [];
  for (let i = 0; i < slides.length; i++) {
    const td = asegurarDestacadoEnTitulo(slides[i].titulo, slides[i].destacar);
    const modoSlide = i === 0 ? 'carrusel_portada' : (i === slides.length - 1 ? 'carrusel_cierre' : 'carrusel_claves');
    const buf = await renderizarFlyer({
      categoria: 'SANTA CRUZ / RESUMEN', titulo: td.titulo, destacar: td.destacar,
      bajada: limpiarBajadaPeriodistica(slides[i].bajada), fuenteCredito: 'EL REGISTRO SUR', pinGeografico: 'SANTA CRUZ',
      fotoFinalUrl: fotoBase, expandirSinCloudinary: false, esUrgente: false, esHistoria: false,
      modoVisual: modoSlide, numeroSlide: `0${i + 1} / 0${slides.length}`
    });
    buffers.push(buf);
  }

  const copyLimpia = filtrarEmojisSegurosRedes(parsed.copy);
  guardarEnColaBorradores({
    foto_url: fotoBase, foto_original_url: fotoBase, foto_secundaria_url: '', fotos_usadas: [fotoBase],
    foco_vertical: '18%', logo_esquina: 'ninguno', pin_geografico: 'SANTA CRUZ', categoria: 'SANTA CRUZ / RESUMEN',
    titulo: limpiarEmojis(slides[0].titulo), destacar: limpiarEmojis(slides[0].destacar),
    bajada: limpiarBajadaPeriodistica(slides[0].bajada), copy: copyLimpia,
    dato_clave: '', autor_cita: '', etiqueta_duelo_1: '', etiqueta_duelo_2: '',
    hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: [],
    fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: 'Resumen de hoy',
    busqueda_foto_web: 'Caleta Olivia Santa Cruz', busqueda_foto_secundaria: '',
    prompt_imagen_ia: 'Caleta Olivia Patagonia coast', fill_mode: 'cover', modo_visual: 'estandar',
    urgente: false, ultimo_message_id: null, imagen_buffer: buffers[0], historia_buffer: null, carrusel_buffers: buffers
  });

  return { buffers, copy: copyLimpia };
}

async function ejecutarParteClima() {
  const clima = await obtenerDatosClimaCaleta();
  const noticiaIA = await procesarNoticiaConIA(clima.texto, 'Fuente meteorológica oficial Open-Meteo Caleta Olivia.', false);
  const { urlFinal: fotoClima } = await auditarYResolverImagen({
    fotoCandidataUrl: '', esFotoManualDelEditor: false,
    titulo: 'Caleta Olivia Santa Cruz Costanera', bajada: noticiaIA.bajada, categoria: 'CALETA OLIVIA / CLIMA',
    busquedasSugeridas: ['Caleta Olivia Santa Cruz costanera', 'Caleta Olivia El Gorosito'],
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina coastal city sea sky dramatic weather landscape'
  });

  const imageBuffer = await renderizarFlyer({
    categoria: 'CALETA OLIVIA / CLIMA', titulo: noticiaIA.titulo, destacar: noticiaIA.destacar, bajada: noticiaIA.bajada,
    datoClave: `${clima.rafagasHoy} KM/H`, fuenteCredito: 'SERVICIO METEOROLÓGICO', pinGeografico: 'CALETA OLIVIA',
    fotoFinalUrl: fotoClima, expandirSinCloudinary: false, esUrgente: clima.rafagasHoy >= 70, esHistoria: false, modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: fotoClima, foto_original_url: fotoClima, foto_secundaria_url: '', fotos_usadas: [fotoClima],
    foco_vertical: '18%', logo_esquina: 'ninguno', pin_geografico: 'CALETA OLIVIA', categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo, destacar: noticiaIA.destacar, bajada: noticiaIA.bajada, copy: noticiaIA.copy,
    dato_clave: `${clima.rafagasHoy} KM/H`, autor_cita: '', etiqueta_duelo_1: '', etiqueta_duelo_2: '',
    hitos_cronologia: [], versus_antes: null, versus_ahora: null,
    items_servicios: [
      { etiqueta: 'TEMPERATURA EN CALETA OLIVIA', valor: `Actual ${clima.tempActual}°C (Mín ${clima.minHoy}°C / Máx ${clima.maxHoy}°C)` },
      { etiqueta: 'RÁFAGAS DE VIENTO', valor: `Hasta ${clima.rafagasHoy} km/h en casco urbano y Ruta 3` }
    ],
    fuente_credito: 'SERVICIO METEOROLÓGICO', antiguedad_texto: 'Actualizado ahora',
    busqueda_foto_web: 'Caleta Olivia costanera', busqueda_foto_secundaria: '',
    prompt_imagen_ia: 'Caleta Olivia Patagonia coastal weather landscape', fill_mode: 'cover', modo_visual: 'estandar',
    urgente: clima.rafagasHoy >= 70, ultimo_message_id: null, imagen_buffer: imageBuffer, historia_buffer: null, carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA };
}

// ============================================================================
// RELOJES AUTOMÁTICOS: COLA ESPACIADA + CENTINELA (15m) + RADAR (1 HORA)
// ============================================================================

// Revisa cada 5 minutos si hay noticias en la Cola Espaciada (.encolar) listas para salir hacia Make
setInterval(async () => {
  try {
    if (colaPublicacion.length === 0) return;
    const ahora = Date.now();
    if (ahora >= colaPublicacion[0].programadoPara) {
      const item = colaPublicacion.shift();
      guardarColaPublicacionEnDisco();
      ultimoEstado = { ...ultimoEstado, ...item, imagen_buffer: item.imagen_buffer };
      persistirEstadoEnDisco(ultimoEstado);
      const enviadoOk = await dispararPublicacionHaciaMake(item);
      await enviarMensajeTelegram(
        enviadoOk
          ? `✅ PUBLICACIÓN PROGRAMADA ENVIADA A REDES:\n"${item.titulo}"\n(Quedan ${colaPublicacion.length} en cola).`
          : `⏰ Turno de la noticia encolada: "${item.titulo}".\nTocá ✅ Publicar IG/FB abajo o configurá .make [url_webhook] para envío directo.`
      );
    }
  } catch (e) {}
}, 5 * 60 * 1000);

// Centinela de primicias cada 15 minutos con descanso nocturno (01:00 a 07:00 hs) y bloqueo de farándula
setInterval(async () => {
  try {
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Rio_Gallegos' }));
    const hora = ahoraAR.getHours();
    if (hora >= 1 && hora < 7) return;

    const candidatas = await obtenerTodasLasCandidatasRadar();
    const ordenadas = ordenarCandidatasRelevantes(candidatas, false);
    const regexUrgenciaReal = /urgente|[úu]ltimo momento|alerta|corte total|vuelco|explosi[óo]n|terremoto|sismo|atentado|renunci[óo]|muri[óo]|falleci[óo]|paro total|caleta olivia|ram[óo]n santos/i;

    const primicia = ordenadas.find(c =>
      c.categoriaOrigen !== 'espectaculos' &&
      c.antiguedadMinutos <= 22 &&
      (c.consensoMedios >= 3 || regexUrgenciaReal.test(c.titulo))
    );

    if (primicia) {
      const armada = await armarNoticiaDesdeCandidata(primicia, true, true);
      if (armada) {
        const etiquetaConsenso = armada.consensoMedios >= 3 ? ` • 🔥 TENDENCIA EN ${armada.consensoMedios} MEDIOS` : '';
        await enviarFotoConBotonesTelegram(
          armada.imageBuffer,
          `🚨 PRIMICIA DETECTADA (${armada.medio.toUpperCase()}${etiquetaConsenso})\n⏱️ Publicado: ${armada.antiguedadTexto} — ¿PUBLICAR AHORA?`,
          armada.noticiaIA.copy
        );
      }
    }
  } catch (e) {}
}, 15 * 60 * 1000);

// Radar general cada 1 HORA (60 min) con descanso nocturno de 01:00 a 07:00 hs
setInterval(async () => {
  try {
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Rio_Gallegos' }));
    const hora = ahoraAR.getHours();
    const fechaHoy = ahoraAR.toISOString().slice(0, 10);
    if (hora >= 1 && hora < 7) return;

    const radar = await generarDatosRadar(false);
    if (radar) {
      await enviarFotoConBotonesTelegram(
        radar.imageBuffer,
        `🚨 RADAR (${radar.medio.toUpperCase()})\n⏱️ Publicado en el portal: ${radar.antiguedadTexto} — ¿QUERÉS PUBLICARLO?`,
        radar.noticiaIA.copy
      );
    }

    if (hora === 8 && ultimoClimaDiaEnviado !== fechaHoy) {
      ultimoClimaDiaEnviado = fechaHoy;
      const { imageBuffer, noticiaIA } = await ejecutarParteClima();
      await enviarFotoConBotonesTelegram(imageBuffer, '📢 PARTE DIARIO DE CLIMA Y VIENTO (⏱️ Actualizado ahora):', noticiaIA.copy);
    }

    if (hora === 21 && ultimoResumenDiaEnviado !== fechaHoy) {
      ultimoResumenDiaEnviado = fechaHoy;
      const resumen = await ejecutarResumenDiarioCarrusel();
      await enviarFotoConBotonesTelegram(resumen.buffers[0], '📰 RESUMEN DIARIO:', resumen.copy);
      for (let i = 1; i < resumen.buffers.length; i++) {
        const f = new FormData();
        f.append('chat_id', EDITOR_CHAT_ID);
        f.append('photo', new Blob([resumen.buffers[i]], { type: 'image/png' }), `resumen_${i + 1}.png`);
        f.append('caption', `📑 Placa ${i + 1}/${resumen.buffers.length} del resumen diario`);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: f });
      }
    }
  } catch (e) {
    console.error('Error en tarea programada:', e.message);
  }
}, 60 * 60 * 1000);

app.get('/radar', async (req, res) => {
  const radar = await generarDatosRadar(true);
  if (!radar) return res.json({ enviado: false, motivo: 'Sin noticias disponibles.' });
  await enviarFotoConBotonesTelegram(
    radar.imageBuffer,
    `🚨 RADAR (${radar.medio.toUpperCase()})\n⏱️ Publicado en el portal: ${radar.antiguedadTexto} — ¿QUERÉS PUBLICARLO?`,
    radar.noticiaIA.copy
  );
  res.json({ enviado: true, titulo: radar.noticiaIA.titulo, medio: radar.medio, publicado: radar.antiguedadTexto });
});

app.get('/clima', async (req, res) => {
  const { imageBuffer, noticiaIA } = await ejecutarParteClima();
  await enviarFotoConBotonesTelegram(imageBuffer, '📢 PARTE DIARIO DE CLIMA Y VIENTO (⏱️ Actualizado ahora):', noticiaIA.copy);
  res.json({ ok: true, titulo: noticiaIA.titulo });
});

async function responderConPlacaYCopyExtenso(res, payload, prefijoTelegram = '', enviadoDirectoPorBot = false) {
  persistirEstadoEnDisco(ultimoEstado);
  const copyCompleto = ultimoEstado.copy || payload.copy || '';
  const { captionFoto, enviarTextoCompletoAparte } = prepararCaptionTelegram(prefijoTelegram, copyCompleto);

  if (enviadoDirectoPorBot && ultimoEstado.imagen_buffer) {
    await enviarFotoConBotonesTelegram(ultimoEstado.imagen_buffer, prefijoTelegram, copyCompleto, Boolean(payload.es_edicion));
  } else if (enviarTextoCompletoAparte) {
    setTimeout(() => {
      enviarMensajeTelegram(`📝 DESCRIPCIÓN COMPLETA PARA META (${copyCompleto.length}/2200 caracteres):\n\n${copyCompleto}`);
    }, 1500);
  }

  return res.json({ ...payload, copy: captionFoto, copy_completo: copyCompleto });
}

// ============================================================================
// ENDPOINT DE COMANDOS Y GENERACIÓN (/generar y /webhook-telegram directo)
// ============================================================================

// Ruta opcional de conexión directa Telegram -> Render para gastar 0 operaciones en Make al editar
app.post('/webhook-telegram', async (req, res) => {
  try {
    const update = req.body || {};
    const msg = update.message || update.callback_query?.message || {};
    const texto = update.callback_query?.data || msg.text || msg.caption || '';
    const callbackId = update.callback_query?.id || '';
    const fileId = (msg.photo && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1].file_id : '') || msg.voice?.file_id || msg.audio?.file_id || '';

    req.body = { texto_crudo: texto, callback_query_id: callbackId, file_id: fileId, _directo_telegram: true };
    return manejarPedidoGenerar(req, res);
  } catch (e) {
    return res.status(200).send('OK');
  }
});

app.post('/generar', (req, res) => manejarPedidoGenerar(req, res));

async function manejarPedidoGenerar(req, res) {
  try {
    let {
      foto_url, file_path, file_id, texto_crudo, callback_query_id,
      categoria, titulo, destacar, bajada, fill_mode, _directo_telegram
    } = req.body;

    let copy = '';
    texto_crudo = (texto_crudo || '').trim();

    const ahoraMs = Date.now();
    if (texto_crudo && texto_crudo === ultimoComandoTexto && (ahoraMs - ultimoComandoTimestamp) < 8000) {
      return res.status(200).json({ ok: true, descartado: true, imagen_base64: '' });
    }
    ultimoComandoTexto = texto_crudo;
    ultimoComandoTimestamp = ahoraMs;

    if (callback_query_id) {
      await responderCallbackTelegram(callback_query_id, '⚡ Procesando en El Registro Sur v12.0...');
    }

    const matchComando = texto_crudo.match(/^\.([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]+)\s*([\s\S]*)$/);
    const comando = matchComando ? matchComando[1].toLowerCase() : '';
    const argumento = matchComando ? matchComando[2].trim() : texto_crudo;

    const entradaArchivo = foto_url || file_path || file_id || '';
    const archivoTelegram = await resolverArchivoTelegram(entradaArchivo);
    const esAudio = /\.(oga|ogg|mp3|m4a|wav|opus)$/i.test(archivoTelegram.path) || archivoTelegram.path.includes('voice/');

    let nuevaFotoTelegram = '';
    if (esAudio && archivoTelegram.url) {
      const transcripcion = await transcribirAudioConGroq(archivoTelegram.url);
      texto_crudo = `${argumento} ${transcripcion}`.trim();
    } else {
      nuevaFotoTelegram = archivoTelegram.url;
    }

    const replyMarkupJson = JSON.stringify(generarTecladoTactil());

    // 1. COMANDO PUBLICAR
    if (comando === 'publicar' || comando === 'comandopublicar') {
      await asegurarBorradorActivo();
      if (!ultimoEstado.imagen_buffer) {
        return res.json({ ok: false, descartado: true, error: 'Sin borrador activo para publicar.' });
      }
      verificarReinicioEstadisticasDia();
      estadisticasDia.publicadasHoy++;
      if (_directo_telegram && configSistema.makeWebhookUrl) {
        const okMake = await dispararPublicacionHaciaMake(ultimoEstado);
        await enviarMensajeTelegram(okMake ? `✅ PUBLICADO EN INSTAGRAM Y FACEBOOK:\n"${ultimoEstado.titulo}"` : '⚠️ No se pudo conectar con el Webhook de Make.');
      }
      const ts = Date.now();
      const urlsCarrusel = (ultimoEstado.carrusel_buffers || []).map((_, idx) => `${PUBLIC_BASE_URL}/carrusel/${idx + 1}.png?t=${ts}`);
      return res.json({
        ok: true, publicar: true, es_carrusel: urlsCarrusel.length > 1, urls_carrusel: urlsCarrusel,
        categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy, copy_completo: ultimoEstado.copy,
        url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${ts}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    // 2. COMANDO ENCOLAR (+2 HORAS) Y VER COLA
    if (comando === 'encolar' || comando === 'programar') {
      await asegurarBorradorActivo();
      if (!ultimoEstado.imagen_buffer || !ultimoEstado.titulo) {
        await enviarMensajeTelegram('⚠️ No hay ningún borrador activo para encolar.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      const baseMs = colaPublicacion.length > 0 ? colaPublicacion[colaPublicacion.length - 1].programadoPara : Date.now();
      const programadoPara = baseMs + (2 * 60 * 60 * 1000);
      const horaSalida = new Date(programadoPara).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos', hour: '2-digit', minute: '2-digit', hour12: false });

      colaPublicacion.push({
        categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy, imagen_buffer: ultimoEstado.imagen_buffer, programadoPara
      });
      guardarColaPublicacionEnDisco();

      await enviarMensajeTelegram(`🕒 ENCOLADO PARA LAS ${horaSalida} HS:\n"${ultimoEstado.titulo}"\n(Total en cola espaciada: ${colaPublicacion.length}).`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    if (comando === 'cola') {
      if (colaPublicacion.length === 0) {
        await enviarMensajeTelegram('📭 La cola de publicación programada está vacía.');
      } else {
        const txtCola = colaPublicacion.map((it, i) => {
          const h = new Date(it.programadoPara).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Rio_Gallegos', hour: '2-digit', minute: '2-digit', hour12: false });
          return `${i + 1}. [${h} hs] ${it.titulo}`;
        }).join('\n');
        await enviarMensajeTelegram(`🕒 COLA DE PUBLICACIÓN PROGRAMADA (${colaPublicacion.length}):\n\n${txtCola}`);
      }
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 3. COMANDO ESTADO Y CONFIGURACIÓN MAKE (.estado / .make)
    if (comando === 'estado' || comando === 'status') {
      verificarReinicioEstadisticasDia();
      const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const txtEstado = `📊 TABLERO DE CONTROL (EL REGISTRO SUR v12.0):\n\n` +
        `• Borrador activo: ${ultimoEstado.titulo || 'Ninguno'}\n` +
        `• En cola programada (+2h): ${colaPublicacion.length} noticias\n` +
        `• En cola de borradores: ${colaBorradores.length}\n` +
        `• Llamadas a Groq hoy: ${estadisticasDia.groqLlamadas}\n` +
        `• Llamadas a Serper hoy: ${estadisticasDia.serperLlamadas} (Ahorradas por caché 24h: ${estadisticasDia.serperCacheHits})\n` +
        `• Placas 2K generadas hoy: ${estadisticasDia.placasRenderizadas}\n` +
        `• Publicadas hoy: ${estadisticasDia.publicadasHoy}\n` +
        `• Memoria RAM en Render: ${memMb} MB\n` +
        `• Webhook Make directo: ${configSistema.makeWebhookUrl ? '✅ Configurado' : 'Usando flujo estándar'}`;
      await enviarMensajeTelegram(txtEstado);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    if (comando === 'make' && argumento.startsWith('http')) {
      configSistema.makeWebhookUrl = argumento.trim();
      guardarConfigSistema();
      await enviarMensajeTelegram(`✅ Webhook de Make guardado en disco:\n${configSistema.makeWebhookUrl}`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 4. COMANDO DESCARTAR (con limpieza del mensaje en el chat)
    if (comando === 'descartar') {
      const descartadoTitulo = ultimoEstado.titulo || 'Borrador';
      if (ultimoEstado.ultimo_message_id) await borrarMensajeTelegram(ultimoEstado.ultimo_message_id);
      if (colaBorradores.length > 0) {
        ultimoEstado = colaBorradores.shift();
        persistirEstadoEnDisco(ultimoEstado);
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}".\n↩️ Recuperado borrador anterior: "${ultimoEstado.titulo}".`);
      } else {
        ultimoEstado.imagen_buffer = null;
        ultimoEstado.titulo = '';
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}". La cola quedó vacía.`);
      }
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 5. COMANDO AYUDA / COMANDOS
    if (comando === 'comandos' || comando === 'ayuda') {
      const textoAyuda = `🤖 COMANDOS DE EL REGISTRO SUR (v12.0):\n\n🔎 BÚSQUEDA Y RADAR:\n.top (o .lista) → Top 5 de los 37 portales web (.1 a .5)\n.redes (o .ig / .fb) → Top 5 posteos en Instagram y Facebook (.1 a .5)\n.radar → Arma directo la noticia más importante ahora\n.mercados (o .dolar) → Pizarra en vivo de Dólar Oficial, Blue, MEP y Energía\n.ruta3 / .clima / .resumen → Coberturas especiales\n\n🎨 MODOS VISUALES:\n.carrusel → 3 placas distintas (Portada + Claves + Cierre)\n.duelo → Pantalla dividida con 2 fotos y etiquetas\n.lupa → Recuadro flotante PIP con segunda foto\n.cronologia → Línea de tiempo de 3 pasos\n.versus → Cuadro comparativo Antes vs. Ahora\n.servicios → Grilla utilitaria guardable para vecinos\n.cita / .dato → Frase textual o cifra gigante\n.auditar → Cambia la foto buscando una nueva sin repetir\n.expandir → Expande foto horizontal con fondo desenfocado\n.marca [crédito] → Estampa marca de agua en fotos de vecinos\n.historia → Formato vertical 9:16\n\n⚙️ GESTIÓN Y AHORRO:\n.encolar → Programa el boceto para salir en +2 horas\n.cola → Muestra las noticias programadas\n.estado → Muestra consumo de créditos y memoria\n.editar [cambio] → Corrige textos\n.publicar → Sube a Facebook e Instagram`;
      await enviarMensajeTelegram(textoAyuda);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 6. COMANDO REDES
    if (comando === 'redes' || comando === 'ig' || comando === 'fb') {
      const candidatasRedes = await obtenerCandidatasRedesSociales();
      ultimasTopCandidatas = candidatasRedes.slice(0, 5);
      if (ultimasTopCandidatas.length === 0) {
        await enviarMensajeTelegram('🔎 No se detectaron posteos nuevos en las páginas de Instagram/Facebook monitoreadas.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      const listadoRedes = ultimasTopCandidatas.map((c, idx) => `${idx + 1}. [${c.medio} — ⏱️ ${c.antiguedadTexto}]\n${c.titulo}`).join('\n\n');
      await enviarMensajeTelegram(`📱 TOP 5 TENDENCIAS EN INSTAGRAM Y FACEBOOK:\n\n${listadoRedes}\n\n👉 Mandá .1, .2, .3, .4 o .5 para verificar y armar la placa.`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 7. COMANDO TOP / LISTA
    if (comando === 'top' || comando === 'lista') {
      const candidatas = await obtenerTodasLasCandidatasRadar();
      let ordenadas = ordenarCandidatasRelevantes(candidatas, false);
      if (ordenadas.length < 5) ordenadas = ordenarCandidatasRelevantes(candidatas, true);
      ultimasTopCandidatas = ordenadas.slice(0, 5);
      if (ultimasTopCandidatas.length === 0) {
        await enviarMensajeTelegram('🔎 No se pudieron leer los portales en este momento.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      const listadoTexto = ultimasTopCandidatas.map((c, idx) => {
        const tagConsenso = (c.consensoMedios || 1) >= 3 ? ` 🔥(${c.consensoMedios} medios)` : '';
        return `${idx + 1}. [${c.medio}${tagConsenso} — ⏱️ ${c.antiguedadTexto}]\n${c.titulo}`;
      }).join('\n\n');
      await enviarMensajeTelegram(`🗞️ TOP 5 NOTICIAS MÁS RECIENTES (37 PORTALES):\n\n${listadoTexto}\n\n👉 Mandá .1, .2, .3, .4 o .5 para armar el boceto.`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 8. SELECCIÓN NUMÉRICA (.1 a .5)
    if (['1', '2', '3', '4', '5'].includes(comando)) {
      if (ultimasTopCandidatas.length === 0) {
        const candidatas = await obtenerTodasLasCandidatasRadar();
        ultimasTopCandidatas = ordenarCandidatasRelevantes(candidatas, true).slice(0, 5);
      }
      const elegida = ultimasTopCandidatas[parseInt(comando, 10) - 1];
      if (!elegida) {
        await enviarMensajeTelegram('⚠️ Ese número no está en la lista actual. Mandá .top o .redes primero.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      const armada = await armarNoticiaDesdeCandidata(elegida, false, false);
      if (!armada) {
        await enviarMensajeTelegram('⚠️ La noticia elegida no pasó la verificación de datos.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada, reply_markup_json: replyMarkupJson,
        url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `📋 BOCETO LISTO (⏱️ Publicado: ${armada.antiguedadTexto}) — ¿PUBLICAR O ENCOLAR?`, _directo_telegram);
    }

    // 9. COBERTURAS ESPECIALES (.marca, .mercados, .radar, .ruta3, .resumen, .clima)
    if (comando === 'marca') {
      const fotoOrigen = nuevaFotoTelegram || ultimoEstado.foto_original_url;
      if (!fotoOrigen) throw new Error('Enviá una foto junto con .marca para estampar el logo de El Registro Sur.');
      const creditoVecino = argumento || 'MATERIAL EXCLUSIVO';
      const bufMarcada = await estamparMarcaDeAguaFoto(fotoOrigen, creditoVecino);
      const captionMarca = `REGISTRO EXCLUSIVO EN EL REGISTRO SUR 📢📍\n\nMaterial enviado a nuestra redacción (${creditoVecino}).\n\nToda la cobertura de Caleta Olivia y Santa Cruz en @elregistrosur.\n\nCompartí esta información o dejá tu comentario 👇\n\n#noticias #elregistrosur #caletaolivia #santacruz #exclusivo #patagonia`;

      guardarEnColaBorradores({
        foto_url: fotoOrigen, foto_original_url: fotoOrigen, foto_secundaria_url: '', fotos_usadas: [fotoOrigen],
        foco_vertical: '18%', logo_esquina: 'ninguno', pin_geografico: 'CALETA OLIVIA', categoria: 'EXCLUSIVO / VECINOS',
        titulo: 'REGISTRO EXCLUSIVO DE VECINOS', destacar: 'REGISTRO EXCLUSIVO', bajada: creditoVecino, copy: captionMarca,
        dato_clave: '', autor_cita: '', etiqueta_duelo_1: '', etiqueta_duelo_2: '', hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: [],
        fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: 'Recién enviado', busqueda_foto_web: '', busqueda_foto_secundaria: '', prompt_imagen_ia: '',
        fill_mode: 'contain', modo_visual: 'estandar', urgente: false, ultimo_message_id: null, imagen_buffer: bufMarcada, historia_buffer: null, carrusel_buffers: []
      });

      return responderConPlacaYCopyExtenso(res, {
        ok: true, reply_markup_json: replyMarkupJson,
        url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: bufMarcada.toString('base64')
      }, '📸 MARCA DE AGUA APLICADA:', _directo_telegram);
    }

    if (comando === 'mercados' || comando === 'dolar') {
      await ejecutarPlacaMercados();
      return responderConPlacaYCopyExtenso(res, {
        ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, '💵 PIZARRA DE MERCADOS Y DÓLAR EN VIVO:', _directo_telegram);
    }

    if (comando === 'radar' || comando === 'comandoradar') {
      const radar = await generarDatosRadar(true);
      if (!radar) {
        await enviarMensajeTelegram('🔎 No se pudieron leer los portales en este momento.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `🚨 RADAR (⏱️ Publicado: ${radar.antiguedadTexto}) — ¿QUERÉS PUBLICARLO?`, _directo_telegram);
    }

    if (comando === 'ruta3' || comando === 'ruta') {
      const alertaVial = await ejecutarAlertaRuta3YServicios();
      if (!alertaVial) {
        await enviarMensajeTelegram('✅ Sin cortes ni alertas recientes reportadas en Ruta Nacional N° 3 o servicios de Caleta Olivia.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `🚧 ALERTA RUTA 3 / SERVICIOS (⏱️ Publicado: ${alertaVial.antiguedadTexto}):`, _directo_telegram);
    }

    if (comando === 'resumen') {
      const resumen = await ejecutarResumenDiarioCarrusel();
      const ts = Date.now();
      const urlsCarrusel = resumen.buffers.map((_, idx) => `${PUBLIC_BASE_URL}/carrusel/${idx + 1}.png?t=${ts}`);
      setTimeout(async () => {
        for (let i = 1; i < resumen.buffers.length; i++) {
          const f = new FormData();
          f.append('chat_id', EDITOR_CHAT_ID);
          f.append('photo', new Blob([resumen.buffers[i]], { type: 'image/png' }), `resumen_${i + 1}.png`);
          f.append('caption', `📑 Placa ${i + 1}/${resumen.buffers.length} del resumen diario`);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: f });
        }
      }, 2500);
      return responderConPlacaYCopyExtenso(res, {
        ok: true, es_carrusel: true, urls_carrusel: urlsCarrusel, categoria: 'SANTA CRUZ / RESUMEN', titulo: ultimoEstado.titulo,
        reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${ts}`,
        imagen_base64: resumen.buffers[0].toString('base64')
      }, '📰 RESUMEN DIARIO (Placa 1/5):', _directo_telegram);
    }

    if (comando === 'clima' || comando === 'comandoclima') {
      await ejecutarParteClima();
      return responderConPlacaYCopyExtenso(res, {
        ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, '📢 PARTE METEOROLÓGICO (⏱️ Actualizado ahora):', _directo_telegram);
    }

    // 10. MODOS VISUALES Y EDICIÓN SOBRE EL BORRADOR ACTIVO
    const comandosDeFormato = [
      'duelo', 'lupa', 'cita', 'dato', 'cronologia', 'versus', 'servicios',
      'carrusel', 'auditar', 'comandoauditar', 'historia', 'comandohistoria',
      'expandir', 'comandoexpandir', 'urgente', 'comandourgente', 'normal', 'comandonormal', 'ia', 'comandoia'
    ];

    if (comandosDeFormato.includes(comando)) {
      if ((comando === 'urgente' || comando === 'comandourgente') && (argumento || nuevaFotoTelegram)) {
        // Sigue abajo si envió una noticia nueva urgente
      } else {
        const hayBorrador = await asegurarBorradorActivo();
        if (!hayBorrador) {
          await enviarMensajeTelegram('⚠️ Todavía no hay ningún borrador cargado. Mandá .radar o un link primero.');
          return res.json({ ok: true, descartado: true, imagen_base64: '' });
        }

        if (comando === 'duelo' || comando === 'lupa') {
          const querySec = argumento || ultimoEstado.busqueda_foto_secundaria || ultimoEstado.destacar || ultimoEstado.titulo;
          const cands = await obtenerCandidatasFotoWeb(querySec, ultimoEstado.fotos_usadas || [ultimoEstado.foto_original_url]);
          if (cands[0]) {
            ultimoEstado.foto_secundaria_url = cands[0].dataUrl;
            ultimoEstado.fotos_usadas = [...(ultimoEstado.fotos_usadas || []), cands[0].url];
          } else if (!ultimoEstado.foto_secundaria_url) {
            ultimoEstado.foto_secundaria_url = ultimoEstado.foto_url;
          }
          ultimoEstado.modo_visual = comando;

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            etiquetaDuelo1: ultimoEstado.etiqueta_duelo_1, etiquetaDuelo2: argumento ? argumento.toUpperCase().slice(0, 18) : ultimoEstado.etiqueta_duelo_2,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, fotoSecundariaUrl: ultimoEstado.foto_secundaria_url,
            focoVertical: ultimoEstado.foco_vertical, logoEsquina: ultimoEstado.logo_esquina,
            expandirSinCloudinary: false, esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: comando
          });
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, comando === 'duelo' ? '⚡ MODO DUELO 2 FOTOS APLICADO:' : '🔍 MODO LUPA PIP APLICADO:', _directo_telegram);
        }

        if (comando === 'cronologia' || comando === 'versus' || comando === 'servicios') {
          const datosEsp = await generarDatosModoEspecialConIA(comando, ultimoEstado);
          if (datosEsp.hitos) ultimoEstado.hitos_cronologia = datosEsp.hitos;
          if (datosEsp.antes) ultimoEstado.versus_antes = datosEsp.antes;
          if (datosEsp.ahora) ultimoEstado.versus_ahora = datosEsp.ahora;
          if (datosEsp.items) ultimoEstado.items_servicios = datosEsp.items;
          ultimoEstado.modo_visual = comando;

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            hitosCronologia: ultimoEstado.hitos_cronologia, versusAntes: ultimoEstado.versus_antes, versusAhora: ultimoEstado.versus_ahora, itemsServicios: ultimoEstado.items_servicios,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: false, esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: comando
          });
          ultimoEstado.imagen_buffer = imageBuffer;

          const etiquetasModo = { cronologia: '⏳ MODO CRONOLOGÍA APLICADO:', versus: '⚖️ MODO VERSUS APLICADO:', servicios: '📋 MODO SERVICIOS APLICADO:' };
          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, etiquetasModo[comando], _directo_telegram);
        }

        if (comando === 'cita' || comando === 'dato') {
          if (comando === 'dato') ultimoEstado.dato_clave = argumento ? argumento.toUpperCase() : extraerDatoClaveAutomatico(ultimoEstado);
          else ultimoEstado.autor_cita = argumento ? argumento.toUpperCase() : extraerAutorCitaAutomatico(ultimoEstado);

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: false, esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: comando
          });
          ultimoEstado.modo_visual = comando;
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, comando === 'cita' ? '💬 MODO CITA APLICADO:' : '📊 MODO DATO APLICADO:', _directo_telegram);
        }

        if (comando === 'carrusel') {
          const slides = await generarSlidesCarruselConIA(ultimoEstado.titulo, ultimoEstado.bajada, ultimoEstado.copy);
          const modosCarrusel = ['carrusel_portada', 'carrusel_claves', 'carrusel_cierre'];
          const buffers = [];
          for (let i = 0; i < 3; i++) {
            const buf = await renderizarFlyer({
              categoria: ultimoEstado.categoria, titulo: slides[i].titulo, destacar: slides[i].destacar, bajada: slides[i].bajada,
              fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
              fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical, logoEsquina: ultimoEstado.logo_esquina,
              expandirSinCloudinary: false, esUrgente: ultimoEstado.urgente, esHistoria: false,
              modoVisual: modosCarrusel[i], numeroSlide: `0${i + 1} / 03`
            });
            buffers.push(buf);
          }

          ultimoEstado.imagen_buffer = buffers[0];
          ultimoEstado.carrusel_buffers = buffers;
          const ts = Date.now();
          const urlsCarrusel = buffers.map((_, idx) => `${PUBLIC_BASE_URL}/carrusel/${idx + 1}.png?t=${ts}`);

          setTimeout(async () => {
            for (let i = 1; i < 3; i++) {
              const formSlide = new FormData();
              formSlide.append('chat_id', EDITOR_CHAT_ID);
              formSlide.append('photo', new Blob([buffers[i]], { type: 'image/png' }), `carrusel_${i + 1}.png`);
              formSlide.append('caption', `📑 Placa ${i + 1}/3 del carrusel (${i === 1 ? 'Las Claves' : 'Impacto y Cierre'})`);
              await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: formSlide });
            }
          }, 2500);

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_carrusel: true, urls_carrusel: urlsCarrusel, categoria: ultimoEstado.categoria,
            titulo: slides[0].titulo, destacar: slides[0].destacar, bajada: slides[0].bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${ts}`,
            imagen_base64: buffers[0].toString('base64')
          }, '📑 CARRUSEL 3X LISTO (Placa 1/3 Portada):', _directo_telegram);
        }

        if (comando === 'auditar' || comando === 'comandoauditar') {
          const { urlFinal, urlOriginal, focoVertical, logoEsquina } = await auditarYResolverImagen({
            fotoCandidataUrl: '', esFotoManualDelEditor: false,
            titulo: ultimoEstado.titulo, bajada: ultimoEstado.bajada, categoria: ultimoEstado.categoria,
            busquedasSugeridas: [argumento || ultimoEstado.busqueda_foto_web || ultimoEstado.titulo, ultimoEstado.busqueda_foto_secundaria],
            promptIaSugerido: ultimoEstado.prompt_imagen_ia, forzarBusquedaNueva: true,
            urlsExcluidas: ultimoEstado.fotos_usadas || [ultimoEstado.foto_original_url]
          });

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: urlFinal, focoVertical, logoEsquina, expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: 'estandar'
          });

          ultimoEstado.foto_url = urlFinal;
          ultimoEstado.foto_original_url = urlOriginal || urlFinal;
          ultimoEstado.fotos_usadas = [...(ultimoEstado.fotos_usadas || []), urlOriginal, urlFinal].filter(Boolean);
          ultimoEstado.foco_vertical = focoVertical;
          ultimoEstado.logo_esquina = logoEsquina || 'ninguno';
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🕵️ NUEVA FOTO HD APLICADA:', _directo_telegram);
        }

        if (comando === 'historia' || comando === 'comandohistoria') {
          const historiaBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical, logoEsquina: ultimoEstado.logo_esquina,
            expandirSinCloudinary: ultimoEstado.fill_mode === 'contain', esUrgente: ultimoEstado.urgente, esHistoria: true, modoVisual: 'estandar'
          });
          ultimoEstado.historia_buffer = historiaBuffer;
          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_historia: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-historia.png?t=${Date.now()}`,
            imagen_base64: historiaBuffer.toString('base64')
          }, '📱 FORMATO HISTORIA 9:16 LISTO:', _directo_telegram);
        }

        if (comando === 'expandir' || comando === 'comandoexpandir') {
          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: true, esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: 'estandar'
          });
          ultimoEstado.fill_mode = 'contain';
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '↔️ FOTO EXPANDIDA CON FONDO DESENFOCADO:', _directo_telegram);
        }

        if (comando === 'urgente' || comando === 'comandourgente') {
          const nuevaCat = ultimoEstado.categoria.includes('URGENTE') ? ultimoEstado.categoria : `URGENTE / ${ultimoEstado.categoria.split('/')[0].trim()}`;
          const imageBuffer = await renderizarFlyer({
            categoria: nuevaCat, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            etiquetaDuelo1: ultimoEstado.etiqueta_duelo_1, etiquetaDuelo2: ultimoEstado.etiqueta_duelo_2,
            hitosCronologia: ultimoEstado.hitos_cronologia, versusAntes: ultimoEstado.versus_antes, versusAhora: ultimoEstado.versus_ahora, itemsServicios: ultimoEstado.items_servicios,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, fotoSecundariaUrl: ultimoEstado.foto_secundaria_url,
            focoVertical: ultimoEstado.foco_vertical, logoEsquina: ultimoEstado.logo_esquina,
            expandirSinCloudinary: ultimoEstado.fill_mode === 'contain', esUrgente: true, esHistoria: false, modoVisual: ultimoEstado.modo_visual
          });
          ultimoEstado.categoria = nuevaCat;
          ultimoEstado.urgente = true;
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🚨 MODO URGENTE APLICADO:', _directo_telegram);
        }

        if (comando === 'normal' || comando === 'comandonormal') {
          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria.replace(/^URGENTE\s*\/\s*/i, ''), titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'EL REGISTRO SUR', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: ultimoEstado.foto_url, focoVertical: ultimoEstado.foco_vertical, logoEsquina: ultimoEstado.logo_esquina,
            expandirSinCloudinary: false, esUrgente: false, esHistoria: false, modoVisual: 'estandar'
          });
          ultimoEstado.urgente = false;
          ultimoEstado.fill_mode = 'cover';
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🔵 MODO ESTÁNDAR APLICADO:', _directo_telegram);
        }

        if (comando === 'ia' || comando === 'comandoia') {
          const promptFinal = argumento || ultimoEstado.prompt_imagen_ia;
          const nuevaUrlIA = construirUrlPollinationsHD(promptFinal);
          const descargadaIA = await descargarYValidarImagen(nuevaUrlIA, 9000);
          const fotoFinalIA = descargadaIA ? descargadaIA.dataUrl : nuevaUrlIA;

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave, autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'ILUSTRACIÓN', pinGeografico: ultimoEstado.pin_geografico,
            fotoFinalUrl: fotoFinalIA, focoVertical: '25%', expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente, esHistoria: false, modoVisual: ultimoEstado.modo_visual
          });
          ultimoEstado.foto_url = fotoFinalIA;
          ultimoEstado.foto_original_url = nuevaUrlIA;
          ultimoEstado.fuente_credito = 'ILUSTRACIÓN';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true, es_edicion: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson, url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🎨 ILUSTRACIÓN IA APLICADA:', _directo_telegram);
        }
      }
    }

    // 11. PROCESAMIENTO DE NOTICIA NUEVA O EDICIÓN DE TEXTO (.editar)
    let textoParaProcesar = comando ? argumento : texto_crudo;
    const esEdicion = comando === 'editar' || comando === 'modificar' || comando === 'comandoeditar';
    if (esEdicion) await asegurarBorradorActivo();

    if (!textoParaProcesar && !nuevaFotoTelegram && !titulo) {
      await enviarMensajeTelegram('ℹ️ Comando no reconocido o sin texto. Mandá .comandos para ver la lista completa.');
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    const urlDetectada = textoParaProcesar.match(/https?:\/\/[^\s]+/i)?.[0];
    let fotoDeLink = '';

    const [extraidoLink, contextoObj] = await Promise.all([
      urlDetectada ? extraerNoticiaDeLink(urlDetectada, textoParaProcesar) : Promise.resolve({ fotoExtraida: '', textoExtraido: '', fechaPublicacion: '' }),
      buscarContextoEnGoogleNews(textoParaProcesar)
    ]);

    if (urlDetectada) {
      fotoDeLink = extraidoLink.fotoExtraida;
      if (extraidoLink.textoExtraido) textoParaProcesar = `${textoParaProcesar}\n\n${extraidoLink.textoExtraido}`.slice(0, 2400);
    }

    const antiguedadLink = calcularAntiguedadNoticia(extraidoLink.fechaPublicacion || contextoObj.fechaReciente);
    const fotoNuevaRecibida = nuevaFotoTelegram || fotoDeLink;
    const esUrgente = comando === 'urgente' || comando === 'comandourgente' || (esEdicion && ultimoEstado.urgente);

    let promptImagenIA = ultimoEstado.prompt_imagen_ia;
    let busquedasSugeridas = [];
    let busquedaSecundaria = ultimoEstado.busqueda_foto_secundaria;
    let datoClave = ultimoEstado.dato_clave;
    let autorCita = ultimoEstado.autor_cita;
    let etiquetaDuelo1 = ultimoEstado.etiqueta_duelo_1;
    let etiquetaDuelo2 = ultimoEstado.etiqueta_duelo_2;
    let pinGeografico = ultimoEstado.pin_geografico;

    if (textoParaProcesar.length > 0) {
      const noticiaIA = await procesarNoticiaConIA(textoParaProcesar, contextoObj.texto || 'Contexto verificado.', esEdicion);
      if (!esEdicion && noticiaIA.descartar) {
        await enviarMensajeTelegram(`ℹ️ La noticia fue descartada por el verificador (sin respaldo en fuentes confiables): ${noticiaIA.motivo_descarte || ''}`);
        return res.json({ ok: true, descartado: true, motivo: noticiaIA.motivo_descarte || 'Sin respaldo', imagen_base64: '' });
      }

      categoria = noticiaIA.categoria || ultimoEstado.categoria || 'NACIÓN / ACTUALIDAD';
      titulo = noticiaIA.titulo || ultimoEstado.titulo || '';
      destacar = noticiaIA.destacar || '';
      bajada = noticiaIA.bajada || ultimoEstado.bajada || '';
      copy = noticiaIA.copy || '';
      datoClave = noticiaIA.dato_clave || '';
      autorCita = noticiaIA.autor_cita || '';
      etiquetaDuelo1 = noticiaIA.etiqueta_duelo_1 || 'PROTAGONISTA 1';
      etiquetaDuelo2 = noticiaIA.etiqueta_duelo_2 || 'PROTAGONISTA 2';
      pinGeografico = noticiaIA.pin_geografico || '';
      promptImagenIA = noticiaIA.prompt_imagen_ia || 'journalism news photography Argentina';
      busquedaSecundaria = noticiaIA.busqueda_foto_secundaria || noticiaIA.busqueda_foto_institucional || '';
      busquedasSugeridas = [noticiaIA.busqueda_foto_web, noticiaIA.busqueda_foto_secundaria, noticiaIA.busqueda_foto_institucional];
    }

    if (!titulo) {
      await enviarMensajeTelegram('⚠️ No se pudo extraer un titular válido del mensaje enviado.');
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    let fotoFinalParaPlaca = esEdicion ? ultimoEstado.foto_url : '';
    let fotoOriginalGuardar = esEdicion ? ultimoEstado.foto_original_url : '';
    let focoVertical = esEdicion ? (ultimoEstado.foco_vertical || '18%') : '18%';
    let logoEsquina = esEdicion ? (ultimoEstado.logo_esquina || 'ninguno') : 'ninguno';

    if (fotoNuevaRecibida || !esEdicion || !fotoFinalParaPlaca) {
      const resAud = await auditarYResolverImagen({
        fotoCandidataUrl: fotoNuevaRecibida || fotoOriginalGuardar,
        esFotoManualDelEditor: Boolean(nuevaFotoTelegram),
        titulo, bajada, categoria, busquedasSugeridas, promptIaSugerido: promptImagenIA
      });
      fotoFinalParaPlaca = resAud.urlFinal;
      fotoOriginalGuardar = resAud.urlOriginal || resAud.urlFinal;
      focoVertical = resAud.focoVertical || '18%';
      logoEsquina = resAud.logoEsquina || 'ninguno';
    }

    const usarModoExpandido = fill_mode === 'contain' || (esEdicion && ultimoEstado.fill_mode === 'contain');
    const imageBuffer = await renderizarFlyer({
      categoria, titulo, destacar, bajada, datoClave, autorCita, etiquetaDuelo1, etiquetaDuelo2,
      fuenteCredito: 'EL REGISTRO SUR', pinGeografico, fotoFinalUrl: fotoFinalParaPlaca,
      focoVertical, logoEsquina, expandirSinCloudinary: usarModoExpandido,
      esUrgente, esHistoria: false, modoVisual: 'estandar'
    });

    const textoAntiguedadFinal = esEdicion ? (ultimoEstado.antiguedad_texto || 'Borrador editado') : antiguedadLink.texto;
    const nuevoEstado = {
      foto_url: fotoFinalParaPlaca, foto_original_url: fotoOriginalGuardar, foto_secundaria_url: '',
      fotos_usadas: [fotoOriginalGuardar, fotoFinalParaPlaca].filter(Boolean),
      foco_vertical: focoVertical, logo_esquina: logoEsquina, pin_geografico: pinGeografico,
      categoria, titulo, destacar, bajada, copy, dato_clave: datoClave, autor_cita: autorCita,
      etiqueta_duelo_1: etiquetaDuelo1, etiqueta_duelo_2: etiquetaDuelo2,
      hitos_cronologia: [], versus_antes: null, versus_ahora: null, items_servicios: [],
      fuente_credito: 'EL REGISTRO SUR', antiguedad_texto: textoAntiguedadFinal,
      busqueda_foto_web: busquedasSugeridas[0] || titulo, busqueda_foto_secundaria: busquedaSecundaria,
      prompt_imagen_ia: promptImagenIA, fill_mode: usarModoExpandido ? 'contain' : 'cover',
      modo_visual: 'estandar', urgente: esUrgente, ultimo_message_id: ultimoEstado.ultimo_message_id,
      imagen_buffer: imageBuffer, historia_buffer: null, carrusel_buffers: []
    };

    if (esEdicion) {
      ultimoEstado = nuevoEstado;
      persistirEstadoEnDisco(ultimoEstado);
    } else {
      registrarTemaEnviado(titulo);
      guardarEnColaBorradores(nuevoEstado);
    }

    const prefijoBoceto = urlDetectada || !esEdicion ? `📋 BOCETO LISTO (⏱️ Publicado: ${textoAntiguedadFinal})` : '✏️ BOCETO EDITADO';
    return responderConPlacaYCopyExtenso(res, {
      ok: true, es_edicion: esEdicion, categoria, titulo, destacar, bajada,
      reply_markup_json: replyMarkupJson,
      url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${Date.now()}`,
      imagen_base64: imageBuffer.toString('base64')
    }, prefijoBoceto, _directo_telegram);
  } catch (err) {
    console.error('Error en /generar:', err.message);
    await enviarMensajeTelegram(`⚠️ Aviso del servidor al procesar el pedido: ${err.message}`);
    return res.status(200).json({ ok: false, descartado: true, error: err.message, imagen_base64: '' });
  }
}

app.get('/ultima-imagen.png', (req, res) => {
  if (!ultimoEstado.imagen_buffer) return res.status(404).send('Sin imagen en memoria.');
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  res.send(ultimoEstado.imagen_buffer);
});

app.get('/ultima-historia.png', (req, res) => {
  if (!ultimoEstado.historia_buffer) return res.status(404).send('Sin historia en memoria.');
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  res.send(ultimoEstado.historia_buffer);
});

app.get('/carrusel/:indice.png', (req, res) => {
  const idx = parseInt(req.params.indice, 10) - 1;
  const buf = (ultimoEstado.carrusel_buffers && ultimoEstado.carrusel_buffers[idx]) || (idx === 0 ? ultimoEstado.imagen_buffer : null);
  if (!buf) return res.status(404).send('Sin lámina de carrusel en memoria.');
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  res.send(buf);
});

app.get('/ultimo-borrador', (req, res) => {
  if (!ultimoEstado.imagen_buffer) return res.status(404).json({ error: 'Sin borrador en memoria.' });
  const ts = Date.now();
  res.json({
    ok: true, categoria: ultimoEstado.categoria, titulo: ultimoEstado.titulo, bajada: ultimoEstado.bajada, copy: ultimoEstado.copy,
    urls_carrusel: (ultimoEstado.carrusel_buffers || []).map((_, idx) => `${PUBLIC_BASE_URL}/carrusel/${idx + 1}.png?t=${ts}`),
    url_imagen_publica: `${PUBLIC_BASE_URL}/ultima-imagen.png?t=${ts}`,
    imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`El Registro Sur v12.0 listo en puerto ${PORT}`));
