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
const RUTA_CACHE_ESTADO = '/tmp/ultimo_estado_ers.json';

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
  { url: 'https://patagonianexo.com.ar/feed/', medio: 'PATAGONIA NEXO', categoria: 'regional' },
  { url: 'https://elciudadanodelasheras.com/feed/', medio: 'EL CIUDADANO LAS HERAS', categoria: 'regional' },
  { url: 'https://noticias.santacruz.gob.ar/feed/', medio: 'PRENSA SANTA CRUZ', categoria: 'regional' },
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('(site:elcaletense.net OR site:eldiarionuevodia.com.ar OR site:tiemposur.com.ar OR "Caleta Olivia" OR "Claudio Vidal") when:24h') + '&hl=es-419&gl=AR&ceid=AR:es-419', medio: 'EL CALETENSE / SC', categoria: 'regional' },
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
  { url: 'https://www.paparazzi.com.ar/feed/', medio: 'PAPARAZZI', categoria: 'espectaculos' },
  { url: 'https://exitoina.perfil.com/feed', medio: 'EXITOÍNA', categoria: 'espectaculos' },
  { url: 'https://www.pronto.com.ar/rss/feed.xml', medio: 'PRONTO', categoria: 'espectaculos' }
];

const DOMINIOS_PROHIBIDOS_IMG = /bing\.com\/th|halo|xbox|playstation|nintendo|steam|epicgames|ign\.com|3djuegos|vandal|hobbyconsolas|meristation|kotaku|fandom|wikia|gamer|gaming|videojuego|minecraft|fortnite|gta|warthog|masterchief|meme|9gag|reddit|imgur|pinterest|deviantart|artstation|wallpaper|alphacoders|freepik|shutterstock|istock|vecteezy|flaticon|pngtree|tiktok|unsplash/i;

let ultimoEstado = {
  foto_url: '',
  foto_original_url: '',
  foto_secundaria_url: '',
  fotos_usadas: [],
  foco_vertical: '20%',
  categoria: '',
  titulo: '',
  destacar: '',
  bajada: '',
  copy: '',
  dato_clave: '',
  autor_cita: '',
  fuente_credito: 'ARCHIVO',
  antiguedad_texto: '',
  busqueda_foto_web: '',
  busqueda_foto_secundaria: '',
  prompt_imagen_ia: 'journalism news photography Argentina',
  fill_mode: 'cover',
  modo_visual: 'estandar',
  urgente: false,
  imagen_buffer: null,
  historia_buffer: null,
  carrusel_buffers: []
};

const colaBorradores = [];
let ultimasTopCandidatas = [];

function persistirEstadoEnDisco(estado) {
  try {
    if (!estado || !estado.titulo) return;
    const copiaLiviana = {
      ...estado,
      imagen_base64_cache: estado.imagen_buffer ? estado.imagen_buffer.toString('base64') : '',
      imagen_buffer: null,
      historia_buffer: null,
      carrusel_buffers: []
    };
    fs.writeFileSync(RUTA_CACHE_ESTADO, JSON.stringify(copiaLiviana), 'utf-8');
  } catch (e) {}
}

function cargarEstadoDesdeDisco() {
  try {
    if (fs.existsSync(RUTA_CACHE_ESTADO)) {
      const raw = JSON.parse(fs.readFileSync(RUTA_CACHE_ESTADO, 'utf-8'));
      if (raw && raw.titulo) {
        ultimoEstado = {
          ...ultimoEstado,
          ...raw,
          fotos_usadas: Array.isArray(raw.fotos_usadas) ? raw.fotos_usadas : [],
          imagen_buffer: raw.imagen_base64_cache ? Buffer.from(raw.imagen_base64_cache, 'base64') : null,
          historia_buffer: null,
          carrusel_buffers: []
        };
      }
    }
  } catch (e) {}
}
cargarEstadoDesdeDisco();

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

const noticiasEnviadasRadar = new Set();
const temasEnviadosPalabras = [];
let ultimoClimaDiaEnviado = '';
let ultimoResumenDiaEnviado = '';
let ultimoComandoTexto = '';
let ultimoComandoTimestamp = 0;
let indiceClaveGroq = 0;
let indiceClaveSerper = 0;

app.get('/ping', (req, res) => res.status(200).send('OK - El Registro Sur 2K + Carrusel Editorial Agencia activo'));

const EMOJIS_SEGUROS_META = new Set([
  '🚨', '🔴', '🟠', '🟡', '🚧', '🚔', '🚒', '🚑', '🛑',
  '💨', '🌀', '🌊', '💧', '☔', '⛄', '⛅', '⚡', '🔥', '🌈',
  '💰', '💵', '📈', '📉', '📊', '⛽', '🏭', '🚜', '🚛', '🚢', '🐟',
  '📢', '📣', '📰', '📋', '📄', '📜', '🏥', '🏫', '🎓', '👷', '🤝', '📍', '📅', '🕒',
  '⚽', '🏆', '🏅', '🎭', '🎶',
  '👇', '👉', '📲', '💬', '✅', '❌'
]);

const MAPA_REEMPLAZO_EMOJIS = {
  '🌧': '☔', '🌨': '⛄', '❄': '⛄', '🌩': '⚡', '🌪': '💨', '🌬': '💨',
  '☀': '⛅', '🌤': '⛅', '🌡': '🔥', '⚠': '🚨', '🏛': '📢', '⚖': '📜',
  '🗣': '📢', '🚓': '🚔', '🛢': '⛽', '💸': '💵', '🏦': '💰', '🗳': '📋'
};

const CONECTORES_COLGADOS = new Set([
  'DE', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS',
  'A', 'AL', 'DEL', 'EN', 'CON', 'POR', 'PARA', 'SIN', 'TRAS',
  'ANTE', 'BAJO', 'SOBRE', 'ENTRE', 'HACIA', 'HASTA', 'DESDE',
  'Y', 'E', 'O', 'U', 'NI', 'QUE', 'SE', 'SU', 'SUS', 'LO', 'LE', 'LES', 'MAS', 'MÁS', 'MUY'
]);

const PREFIJOS_COMPUESTOS = new Set([
  'RÍO', 'RIO', 'CALETA', 'PICO', 'PUERTO', 'SAN', 'SANTA', 'SANTO',
  'GENERAL', 'COMODORO', 'VILLA', 'CAÑADÓN', 'CANADON', 'GOBERNADOR',
  'INTENDENTE', 'CONCEJAL', 'DIPUTADO', 'DIPUTADA', 'SENADOR', 'SENADORA',
  'MINISTRO', 'MINISTRA', 'SECRETARIO', 'SECRETARIA', 'SUBSECRETARIO',
  'JUEZ', 'JUEZA', 'FISCAL', 'CANDIDATO', 'CANDIDATA', 'POSTULADO', 'POSTULADA',
  'DELEGADO', 'DELEGADA', 'PRESIDENTE', 'TITULAR', 'VOCERO', 'DIRIGENTE',
  'EMPRESARIO', 'EMPRESARIA', 'REFERENTE', 'GREMIALISTA', 'COMISARIO',
  'PERITO', 'PIEDRA', 'PUNTA', 'BAHÍA', 'BAHIA', 'TIERRA', 'ZONA',
  'GOLFO', 'CABO', 'LAGO', 'LAGUNA', 'CERRO', 'MONTE', 'SIERRA',
  'CASA', 'CORTE', 'BANCO', 'RIESGO', 'DÓLAR', 'DOLAR', 'RUTA',
  'SERVICIO', 'SERVICIOS', 'VIALIDAD', 'POLICÍA', 'POLICIA', 'ARMADA',
  'GRAN', 'JAVIER', 'CLAUDIO', 'CRISTINA', 'AXEL', 'PABLO', 'FERNANDO',
  'LUIS', 'JUAN', 'MARÍA', 'MARIA', 'LA', 'EL', 'LOS', 'LAS', '28', 'VEINTIOCHO', 'PASO', 'REFORMA', 'PAPA', 'LEÓN', 'LEON'
]);

const SUFIJOS_COMPUESTOS = new Set([
  'GALLEGOS', 'OLIVIA', 'TRUNCADO', 'DESEADO', 'JULIÁN', 'JULIAN',
  'CALAFATE', 'CHALTÉN', 'CHALTEN', 'TURBIO', 'ANTIGUOS', 'MORENO',
  'BUENA', 'RIVADAVIA', 'CRUZ', 'FUEGO', 'AIRES', 'BLANCA', 'ARENAS',
  'SECO', 'GREGORES', 'JORGE', 'PAULA', 'SANTOS', 'ROSADA', 'SUPREMA',
  'CENTRAL', 'PAÍS', 'PAIS', 'BLUE', 'OFICIAL', 'MILEI', 'VIDAL',
  'KIRCHNER', 'KICILLOF', 'GRASSO', 'CARRIZO', 'COTILLO', 'ELECTORAL', 'JUDICIAL', 'LABORAL', 'XIV', 'PREVOST'
]);

function limpiarPalabraSignos(p) {
  return String(p || '').replace(/^[^A-ZÁÉÍÓÚÜÑ0-9]+|[^A-ZÁÉÍÓÚÜÑ0-9]+$/gi, '').toUpperCase();
}

function depurarEstiloPeriodistico(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/\belogó\b/g, 'elogió')
    .replace(/\bElogó\b/g, 'Elogió')
    .replace(/\bELOGÓ\b/g, 'ELOGIÓ')
    .replace(/\bfortes\b/gi, (m) => (m === m.toUpperCase() ? 'FUERTES' : 'fuertes'))
    .replace(/\bprimer provincia\b/gi, 'primera provincia')
    .replace(/\bprimer medida\b/gi, 'primera medida')
    .replace(/\bexpresaron su alegr[íi]a por\b/gi, 'confirmaron')
    .replace(/\bexpres[óo] su alegr[íi]a por\b/gi, 'confirmó')
    .replace(/\bcelebraron el inicio de\b/gi, 'confirmaron el inicio de')
    .replace(/\bcelebr[óo] el inicio de\b/gi, 'confirmó el inicio de')
    .replace(/\bcelebraron la\b/gi, 'destacaron la')
    .replace(/\ben el marco de una\b/gi, 'durante una')
    .replace(/\ben el día de la fecha\b/gi, 'hoy');
}

function extraerDatoClaveAutomatico(estado) {
  if (estado.dato_clave && estado.dato_clave.trim().length > 1 && !/DATO CLAVE/i.test(estado.dato_clave)) {
    return estado.dato_clave.trim().toUpperCase();
  }
  const fuente = `${estado.titulo || ''} ${estado.bajada || ''}`;
  const matchMonto = fuente.match(/(?:USD|U\$S|\$)\s*\d+(?:[.,]\d+)?(?:\s*(?:MILLONES|MIL|BILLONES|M))?|\b\d+(?:[.,]\d+)?\s*(?:%|POR CIENTO|FAMILIAS|VOTOS|KM\/H|MILLONES|HORAS|DÍAS|LOCALIDADES|BARRIOS|EMPLEOS|POZOS|MW)\b/i);
  if (matchMonto) return matchMonto[0].toUpperCase();
  if (estado.destacar && estado.destacar.length <= 18) return estado.destacar.toUpperCase();
  return 'CIFRA CLAVE';
}

function extraerAutorCitaAutomatico(estado) {
  if (estado.autor_cita && estado.autor_cita.trim().length > 2 && !/DECLARACI[ÓO]N/i.test(estado.autor_cita)) {
    return estado.autor_cita.trim().toUpperCase();
  }
  const fuente = `${estado.bajada || ''} ${estado.copy || ''}`;
  const matchRol = fuente.match(/\b(?:el gobernador|el intendente|el presidente|el ministro|el concejal|la concejal|el diputado|la diputada|el senador|la senadora|el empresario|la delegada|el delegado|el titular|el vocero|el candidato)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?/i);
  if (matchRol) return matchRol[0].toUpperCase();
  return estado.categoria || 'DEFINICIÓN EDITORIAL';
}

function calcularAntiguedadNoticia(fechaRaw) {
  if (!fechaRaw) return { texto: 'Recién detectado', minutos: 120 };
  const fecha = new Date(fechaRaw);
  if (isNaN(fecha.getTime())) return { texto: 'Recién detectado', minutos: 120 };

  const diffMs = Math.max(0, Date.now() - fecha.getTime());
  const diffMin = Math.floor(diffMs / 60000);

  let horaAR = '';
  try {
    horaAR = fecha.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Rio_Gallegos',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' hs';
  } catch (e) {}

  const sufijoHora = horaAR ? ` (${horaAR})` : '';
  if (diffMin < 2) return { texto: `hace instantes${sufijoHora}`, minutos: diffMin };
  if (diffMin < 60) return { texto: `hace ${diffMin} min${sufijoHora}`, minutos: diffMin };
  if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { texto: m > 0 ? `hace ${h} h ${m} min${sufijoHora}` : `hace ${h} h${sufijoHora}`, minutos: diffMin };
  }
  const dias = Math.floor(diffMin / 1440);
  return { texto: `hace ${dias} d${sufijoHora}`, minutos: diffMin };
}

function esTemaRepetido(titulo) {
  const palabras = String(titulo || '')
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/g, '')
    .split(/\s+/)
    .filter(p => p.length > 4);

  if (palabras.length < 3) return false;
  for (const prev of temasEnviadosPalabras) {
    const coincidencias = palabras.filter(p => prev.has(p)).length;
    if (coincidencias >= 3 || coincidencias / palabras.length >= 0.6) return true;
  }
  return false;
}

function registrarTemaEnviado(titulo) {
  noticiasEnviadasRadar.add(titulo);
  const palabras = new Set(
    String(titulo || '')
      .toLowerCase()
      .replace(/[^a-záéíóúñ0-9\s]/g, '')
      .split(/\s+/)
      .filter(p => p.length > 4)
  );
  if (palabras.size > 0) {
    temasEnviadosPalabras.unshift(palabras);
    if (temasEnviadosPalabras.length > 40) temasEnviadosPalabras.pop();
  }
}

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
  if (/dólar|inflación|econom|sueldo|salario|paritaria|banco|impuesto|jubilad|anses/.test(t)) return ['💰', '📊'];
  if (/petróleo|ypf|pozo|minería|producción|puerto|pesca|buque/.test(t)) return ['🏭', '⛽'];
  if (/fútbol|boca|river|selección|messi|deporte|colapinto/.test(t)) return ['⚽', '🏆'];
  return ['📢', '📍'];
}

function filtrarEmojisSegurosRedes(texto) {
  if (!texto) return '';
  let limpio = depurarEstiloPeriodistico(String(texto))
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\*\*/g, '');

  for (const [inseguro, seguro] of Object.entries(MAPA_REEMPLAZO_EMOJIS)) {
    limpio = limpio.split(inseguro).join(seguro);
  }

  limpio = limpio.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, (m) => EMOJIS_SEGUROS_META.has(m) ? m : '');
  limpio = limpio
    .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:|\bTitular\s*:|\bCierre\s*:)\s*/gim, '')
    .replace(/\n---\n/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const bloques = limpio.split('\n\n');
  if (bloques.length > 0) {
    const sugeridos = elegirEmojisPorTema(limpio);
    const emojisEnPrimera = [...bloques[0]].filter(ch => EMOJIS_SEGUROS_META.has(ch));
    if (emojisEnPrimera.length === 0) {
      bloques[0] = `${bloques[0]} ${sugeridos[0]}${sugeridos[1]}`;
    } else if (emojisEnPrimera.length === 1) {
      const extra = emojisEnPrimera[0] === sugeridos[0] ? sugeridos[1] : sugeridos[0];
      bloques[0] = `${bloques[0]}${extra}`;
    }
    limpio = bloques.join('\n\n');
  }

  if (limpio.length > 2180) {
    const partes = limpio.split('\n\n');
    const ultima = partes[partes.length - 1] || '';
    if (ultima.trim().startsWith('#') && partes.length > 2) {
      const maxCuerpo = 2170 - ultima.length;
      let cuerpo = partes.slice(0, -1).join('\n\n');
      if (cuerpo.length > maxCuerpo) cuerpo = cuerpo.slice(0, maxCuerpo).replace(/\s+\S*$/, '') + '.';
      limpio = `${cuerpo}\n\n${ultima}`;
    } else {
      limpio = limpio.slice(0, 2175).replace(/\s+\S*$/, '') + '.';
    }
  }
  return limpio;
}

function prepararCaptionTelegram(prefijo, copyCompleto) {
  const textoTotal = prefijo ? `${prefijo}\n\n${copyCompleto}` : copyCompleto;
  if (textoTotal.length <= 1010) return { captionFoto: textoTotal, enviarTextoCompletoAparte: false };
  const recorte = textoTotal.slice(0, 950).replace(/\s+\S*$/, '');
  return {
    captionFoto: `${recorte}...\n\n⬇️ (Nota completa abajo para leer / publicar en Meta)`,
    enviarTextoCompletoAparte: true
  };
}

function asegurarDestacadoEnTitulo(titulo, destacar) {
  const tit = limpiarEmojis(titulo).toUpperCase();
  let des = limpiarEmojis(destacar).toUpperCase();
  if (!tit) return { titulo: '', destacar: '' };

  const palabrasTit = tit.split(/\s+/).filter(Boolean);
  if (palabrasTit.length <= 2) return { titulo: tit, destacar: tit };

  const palabrasDes = des.split(/\s+/).filter(Boolean);
  let idxInicio = -1;

  if (palabrasDes.length > 0) {
    for (let i = 0; i <= palabrasTit.length - palabrasDes.length; i++) {
      let ok = true;
      for (let j = 0; j < palabrasDes.length; j++) {
        if (limpiarPalabraSignos(palabrasTit[i + j]) !== limpiarPalabraSignos(palabrasDes[j])) {
          ok = false;
          break;
        }
      }
      if (ok) { idxInicio = i; break; }
    }
  }

  let idxFin = idxInicio !== -1 ? idxInicio + palabrasDes.length - 1 : -1;
  if (idxInicio === -1) {
    idxInicio = 0;
    idxFin = Math.min(2, palabrasTit.length - 1);
  }

  if (idxInicio > 0 && SUFIJOS_COMPUESTOS.has(limpiarPalabraSignos(palabrasTit[idxInicio])) && PREFIJOS_COMPUESTOS.has(limpiarPalabraSignos(palabrasTit[idxInicio - 1]))) {
    idxInicio--;
  }

  while (idxInicio < idxFin && ['DE', 'DEL', 'Y', 'E', 'O', 'U', 'A', 'AL', 'CON', 'POR', 'EN', 'PARA', 'QUE'].includes(limpiarPalabraSignos(palabrasTit[idxInicio]))) {
    idxInicio++;
  }

  let huboCambio = true;
  while (huboCambio && idxFin < palabrasTit.length - 1) {
    huboCambio = false;
    const palabraActual = limpiarPalabraSignos(palabrasTit[idxFin]);
    const palabraSiguiente = limpiarPalabraSignos(palabrasTit[idxFin + 1]);

    if (
      CONECTORES_COLGADOS.has(palabraActual) ||
      PREFIJOS_COMPUESTOS.has(palabraActual) ||
      SUFIJOS_COMPUESTOS.has(palabraSiguiente) ||
      /^[0-9]+$/.test(palabraSiguiente) ||
      (palabraActual === 'RUTA' && palabraSiguiente === 'NACIONAL')
    ) {
      idxFin++;
      huboCambio = true;
    }
  }

  if (idxFin - idxInicio + 1 >= 5) {
    for (let k = idxInicio + 1; k < idxFin; k++) {
      if (['EN', 'DE', 'DEL', 'A', 'AL', 'PARA', 'POR', 'CONTRA', 'SOBRE', 'QUE'].includes(limpiarPalabraSignos(palabrasTit[k]))) {
        const candidatoFinal = idxFin - k;
        if (candidatoFinal >= 2) {
          idxInicio = k + 1;
          break;
        }
      }
    }
  }

  while (idxFin > idxInicio && CONECTORES_COLGADOS.has(limpiarPalabraSignos(palabrasTit[idxFin]))) {
    idxFin--;
  }

  return { titulo: tit, destacar: palabrasTit.slice(idxInicio, idxFin + 1).join(' ') };
}

function limpiarBajadaPeriodistica(bajada) {
  let baj = limpiarEmojis(bajada);
  if (!baj) return '';
  baj = baj.charAt(0).toUpperCase() + baj.slice(1);
  if (!/[.!?]$/.test(baj)) baj += '.';
  return baj;
}

function normalizarCategoriaPeriodistica(categoria, textoOriginal = '') {
  let cat = limpiarEmojis(categoria).toUpperCase();
  const mencionaLocalEnFuente = /caleta olivia|santa cruz|claudio vidal|ruta 3|ram[óo]n santos|pico truncado|las heras|r[íi]o gallegos|gorosito|chimen aike|distrigas|spse/i.test(textoOriginal);
  if (!mencionaLocalEnFuente && cat.startsWith('CALETA OLIVIA')) {
    cat = cat.replace(/^CALETA OLIVIA\s*\/\s*/i, 'NACIÓN / ');
  }
  cat = cat.replace(/\/\s*(REGIONAL|NACIONAL|LOCAL|PROVINCIAL)$/i, '/ ACTUALIDAD');
  if (!cat.includes('/')) {
    cat = mencionaLocalEnFuente ? `SANTA CRUZ / ${cat || 'ACTUALIDAD'}` : `NACIÓN / ${cat || 'ACTUALIDAD'}`;
  }
  return cat;
}

function obtenerListaClavesGroq() {
  const raw = process.env.GROQ_API_KEY || '';
  const desdeEnv = raw.split(',').map(k => k.trim()).filter(Boolean);
  const todas = [...new Set([...desdeEnv, CLAVE_GROQ_RESPALDO].filter(Boolean))];
  if (todas.length === 0) throw new Error('Falta configurar GROQ_API_KEY.');
  return todas;
}

function obtenerListaClavesSerper() {
  const raw = process.env.SERPER_API_KEY || '';
  const desdeEnv = raw.split(',').map(k => k.trim()).filter(Boolean);
  return [...new Set([...desdeEnv, ...CLAVES_SERPER_RESPALDO].filter(Boolean))];
}

async function llamarSerperApi(endpoint, payload) {
  const claves = obtenerListaClavesSerper();
  for (let i = 0; i < claves.length; i++) {
    const key = claves[(indiceClaveSerper + i) % claves.length];
    try {
      const resp = await fetch(`https://google.serper.dev/${endpoint}`, {
        method: 'POST',
        signal: AbortSignal.timeout(4500),
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
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

  try {
    return JSON.parse(candidato);
  } catch (e1) {
    try {
      const reparado = candidato
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ');
      return JSON.parse(reparado);
    } catch (e2) {
      const extraerCampo = (clave) => {
        const reg = new RegExp(`"${clave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
        const m = candidato.match(reg);
        if (!m) return '';
        return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
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
          fuente_credito: extraerCampo('fuente_credito') || 'PRENSA',
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
  const claves = obtenerListaClavesGroq();
  const totalIntentos = Math.max(claves.length * 2, 4);
  let ultimoError = '';

  for (let intento = 0; intento < totalIntentos; intento++) {
    const apiKey = claves[(indiceClaveGroq++) % claves.length];
    const usarJsonMode = intento < totalIntentos - 1;

    try {
      const bodyPayload = {
        model: 'openai/gpt-oss-120b',
        temperature: 0.2,
        max_tokens: 4096,
        messages
      };
      if (usarJsonMode) bodyPayload.response_format = { type: 'json_object' };

      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(18000),
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

      const data = await resp.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      return parsearJsonSeguro(rawContent);
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
      if (chunk === 'VP8 ' && buffer.length >= 30) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L' && buffer.length >= 25) {
        const b = buffer.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8X' && buffer.length >= 30) {
        return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      }
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
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const fechaHoy = ahora.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Rio_Gallegos',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const promptVision = `Sos el Director de Fotografía de 'El Registro Sur'. Hoy es ${fechaHoy} (Año ${anioActual}).
Mirá esta imagen y evaluá si sirve para ilustrar esta noticia RECIENTE:
SECCIÓN: "${categoria}"
TITULAR: "${titulo}"
BAJADA: "${bajada}"
DESCRIPCIÓN DE ORIGEN DE LA FOTO: "${tituloDescriptivoFoto}"

REGLAS DE RECHAZO ESTRICTO ("aprobada": false):
1. ACTUALIDAD Y VIGENCIA (${anioActual}): Rechazar inmediatamente si la foto muestra a exfuncionarios, expresidentes, figuras ya fallecidas (como el Papa Francisco cuando la noticia habla del Papa actual en ${anioActual}), exentrenadores o eventos de años pasados cuando la noticia habla de un hecho actual en presente.
2. RECHAZAR si tiene bordes blancos/negros gigantes alrededor, si está pixelada o si tiene marcas de agua grandes de otros medios.
3. RECHAZAR si muestra a una persona o tema ajeno a la noticia o un paisaje vacío de montañas en una nota política/económica.
4. RECHAZAR si es un videojuego, meme, caricatura o tiene caras deformadas por IA.
5. Si es APROBADA ("aprobada": true), indicá en "foco_vertical" dónde están las caras ("15%" si están arriba, "25%" en el tercio superior, "50%" en el centro).

Devolvé SOLO este JSON:
{
  "aprobada": true,
  "motivo": "Explicación breve",
  "foco_vertical": "20%",
  "busqueda_corregida": "Nombre propio actual exacto del protagonista + lugar + ${anioActual}"
}`;

  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey && dataUrl.startsWith('data:image/')) {
    try {
      const matchMime = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
      if (matchMime) {
        const respGem = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          signal: AbortSignal.timeout(9000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptVision },
                { inline_data: { mime_type: matchMime[1], data: matchMime[2] } }
              ]
            }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
          })
        });
        if (respGem.ok) {
          const dataGem = await respGem.json();
          const rawText = dataGem?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          return parsearJsonSeguro(rawText);
        }
      }
    } catch (e) {}
  }

  const claves = obtenerListaClavesGroq();
  const apiKey = claves[(indiceClaveGroq++) % claves.length];

  try {
    if (dataUrl.length < 460000) {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(8500),
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.1,
          max_tokens: 450,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: promptVision },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }]
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const raw = data?.choices?.[0]?.message?.content || '{}';
        return parsearJsonSeguro(raw);
      }
    }

    if (tituloDescriptivoFoto && !tituloDescriptivoFoto.startsWith('http')) {
      return await llamarGroqChat([{
        role: 'user',
        content: `Sos el Auditor Fotográfico de un diario en el año ${anioActual}. Evaluá si una foto titulada "${tituloDescriptivoFoto}" es actual y coherente para la noticia "${categoria}: ${titulo} - ${bajada}". Rechazá si muestra figuras fallecidas, exfuncionarios de años pasados, otro evento ajeno o paisaje sin relación. Devolvé JSON: {"aprobada": true o false, "foco_vertical": "20%", "busqueda_corregida": "consulta mejorada con nombre propio actual ${anioActual}"}`
      }]);
    }
    return { aprobada: true, foco_vertical: '20%' };
  } catch (e) {
    return { aprobada: true, foco_vertical: '20%' };
  }
}

function construirUrlPollinationsHD(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  const promptSeguroSinCaras = `${prompt}, wide angle architectural or urban photojournalism exterior, NO HUMANS, NO PEOPLE, NO FACES, NO TEXT, photorealistic DSLR`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(promptSeguroSinCaras)}?width=1080&height=1080&nologo=true&seed=${seed}`;
}

function generarTecladoTactil() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Publicar IG/FB', callback_data: '.publicar' },
        { text: '❌ Descartar', callback_data: '.descartar' }
      ],
      [
        { text: '⚡ Duelo 2 Fotos', callback_data: '.duelo' },
        { text: '🔍 Lupa PIP', callback_data: '.lupa' },
        { text: '↔️ Expandir', callback_data: '.expandir' }
      ],
      [
        { text: '📱 Historia 9:16', callback_data: '.historia' },
        { text: '📑 Carrusel 3x', callback_data: '.carrusel' },
        { text: '🕵️ Cambiar Foto', callback_data: '.auditar' }
      ],
      [
        { text: '🚨 Urgente', callback_data: '.urgente' },
        { text: '🔵 Normal', callback_data: '.normal' },
        { text: '💬 Cita', callback_data: '.cita' },
        { text: '📊 Dato', callback_data: '.dato' }
      ]
    ]
  };
}

async function responderCallbackTelegram(callbackQueryId, textoAviso = 'Procesando...') {
  if (!callbackQueryId || !callbackQueryId.trim()) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId.trim(), text: textoAviso })
    });
  } catch (e) {}
}

async function enviarMensajeTelegram(texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: EDITOR_CHAT_ID, text: String(texto || '').slice(0, 4050) })
    });
  } catch (e) {}
}

async function resolverArchivoTelegram(valorRecibido) {
  if (!valorRecibido || !valorRecibido.trim()) return { url: '', path: '' };
  const limpio = valorRecibido.trim();
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) return { url: limpio, path: limpio };
  if (limpio.includes('/')) {
    return { url: `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${limpio}`, path: limpio };
  }
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${limpio}`);
  const data = await resp.json();
  if (data.ok && data.result && data.result.file_path) {
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
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form
  });

  if (!resp.ok) throw new Error(`Error transcribiendo audio (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return (data.text || '').slice(0, 1800);
}

async function obtenerCandidatasRedesSociales() {
  try {
    const queryRedes = '(site:instagram.com/p/ OR site:instagram.com/reel/ OR site:facebook.com) ("Caleta Olivia" OR "Claudio Vidal" OR "Río Gallegos" OR "Santa Cruz" OR "elcaletense" OR "infocaleta" OR "vocesyapuntes" OR "cortanoticias" OR "elcancillercom" OR "laderechadiario")';
    const dataS = await llamarSerperApi('search', {
      q: queryRedes,
      gl: 'ar',
      hl: 'es',
      num: 10,
      tbs: 'qdr:d'
    });
    if (!dataS || !Array.isArray(dataS.organic)) return [];

    return dataS.organic.map(item => {
      const esIg = item.link?.includes('instagram.com');
      const medioRed = esIg ? 'INSTAGRAM' : 'FACEBOOK';
      const snippetLimpio = (item.snippet || '').replace(/\s{2,}/g, ' ').trim();
      const tituloBase = (item.title || '').replace(/\s*\|\s*Instagram|\s*-\s*Facebook/gi, '').trim();
      const tituloFinal = snippetLimpio.length > 35 ? snippetLimpio.slice(0, 130) : tituloBase;

      return {
        titulo: tituloFinal,
        link: item.link,
        medio: `${medioRed} (${tituloBase.slice(0, 22)})`,
        categoriaOrigen: /caleta|santa cruz|vidal|gallegos|truncado|las heras/i.test(`${tituloBase} ${snippetLimpio}`) ? 'regional' : 'nacional',
        fotoRss: '',
        bajadaRss: `${tituloBase}. ${snippetLimpio}`,
        fechaPub: new Date().toISOString(),
        antiguedadTexto: item.date || 'En redes (últimas hs)',
        antiguedadMinutos: 40
      };
    }).filter(c => c.titulo.length > 20);
  } catch (e) {
    return [];
  }
}

async function resolverUrlOriginalDesdeBuscador(titulo, medio = '') {
  try {
    const tituloLimpio = String(titulo || '').replace(/\s+-\s+[^-]+$/, '').trim();
    if (tituloLimpio.length < 10) return '';
    const query = `${tituloLimpio} ${medio}`.trim();

    const dataS = await llamarSerperApi('search', { q: query, gl: 'ar', hl: 'es', num: 3 });
    const linkSerper = dataS?.organic?.[0]?.link;
    if (linkSerper && !linkSerper.includes('google.com')) return linkSerper;

    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(ddgUrl, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (resp.ok) {
      const html = await resp.text();
      const uddgMatch = html.match(/uddg=(https?%3A%2F%2F[^&"']+)/i);
      if (uddgMatch) {
        const decoded = decodeURIComponent(uddgMatch[1]);
        if (!decoded.includes('google.com') && !decoded.includes('duckduckgo.com')) return decoded;
      }
    }
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
          fotoExtraida: '',
          fuenteDominio: urlFinal.includes('instagram.com') ? 'INSTAGRAM' : 'FACEBOOK',
          fechaPublicacion: '',
          parrafosReales: `${itemRed.title || ''} ${itemRed.snippet || ''}`.trim(),
          textoExtraido: `POSTEO EN REDES: ${itemRed.title || ''}\nCONTENIDO: ${itemRed.snippet || ''}`
        };
      }
    }

    if ((!urlFinal || urlFinal.includes('news.google.com')) && tituloParaResolver) {
      const resuelta = await resolverUrlOriginalDesdeBuscador(tituloParaResolver, medioParaResolver);
      if (resuelta) urlFinal = resuelta;
    }

    if (!urlFinal || urlFinal.includes('news.google.com')) {
      return { fotoExtraida: '', fuenteDominio: '', textoExtraido: '', parrafosReales: '', fechaPublicacion: '' };
    }

    const resp = await fetch(urlFinal, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await resp.text();

    let fotoJsonLd = '';
    let fechaJsonLd = '';
    const scriptsLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of scriptsLd) {
      try {
        const rawLd = s[1].trim();
        const imgM = rawLd.match(/"image"\s*:\s*(?:\[\s*)?(?:\{\s*[^}]*"url"\s*:\s*"([^"]+)"|"([^"]+)")/i);
        if (imgM && (imgM[1] || imgM[2]) && !fotoJsonLd) {
          fotoJsonLd = imgM[1] || imgM[2];
        }
        const fecM = rawLd.match(/"datePublished"\s*:\s*"([^"]+)"/i);
        if (fecM && fecM[1] && !fechaJsonLd) fechaJsonLd = fecM[1];
      } catch (e) {}
    }

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                         html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]+class=["'][^"']*wp-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i);

    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    const fechaMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|pubdate|publishdate|date)["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<time[^>]+datetime=["']([^"']+)["']/i);

    const htmlSinBasura = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

    const parrafos = [...htmlSinBasura.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(t => t.length > 55 && !t.includes('{') && !t.includes('function('))
      .slice(0, 10)
      .join('\n')
      .slice(0, 2200);

    let fotoUrl = fotoJsonLd || (ogImageMatch ? ogImageMatch[1] : '');
    if (fotoUrl && fotoUrl.startsWith('/')) {
      const origin = new URL(urlFinal).origin;
      fotoUrl = `${origin}${fotoUrl}`;
    }
    fotoUrl = expandirUrlImagenAltaResolucion(fotoUrl);

    const dominio = new URL(urlFinal).hostname.replace('www.', '').split('.')[0].toUpperCase();
    const tituloLimpio = (ogTitleMatch ? ogTitleMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 220);
    const bajadaMeta = (ogDescMatch ? ogDescMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 350);

    return {
      fotoExtraida: fotoUrl,
      fuenteDominio: dominio,
      fechaPublicacion: fechaJsonLd || (fechaMatch ? fechaMatch[1] : ''),
      parrafosReales: `${bajadaMeta} ${parrafos}`.trim(),
      textoExtraido: `TÍTULO ORIGINAL: ${tituloLimpio}\nBAJADA: ${bajadaMeta}\nCUERPO COMPLETO:\n${parrafos}`.slice(0, 2600)
    };
  } catch (e) {
    return { fotoExtraida: '', fuenteDominio: '', textoExtraido: '', parrafosReales: '', fechaPublicacion: '' };
  }
}

async function buscarContextoEnGoogleNews(consulta) {
  try {
    const queryLimpia = consulta
      .replace(/https?:\/\/\S+/g, '')
      .replace(/TÍTULO ORIGINAL:[\s\S]*/i, '')
      .replace(/^\.[a-zA-Z0-9]+\s*/i, '')
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .join(' ');
    if (queryLimpia.length < 5) return { texto: '', fechaReciente: '' };

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryLimpia)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const xml = await resp.text();

    const bloques = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    let fechaReciente = '';

    const items = bloques.slice(0, 6).map(b => {
      const tit = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
      const desc = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim() || '';
      const pub = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
      if (!fechaReciente && pub) fechaReciente = pub;
      return tit ? `- ${tit} (${desc.slice(0, 140)})` : '';
    }).filter(Boolean).join('\n').slice(0, 900);

    return {
      texto: items ? `\nVERIFICACIÓN CRUZADA EN MEDIOS DE ARGENTINA:\n${items}` : '',
      fechaReciente
    };
  } catch (e) {
    return { texto: '', fechaReciente: '' };
  }
}

async function leerUnFeedRss(fuente) {
  try {
    const resp = await fetch(fuente.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!resp.ok) return [];
    const xml = await resp.text();

    const bloquesItem = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => m[1]);

    return bloquesItem.slice(0, 8).map(itemXml => {
      const tituloMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const contentMatch = itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                           itemXml.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i) ||
                           itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

      const imgMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) ||
                       itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                       (contentMatch && contentMatch[1].match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)) ||
                       itemXml.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);

      const titulo = (tituloMatch ? tituloMatch[1] : '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/<[^>]+>/g, '')
        .trim();

      const link = (linkMatch ? linkMatch[1] : '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const textoRssBruto = (descMatch ? descMatch[1] : '') + ' ' + (contentMatch ? contentMatch[1] : '');
      const bajadaRss = textoRssBruto.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 750);
      const medio = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : fuente.medio;
      const fechaPub = pubDateMatch ? pubDateMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const antiguedad = calcularAntiguedadNoticia(fechaPub);

      return {
        titulo,
        link,
        medio,
        categoriaOrigen: fuente.categoria,
        fotoRss: imgMatch ? expandirUrlImagenAltaResolucion(imgMatch[1]) : '',
        bajadaRss,
        fechaPub,
        antiguedadTexto: antiguedad.texto,
        antiguedadMinutos: antiguedad.minutos
      };
    }).filter(i => i.titulo.length > 18 && i.link.startsWith('http'));
  } catch (e) {
    return [];
  }
}

async function obtenerTodasLasCandidatasRadar() {
  const listas = await Promise.all(FUENTES_RSS_RADAR.map(f => leerUnFeedRss(f)));
  return listas.flat();
}

function ordenarCandidatasRelevantes(candidatas, ignorarHistorial = false) {
  if (!candidatas || candidatas.length === 0) return [];

  const regexDescartar = /pron[óo]stico de lluvia|pron[óo]stico del tiempo|c[óo]mo estar[áa] el clima|clima hoy en|tiempo hoy en|qu[ée] dice el servicio meteorol[óo]gico para hoy|hor[óo]scopo|quiniela|loter[íi]a|crucigrama|efem[ée]rides|receta|tarot|predicciones|a qu[ée] hora juega|d[óo]nde ver en vivo/i;
  const regexPrioridadMaxima = /caleta olivia|santa cruz|claudio vidal|ruta 3|ruta nacional 3|ram[óo]n santos|zona norte|pico truncado|las heras|r[íi]o gallegos|ypf|petr[óo]leo|servicios p[úu]blicos|distrigas|acueducto/i;
  const regexImpactoNacional = /milei|d[óo]lar|inflaci[óo]n|anses|jubilados|combustible|nafta|sueldo|paro|corte|tarifa|impuesto|banco central|selecci[óo]n argentina|boca|river|messi|colapinto|gobierno|empresarios|salarios|diputados|senado|reforma|paso/i;
  const regexBombasEspectaculos = /wanda|icardi|china su[áa]rez|tinelli|susana|mirtha|gran hermano|lam|esc[áa]ndalo|separaci[óo]n|denuncia|luck ra|tiago pzk|la joaqui|duki|mar[íi]a becerra|l-gante|occhiato|granados/i;

  const disponibles = candidatas.filter(c => {
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
    if (c.categoriaOrigen === 'espectaculos') puntos += regexBombasEspectaculos.test(c.titulo) ? 32 : -5;

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
    rafagasHoy
  };
}

function optimizarFotoConCloudinary(fotoUrl, expandir = false, alto = 1080) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !fotoUrl || !fotoUrl.startsWith('http') || fotoUrl.includes('res.cloudinary.com')) return fotoUrl;

  const hFinal = alto === 1920 ? 2560 : 1440;
  if (expandir) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/c_pad,w_1440,h_${hFinal},b_gen_fill,e_improve,e_sharpen:80,f_jpg,q_92/${encodeURIComponent(fotoUrl)}`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/fetch/c_fill,g_auto:faces,w_1440,h_${hFinal},e_improve,e_sharpen:80,f_jpg,q_92/${encodeURIComponent(fotoUrl)}`;
}

function esUrlDeArchivoViejo(url) {
  const anioActual = new Date().getFullYear();
  const matchesAnio = [...String(url || '').matchAll(/[\/\-_](20[12][0-9])[\/\-_]/g)];
  for (const m of matchesAnio) {
    const anioFoto = parseInt(m[1], 10);
    if (anioFoto >= 2010 && anioFoto <= anioActual - 2) {
      return true;
    }
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
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 22000 || buffer.length > 10 * 1024 * 1024) return null;

    const dims = obtenerDimensionesBuffer(buffer);
    if (dims && (dims.width < 580 || dims.height < 330)) {
      return null;
    }

    return {
      url: urlExpandida,
      dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      bytes: buffer.length,
      width: dims ? dims.width : 1080,
      height: dims ? dims.height : 720,
      tituloDescriptivo
    };
  };

  try {
    const urlCloudinary = optimizarFotoConCloudinary(urlExpandida, false, 1080);
    if (urlCloudinary !== urlExpandida) {
      const desdeCloud = await intentarDescarga(urlCloudinary).catch(() => null);
      if (desdeCloud) return desdeCloud;
    }
    return await intentarDescarga(urlExpandida);
  } catch (e) {
    return null;
  }
}

async function obtenerCandidatasFotoWeb(consulta, urlsExcluidas = []) {
  if (!consulta || consulta.trim().length < 3) return [];
  const anioActual = new Date().getFullYear();
  const consultaLimpia = consulta.replace(/orcolandia|kukardo|mandril|casta/gi, '').trim();
  const setExcluidas = new Set((urlsExcluidas || []).filter(Boolean));
  const itemsEncontrados = [];

  let dataS = await llamarSerperApi('images', {
    q: `${consultaLimpia} ${anioActual}`,
    gl: 'ar',
    hl: 'es',
    num: 12,
    tbs: 'isz:l,itp:photo,qdr:m'
  });

  if (!dataS?.images || dataS.images.length < 2) {
    dataS = await llamarSerperApi('images', {
      q: `${consultaLimpia} Argentina ${anioActual}`,
      gl: 'ar',
      hl: 'es',
      num: 12,
      tbs: 'isz:l,itp:photo,qdr:y'
    });
  }

  if (dataS && Array.isArray(dataS.images)) {
    for (const img of dataS.images) {
      if (
        img.imageUrl &&
        !setExcluidas.has(img.imageUrl) &&
        (img.imageWidth || 800) >= 650 &&
        !esUrlDeArchivoViejo(img.imageUrl) &&
        !DOMINIOS_PROHIBIDOS_IMG.test(img.imageUrl) &&
        !DOMINIOS_PROHIBIDOS_IMG.test(img.title || '')
      ) {
        itemsEncontrados.push({ url: img.imageUrl, desc: img.title || consultaLimpia });
      }
    }
  }

  if (itemsEncontrados.length < 3) {
    try {
      const apiWiki = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(consultaLimpia)}&gsrlimit=3&prop=pageimages&piprop=original&format=json`;
      const respW = await fetch(apiWiki, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'ElRegistroSurBot/1.0 (https://elregistrosur.com.ar)' }
      });
      if (respW.ok) {
        const dataW = await respW.json();
        for (const p of Object.values(dataW?.query?.pages || {})) {
          const orig = p?.original?.source;
          if (orig && !setExcluidas.has(orig) && /\.(?:jpg|jpeg|png|webp)$/i.test(orig) && !/coat_of_arms|escudo|flag|bandera|map|mapa|locator|signature|firma/i.test(orig)) {
            itemsEncontrados.push({ url: orig, desc: `Wikipedia: ${p.title}` });
          }
        }
      }
    } catch (e) {}
  }

  if (itemsEncontrados.length < 3) {
    try {
      const bingUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(consultaLimpia + ' ' + anioActual)}&qft=+filterui:imagesize-large+filterui:photo-photo&first=0&count=12&mmasync=1`;
      const resp = await fetch(bingUrl, {
        signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await resp.text();
      const matches = [
        ...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;[\s\S]{0,300}?t&quot;:&quot;([^&"]*)&quot;/gi),
        ...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;/gi)
      ];
      const vistos = new Set();
      for (const m of matches) {
        const murl = m[1];
        const tituloImg = m[2] || consultaLimpia;
        if (
          murl &&
          !vistos.has(murl) &&
          !setExcluidas.has(murl) &&
          !esUrlDeArchivoViejo(murl) &&
          /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(murl) &&
          !DOMINIOS_PROHIBIDOS_IMG.test(murl) &&
          !DOMINIOS_PROHIBIDOS_IMG.test(tituloImg)
        ) {
          vistos.add(murl);
          itemsEncontrados.push({ url: murl, desc: tituloImg });
        }
      }
    } catch (e) {}
  }

  const descargadas = await Promise.all(itemsEncontrados.slice(0, 6).map(it => descargarYValidarImagen(it.url, 4500, it.desc)));
  return descargadas.filter(Boolean);
}

async function auditarYResolverImagen({
  fotoCandidataUrl,
  esFotoManualDelEditor,
  titulo,
  bajada,
  categoria = '',
  busquedasSugeridas = [],
  promptIaSugerido,
  forzarBusquedaNueva = false,
  urlsExcluidas = []
}) {
  if (fotoCandidataUrl && esFotoManualDelEditor && !forzarBusquedaNueva) {
    const validadaEditor = await descargarYValidarImagen(fotoCandidataUrl, 6000, 'Foto enviada por el Editor');
    if (validadaEditor) return { urlFinal: validadaEditor.dataUrl, urlOriginal: validadaEditor.url, focoVertical: '20%', fuenteAuto: 'GENTILEZA / ARCHIVO', esFotoRealVerificada: true };
  }

  if (fotoCandidataUrl && !forzarBusquedaNueva) {
    const validadaNota = await descargarYValidarImagen(fotoCandidataUrl, 6000, '');
    if (validadaNota) {
      const auditoria = await auditarFotoConVisionIA(validadaNota.dataUrl, titulo, bajada, categoria, '');
      if (auditoria.aprobada !== false) {
        return {
          urlFinal: validadaNota.dataUrl,
          urlOriginal: validadaNota.url,
          focoVertical: auditoria.foco_vertical || '20%',
          fuenteAuto: '',
          esFotoRealVerificada: true
        };
      }
      if (auditoria.busqueda_corregida) {
        busquedasSugeridas.unshift(auditoria.busqueda_corregida);
      }
    }
  }

  const colaConsultas = [...new Set([...busquedasSugeridas.filter(Boolean), titulo])].slice(0, 3);

  for (const queryWeb of colaConsultas) {
    const candidatasWeb = await obtenerCandidatasFotoWeb(queryWeb, urlsExcluidas);
    for (const cand of candidatasWeb) {
      const veredicto = await auditarFotoConVisionIA(cand.dataUrl, titulo, bajada, categoria, cand.tituloDescriptivo);
      if (veredicto.aprobada !== false) {
        return {
          urlFinal: cand.dataUrl,
          urlOriginal: cand.url,
          focoVertical: veredicto.foco_vertical || '20%',
          fuenteAuto: 'ARCHIVO / PRENSA',
          esFotoRealVerificada: true
        };
      }
    }
  }

  const urlIa = construirUrlPollinationsHD(promptIaSugerido || 'Government building exterior Argentina photojournalism');
  const validadaIa = await descargarYValidarImagen(urlIa, 9000, 'Ilustración institucional');
  if (validadaIa) {
    return { urlFinal: validadaIa.dataUrl, urlOriginal: urlIa, focoVertical: '30%', fuenteAuto: 'ILUSTRACIÓN', esFotoRealVerificada: false };
  }

  return { urlFinal: urlIa, urlOriginal: urlIa, focoVertical: '20%', fuenteAuto: 'ARCHIVO', esFotoRealVerificada: false };
}

// ============================================================================
// CEREBRO EDITORIAL: TRIPLE BORRADOR + PROHIBIDO REPETIR + ROLES OBLIGATORIOS
// ============================================================================

async function procesarNoticiaConIA(textoCrudo, contextoWeb = '', esEdicion = false) {
  const textoRecortado = String(textoCrudo || '').slice(0, 2400);
  const contextoRecortado = String(contextoWeb || '').slice(0, 850);
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const fechaHoy = ahora.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Rio_Gallegos',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur), medio periodístico digital con sede en Caleta Olivia, Santa Cruz.
FECHA ACTUAL EN VIVO: Hoy es ${fechaHoy} (Año ${anioActual}).
PERSONALIDAD EDITORIAL: "Con carácter, cero humo". Estilo directo, filoso y verificable (inspirado en lo mejor de Infobae, TN, Corta y ADNSUR).

REGLA DE ACTUALIDAD Y VERIFICACIÓN ESTRICTA:
- Usá ÚNICAMENTE los hechos, lugares, nombres y cifras confirmados en el texto recibido. Si carece de sustento verificable, devolvé "descartar": true.
- PROHIBIDO usar memoria vieja para cargos públicos o religiosos (ej: el Papa actual es León XIV tras el fallecimiento de Francisco en 2025; el gobernador de Santa Cruz es Claudio Vidal; el intendente de Caleta Olivia es Pablo Carrizo; el intendente de Río Gallegos es Pablo Grasso). Extraé siempre el nombre actual del texto.

REGLA 1 — TÉCNICA DEL TRIPLE BORRADOR Y ARQUETIPOS DE TÍTULO ("borrador_descartado" -> "titulo"):
- Primero pensá el título obvio de portal burocrático y ponelo en "borrador_descartado" (ej: "Avance de obra de gas en Río Gallegos: 150 familias").
- Luego redactá en "titulo" (5 a 8 palabras en MAYÚSCULAS SIN EMOJIS, entre 36 y 54 caracteres) un titular de alto impacto usando uno de estos 4 arquetipos según la noticia:
  1. IMPACTO DIRECTO / OBRA / ECONOMÍA (Verbo activo presente/futuro): "RED DE GAS EN RÍO GALLEGOS: CONECTAN A 150 FAMILIAS" (Prohibido empezar con "Avance de...", "Reunión por...", "Importante...").
  2. DECLARACIÓN FUERTE (Rol + Nombre + Frase clave): "EL EMPRESARIO PAVANELLO: 'SANTA CRUZ RECUPERÓ SEGURIDAD JURÍDICA'".
  3. TENSIÓN POLÍTICA / VOTACIÓN (Lo que está en juego): "SUSPENSIÓN DE LAS PASO: AL GOBIERNO LE FALTAN 6 VOTOS".
  4. ALERTA VIAL / POLICIAL / CLIMA (Lugar + impacto operativo): "CORTE EN RUTA 3: DEMORAS EN EL ACCESO A CALETA OLIVIA".
- En "destacar": Elegí una FRASE COMPLETA CON SENTIDO PROPIO de 2 a 4 palabras consecutivas exactas dentro de "titulo" (ej: "CONECTAN A 150 FAMILIAS", "SEGURIDAD JURÍDICA", "LE FALTAN 6 VOTOS").

REGLA 2 — ROLES OBLIGATORIOS Y LEY DE "PROHIBIDO REPETIR" EN EL SUBTÍTULO ("bajada"):
- LEY DE COMPLEMENTARIEDAD (PROHIBIDO REPETIR): Las cifras o datos que ya pusiste en "titulo" NO se repiten con las mismas palabras en "bajada". La "bajada" (20 a 30 palabras, 3 a 4 renglones parejos sin emojis) debe agregar DATOS NUEVOS (qué empresa/organismo ejecuta, a qué barrios alcanza, qué dijo el protagonista o cuál es el contexto).
- OBLIGATORIO DESTACAR EL ROL O CARGO ANTES DEL NOMBRE: Tanto en "titulo", "bajada" como en "copy", JAMÁS pongas un nombre suelto sin su rol ("el gobernador Claudio Vidal", "el intendente Pablo Carrizo", "el concejal [Nombre]", "el candidato/postulado a concejal [Nombre]", "la delegada del barrio 22 de Septiembre, Fátima Soto", "el dirigente empresarial [Nombre]").
- PROHIBIDO empezar la "bajada" con nombres de personas poco conocidas sin antes presentar el hecho o el organismo (ej: empezá con "La empresa estatal Distrigas S.A. puso en marcha..." en vez de "Giselle Soto celebró...").
- CERO GACETILLA: Prohibido usar "celebraron", "expresaron su alegría", "destacaron con entusiasmo", "histórica gestión".
- En "categoria", usá siempre "LUGAR / TEMA CONCRETO" (ej: "RÍO GALLEGOS / OBRAS", "CALETA OLIVIA / SERVICIOS", "SANTA CRUZ / ENERGÍA", "NACIÓN / POLÍTICA"). Prohibido poner "SANTA CRUZ / REGIONAL".

REGLA 3 — DESCRIPCIÓN EXTENSA Y DESGLOSADA PARA REDES ("copy" — ENTRE 1.300 Y 2.050 CARACTERES, TOPE MÁXIMO 2.200):
Redactá una NOTA PERIODÍSTICA COMPLETA en texto plano separada por doble salto de línea (\\n\\n), usando comillas simples ('...') para citas internas:
1. ENCABEZADO EN MAYÚSCULAS + 2 emojis coherentes con el tema real de la lista permitida.
2. PÁRRAFO 1 (COPETE): Qué ocurrió, qué cambia en la calle o el bolsillo, dónde fue y quiénes intervienen (siempre con sus cargos/roles completos).
3. 3 A 4 PÁRRAFOS CON SUBTÍTULO EN LÍNEA ("Subtema clave: Desarrollo..."): Desglosá los detalles, barrios, montos y declaraciones. Prohibido usar viñetas o asteriscos.
4. PÁRRAFO DE CIERRE INFORMATIVO: Próximos pasos o impacto real.
5. FIRMA EDITORIAL: "Toda la cobertura en @elregistrosur."
6. CIERRE DINÁMICO + 👇: Pregunta de debate (en política/economía) o llamado a compartir con vecinos (en servicios/clima/ruta) terminando con 👇.
7. BLOQUE DE 8 A 10 HASHTAGS EN MINÚSCULAS.

REGLA 4 — BÚSQUEDA FOTOGRÁFICA ESCALONADA Y RECIENTE (${anioActual}):
- "busqueda_foto_web": Nombre propio actual del protagonista principal o escenario + lugar + ${anioActual}.
- "busqueda_foto_secundaria": Segundo protagonista actual o institución para modo Duelo/Lupa/Carrusel.
- "busqueda_foto_institucional": Edificio oficial o escenario físico real.

LISTA BLANCA DE EMOJIS PERMITIDOS EN "copy":
🚨 🔴 🟠 🟡 🚧 🚔 🚒 🚑 🛑 💨 🌀 🌊 💧 ☔ ⛄ ⛅ ⚡ 🔥 💰 💵 📈 📉 📊 ⛽ 🏭 🚜 🚛 🚢 🐟 📢 📣 📰 📋 📄 📜 🏥 🏫 🎓 👷 🤝 📍 📅 🕒 ⚽ 🏆 🏅 🎭 🎶 👇 👉 📲 💬 ✅ ❌

Devolvé ÚNICAMENTE este objeto JSON plano (sin arrays adentro):
{
  "descartar": false,
  "motivo_descarte": "",
  "borrador_descartado": "Título obvio descartado",
  "categoria": "LUGAR / TEMA CONCRETO EN MAYÚSCULAS SIN EMOJIS",
  "titulo": "TITULAR FILOSO EN MAYÚSCULAS SIN EMOJIS (5 a 8 palabras)",
  "destacar": "FRASE COMPLETA CON SENTIDO PROPIO DENTRO DEL TITULO",
  "bajada": "Subtítulo periodístico de 20 a 30 palabras SIN EMOJIS que aporta datos nuevos sin repetir el título e incluye los roles completos.",
  "dato_clave": "Cifra corta de impacto (ej: '150 FAMILIAS', '6 VOTOS', '75 KM/H') extraída del hecho",
  "autor_cita": "Rol y nombre del protagonista principal (ej: 'EL GOBERNADOR CLAUDIO VIDAL')",
  "fuente_credito": "Crédito corto en MAYÚSCULAS",
  "copy": "Nota periodística extensa (1300 a 2050 caracteres) con la estructura indicada",
  "busqueda_foto_web": "Nombre propio actual del protagonista o escenario + ${anioActual}",
  "busqueda_foto_secundaria": "Segundo protagonista actual o escenario complementario",
  "busqueda_foto_institucional": "Edificio oficial o escenario físico real",
  "prompt_imagen_ia": "Wide angle exterior photojournalism prompt in English showing the real physical building or setting, NO PEOPLE, NO FACES, NO TEXT"
}`;

  const userMessage = esEdicion
    ? `Borrador actual:\n${JSON.stringify({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: String(ultimoEstado.copy || '').slice(0, 1400)
      })}\n\nCambio pedido: "${textoRecortado}". Devolvé JSON verificado con "descartar": false.`
    : `Noticia recibida (${fechaHoy}):\n"${textoRecortado}"\n${contextoRecortado}\nVerificá los datos reales de ${anioActual}, destacá siempre el cargo/rol de cada persona y redactá el JSON completo.`;

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

  return parsed;
}

async function generarSlidesCarruselConIA(tituloBase, bajadaBase, copyBase) {
  try {
    const promptCarrusel = `Sos el Editor Jefe de 'EL REGISTRO SUR'. A partir de esta noticia ("${tituloBase}" - "${bajadaBase}" - ${String(copyBase || '').slice(0, 1200)}), armá una historia visual de 3 placas para un carrusel de Instagram estilo Infobae / Filo.news:
- Placa 1 (PORTADA GANCHO): El titular principal más fuerte y su bajada inicial sin repetir palabras.
- Placa 2 (LAS CLAVES / DETALLES): Un título enfocado en los detalles operativos (barrios, montos, empresas, quiénes hablaron con su cargo) y un párrafo explicativo claro de 24 a 32 palabras.
- Placa 3 (QUÉ CAMBIA / DEFINICIÓN): Un título sobre cómo sigue el tema o el impacto directo en la calle/vecinos, y un párrafo final contundente de 22 a 30 palabras.

Devolvé ÚNICAMENTE este JSON plano:
{
  "t1": "TITULAR PORTADA (5 a 8 palabras)", "d1": "FRASE DESTACADA 1", "b1": "Subtítulo de portada de 20 a 28 palabras.",
  "t2": "TITULAR DE CLAVES Y DETALLES (5 a 8 palabras)", "d2": "FRASE DESTACADA 2", "b2": "Desarrollo claro de 24 a 32 palabras con los datos concretos, cargos y lugares.",
  "t3": "TITULAR DE IMPACTO Y CIERRE (5 a 8 palabras)", "d3": "FRASE DESTACADA 3", "b3": "Conclusión periodística de 22 a 30 palabras sobre qué cambia o cómo sigue."
}`;
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
// MOTOR GRÁFICO 2K RETINA + CARRUSEL EDITORIAL + CITA/DATO RESPETANDO EL LOGO
// ============================================================================

async function estamparMarcaDeAguaFoto(fotoUrl, textoCredito = 'EXCLUSIVO') {
  const validada = await descargarYValidarImagen(fotoUrl, 7000);
  const srcSeguro = validada ? validada.dataUrl : fotoUrl;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    const creditoLimpio = limpiarEmojis(textoCredito || 'EXCLUSIVO').toUpperCase();

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
    await browser.close();
  }
}

async function renderizarFlyer({
  categoria,
  titulo,
  destacar,
  bajada,
  datoClave = '',
  autorCita = '',
  fuenteCredito = '',
  fotoFinalUrl,
  fotoSecundariaUrl = '',
  focoVertical = '20%',
  expandirSinCloudinary,
  esUrgente,
  esHistoria = false,
  modoVisual = 'estandar',
  numeroSlide = ''
}) {
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

  const alto = esHistoria ? 1920 : 1080;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: alto, deviceScaleFactor: 2 });

    const catLimpia = limpiarEmojis(categoria || 'ACTUALIDAD / NOTICIAS').toUpperCase();
    const { titulo: titLimpio, destacar: desLimpio } = asegurarDestacadoEnTitulo(titulo || 'COBERTURA DE EL REGISTRO SUR', destacar);
    const bajLimpia = limpiarBajadaPeriodistica(bajada || 'Toda la información verificada de Caleta Olivia, Santa Cruz y el país.');

    let htmlModificado = templateHtml
      .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', () => titLimpio.replace(/"/g, '&quot;'))
      .replace('VENTA DE TIERRAS A EXTRANJEROS', () => desLimpio.replace(/"/g, '&quot;'))
      .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', () => bajLimpia.replace(/"/g, '&quot;'))
      .replace('POLÍTICA', () => catLimpia.replace(/"/g, '&quot;'));

    if (fotoSegura) {
      htmlModificado = htmlModificado.replace(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g, () => fotoSegura);
    }

    await page.setContent(htmlModificado, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.evaluate(async ({
      url, urlSecundaria, focoY, expandir, modoUrgente, modoHistoria, modoVisual,
      categoria, titulo, destacar, bajada, datoClave, autorCita, fuenteCredito, numeroSlide
    }) => {
      document.body.style.webkitFontSmoothing = 'antialiased';
      document.body.style.textRendering = 'optimizeLegibility';

      const canvas = document.querySelector('#canvas');
      if (!canvas) return;

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
              const w = im.naturalWidth;
              const h = im.naturalHeight;
              if (w < 100 || h < 100) return resolve(srcData);

              const c = document.createElement('canvas');
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d');
              ctx.drawImage(im, 0, 0);
              const px = ctx.getImageData(0, 0, w, h).data;

              const esFilaBorde = (y) => {
                let blancos = 0, negros = 0, muestras = 0;
                for (let x = 10; x < w - 10; x += 8) {
                  const idx = (y * w + x) * 4;
                  const r = px[idx], g = px[idx + 1], b = px[idx + 2];
                  muestras++;
                  if (r > 240 && g > 240 && b > 240) blancos++;
                  if (r < 14 && g < 14 && b < 14) negros++;
                }
                return (blancos / muestras > 0.9) || (negros / muestras > 0.92);
              };

              const esColBorde = (x) => {
                let blancos = 0, negros = 0, muestras = 0;
                for (let y = 10; y < h - 10; y += 8) {
                  const idx = (y * w + x) * 4;
                  const r = px[idx], g = px[idx + 1], b = px[idx + 2];
                  muestras++;
                  if (r > 240 && g > 240 && b > 240) blancos++;
                  if (r < 14 && g < 14 && b < 14) negros++;
                }
                return (blancos / muestras > 0.9) || (negros / muestras > 0.92);
              };

              let top = 0, bottom = h - 1, left = 0, right = w - 1;
              while (top < h * 0.35 && esFilaBorde(top)) top += 2;
              while (bottom > h * 0.65 && esFilaBorde(bottom)) bottom -= 2;
              while (left < w * 0.35 && esColBorde(left)) left += 2;
              while (right > w * 0.65 && esColBorde(right)) right -= 2;

              if (top > 6 || left > 6 || (h - 1 - bottom) > 6 || (w - 1 - right) > 6) {
                const nw = Math.max(200, right - left);
                const nh = Math.max(200, bottom - top);
                const out = document.createElement('canvas');
                out.width = nw;
                out.height = nh;
                out.getContext('2d').drawImage(c, left, top, nw, nh, 0, 0, nw, nh);
                return resolve(out.toDataURL('image/jpeg', 0.94));
              }
              resolve(srcData);
            } catch (e) {
              resolve(srcData);
            }
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
        const nodosTexto = [];
        let n;
        while ((n = walker.nextNode())) {
          if (n.nodeValue && n.nodeValue.trim().length > 0) nodosTexto.push(n);
        }
        if (nodosTexto.length > 0) {
          const ultimoNodo = nodosTexto[nodosTexto.length - 1];
          ultimoNodo.nodeValue = ultimoNodo.nodeValue.replace(/\s+(\S{1,4})\s+(\S+)\s*$/, '\u00A0$1\u00A0$2');
          ultimoNodo.nodeValue = ultimoNodo.nodeValue.replace(/\s+(\S+)\s*$/, '\u00A0$1');
        }

        if (esSubtitulo) {
          el.style.maxWidth = '880px';
          el.style.lineHeight = '1.36';
        }

        for (let intento = 0; intento < 8; intento++) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = Array.from(range.getClientRects()).filter(r => r.width > 4 && r.height > 4);
          if (rects.length < 2) break;

          const lineas = [];
          rects.forEach(r => {
            const existente = lineas.find(l => Math.abs(l.top - r.top) < 8);
            if (existente) {
              existente.right = Math.max(existente.right, r.right);
              existente.left = Math.min(existente.left, r.left);
            } else {
              lineas.push({ top: r.top, left: r.left, right: r.right });
            }
          });

          if (lineas.length < 2) break;
          const anchoPrimera = lineas[0].right - lineas[0].left;
          const anchoUltima = lineas[lineas.length - 1].right - lineas[lineas.length - 1].left;

          if (esSubtitulo && lineas.length === 2 && anchoPrimera > 740) {
            const wActual = el.getBoundingClientRect().width;
            el.style.maxWidth = `${Math.max(620, wActual - 65)}px`;
            continue;
          }

          if (anchoUltima >= anchoPrimera * 0.48 || lineas.length >= 4) break;
          const wActual = el.getBoundingClientRect().width;
          el.style.maxWidth = `${Math.max(520, wActual - 40)}px`;
        }
      }

      let fotoPrincipal = null;
      const imgs = canvas.querySelectorAll('img');
      for (const img of imgs) {
        img.style.imageRendering = '-webkit-optimize-contrast';
        const rect = img.getBoundingClientRect();
        if (img.src.includes('unsplash') || img.id.includes('bg') || img.className.includes('bg') || rect.width > 300 || img.width > 300) {
          if (urlLimpia) {
            img.src = urlLimpia;
            try { await img.decode(); } catch (e) {}
          }
          fotoPrincipal = img;
          if (expandir && urlLimpia) {
            const parent = img.parentElement;
            if (parent) {
              parent.style.position = 'relative';
              parent.style.overflow = 'hidden';
              const bgBlurImg = document.createElement('img');
              bgBlurImg.src = urlLimpia;
              bgBlurImg.style.cssText = 'position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);object-fit:cover;filter:blur(28px) brightness(0.42) saturate(1.15);z-index:0;';
              parent.insertBefore(bgBlurImg, img);
            }
            img.style.position = 'relative';
            img.style.zIndex = '1';
            img.style.objectFit = 'contain';
            img.style.width = '100%';
            img.style.height = '100%';
          } else {
            img.style.objectFit = 'cover';
            img.style.objectPosition = `center ${focoY || '20%'}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.filter = 'contrast(1.04) saturate(1.05)';
            img.style.transform = 'scale(1.02)';
          }
        }
      }

      if (urlLimpia) {
        canvas.querySelectorAll('*').forEach(el => {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && (bg.includes('unsplash') || bg.includes('http') || bg.includes('data:image'))) {
            el.style.backgroundImage = `url("${urlLimpia}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = `center ${focoY || '20%'}`;
          }
        });
      }

      if (modoVisual === 'duelo' && urlLimpia && urlSecundaria) {
        const urlSecLimpia = await recortarBordesBlancosONegros(urlSecundaria);
        const splitWrap = document.createElement('div');
        splitWrap.style.cssText = 'position:absolute;top:0;left:0;width:1080px;height:680px;z-index:1;display:flex;overflow:hidden;';
        splitWrap.innerHTML = `
          <div style="flex:1;height:100%;overflow:hidden;position:relative;border-right:4px solid ${accentColor};">
            <img src="${urlLimpia}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;" />
          </div>
          <div style="flex:1;height:100%;overflow:hidden;position:relative;">
            <img src="${urlSecLimpia}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;" />
          </div>
          <div style="position:absolute;inset:0;background:linear-gradient(to top, #050d1a 2%, rgba(5,13,26,0.6) 28%, transparent 65%);"></div>
        `;
        canvas.insertBefore(splitWrap, canvas.firstChild);
        if (fotoPrincipal) fotoPrincipal.style.opacity = '0';
      }

      if (modoVisual === 'lupa' && (urlSecundaria || urlLimpia)) {
        const imgPip = urlSecundaria ? await recortarBordesBlancosONegros(urlSecundaria) : urlLimpia;
        const pipCard = document.createElement('div');
        pipCard.style.cssText = `position:absolute;top:78px;right:42px;width:270px;height:270px;border-radius:24px;overflow:hidden;z-index:25;border:4px solid ${accentColor};box-shadow:0 20px 45px rgba(0,0,0,0.75);background:#050d1a;`;
        pipCard.innerHTML = `<img src="${imgPip}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;transform:scale(1.08);" />`;
        canvas.appendChild(pipCard);
      }

      let esFotoClara = false;
      if (fotoPrincipal && fotoPrincipal.complete && fotoPrincipal.naturalWidth > 0) {
        try {
          const c = document.createElement('canvas');
          c.width = 40; c.height = 40;
          const ctx = c.getContext('2d');
          ctx.drawImage(fotoPrincipal, 0, 0, 40, 40);
          const data = ctx.getImageData(0, 20, 40, 20).data;
          let suma = 0;
          for (let i = 0; i < data.length; i += 4) suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          esFotoClara = (suma / (data.length / 4)) > 125;
        } catch (e) {}
      }

      if (esFotoClara && (modoVisual === 'estandar' || modoVisual === 'carrusel_portada')) {
        const refuerzo = document.createElement('div');
        refuerzo.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:linear-gradient(to top, rgba(4,10,20,0.97) 0%, rgba(4,10,20,0.84) 46%, rgba(4,10,20,0.12) 100%);';
        canvas.appendChild(refuerzo);
      }

      if (fuenteCredito) {
        const badgeFuente = document.createElement('div');
        badgeFuente.textContent = `FUENTE: ${fuenteCredito.toUpperCase()}`;
        badgeFuente.style.cssText = 'position:absolute;top:34px;right:38px;z-index:30;background:rgba(6,14,26,0.76);backdrop-filter:blur(8px);color:rgba(255,255,255,0.88);font-family:sans-serif;font-size:14px;font-weight:800;letter-spacing:1.3px;padding:7px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.18);';
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
        badgeDesliza.style.cssText = `position:absolute;bottom:118px;right:48px;z-index:30;background:rgba(5,13,26,0.88);color:${accentColor};border:1.5px solid ${accentColor};font-family:sans-serif;font-size:15px;font-weight:900;letter-spacing:1.5px;padding:8px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,0.6);`;
        canvas.appendChild(badgeDesliza);
      }

      const modulosEspeciales = ['cita', 'dato', 'carrusel_claves', 'carrusel_cierre'];
      if (modulosEspeciales.includes(modoVisual)) {
        // Oculta únicamente los textos centrales originales dejando intacto el pie del logo de la brújula (abajo de y=920)
        canvas.querySelectorAll('h1, h2, h3, p, .titulo, .bajada, [class*="title"], [class*="sub"], [class*="cat"], [class*="tag"], [class*="pill"]').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.top < 915 && r.height < 600) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          }
        });

        const tituloFormateado = destacar && titulo.includes(destacar)
          ? titulo.replace(destacar, `<span style="color:${accentColor}">${destacar}</span>`)
          : titulo;

        const panel = document.createElement('div');
        // El panel termina a 132px del borde inferior para que el logo de la brújula y @elregistrosur se vean siempre
        panel.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:132px;z-index:18;display:flex;flex-direction:column;justify-content:flex-end;padding:88px 64px 28px 64px;box-sizing:border-box;font-family:sans-serif;';

        if (modoVisual === 'carrusel_claves') {
          if (fotoPrincipal) {
            fotoPrincipal.style.height = '450px';
            fotoPrincipal.style.filter = 'brightness(0.82) contrast(1.06)';
          }
          panel.style.background = 'linear-gradient(to bottom, rgba(5,13,26,0.10) 0%, rgba(5,13,26,0.88) 34%, #050d1a 48%)';
          panel.innerHTML = `
            <div style="background:rgba(10,23,44,0.92);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-left:7px solid ${accentColor};border-radius:20px;padding:42px 44px;box-shadow:0 24px 50px rgba(0,0,0,0.65);display:flex;flex-direction:column;gap:22px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:16px;letter-spacing:1.5px;padding:6px 16px;border-radius:4px;text-transform:uppercase;">${categoria}</span>
                <span style="color:${accentColor};font-weight:800;font-size:16px;letter-spacing:1.5px;">LAS CLAVES DEL TEMA &rarr;</span>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:44px;font-weight:900;line-height:1.12;letter-spacing:-0.5px;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.92);font-size:26px;line-height:1.42;font-weight:400;">${bajada}</div>
            </div>`;
        } else if (modoVisual === 'carrusel_cierre') {
          if (fotoPrincipal) {
            fotoPrincipal.style.filter = 'blur(14px) brightness(0.32) saturate(1.2)';
          }
          panel.style.justifyContent = 'center';
          panel.style.background = 'radial-gradient(circle at center, rgba(12,28,54,0.55) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:linear-gradient(165deg, rgba(12,27,50,0.95) 0%, rgba(6,15,28,0.98) 100%);border:1.5px solid rgba(56,189,248,0.35);border-top:7px solid ${accentColor};border-radius:22px;padding:48px 48px;box-shadow:0 28px 60px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:24px;">
              <div>
                <span style="display:inline-block;background:${accentColor};color:#050d1a;font-weight:900;font-size:16px;letter-spacing:1.6px;padding:7px 18px;border-radius:5px;text-transform:uppercase;">QUÉ CAMBIA / DEFINICIONES</span>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:46px;font-weight:900;line-height:1.12;letter-spacing:-0.5px;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.90);font-size:26px;line-height:1.42;font-weight:400;border-left:4px solid ${accentColor};padding-left:22px;">${bajada}</div>
              <div style="margin-top:6px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.12);display:flex;justify-content:space-between;align-items:center;">
                <span style="color:rgba(255,255,255,0.70);font-size:16px;font-weight:700;letter-spacing:1px;">NOTA COMPLETA EN LA DESCRIPCIÓN</span>
                <span style="color:${accentColor};font-size:17px;font-weight:900;letter-spacing:1px;">@ELREGISTROSUR</span>
              </div>
            </div>`;
        } else if (modoVisual === 'cita') {
          if (fotoPrincipal) {
            fotoPrincipal.style.filter = 'blur(10px) brightness(0.35)';
          }
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.92);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:42px 44px;box-shadow:0 25px 55px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:24px;">
              <div style="display:flex;align-items:center;gap:24px;">
                ${urlLimpia ? `<img src="${urlLimpia}" style="width:128px;height:128px;border-radius:50%;object-fit:cover;object-position:center 18%;border:4px solid ${accentColor};box-shadow:0 10px 25px rgba(0,0,0,0.5);" />` : ''}
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <span style="align-self:flex-start;background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;letter-spacing:1.4px;padding:5px 14px;border-radius:4px;text-transform:uppercase;">${categoria}</span>
                  <div style="color:${accentColor};font-size:21px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;">${autorCita}</div>
                </div>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:44px;font-weight:900;line-height:1.14;letter-spacing:-0.5px;">“${tituloFormateado}”</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.88);font-size:24px;line-height:1.38;font-weight:400;border-left:4px solid ${accentColor};padding-left:20px;">${bajada}</div>
            </div>`;
        } else if (modoVisual === 'dato') {
          if (fotoPrincipal) {
            fotoPrincipal.style.filter = 'blur(10px) brightness(0.34)';
          }
          panel.style.justifyContent = 'center';
          panel.style.background = 'linear-gradient(180deg, rgba(5,13,26,0.45) 0%, rgba(5,13,26,0.96) 85%)';
          panel.innerHTML = `
            <div style="background:rgba(9,21,40,0.92);border:1px solid rgba(255,255,255,0.14);border-left:7px solid ${accentColor};border-radius:22px;padding:44px 46px;box-shadow:0 25px 55px rgba(0,0,0,0.75);display:flex;flex-direction:column;gap:20px;">
              <div><span style="background:#ffffff;color:#050d1a;font-weight:900;font-size:15px;letter-spacing:1.5px;padding:6px 16px;border-radius:4px;text-transform:uppercase;">${categoria}</span></div>
              <div style="color:${accentColor};font-size:92px;font-weight:900;line-height:0.98;letter-spacing:-2px;text-shadow:0 10px 30px rgba(0,0,0,0.55);">${datoClave}</div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:42px;font-weight:900;line-height:1.14;text-transform:uppercase;">${tituloFormateado}</div>
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.88);font-size:24px;line-height:1.38;">${bajada}</div>
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
      titulares.forEach(el => {
        if (el.innerText && el.innerText.trim().length > 4) blindarTipografiaProlija(el, false);
      });

      const subtitulos = canvas.querySelectorAll('p, .bajada, [class*="sub"], [class*="desc"]');
      subtitulos.forEach(el => {
        if (el.innerText && el.innerText.trim().length > 20) blindarTipografiaProlija(el, true);
      });

      titulares.forEach(el => {
        let fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        const limiteInferior = altoCanvas - 140;
        while (el.getBoundingClientRect().bottom > limiteInferior && fontSize > 26) {
          fontSize -= 2;
          el.style.fontSize = `${fontSize}px`;
          el.style.lineHeight = '1.12';
        }
      });
    }, {
      url: fotoSegura, urlSecundaria: fotoSecSegura, focoY: focoVertical,
      expandir: expandirSinCloudinary, modoUrgente: esUrgente, modoHistoria: esHistoria,
      modoVisual, categoria: catLimpia, titulo: titLimpio, destacar: desLimpio, bajada: bajLimpia,
      datoClave, autorCita, fuenteCredito, numeroSlide
    });

    await new Promise(r => setTimeout(r, 300));
    const canvasElement = await page.$('#canvas');
    return await canvasElement.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

async function enviarFotoConBotonesTelegram(imageBuffer, prefijo, copyCompleto) {
  const { captionFoto, enviarTextoCompletoAparte } = prepararCaptionTelegram(prefijo, copyCompleto);

  const form = new FormData();
  form.append('chat_id', EDITOR_CHAT_ID);
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'flyer_2k.png');
  form.append('caption', captionFoto);
  form.append('reply_markup', JSON.stringify(generarTecladoTactil()));

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: form });

  if (enviarTextoCompletoAparte) {
    await enviarMensajeTelegram(`📝 DESCRIPCIÓN COMPLETA PARA META (${copyCompleto.length}/2200 caracteres):\n\n${copyCompleto}`);
  }
}

async function armarNoticiaDesdeCandidata(elegida, exigirFotoReal = false) {
  registrarTemaEnviado(elegida.titulo);

  const [extraido, contextoObj] = await Promise.all([
    extraerNoticiaDeLink(elegida.link, elegida.titulo, elegida.medio),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const contenidoDisponible = `${elegida.bajadaRss || ''} ${extraido.parrafosReales || ''} ${contextoObj.texto || ''}`.trim();
  if (exigirFotoReal && contenidoDisponible.length < 140) {
    return null;
  }

  const fechaRawFinal = elegida.fechaPub || extraido.fechaPublicacion || contextoObj.fechaReciente || '';
  const antiguedad = calcularAntiguedadNoticia(fechaRawFinal);

  const textoCompleto = `CATEGORÍA: ${elegida.categoriaOrigen.toUpperCase()}\nMEDIO DE ORIGEN: ${elegida.medio}\nPUBLICADO: ${antiguedad.texto}\nTITULAR: ${elegida.titulo}\nRESUMEN RSS: ${elegida.bajadaRss || ''}\n${extraido.textoExtraido}`;
  const noticiaIA = await procesarNoticiaConIA(textoCompleto, contextoObj.texto || 'Noticia verificada en portal oficial.', false);

  if (noticiaIA.descartar) return null;

  const fotoInicial = extraido.fotoExtraida || elegida.fotoRss || '';
  const { urlFinal, urlOriginal, focoVertical, fuenteAuto, esFotoRealVerificada } = await auditarYResolverImagen({
    fotoCandidataUrl: fotoInicial,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    bajada: noticiaIA.bajada,
    categoria: noticiaIA.categoria,
    busquedasSugeridas: [
      noticiaIA.busqueda_foto_web,
      noticiaIA.busqueda_foto_secundaria,
      noticiaIA.busqueda_foto_institucional
    ],
    promptIaSugerido: noticiaIA.prompt_imagen_ia
  });

  if (exigirFotoReal && !esFotoRealVerificada) {
    return null;
  }

  const fuenteFinal = fuenteAuto || elegida.medio.toUpperCase() || noticiaIA.fuente_credito || 'PRENSA';

  const imageBuffer = await renderizarFlyer({
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    datoClave: noticiaIA.dato_clave,
    autorCita: noticiaIA.autor_cita,
    fuenteCredito: fuenteFinal,
    fotoFinalUrl: urlFinal,
    focoVertical,
    expandirSinCloudinary: false,
    esUrgente: false,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: urlFinal,
    foto_original_url: urlOriginal || urlFinal,
    foto_secundaria_url: '',
    fotos_usadas: [urlOriginal, urlFinal].filter(Boolean),
    foco_vertical: focoVertical,
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: noticiaIA.dato_clave || '',
    autor_cita: noticiaIA.autor_cita || '',
    fuente_credito: fuenteFinal,
    antiguedad_texto: antiguedad.texto,
    busqueda_foto_web: noticiaIA.busqueda_foto_web || noticiaIA.titulo,
    busqueda_foto_secundaria: noticiaIA.busqueda_foto_secundaria || noticiaIA.busqueda_foto_institucional || '',
    prompt_imagen_ia: noticiaIA.prompt_imagen_ia || 'Argentina journalism photography',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: false,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA, medio: elegida.medio, antiguedadTexto: antiguedad.texto };
}

async function generarDatosRadar(forzar = false) {
  const candidatas = await obtenerTodasLasCandidatasRadar();
  if (candidatas.length === 0) return null;

  let ordenadas = ordenarCandidatasRelevantes(candidatas, false);
  if (ordenadas.length === 0 && forzar) {
    ordenadas = ordenarCandidatasRelevantes(candidatas, true);
  }
  if (ordenadas.length === 0) return null;

  ultimasTopCandidatas = ordenadas.slice(0, 5);

  for (const elegida of ordenadas.slice(0, 4)) {
    const resultado = await armarNoticiaDesdeCandidata(elegida, true);
    if (resultado) return resultado;
  }

  return await armarNoticiaDesdeCandidata(ordenadas[0], false);
}

// Garantiza que siempre exista un borrador válido antes de ejecutar comandos de edición/formato (.carrusel, .duelo, .cita, etc.)
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

  registrarTemaEnviado(elegida.titulo);

  const [extraido, contextoObj] = await Promise.all([
    extraerNoticiaDeLink(elegida.link, elegida.titulo, elegida.medio),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const antiguedad = calcularAntiguedadNoticia(elegida.fechaPub || extraido.fechaPublicacion || contextoObj.fechaReciente);
  const noticiaIA = await procesarNoticiaConIA(`ALERTA VIAL / SERVICIOS ZONA NORTE: ${elegida.titulo}\n${extraido.textoExtraido}`, contextoObj.texto || 'Reporte vial y de servicios.', false);
  if (noticiaIA.descartar) return null;

  const { urlFinal, urlOriginal, focoVertical, fuenteAuto } = await auditarYResolverImagen({
    fotoCandidataUrl: extraido.fotoExtraida || elegida.fotoRss,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    bajada: noticiaIA.bajada,
    categoria: 'ZONA NORTE / ALERTA',
    busquedasSugeridas: ['Ruta Nacional 3 Caleta Olivia Santa Cruz', 'Caleta Olivia Santa Cruz ruta'],
    promptIaSugerido: 'Patagonia Argentina coastal highway Ruta 3 photojournalism'
  });

  const imageBuffer = await renderizarFlyer({
    categoria: 'ZONA NORTE / ALERTA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    fuenteCredito: fuenteAuto || 'VIALIDAD / SERVICIOS',
    fotoFinalUrl: urlFinal,
    focoVertical,
    expandirSinCloudinary: false,
    esUrgente: true,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: urlFinal,
    foto_original_url: urlOriginal || urlFinal,
    foto_secundaria_url: '',
    fotos_usadas: [urlOriginal, urlFinal].filter(Boolean),
    foco_vertical: focoVertical,
    categoria: 'ZONA NORTE / ALERTA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: '',
    autor_cita: '',
    fuente_credito: fuenteAuto || 'VIALIDAD / SERVICIOS',
    antiguedad_texto: antiguedad.texto,
    busqueda_foto_web: noticiaIA.titulo,
    busqueda_foto_secundaria: 'Caleta Olivia Santa Cruz',
    prompt_imagen_ia: 'Patagonia highway Ruta 3 landscape',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: true,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA, antiguedadTexto: antiguedad.texto };
}

async function ejecutarResumenDiarioCarrusel() {
  const candidatas = await obtenerTodasLasCandidatasRadar();
  const titulares = candidatas.slice(0, 14).map(t => `- [${t.medio} | ${t.antiguedadTexto}] ${t.titulo}`).join('\n').slice(0, 1400);

  const promptResumen = `Sos el Editor Jefe de 'EL REGISTRO SUR'. Redactá estrictamente en castellano natural y fluido.
A partir de los hechos confirmados de hoy en Argentina y Santa Cruz, armá el RESUMEN DIARIO EN CARRUSEL de 5 placas:
- Placa 1 (Portada): "LO QUE PASÓ HOY EN EL SUR"
- Placas 2, 3, 4 y 5: Las 4 noticias más importantes del día.

Titulares del día:
${titulares}

Devolvé ÚNICAMENTE este JSON plano:
{
  "t1": "LO QUE PASÓ HOY EN EL SUR", "d1": "LO QUE PASÓ HOY", "b1": "Repaso completo por los cuatro hechos más relevantes que marcaron la jornada informativa en Caleta Olivia, la provincia de Santa Cruz y el país.",
  "t2": "TITULAR TEMA 1", "d2": "FRASE CON SENTIDO", "b2": "Oración informativa coherente y natural de 20 a 28 palabras explicando el hecho y su impacto directo.",
  "t3": "TITULAR TEMA 2", "d3": "FRASE CON SENTIDO", "b3": "Oración informativa coherente y natural de 20 a 28 palabras explicando el hecho y su impacto directo.",
  "t4": "TITULAR TEMA 3", "d4": "FRASE CON SENTIDO", "b4": "Oración informativa coherente y natural de 20 a 28 palabras explicando el hecho y su impacto directo.",
  "t5": "TITULAR TEMA 4", "d5": "FRASE CON SENTIDO", "b5": "Oración informativa coherente y natural de 20 a 28 palabras explicando el hecho y su impacto directo.",
  "copy": "RESUMEN DEL DÍA EN EL REGISTRO SUR 📰📍\\n\\nRepaso completo con los hechos más importantes de la jornada.\\n\\nTema 1: Desarrollo...\\n\\nTema 2: Desarrollo...\\n\\nTema 3: Desarrollo...\\n\\nTema 4: Desarrollo...\\n\\nToda la cobertura en @elregistrosur.\\n\\n¿Cuál de estos temas te parece más relevante hoy? Te leemos en comentarios 👇\\n\\n#noticias #elregistrosur #caletaolivia #santacruz #resumendeldia #patagonia #actualidad #argentina"
}`;

  const parsed = await llamarGroqChat([{ role: 'user', content: promptResumen }]);
  const slides = [
    { titulo: parsed.t1 || 'LO QUE PASÓ HOY EN EL SUR', destacar: parsed.d1 || 'LO QUE PASÓ HOY', bajada: parsed.b1 || 'Repaso por los temas más importantes de la jornada.' },
    { titulo: parsed.t2 || 'ACTUALIDAD REGIONAL', destacar: parsed.d2 || 'ACTUALIDAD', bajada: parsed.b2 || '' },
    { titulo: parsed.t3 || 'PANORAMA PROVINCIAL', destacar: parsed.d3 || 'PROVINCIAL', bajada: parsed.b3 || '' },
    { titulo: parsed.t4 || 'AGENDA NACIONAL', destacar: parsed.d4 || 'NACIONAL', bajada: parsed.b4 || '' },
    { titulo: parsed.t5 || 'CIERRE DE JORNADA', destacar: parsed.d5 || 'JORNADA', bajada: parsed.b5 || '' }
  ].filter(s => s.bajada);

  const { urlFinal: fotoBase } = await auditarYResolverImagen({
    fotoCandidataUrl: '',
    esFotoManualDelEditor: false,
    titulo: 'Caleta Olivia Santa Cruz Patagonia',
    bajada: 'Vista panorámica de la ciudad de Caleta Olivia en la provincia de Santa Cruz.',
    categoria: 'SANTA CRUZ / RESUMEN',
    busquedasSugeridas: ['Caleta Olivia Santa Cruz El Gorosito', 'Caleta Olivia costanera'],
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina dusk city coast landscape'
  });

  const buffers = [];
  for (let i = 0; i < slides.length; i++) {
    const td = asegurarDestacadoEnTitulo(slides[i].titulo, slides[i].destacar);
    const modoSlide = i === 0 ? 'carrusel_portada' : (i === slides.length - 1 ? 'carrusel_cierre' : 'carrusel_claves');
    const buf = await renderizarFlyer({
      categoria: 'SANTA CRUZ / RESUMEN',
      titulo: td.titulo,
      destacar: td.destacar,
      bajada: limpiarBajadaPeriodistica(slides[i].bajada),
      fuenteCredito: 'EL REGISTRO SUR',
      fotoFinalUrl: fotoBase,
      expandirSinCloudinary: false,
      esUrgente: false,
      esHistoria: false,
      modoVisual: modoSlide,
      numeroSlide: `0${i + 1} / 0${slides.length}`
    });
    buffers.push(buf);
  }

  const copyLimpia = filtrarEmojisSegurosRedes(parsed.copy);

  guardarEnColaBorradores({
    foto_url: fotoBase,
    foto_original_url: fotoBase,
    foto_secundaria_url: '',
    fotos_usadas: [fotoBase],
    foco_vertical: '20%',
    categoria: 'SANTA CRUZ / RESUMEN',
    titulo: limpiarEmojis(slides[0].titulo),
    destacar: limpiarEmojis(slides[0].destacar),
    bajada: limpiarBajadaPeriodistica(slides[0].bajada),
    copy: copyLimpia,
    dato_clave: '',
    autor_cita: '',
    fuente_credito: 'EL REGISTRO SUR',
    antiguedad_texto: 'Resumen de hoy',
    busqueda_foto_web: 'Caleta Olivia Santa Cruz',
    busqueda_foto_secundaria: '',
    prompt_imagen_ia: 'Caleta Olivia Patagonia coast',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: false,
    imagen_buffer: buffers[0],
    historia_buffer: null,
    carrusel_buffers: buffers
  });

  return { buffers, copy: copyLimpia };
}

async function ejecutarParteClima() {
  const clima = await obtenerDatosClimaCaleta();
  const noticiaIA = await procesarNoticiaConIA(clima.texto, 'Fuente meteorológica oficial Open-Meteo Caleta Olivia.', false);
  const { urlFinal: fotoClima } = await auditarYResolverImagen({
    fotoCandidataUrl: '',
    esFotoManualDelEditor: false,
    titulo: 'Caleta Olivia Santa Cruz Costanera',
    bajada: noticiaIA.bajada,
    categoria: 'CALETA OLIVIA / CLIMA',
    busquedasSugeridas: ['Caleta Olivia Santa Cruz costanera', 'Caleta Olivia El Gorosito'],
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina coastal city sea sky dramatic weather landscape'
  });

  const imageBuffer = await renderizarFlyer({
    categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    datoClave: `${clima.rafagasHoy} KM/H`,
    fuenteCredito: 'SERVICIO METEOROLÓGICO',
    fotoFinalUrl: fotoClima,
    expandirSinCloudinary: false,
    esUrgente: clima.rafagasHoy >= 70,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: fotoClima,
    foto_original_url: fotoClima,
    foto_secundaria_url: '',
    fotos_usadas: [fotoClima],
    foco_vertical: '20%',
    categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: `${clima.rafagasHoy} KM/H`,
    autor_cita: '',
    fuente_credito: 'SERVICIO METEOROLÓGICO',
    antiguedad_texto: 'Actualizado ahora',
    busqueda_foto_web: 'Caleta Olivia costanera',
    busqueda_foto_secundaria: '',
    prompt_imagen_ia: 'Caleta Olivia Patagonia coastal weather landscape',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: clima.rafagasHoy >= 70,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA };
}

setInterval(async () => {
  try {
    const radar = await generarDatosRadar(false);
    if (radar) {
      await enviarFotoConBotonesTelegram(
        radar.imageBuffer,
        `🚨 RADAR (${radar.medio.toUpperCase()})\n⏱️ Publicado en el portal: ${radar.antiguedadTexto} — ¿QUERÉS PUBLICARLO?`,
        radar.noticiaIA.copy
      );
    }

    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Rio_Gallegos' }));
    const fechaHoy = ahoraAR.toISOString().slice(0, 10);

    if (ahoraAR.getHours() === 8 && ahoraAR.getMinutes() >= 25 && ultimoClimaDiaEnviado !== fechaHoy) {
      ultimoClimaDiaEnviado = fechaHoy;
      const { imageBuffer, noticiaIA } = await ejecutarParteClima();
      await enviarFotoConBotonesTelegram(imageBuffer, '📢 PARTE DIARIO DE CLIMA Y VIENTO (⏱️ Actualizado ahora):', noticiaIA.copy);
    }

    if (ahoraAR.getHours() === 21 && ahoraAR.getMinutes() < 35 && ultimoResumenDiaEnviado !== fechaHoy) {
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
}, 30 * 60 * 1000);

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

async function responderConPlacaYCopyExtenso(res, payload, prefijoTelegram = '') {
  persistirEstadoEnDisco(ultimoEstado);
  const copyCompleto = ultimoEstado.copy || payload.copy || '';
  const { captionFoto, enviarTextoCompletoAparte } = prepararCaptionTelegram(prefijoTelegram, copyCompleto);

  if (enviarTextoCompletoAparte) {
    setTimeout(() => {
      enviarMensajeTelegram(`📝 DESCRIPCIÓN COMPLETA PARA META (${copyCompleto.length}/2200 caracteres):\n\n${copyCompleto}`);
    }, 1500);
  }

  return res.json({
    ...payload,
    copy: captionFoto,
    copy_completo: copyCompleto
  });
}

app.post('/generar', async (req, res) => {
  try {
    let {
      foto_url, file_path, file_id, texto_crudo, callback_query_id,
      categoria, titulo, destacar, bajada, fill_mode
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
      await responderCallbackTelegram(callback_query_id, '⚡ Procesando en El Registro Sur...');
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

    // 1. COMANDO PUBLICAR (por si Make lo reenvía a /generar)
    if (comando === 'publicar' || comando === 'comandopublicar') {
      await asegurarBorradorActivo();
      if (!ultimoEstado.imagen_buffer) {
        return res.json({ ok: false, descartado: true, error: 'Sin borrador activo para publicar.' });
      }
      return res.json({
        ok: true,
        publicar: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        copy_completo: ultimoEstado.copy,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    // 2. COMANDO DESCARTAR
    if (comando === 'descartar') {
      const descartadoTitulo = ultimoEstado.titulo || 'Borrador';
      if (colaBorradores.length > 0) {
        ultimoEstado = colaBorradores.shift();
        persistirEstadoEnDisco(ultimoEstado);
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}".\n↩️ Recuperado borrador anterior en cola: "${ultimoEstado.titulo}".`);
      } else {
        ultimoEstado.imagen_buffer = null;
        ultimoEstado.titulo = '';
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}". La cola de borradores quedó vacía.`);
      }
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 3. COMANDO AYUDA / COMANDOS
    if (comando === 'comandos' || comando === 'ayuda') {
      const textoAyuda = `🤖 COMANDOS Y EDITOR DE EL REGISTRO SUR:\n\n.top (o .lista) → Muestra las 5 noticias más recientes de los 33 portales (.1 a .5)\n.redes → Muestra los 5 posteos más recientes de páginas de Instagram y Facebook (.1 a .5)\n.radar → Arma directo la noticia más importante o reciente\n.carrusel → Arma carrusel editorial de 3 placas con distintos diseños (Portada + Claves + Cierre)\n.duelo → Arma collage pantalla dividida con 2 fotos distintas\n.lupa → Agrega recuadro flotante PIP con segunda foto\n.cita / .dato → Placa de frase textual o cifra gigante (conservando logo oficial)\n.auditar → Cambia la foto buscando una nueva sin repetir\n.expandir → Expande foto horizontal con fondo desenfocado real\n.ruta3 / .clima / .resumen → Coberturas especiales\n.marca [crédito] → Estampa marca de agua en fotos de vecinos\n.historia → Formato vertical 9:16\n.editar [cambio] → Corrige textos\n.publicar → Sube a Facebook e Instagram`;
      await enviarMensajeTelegram(textoAyuda);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 4. COMANDO REDES
    if (comando === 'redes' || comando === 'ig' || comando === 'fb') {
      const candidatasRedes = await obtenerCandidatasRedesSociales();
      ultimasTopCandidatas = candidatasRedes.slice(0, 5);

      if (ultimasTopCandidatas.length === 0) {
        await enviarMensajeTelegram('🔎 No se detectaron posteos nuevos en las páginas de Instagram/Facebook monitoreadas.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }

      const listadoRedes = ultimasTopCandidatas.map((c, idx) =>
        `${idx + 1}. [${c.medio} — ⏱️ ${c.antiguedadTexto}]\n${c.titulo}`
      ).join('\n\n');

      await enviarMensajeTelegram(`📱 TOP 5 TENDENCIAS EN INSTAGRAM Y FACEBOOK:\n\n${listadoRedes}\n\n👉 Mandá .1, .2, .3, .4 o .5 para verificar y armar la placa.`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 5. COMANDO TOP / LISTA
    if (comando === 'top' || comando === 'lista') {
      const candidatas = await obtenerTodasLasCandidatasRadar();
      let ordenadas = ordenarCandidatasRelevantes(candidatas, false);
      if (ordenadas.length < 5) ordenadas = ordenarCandidatasRelevantes(candidatas, true);
      ultimasTopCandidatas = ordenadas.slice(0, 5);

      if (ultimasTopCandidatas.length === 0) {
        await enviarMensajeTelegram('🔎 No se pudieron leer los portales en este momento.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }

      const listadoTexto = ultimasTopCandidatas.map((c, idx) =>
        `${idx + 1}. [${c.medio} — ⏱️ ${c.antiguedadTexto}]\n${c.titulo}`
      ).join('\n\n');

      await enviarMensajeTelegram(`🗞️ TOP 5 NOTICIAS MÁS RECIENTES (33 PORTALES):\n\n${listadoTexto}\n\n👉 Mandá .1, .2, .3, .4 o .5 para armar el boceto de la que quieras subir.`);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 6. SELECCIÓN NUMÉRICA (.1 a .5)
    if (['1', '2', '3', '4', '5'].includes(comando)) {
      if (ultimasTopCandidatas.length === 0) {
        const candidatas = await obtenerTodasLasCandidatasRadar();
        ultimasTopCandidatas = ordenarCandidatasRelevantes(candidatas, true).slice(0, 5);
      }
      const idx = parseInt(comando, 10) - 1;
      const elegida = ultimasTopCandidatas[idx];
      if (!elegida) {
        await enviarMensajeTelegram('⚠️ Ese número no está en la lista actual. Mandá .top o .redes primero.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      const armada = await armarNoticiaDesdeCandidata(elegida, false);
      if (!armada) {
        await enviarMensajeTelegram('⚠️ La noticia elegida no pasó la verificación de datos.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `🚨 BOCETO (${armada.medio.toUpperCase()})\n⏱️ Publicado en el portal: ${armada.antiguedadTexto} — ¿QUERÉS PUBLICARLO?`);
    }

    // 7. COMANDOS DE COBERTURAS ESPECIALES (.radar, .ruta3, .resumen, .clima, .marca)
    if (comando === 'marca') {
      const fotoOrigen = nuevaFotoTelegram || ultimoEstado.foto_original_url;
      if (!fotoOrigen) throw new Error('Enviá una foto junto con .marca para estampar el logo de El Registro Sur.');

      const creditoVecino = argumento || 'MATERIAL EXCLUSIVO';
      const bufMarcada = await estamparMarcaDeAguaFoto(fotoOrigen, creditoVecino);
      const captionMarca = `REGISTRO EXCLUSIVO EN EL REGISTRO SUR 📢📍\n\nMaterial enviado a nuestra redacción (${creditoVecino}).\n\nToda la cobertura de Caleta Olivia y Santa Cruz en @elregistrosur 👇\n\n#noticias #elregistrosur #caletaolivia #santacruz #exclusivo #patagonia`;

      guardarEnColaBorradores({
        foto_url: fotoOrigen,
        foto_original_url: fotoOrigen,
        foto_secundaria_url: '',
        fotos_usadas: [fotoOrigen],
        foco_vertical: '20%',
        categoria: 'EXCLUSIVO / VECINOS',
        titulo: 'REGISTRO EXCLUSIVO DE VECINOS',
        destacar: 'REGISTRO EXCLUSIVO',
        bajada: creditoVecino,
        copy: captionMarca,
        dato_clave: '',
        autor_cita: '',
        fuente_credito: creditoVecino.toUpperCase(),
        antiguedad_texto: 'Recién enviado',
        busqueda_foto_web: '',
        busqueda_foto_secundaria: '',
        prompt_imagen_ia: '',
        fill_mode: 'contain',
        modo_visual: 'estandar',
        urgente: false,
        imagen_buffer: bufMarcada,
        historia_buffer: null,
        carrusel_buffers: []
      });

      return responderConPlacaYCopyExtenso(res, {
        ok: true,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: bufMarcada.toString('base64')
      });
    }

    if (comando === 'radar' || comando === 'comandoradar') {
      const radar = await generarDatosRadar(true);
      if (!radar) {
        await enviarMensajeTelegram('🔎 No se pudieron leer los portales en este momento. Intentá de nuevo en unos segundos.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `🚨 RADAR (${radar.medio.toUpperCase()})\n⏱️ Publicado en el portal: ${radar.antiguedadTexto} — ¿QUERÉS PUBLICARLO?`);
    }

    if (comando === 'ruta3' || comando === 'ruta') {
      const alertaVial = await ejecutarAlertaRuta3YServicios();
      if (!alertaVial) {
        await enviarMensajeTelegram('✅ Sin cortes ni alertas recientes reportadas en Ruta Nacional N° 3 o servicios de Caleta Olivia.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return responderConPlacaYCopyExtenso(res, {
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, `🚧 ALERTA RUTA 3 / SERVICIOS (⏱️ Publicado: ${alertaVial.antiguedadTexto}):`);
    }

    if (comando === 'resumen') {
      const resumen = await ejecutarResumenDiarioCarrusel();
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
        ok: true,
        categoria: 'SANTA CRUZ / RESUMEN',
        titulo: ultimoEstado.titulo,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: resumen.buffers[0].toString('base64')
      }, '📰 RESUMEN DIARIO (Placa 1/5):');
    }

    if (comando === 'clima' || comando === 'comandoclima') {
      await ejecutarParteClima();
      return responderConPlacaYCopyExtenso(res, {
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      }, '📢 PARTE METEOROLÓGICO (⏱️ Actualizado ahora):');
    }

    // 8. COMANDOS DE FORMATO Y EDICIÓN VISUAL (Auto-rescatan borrador si la memoria estaba vacía)
    const comandosDeFormato = [
      'duelo', 'lupa', 'cita', 'dato', 'carrusel', 'auditar', 'comandoauditar',
      'historia', 'comandohistoria', 'expandir', 'comandoexpandir',
      'urgente', 'comandourgente', 'normal', 'comandonormal', 'ia', 'comandoia'
    ];

    if (comandosDeFormato.includes(comando)) {
      if ((comando === 'urgente' || comando === 'comandourgente') && (argumento || nuevaFotoTelegram)) {
        // Si mandó ".urgente [texto de noticia nueva]", sigue abajo para crear la noticia urgente desde cero
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
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            fotoSecundariaUrl: ultimoEstado.foto_secundaria_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente,
            esHistoria: false,
            modoVisual: comando
          });
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, comando === 'duelo' ? '⚡ MODO DUELO 2 FOTOS APLICADO:' : '🔍 MODO LUPA PIP APLICADO:');
        }

        if (comando === 'cita' || comando === 'dato') {
          if (comando === 'dato') {
            ultimoEstado.dato_clave = argumento ? argumento.toUpperCase() : extraerDatoClaveAutomatico(ultimoEstado);
          } else {
            ultimoEstado.autor_cita = argumento ? argumento.toUpperCase() : extraerAutorCitaAutomatico(ultimoEstado);
          }

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente,
            esHistoria: false,
            modoVisual: comando
          });
          ultimoEstado.modo_visual = comando;
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, comando === 'cita' ? '💬 MODO CITA PERIODÍSTICA APLICADO:' : '📊 MODO DATO DE IMPACTO APLICADO:');
        }

        if (comando === 'carrusel') {
          const slides = await generarSlidesCarruselConIA(ultimoEstado.titulo, ultimoEstado.bajada, ultimoEstado.copy);

          // Busca una segunda foto distinta para la Placa 2/3 así el carrusel tiene variedad visual real
          let fotoSlide2 = ultimoEstado.foto_secundaria_url;
          if (!fotoSlide2) {
            const cands2 = await obtenerCandidatasFotoWeb(
              ultimoEstado.busqueda_foto_secundaria || ultimoEstado.busqueda_foto_web || ultimoEstado.titulo,
              ultimoEstado.fotos_usadas || [ultimoEstado.foto_original_url]
            );
            if (cands2[0]) {
              fotoSlide2 = cands2[0].dataUrl;
              ultimoEstado.foto_secundaria_url = fotoSlide2;
            }
          }

          const modosCarrusel = ['carrusel_portada', 'carrusel_claves', 'carrusel_cierre'];
          const fotosPorSlide = [
            ultimoEstado.foto_url,
            fotoSlide2 || ultimoEstado.foto_url,
            ultimoEstado.foto_url
          ];

          const buffers = [];
          for (let i = 0; i < 3; i++) {
            const buf = await renderizarFlyer({
              categoria: ultimoEstado.categoria,
              titulo: slides[i].titulo,
              destacar: slides[i].destacar,
              bajada: slides[i].bajada,
              fuenteCredito: ultimoEstado.fuente_credito,
              fotoFinalUrl: fotosPorSlide[i],
              focoVertical: ultimoEstado.foco_vertical,
              expandirSinCloudinary: false,
              esUrgente: ultimoEstado.urgente,
              esHistoria: false,
              modoVisual: modosCarrusel[i],
              numeroSlide: `0${i + 1} / 03`
            });
            buffers.push(buf);
          }

          ultimoEstado.imagen_buffer = buffers[0];
          ultimoEstado.carrusel_buffers = buffers;

          // Envía las placas 2/3 y 3/3 con 2.5s de espera para que lleguen a Telegram DESPUÉS de la portada 1/3
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
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: slides[0].titulo,
            destacar: slides[0].destacar,
            bajada: slides[0].bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: buffers[0].toString('base64')
          }, '📑 CARRUSEL 3X LISTO (Placa 1/3 Portada):');
        }

        if (comando === 'auditar' || comando === 'comandoauditar') {
          const { urlFinal, urlOriginal, focoVertical, fuenteAuto } = await auditarYResolverImagen({
            fotoCandidataUrl: '',
            esFotoManualDelEditor: false,
            titulo: ultimoEstado.titulo,
            bajada: ultimoEstado.bajada,
            categoria: ultimoEstado.categoria,
            busquedasSugeridas: [argumento || ultimoEstado.busqueda_foto_web || ultimoEstado.titulo, ultimoEstado.busqueda_foto_secundaria],
            promptIaSugerido: ultimoEstado.prompt_imagen_ia,
            forzarBusquedaNueva: true,
            urlsExcluidas: ultimoEstado.fotos_usadas || [ultimoEstado.foto_original_url]
          });

          const fuenteFinal = fuenteAuto || ultimoEstado.fuente_credito;
          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: fuenteFinal,
            fotoFinalUrl: urlFinal,
            focoVertical,
            expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente,
            esHistoria: false,
            modoVisual: 'estandar'
          });

          ultimoEstado.foto_url = urlFinal;
          ultimoEstado.foto_original_url = urlOriginal || urlFinal;
          ultimoEstado.fotos_usadas = [...(ultimoEstado.fotos_usadas || []), urlOriginal, urlFinal].filter(Boolean);
          ultimoEstado.foco_vertical = focoVertical;
          ultimoEstado.fuente_credito = fuenteFinal;
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🕵️ NUEVA FOTO HD APLICADA:');
        }

        if (comando === 'historia' || comando === 'comandohistoria') {
          const historiaBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: ultimoEstado.fill_mode === 'contain',
            esUrgente: ultimoEstado.urgente,
            esHistoria: true,
            modoVisual: 'estandar'
          });
          ultimoEstado.historia_buffer = historiaBuffer;
          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            es_historia: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-historia.png?t=${Date.now()}`,
            imagen_base64: historiaBuffer.toString('base64')
          }, '📱 FORMATO HISTORIA 9:16 LISTO:');
        }

        if (comando === 'expandir' || comando === 'comandoexpandir') {
          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: true,
            esUrgente: ultimoEstado.urgente,
            esHistoria: false,
            modoVisual: 'estandar'
          });

          ultimoEstado.fill_mode = 'contain';
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '↔️ FOTO EXPANDIDA CON FONDO DESENFOCADO:');
        }

        if (comando === 'urgente' || comando === 'comandourgente') {
          const nuevaCat = ultimoEstado.categoria.includes('URGENTE') ? ultimoEstado.categoria : `URGENTE / ${ultimoEstado.categoria.split('/')[0].trim()}`;
          const imageBuffer = await renderizarFlyer({
            categoria: nuevaCat,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            fotoSecundariaUrl: ultimoEstado.foto_secundaria_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: ultimoEstado.fill_mode === 'contain',
            esUrgente: true,
            esHistoria: false,
            modoVisual: ultimoEstado.modo_visual
          });
          ultimoEstado.categoria = nuevaCat;
          ultimoEstado.urgente = true;
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🚨 MODO URGENTE APLICADO:');
        }

        if (comando === 'normal' || comando === 'comandonormal') {
          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria.replace(/^URGENTE\s*\/\s*/i, ''),
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: ultimoEstado.fuente_credito,
            fotoFinalUrl: ultimoEstado.foto_url,
            focoVertical: ultimoEstado.foco_vertical,
            expandirSinCloudinary: false,
            esUrgente: false,
            esHistoria: false,
            modoVisual: 'estandar'
          });
          ultimoEstado.urgente = false;
          ultimoEstado.fill_mode = 'cover';
          ultimoEstado.modo_visual = 'estandar';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🔵 MODO ESTÁNDAR APLICADO:');
        }

        if (comando === 'ia' || comando === 'comandoia') {
          const promptFinal = argumento || ultimoEstado.prompt_imagen_ia;
          const nuevaUrlIA = construirUrlPollinationsHD(promptFinal);
          const descargadaIA = await descargarYValidarImagen(nuevaUrlIA, 9000);
          const fotoFinalIA = descargadaIA ? descargadaIA.dataUrl : nuevaUrlIA;

          const imageBuffer = await renderizarFlyer({
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            datoClave: ultimoEstado.dato_clave,
            autorCita: ultimoEstado.autor_cita,
            fuenteCredito: 'ILUSTRACIÓN',
            fotoFinalUrl: fotoFinalIA,
            focoVertical: '30%',
            expandirSinCloudinary: false,
            esUrgente: ultimoEstado.urgente,
            esHistoria: false,
            modoVisual: ultimoEstado.modo_visual
          });

          ultimoEstado.foto_url = fotoFinalIA;
          ultimoEstado.foto_original_url = nuevaUrlIA;
          ultimoEstado.fuente_credito = 'ILUSTRACIÓN';
          ultimoEstado.imagen_buffer = imageBuffer;

          return responderConPlacaYCopyExtenso(res, {
            ok: true,
            categoria: ultimoEstado.categoria,
            titulo: ultimoEstado.titulo,
            destacar: ultimoEstado.destacar,
            bajada: ultimoEstado.bajada,
            reply_markup_json: replyMarkupJson,
            url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
            imagen_base64: imageBuffer.toString('base64')
          }, '🎨 ILUSTRACIÓN IA APLICADA:');
        }
      }
    }

    // 9. PROCESAMIENTO DE NOTICIA NUEVA O EDICIÓN DE TEXTO (.editar)
    let textoParaProcesar = comando ? argumento : texto_crudo;
    const esEdicion = comando === 'editar' || comando === 'modificar' || comando === 'comandoeditar';

    if (esEdicion) {
      await asegurarBorradorActivo();
    }

    // Guardia de seguridad: si llegó un comando desconocido sin texto ni foto, nunca dibuja una placa vacía
    if (!textoParaProcesar && !nuevaFotoTelegram && !titulo) {
      await enviarMensajeTelegram('ℹ️ Comando no reconocido o sin texto. Mandá .comandos para ver la lista completa.');
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    const urlDetectada = textoParaProcesar.match(/https?:\/\/[^\s]+/i)?.[0];
    let fotoDeLink = '';
    let fuenteLink = '';

    const [extraidoLink, contextoObj] = await Promise.all([
      urlDetectada ? extraerNoticiaDeLink(urlDetectada, textoParaProcesar) : Promise.resolve({ fotoExtraida: '', fuenteDominio: '', textoExtraido: '', fechaPublicacion: '' }),
      buscarContextoEnGoogleNews(textoParaProcesar)
    ]);

    if (urlDetectada) {
      fotoDeLink = extraidoLink.fotoExtraida;
      fuenteLink = extraidoLink.fuenteDominio;
      if (extraidoLink.textoExtraido) {
        textoParaProcesar = `${textoParaProcesar}\n\n${extraidoLink.textoExtraido}`.slice(0, 2400);
      }
    }

    const antiguedadLink = calcularAntiguedadNoticia(extraidoLink.fechaPublicacion || contextoObj.fechaReciente);
    const fotoNuevaRecibida = nuevaFotoTelegram || fotoDeLink;
    const esUrgente = comando === 'urgente' || comando === 'comandourgente' || (esEdicion && ultimoEstado.urgente);

    let promptImagenIA = ultimoEstado.prompt_imagen_ia;
    let busquedasSugeridas = [];
    let busquedaSecundaria = ultimoEstado.busqueda_foto_secundaria;
    let datoClave = ultimoEstado.dato_clave;
    let autorCita = ultimoEstado.autor_cita;
    let fuenteCredito = fuenteLink || ultimoEstado.fuente_credito;

    if (textoParaProcesar.length > 0) {
      const noticiaIA = await procesarNoticiaConIA(textoParaProcesar, contextoObj.texto || 'Contexto verificado.', esEdicion);

      if (!esEdicion && noticiaIA.descartar) {
        await enviarMensajeTelegram(`ℹ️ La noticia fue descartada por el verificador (sin respaldo en fuentes confiables): ${noticiaIA.motivo_descarte || ''}`);
        return res.json({
          ok: true,
          descartado: true,
          motivo: noticiaIA.motivo_descarte || 'Sin respaldo verificable',
          imagen_base64: ''
        });
      }

      categoria = noticiaIA.categoria || ultimoEstado.categoria || 'NACIÓN / ACTUALIDAD';
      titulo = noticiaIA.titulo || ultimoEstado.titulo || '';
      destacar = noticiaIA.destacar || '';
      bajada = noticiaIA.bajada || ultimoEstado.bajada || '';
      copy = noticiaIA.copy || '';
      datoClave = noticiaIA.dato_clave || '';
      autorCita = noticiaIA.autor_cita || '';
      fuenteCredito = fuenteLink || noticiaIA.fuente_credito || 'ARCHIVO';
      promptImagenIA = noticiaIA.prompt_imagen_ia || 'journalism news photography Argentina';
      busquedaSecundaria = noticiaIA.busqueda_foto_secundaria || noticiaIA.busqueda_foto_institucional || '';
      busquedasSugeridas = [
        noticiaIA.busqueda_foto_web,
        noticiaIA.busqueda_foto_secundaria,
        noticiaIA.busqueda_foto_institucional
      ];
    }

    if (!titulo) {
      await enviarMensajeTelegram('⚠️ No se pudo extraer un titular válido del mensaje enviado.');
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    let fotoFinalParaPlaca = esEdicion ? ultimoEstado.foto_url : '';
    let fotoOriginalGuardar = esEdicion ? ultimoEstado.foto_original_url : '';
    let focoVertical = esEdicion ? (ultimoEstado.foco_vertical || '20%') : '20%';

    if (fotoNuevaRecibida || !esEdicion || !fotoFinalParaPlaca) {
      const resultadoAuditoria = await auditarYResolverImagen({
        fotoCandidataUrl: fotoNuevaRecibida || fotoOriginalGuardar,
        esFotoManualDelEditor: Boolean(nuevaFotoTelegram),
        titulo,
        bajada,
        categoria,
        busquedasSugeridas,
        promptIaSugerido: promptImagenIA
      });
      fotoFinalParaPlaca = resultadoAuditoria.urlFinal;
      fotoOriginalGuardar = resultadoAuditoria.urlOriginal || resultadoAuditoria.urlFinal;
      focoVertical = resultadoAuditoria.focoVertical || '20%';
      if (resultadoAuditoria.fuenteAuto) fuenteCredito = resultadoAuditoria.fuenteAuto;
    }

    const usarModoExpandido = fill_mode === 'contain' || (esEdicion && ultimoEstado.fill_mode === 'contain');

    const imageBuffer = await renderizarFlyer({
      categoria,
      titulo,
      destacar,
      bajada,
      datoClave,
      autorCita,
      fuenteCredito,
      fotoFinalUrl: fotoFinalParaPlaca,
      focoVertical,
      expandirSinCloudinary: usarModoExpandido,
      esUrgente,
      esHistoria: false,
      modoVisual: 'estandar'
    });

    const textoAntiguedadFinal = esEdicion ? (ultimoEstado.antiguedad_texto || 'Borrador editado') : antiguedadLink.texto;

    const nuevoEstado = {
      foto_url: fotoFinalParaPlaca,
      foto_original_url: fotoOriginalGuardar,
      foto_secundaria_url: '',
      fotos_usadas: [fotoOriginalGuardar, fotoFinalParaPlaca].filter(Boolean),
      foco_vertical: focoVertical,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      dato_clave: datoClave,
      autor_cita: autorCita,
      fuente_credito: fuenteCredito,
      antiguedad_texto: textoAntiguedadFinal,
      busqueda_foto_web: busquedasSugeridas[0] || titulo,
      busqueda_foto_secundaria: busquedaSecundaria,
      prompt_imagen_ia: promptImagenIA,
      fill_mode: usarModoExpandido ? 'contain' : 'cover',
      modo_visual: 'estandar',
      urgente: esUrgente,
      imagen_buffer: imageBuffer,
      historia_buffer: null,
      carrusel_buffers: []
    };

    if (esEdicion) {
      ultimoEstado = nuevoEstado;
      persistirEstadoEnDisco(ultimoEstado);
    } else {
      guardarEnColaBorradores(nuevoEstado);
    }

    const prefijoBoceto = urlDetectada || !esEdicion
      ? `📋 BOCETO LISTO (${fuenteCredito})\n⏱️ Publicado en origen: ${textoAntiguedadFinal}`
      : '✏️ BOCETO EDITADO';

    return responderConPlacaYCopyExtenso(res, {
      ok: true,
      es_edicion: esEdicion,
      categoria,
      titulo,
      destacar,
      bajada,
      reply_markup_json: replyMarkupJson,
      url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
      imagen_base64: imageBuffer.toString('base64')
    }, prefijoBoceto);
  } catch (err) {
    console.error('Error en /generar:', err.message);
    await enviarMensajeTelegram(`⚠️ Aviso del servidor al procesar el pedido: ${err.message}`);
    return res.status(200).json({ ok: false, descartado: true, error: err.message, imagen_base64: '' });
  }
});

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

app.get('/ultimo-borrador', (req, res) => {
  if (!ultimoEstado.imagen_buffer) return res.status(404).json({ error: 'Sin borrador en memoria.' });
  res.json({
    ok: true,
    categoria: ultimoEstado.categoria,
    titulo: ultimoEstado.titulo,
    bajada: ultimoEstado.bajada,
    copy: ultimoEstado.copy,
    url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
    imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`El Registro Sur 2K + Carrusel Editorial Agencia listo en puerto ${PORT}`));
