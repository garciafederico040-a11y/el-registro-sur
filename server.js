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

const MEDIOS_REGIONALES = [
  'laopinionaustral.com.ar',
  'tiemposur.com.ar',
  'adnsur.com.ar',
  'elpatagonico.com',
  'lagacetadesantacruz.com.ar',
  'ecosdelsur.com',
  'noticias.santacruz.gob.ar',
  'infocaleta.com'
];

const MEDIOS_NACIONALES = [
  'infobae.com',
  'lanacion.com.ar',
  'clarin.com',
  'tn.com.ar',
  'pagina12.com.ar',
  'iprofesional.com',
  'eleconomista.com.ar',
  'tycsports.com'
];

const MEDIOS_ESPECTACULOS = [
  'primiciasya.com',
  'ciudad.com.ar',
  'pronto.com.ar',
  'paparazzi.com.ar',
  'exitoina.perfil.com'
];

let ultimoEstado = {
  foto_url: '',
  foto_original_url: '',
  categoria: '',
  titulo: '',
  destacar: '',
  bajada: '',
  copy: '',
  dato_clave: '',
  autor_cita: '',
  fuente_credito: 'ARCHIVO',
  prompt_imagen_ia: 'journalism news photography Argentina Patagonia',
  fill_mode: 'cover',
  modo_visual: 'estandar',
  urgente: false,
  imagen_buffer: null,
  historia_buffer: null,
  carrusel_buffers: []
};

const colaBorradores = [];

function guardarEnColaBorradores(nuevoEstado) {
  if (ultimoEstado && ultimoEstado.imagen_buffer && ultimoEstado.titulo) {
    colaBorradores.unshift({ ...ultimoEstado });
    if (colaBorradores.length > 5) colaBorradores.pop();
  }
  ultimoEstado = nuevoEstado;
}

const noticiasEnviadasRadar = new Set();
let ultimoClimaDiaEnviado = '';
let ultimoResumenDiaEnviado = '';

app.get('/ping', (req, res) => res.status(200).send('OK - El Registro Sur 2K + Radar 21 Medios activo'));

// Lista blanca de emojis Unicode 6.0-11.0 100% compatibles con Facebook Web y Windows (sin U+FE0F ni banderas)
const EMOJIS_SEGUROS_META = new Set([
  '🚨', '🔴', '🟠', '🟡', '🚧', '🚔', '🚒', '🚑', '🛑',
  '💨', '🌀', '🌊', '💧', '☔', '⛄', '⛅', '⚡', '🔥', '🌈',
  '💰', '💵', '📈', '📉', '📊', '⛽', '🏭', '🚜', '🚛', '🚢', '🐟',
  '📢', '📣', '📰', '📋', '📄', '📜', '🏥', '🏫', '🎓', '👷', '🤝', '📍', '📅', '🕒',
  '⚽', '🏆', '🏅', '🎭', '🎶',
  '👇', '👉', '📲', '💬', '✅', '❌'
]);

function limpiarEmojis(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\b(fortes)\b/gi, 'fuertes')
    .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:)\s*/gim, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function filtrarEmojisSegurosRedes(texto) {
  if (!texto) return '';
  let limpio = String(texto)
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '');

  limpio = limpio.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, (match) => {
    return EMOJIS_SEGUROS_META.has(match) ? match : '';
  });

  return limpio
    .replace(/\b(fortes)\b/gi, (m) => (m === m.toUpperCase() ? 'FUERTES' : 'fuertes'))
    .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:|\bTitular\s*:|\bCierre\s*:)\s*/gim, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}

// Llamada única a openai/gpt-oss-120b con espera inteligente ante límite 429
async function llamarGroqChat(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta configurar GROQ_API_KEY en Render.');

  for (let intento = 1; intento <= 3; intento++) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(14000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages
      })
    });

    if (resp.status === 429 && intento < 3) {
      const retryHeader = parseInt(resp.headers.get('retry-after') || '0', 10);
      const esperaMs = retryHeader > 0 ? Math.min(retryHeader * 1000, 5000) : intento * 2500;
      console.warn(`Cupo Groq 429 alcanzado. Esperando ${esperaMs}ms (intento ${intento}/3)...`);
      await new Promise(r => setTimeout(r, esperaMs));
      continue;
    }

    if (!resp.ok) {
      throw new Error(`Error de Groq (${resp.status}): ${await resp.text()}`);
    }

    const data = await resp.json();
    const rawContent = data?.choices?.[0]?.message?.content || '{}';
    const jsonLimpio = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(jsonLimpio);
  }
}

function generarTecladoTactil() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Publicar IG/FB', callback_data: '.publicar' },
        { text: '❌ Descartar', callback_data: '.descartar' }
      ],
      [
        { text: '📱 Historia 9:16', callback_data: '.historia' },
        { text: '📑 Carrusel 3x', callback_data: '.carrusel' }
      ],
      [
        { text: '🚨 Urgente', callback_data: '.urgente' },
        { text: '🔵 Normal', callback_data: '.normal' },
        { text: '↔️ Expandir', callback_data: '.expandir' }
      ],
      [
        { text: '💬 Cita', callback_data: '.cita' },
        { text: '📊 Dato', callback_data: '.dato' },
        { text: '🕵️ Auditar Foto', callback_data: '.auditar' }
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
      body: JSON.stringify({
        callback_query_id: callbackQueryId.trim(),
        text: textoAviso
      })
    });
  } catch (e) {}
}

async function enviarMensajeTelegram(texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: EDITOR_CHAT_ID, text: texto })
    });
  } catch (e) {}
}

async function resolverArchivoTelegram(valorRecibido) {
  if (!valorRecibido || !valorRecibido.trim()) return { url: '', path: '' };
  const limpio = valorRecibido.trim();
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) {
    return { url: limpio, path: limpio };
  }
  if (limpio.includes('/')) {
    return {
      url: `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${limpio}`,
      path: limpio
    };
  }
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${limpio}`);
  const data = await resp.json();
  if (data.ok && data.result && data.result.file_path) {
    return {
      url: `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`,
      path: data.result.file_path
    };
  }
  return { url: '', path: '' };
}

async function transcribirAudioConGroq(audioUrl) {
  const apiKey = process.env.GROQ_API_KEY;
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

  if (!resp.ok) {
    throw new Error(`Error transcribiendo audio (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.text || '';
}

async function extraerNoticiaDeLink(url) {
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await resp.text();

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                         html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<title>([^<]+)<\/title>/i);

    const parrafos = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 60)
      .slice(0, 8)
      .join('\n');

    let fotoUrl = ogImageMatch ? ogImageMatch[1] : '';
    if (fotoUrl && fotoUrl.startsWith('/')) {
      const origin = new URL(url).origin;
      fotoUrl = `${origin}${fotoUrl}`;
    }

    const dominio = new URL(url).hostname.replace('www.', '').split('.')[0].toUpperCase();

    return {
      fotoExtraida: fotoUrl,
      fuenteDominio: dominio,
      textoExtraido: `TÍTULO ORIGINAL: ${ogTitleMatch ? ogTitleMatch[1] : ''}\nCUERPO: ${parrafos}`
    };
  } catch (e) {
    return { fotoExtraida: '', fuenteDominio: '', textoExtraido: '' };
  }
}

async function buscarContextoEnGoogleNews(consulta) {
  try {
    const queryLimpia = consulta.replace(/https?:\/\/\S+/g, '').replace(/^\.[a-zA-Z]+\s*/i, '').trim().split(/\s+/).slice(0, 8).join(' ');
    if (queryLimpia.length < 5) return '';

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryLimpia)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const xml = await resp.text();

    const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi)]
      .slice(0, 5)
      .map(m => `- ${m[1].replace(/<!\[CDATA\[|\]\]>/g, '')} (${m[2]})`)
      .join('\n');

    return items ? `\nFUENTES Y ANTECEDENTES EN MEDIOS DE ARGENTINA:\n${items}` : '';
  } catch (e) {
    return '';
  }
}

// ============================================================================
// MONITOR DE LOS 21 PORTALES + CURADOR RÁPIDO SIN GASTAR CUPO DE GROQ
// ============================================================================

async function consultarRssGooglePorSitios(dominios, ventanaTiempo = '4h', categoriaOrigen = 'general') {
  try {
    const filtroSitios = dominios.map(d => `site:${d}`).join(' OR ');
    const query = `(${filtroSitios}) when:${ventanaTiempo}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6500) });
    const xml = await resp.text();

    return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<\/item>/gi)]
      .map(m => ({
        titulo: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        link: m[2].trim(),
        medio: m[3].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        categoriaOrigen
      }));
  } catch (e) {
    return [];
  }
}

function seleccionarNoticiaRelevante(candidatas) {
  if (!candidatas || candidatas.length === 0) return null;

  const regexDescartar = /hor[óo]scopo|quiniela|loter[íi]a|crucigrama|efem[ée]rides|receta|tarot|predicciones/i;
  const regexPrioridadMaxima = /caleta olivia|santa cruz|claudio vidal|ruta 3|ruta nacional 3|ram[óo]n santos|zona norte|pico truncado|las heras|r[íi]o gallegos|ypf|petr[óo]leo|servicios p[úu]blicos|distrigas|acueducto/i;
  const regexImpactoNacional = /milei|d[óo]lar|inflaci[óo]n|anses|jubilados|combustible|nafta|sueldo|paro|corte|tarifa|impuesto|banco central|selecci[óo]n argentina|boca|river|messi|colapinto/i;
  const regexBombasEspectaculos = /wanda|icardi|china su[áa]rez|tinelli|susana|mirtha|gran hermano|lam|esc[áa]ndalo|separaci[óo]n|denuncia|luck ra|tiago pzk|la joaqui|duki|mar[íi]a becerra|l-gante|occhiato|granados/i;

  const puntuadas = candidatas
    .filter(c => !regexDescartar.test(c.titulo))
    .map(c => {
      let puntos = 0;
      if (regexPrioridadMaxima.test(c.titulo)) puntos += 50;
      if (c.categoriaOrigen === 'regional') puntos += 25;
      if (regexImpactoNacional.test(c.titulo)) puntos += 30;
      if (c.categoriaOrigen === 'espectaculos') {
        puntos += regexBombasEspectaculos.test(c.titulo) ? 28 : -20;
      }
      return { ...c, puntos };
    })
    .filter(c => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  return puntuadas[0] || candidatas[0];
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
    texto: `PARTE METEOROLÓGICO OFICIAL PARA CALETA OLIVIA HOY: Temperatura actual ${tempActual}°C (Mínima ${minHoy}°C / Máxima ${maxHoy}°C). Viento sostenido de ${vientoActual} km/h con ráfagas máximas previstas de hasta ${rafagasHoy} km/h en la ciudad y Ruta Nacional N° 3.`,
    rafagasHoy
  };
}

function optimizarFotoConCloudinary(fotoUrl, expandir = false, alto = 1080) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !fotoUrl || fotoUrl.includes('res.cloudinary.com')) return fotoUrl;

  const hFinal = alto === 1920 ? 2560 : 1440;
  if (expandir) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/c_pad,w_1440,h_${hFinal},b_gen_fill,e_improve,e_sharpen:80,f_png,q_100/${encodeURIComponent(fotoUrl)}`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/fetch/c_fill,g_auto:faces,w_1440,h_${hFinal},e_improve,e_sharpen:80,f_png,q_100/${encodeURIComponent(fotoUrl)}`;
}

function construirUrlPollinationsHD(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=1280&model=turbo&nologo=true&seed=${seed}`;
}

async function descargarYValidarImagen(url) {
  if (!url || !url.startsWith('http')) return null;
  if (/logo|favicon|avatar|placeholder|default|icon|sprite|blank|1x1|banner-site/i.test(url)) {
    return null;
  }
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 18000 || buffer.length > 8 * 1024 * 1024) return null;

    return { url, bytes: buffer.length };
  } catch (e) {
    return null;
  }
}

async function buscarFotoRealEnWeb(consulta) {
  if (!consulta || consulta.trim().length < 3) return '';
  try {
    const initResp = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(consulta)}&iax=images&ia=images`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const initHtml = await initResp.text();
    const vqdMatch = initHtml.match(/vqd=["']([^"']+)["']/i) || initHtml.match(/vqd=([0-9-]+)/i);

    if (vqdMatch) {
      const jsonUrl = `https://duckduckgo.com/i.js?l=ar-es&o=json&q=${encodeURIComponent(consulta)}&vqd=${vqdMatch[1]}&f=,,,,,&p=1`;
      const imgResp = await fetch(jsonUrl, {
        signal: AbortSignal.timeout(4000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://duckduckgo.com/'
        }
      });
      const imgData = await imgResp.json();
      const candidatas = (imgData.results || [])
        .filter(r => (r.width || 0) >= 750 && (r.height || 0) >= 500)
        .slice(0, 3);

      const resultados = await Promise.all(candidatas.map(c => descargarYValidarImagen(c.image)));
      const primeraValida = resultados.find(Boolean);
      if (primeraValida) return primeraValida.url;
    }
  } catch (e) {}
  return '';
}

async function auditarYResolverImagen({
  fotoCandidataUrl,
  esFotoManualDelEditor,
  titulo,
  busquedaWebSugerida,
  promptIaSugerido,
  forzarBusquedaNueva = false
}) {
  if (fotoCandidataUrl && esFotoManualDelEditor && !forzarBusquedaNueva) {
    return { urlFinal: fotoCandidataUrl, fuenteAuto: 'GENTILEZA / ARCHIVO' };
  }

  if (fotoCandidataUrl && !forzarBusquedaNueva) {
    const validada = await descargarYValidarImagen(fotoCandidataUrl);
    if (validada) {
      return { urlFinal: fotoCandidataUrl, fuenteAuto: '' };
    }
  }

  const queryWeb = busquedaWebSugerida || titulo;
  const fotoWebEncontrada = await buscarFotoRealEnWeb(queryWeb);
  if (fotoWebEncontrada && fotoWebEncontrada !== fotoCandidataUrl) {
    return { urlFinal: fotoWebEncontrada, fuenteAuto: 'ARCHIVO / PRENSA' };
  }

  const fotoIA = construirUrlPollinationsHD(promptIaSugerido || 'Argentina Patagonia journalism news photography');
  return { urlFinal: fotoIA, fuenteAuto: 'ILUSTRACIÓN IA' };
}

// ============================================================================
// CEREBRO EDITORIAL EN CASTELLANO PURO (1 SOLA LLAMADA A GROQ POR NOTICIA)
// ============================================================================

async function procesarNoticiaConIA(textoCrudo, contextoWeb = '', esEdicion = false) {
  const antecedentesExtra = contextoWeb
    ? ''
    : await buscarContextoEnGoogleNews(`${textoCrudo} antecedentes obras montos`);

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur), medio periodístico digital de Caleta Olivia, Santa Cruz ("El sur tiene registro").
IDIOMA OBLIGATORIO: Redactá ABSOLUTAMENTE TODO EN CASTELLANO DE ARGENTINA PERFECTO Y NATURAL. Prohibido usar palabras en portugués, gallego o inglés (jamás escribas "fortes", escribí "fuertes").

PERSONALIDAD Y VOZ DE REDACCIÓN ("CON CARÁCTER Y CALLE, CERO HUMO"):
1. NUNCA SUENES VACÍO NI BUROCRÁTICO: Prohibido escribir como un parte policial muerto o una gacetilla oficial. Nunca arranques con "En el día de la fecha...", "Se llevó a cabo..." o "Cabe destacar...". Arrancá directo con el hecho que impacta en la calle, el bolsillo, la producción o el debate público, usando verbos de acción, ritmo ágil y autoridad periodística.
2. VECINO Y PRODUCCIÓN — CERO CHUPAMEDIAS (1B): Mostrá con cifras, presupuestos y hechos concretos lo que impulsa el empleo, la energía, la obra pública y el orden fiscal en Santa Cruz (Claudio Vidal) y Nación (Javier Milei). Señalá con la misma firmeza y datos duros cuando falla un servicio o un aumento golpea al vecino de Caleta Olivia. Prohibido usar adjetivos elogiosos hacia políticos o gestiones ("histórica gestión", "brillante decisión", "gran logro", "enorme esfuerzo").
3. CERO CUENTA CUENTOS EN CONFLICTOS (3): En cortes de Ruta Nacional N° 3, paros, falta de agua o reclamos locales, nada de épica ni dramatización literaria. Conectá causa y efecto con datos precisos: qué pasa, dónde exactamente, horarios, responsables, antecedentes previos y qué consecuencia real tiene para el vecino o la actividad.
4. ENRIQUECIMIENTO CON ANTECEDENTES (4A): Cruzá el dato nuevo con el contexto previo confirmado (demoras anteriores, licitaciones previas, cifras comparativas de Zona Norte) para que cada párrafo aporte valor real y no relleno.
5. ESPECTÁCULOS / CHISMES VIRALES: Si la noticia es de farándula o espectáculos de alto impacto, redactala directa al hueso con los protagonistas, el cruce o primicia confirmada, sin insultos ni difamaciones (100% apto para Meta) y cerrá con pregunta de debate (¿Vos qué opinás? 👇).
6. VALIDACIÓN Y DESCARTE SILENCIOSO (2B): Contrastá los datos redactados contra las fuentes web recibidas. Si la noticia central no tiene sustento verificable o contradice los hechos (y no es una edición manual del director), devolvé "descartar": true. Eliminá cualquier dato secundario no confirmado.

REGLAS ESTRICTAS DE DISEÑO Y EMOJIS COMPATIBLES CON FACEBOOK:
- PROHIBIDO poner emojis o banderas en "categoria", "titulo", "destacar" o "bajada".
- PROHIBIDO usar banderas (🇦🇷, 🇺🇸, etc.) en cualquier parte.
- PROHIBIDO poner números de lista o etiquetas ("1)", "2)", "Línea 1:", "Titular:") dentro de "copy".
- EN "copy" (DESCRIPCIÓN PARA REDES): Usá 2 emojis en el encabezado en mayúsculas y 👇 en el cierre, eligiendo ÚNICAMENTE de esta lista compatible con Facebook Web y Windows (PROHIBIDO usar símbolos como ❄️, ⚠️, 🌡️, ☀️ que salen como cuadraditos):
  🚨 🔴 🟠 🟡 🚧 🚔 🚒 🚑 🛑 💨 🌀 🌊 💧 ☔ ⛄ ⛅ ⚡ 🔥 💰 💵 📈 📉 📊 ⛽ 🏭 🚜 🚛 🚢 🐟 📢 📣 📰 📋 📄 📜 🏥 🏫 🎓 👷 🤝 📍 📅 🕒 ⚽ 🏆 🏅 🎭 🎶 👇 👉 📲 💬 ✅ ❌
- EVITAR "FORMA DE PISTOLITA" Y PALABRAS SUELTAS: Redactá "titulo" (4 a 7 palabras) y "bajada" (10 a 13 palabras) con longitud equilibrada para que formen bloques parejos en 2 líneas y jamás quede una sola palabra, número o letra colgada abajo.

REGLAS DE FORMATO (TEXTO 100% PLANO PARA META, EN CASTELLANO):
Devolvé ÚNICAMENTE un JSON válido:
{
  "descartar": false,
  "motivo_descarte": "",
  "categoria": "SECCIÓN / SUBTEMA en MAYÚSCULAS SIN EMOJIS (ej. SANTA CRUZ / ENERGÍA, CALETA OLIVIA / SERVICIOS, ESPECTÁCULOS / VIRAL)",
  "titulo": "Titular en MAYÚSCULAS en castellano, seco y con gancho, SIN EMOJIS (4 a 7 palabras máximo)",
  "destacar": "Subcadena EXACTA dentro de 'titulo' SIN EMOJIS (2 a 4 palabras clave)",
  "bajada": "1 sola oración contundente en castellano SIN EMOJIS con el dato clave (10 a 13 palabras, sin palabra suelta final)",
  "dato_clave": "Cifra o porcentaje central si existe, o vacío",
  "autor_cita": "Nombre y cargo si hay declaración textual, o vacío",
  "fuente_credito": "Crédito breve en MAYÚSCULAS (ej. PRENSA PROVINCIAL, VIALIDAD, ARCHIVO)",
  "copy": "Texto 100% plano en castellano (SIN viñetas, SIN guiones de lista, SIN asteriscos, SIN números como 1) ni etiquetas), separando cada bloque con doble salto de línea (\\n\\n): primero el TITULAR EN MAYÚSCULAS acompañado por 2 emojis seguros de la lista; luego 2 a 3 párrafos periodísticos con datos verificados, antecedentes y consecuencia real; luego el cierre dinámico invitando a seguir @elregistrosur con pregunta de debate o llamado a compartir terminado en 👇; luego una línea con ---; y finalmente 6 a 8 hashtags en minúsculas incluyendo #noticias #elregistrosur #caletaolivia #santacruz.",
  "slides_carrusel": [
    { "titulo": "TITULAR PORTADA SIN EMOJIS", "destacar": "PALABRA CLAVE", "bajada": "Síntesis gancho para deslizar" },
    { "titulo": "EL ANTECEDENTE Y LOS DATOS", "destacar": "LOS DATOS", "bajada": "Contexto concreto y cifras en 14 palabras máximo" },
    { "titulo": "QUÉ CAMBIA EN LA REGIÓN", "destacar": "LA REGIÓN", "bajada": "Consecuencia directa en Caleta Olivia o Santa Cruz" }
  ],
  "busqueda_foto_web": "3 a 5 palabras clave en castellano para foto real de prensa",
  "prompt_imagen_ia": "Photorealistic editorial news photography prompt in English (18 words, no text)"
}`;

  const userMessage = esEdicion
    ? `Borrador actual:\n${JSON.stringify({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy
      }, null, 2)}\n\nCambio pedido por el director: "${textoCrudo}".\n${contextoWeb}\nDevolvé el JSON actualizado en castellano con "descartar": false, sin emojis ni banderas en titulo ni bajada y sin números como 1) en copy.`
    : `Noticia recibida:\n"${textoCrudo}"\n${contextoWeb}\n${antecedentesExtra}\nRedactá estrictamente en castellano de Argentina con carácter periodístico, enriquecé con antecedentes y validá los datos en JSON.`;

  const parsed = await llamarGroqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]);

  parsed.categoria = limpiarEmojis(parsed.categoria);
  parsed.titulo = limpiarEmojis(parsed.titulo);
  parsed.destacar = limpiarEmojis(parsed.destacar);
  parsed.bajada = limpiarEmojis(parsed.bajada);
  parsed.copy = filtrarEmojisSegurosRedes(parsed.copy);

  if (Array.isArray(parsed.slides_carrusel)) {
    parsed.slides_carrusel = parsed.slides_carrusel.map(s => ({
      titulo: limpiarEmojis(s.titulo),
      destacar: limpiarEmojis(s.destacar),
      bajada: limpiarEmojis(s.bajada)
    }));
  }

  return parsed;
}

// ============================================================================
// MOTOR GRÁFICO 2K RETINA + EQUILIBRIO TIPOGRÁFICO + MARCA DE AGUA
// ============================================================================

async function estamparMarcaDeAguaFoto(fotoUrl, textoCredito = 'EXCLUSIVO') {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

    const creditoLimpio = limpiarEmojis(textoCredito || 'EXCLUSIVO').toUpperCase();

    const htmlMarca = `<!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 1080px; height: 1080px; overflow: hidden; background: #050d1a; font-family: Arial, sans-serif; }
        #wrap { position: relative; width: 1080px; height: 1080px; }
        #bg-blur { position: absolute; inset: -30px; width: 1140px; height: 1140px; object-fit: cover; filter: blur(26px) brightness(0.45); }
        #main-img { position: relative; z-index: 2; width: 1080px; height: 1080px; object-fit: contain; }
        #watermark-center {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg);
          z-index: 10; pointer-events: none;
          color: rgba(255, 255, 255, 0.22); font-size: 54px; font-weight: 900; letter-spacing: 5px;
          text-transform: uppercase; white-space: nowrap;
          text-shadow: 0 2px 12px rgba(0,0,0,0.35);
        }
        #badge-bottom {
          position: absolute; bottom: 32px; right: 32px; z-index: 12;
          background: rgba(6, 15, 28, 0.84); backdrop-filter: blur(8px);
          border: 1.5px solid rgba(56, 189, 248, 0.65); border-radius: 10px;
          padding: 12px 22px; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
        }
        #brand { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; }
        #sub { color: #38bdf8; font-size: 13px; font-weight: 700; letter-spacing: 1.2px; }
      </style>
    </head>
    <body>
      <div id="wrap">
        <img id="bg-blur" src="${fotoUrl}" />
        <img id="main-img" src="${fotoUrl}" />
        <div id="watermark-center">EL REGISTRO SUR</div>
        <div id="badge-bottom">
          <span id="brand">EL REGISTRO SUR</span>
          <span id="sub">${creditoLimpio} • @ELREGISTROSUR</span>
        </div>
      </div>
    </body>
    </html>`;

    await page.setContent(htmlMarca, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.race([
        Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; }))),
        new Promise(res => setTimeout(res, 7500))
      ]);
    });
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
  expandirSinCloudinary,
  esUrgente,
  esHistoria = false,
  modoVisual = 'estandar',
  numeroSlide = ''
}) {
  const alto = esHistoria ? 1920 : 1080;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: alto, deviceScaleFactor: 2 });

    const catLimpia = limpiarEmojis(categoria);
    const titLimpio = limpiarEmojis(titulo);
    const desLimpio = limpiarEmojis(destacar);
    const bajLimpia = limpiarEmojis(bajada);

    let htmlModificado = templateHtml
      .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', () => titLimpio.replace(/"/g, '&quot;'))
      .replace('VENTA DE TIERRAS A EXTRANJEROS', () => desLimpio.replace(/"/g, '&quot;'))
      .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', () => bajLimpia.replace(/"/g, '&quot;'))
      .replace('POLÍTICA', () => catLimpia.replace(/"/g, '&quot;'));

    if (fotoFinalUrl) {
      htmlModificado = htmlModificado.replace(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g, () => fotoFinalUrl);
    }

    await page.setContent(htmlModificado, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Espera inteligente de imágenes y fuentes con tope de 8s para no exceder nunca el timeout de Make
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]);
      }
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.race([
        Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; }))),
        new Promise(res => setTimeout(res, 7500))
      ]);
    });

    await page.evaluate(({
      url,
      expandir,
      modoUrgente,
      modoHistoria,
      modoVisual,
      categoria,
      titulo,
      destacar,
      bajada,
      datoClave,
      autorCita,
      fuenteCredito,
      numeroSlide
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

      function blindarTipografiaProlija(el) {
        if (!el) return;
        el.style.textWrap = 'balance';

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

        for (let intento = 0; intento < 7; intento++) {
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

          if (anchoUltima >= anchoPrimera * 0.42) break;

          const wActual = el.getBoundingClientRect().width;
          el.style.maxWidth = `${Math.max(380, wActual - 45)}px`;
        }
      }

      let fotoPrincipal = null;
      const imgs = canvas.querySelectorAll('img');
      imgs.forEach(img => {
        img.style.imageRendering = '-webkit-optimize-contrast';
        if (img.src.includes('unsplash') || img.id.includes('bg') || img.className.includes('bg') || img.width > 400) {
          if (url) img.src = url;
          fotoPrincipal = img;
          if (expandir && url) {
            img.style.objectFit = 'contain';
            img.parentElement.style.backgroundImage = `url("${url}")`;
            img.parentElement.style.backgroundSize = 'cover';
            img.parentElement.style.backgroundPosition = 'center';
            img.parentElement.style.backdropFilter = 'blur(28px)';
          }
        }
      });

      let esFotoClara = false;
      if (fotoPrincipal && fotoPrincipal.complete && fotoPrincipal.naturalWidth > 0) {
        try {
          const c = document.createElement('canvas');
          c.width = 40;
          c.height = 40;
          const ctx = c.getContext('2d');
          ctx.drawImage(fotoPrincipal, 0, 0, 40, 40);
          const data = ctx.getImageData(0, 20, 40, 20).data;
          let suma = 0;
          for (let i = 0; i < data.length; i += 4) {
            suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          esFotoClara = (suma / (data.length / 4)) > 125;
        } catch (e) {}
      }

      if (esFotoClara && modoVisual === 'estandar') {
        const refuerzo = document.createElement('div');
        refuerzo.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:linear-gradient(to top, rgba(4,10,20,0.97) 0%, rgba(4,10,20,0.84) 46%, rgba(4,10,20,0.12) 100%);';
        canvas.appendChild(refuerzo);
      }

      if (fuenteCredito) {
        const badgeFuente = document.createElement('div');
        badgeFuente.textContent = `FUENTE: ${fuenteCredito.toUpperCase()}`;
        badgeFuente.style.cssText = 'position:absolute;top:34px;right:38px;z-index:30;background:rgba(6,14,26,0.72);backdrop-filter:blur(8px);color:rgba(255,255,255,0.85);font-family:sans-serif;font-size:15px;font-weight:700;letter-spacing:1.2px;padding:7px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.16);';
        canvas.appendChild(badgeFuente);
      }

      if (numeroSlide) {
        const badgeSlide = document.createElement('div');
        badgeSlide.textContent = numeroSlide;
        badgeSlide.style.cssText = `position:absolute;top:34px;left:38px;z-index:30;background:${accentColor};color:#050d1a;font-family:sans-serif;font-size:18px;font-weight:900;padding:7px 16px;border-radius:999px;`;
        canvas.appendChild(badgeSlide);
      }

      if (modoVisual === 'cita' || modoVisual === 'dato') {
        const tituloFormateado = destacar && titulo.includes(destacar)
          ? titulo.replace(destacar, `<span style="color:${accentColor}">${destacar}</span>`)
          : titulo;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;z-index:20;background:linear-gradient(160deg, rgba(6,15,28,0.94) 0%, rgba(9,22,42,0.97) 100%);display:flex;flex-direction:column;justify-content:space-between;padding:72px 72px 145px 72px;box-sizing:border-box;font-family:sans-serif;';

        if (modoVisual === 'cita') {
          overlay.innerHTML = `
            <div>
              <span style="display:inline-block;background:${accentColor};color:#050d1a;font-weight:900;font-size:18px;letter-spacing:1.5px;padding:8px 18px;border-radius:6px;text-transform:uppercase;">${categoria}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:26px;">
              <div style="display:flex;align-items:center;gap:26px;">
                ${url ? `<img src="${url}" style="width:140px;height:140px;border-radius:50%;object-fit:cover;border:4px solid ${accentColor};box-shadow:0 12px 30px rgba(0,0,0,0.45);" />` : ''}
                <div>
                  <div style="color:${accentColor};font-size:74px;line-height:0.6;font-weight:900;">“</div>
                  <div style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-top:8px;">${autorCita || 'DECLARACIÓN DESTACADA'}</div>
                </div>
              </div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:46px;font-weight:900;line-height:1.14;letter-spacing:-0.5px;">${tituloFormateado}</div>
              <div class="texto-equilibrado" style="color:rgba(255,255,255,0.82);font-size:25px;line-height:1.38;font-weight:400;border-left:4px solid ${accentColor};padding-left:20px;">${bajada}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:22px;">
              <span style="color:#ffffff;font-weight:900;font-size:22px;letter-spacing:1.5px;">EL REGISTRO SUR</span>
              <span style="color:${accentColor};font-weight:700;font-size:19px;">@elregistrosur</span>
            </div>
          `;
        } else {
          overlay.innerHTML = `
            <div>
              <span style="display:inline-block;background:${accentColor};color:#050d1a;font-weight:900;font-size:18px;letter-spacing:1.5px;padding:8px 18px;border-radius:6px;text-transform:uppercase;">${categoria}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:22px;text-align:left;">
              <div style="color:${accentColor};font-size:122px;font-weight:900;line-height:0.95;letter-spacing:-2px;text-shadow:0 10px 35px rgba(0,0,0,0.5);">${datoClave || 'DATO CLAVE'}</div>
              <div class="texto-equilibrado" style="color:#ffffff;font-size:48px;font-weight:900;line-height:1.12;">${tituloFormateado}</div>
              <div class="texto-equilibrado" style="color:rgba(255,255,255,0.84);font-size:26px;line-height:1.38;">${bajada}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:22px;">
              <span style="color:#ffffff;font-weight:900;font-size:22px;letter-spacing:1.5px;">EL REGISTRO SUR</span>
              <span style="color:${accentColor};font-weight:700;font-size:19px;">@elregistrosur</span>
            </div>
          `;
        }
        canvas.appendChild(overlay);
        overlay.querySelectorAll('.texto-equilibrado').forEach(blindarTipografiaProlija);
        return;
      }

      if (modoUrgente) {
        canvas.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.color === 'rgb(56, 189, 248)' || style.color === 'rgb(0, 174, 239)') el.style.color = '#ef4444';
          if (style.backgroundColor === 'rgb(56, 189, 248)' || style.backgroundColor === 'rgb(0, 174, 239)') el.style.backgroundColor = '#ef4444';
        });
      }

      const bloquesTexto = canvas.querySelectorAll('h1, h2, h3, p, .titulo, .bajada, [class*="title"], [class*="sub"]');
      bloquesTexto.forEach(el => {
        if (el.innerText && el.innerText.trim().length > 6) {
          blindarTipografiaProlija(el);
        }
      });

      const titulares = canvas.querySelectorAll('h1, h2, h3, .titulo, [class*="title"]');
      titulares.forEach(el => {
        let fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        const limiteInferior = altoCanvas - 145;
        while (el.getBoundingClientRect().bottom > limiteInferior && fontSize > 26) {
          fontSize -= 2;
          el.style.fontSize = `${fontSize}px`;
          el.style.lineHeight = '1.12';
        }
      });
    }, {
      url: fotoFinalUrl,
      expandir: expandirSinCloudinary,
      modoUrgente: esUrgente,
      modoHistoria: esHistoria,
      modoVisual,
      categoria: catLimpia,
      titulo: titLimpio,
      destacar: desLimpio,
      bajada: bajLimpia,
      datoClave,
      autorCita,
      fuenteCredito,
      numeroSlide
    });

    await new Promise(r => setTimeout(r, 350));
    const canvasElement = await page.$('#canvas');
    return await canvasElement.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

async function enviarFotoConBotonesTelegram(imageBuffer, captionTexto) {
  const form = new FormData();
  form.append('chat_id', EDITOR_CHAT_ID);
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'flyer_2k.png');
  form.append('caption', captionTexto.slice(0, 1020));
  form.append('reply_markup', JSON.stringify(generarTecladoTactil()));

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form
  });
}

// ============================================================================
// FLUJOS AUTOMÁTICOS: RADAR DE 21 MEDIOS, RUTA 3, CLIMA Y RESUMEN DIARIO
// ============================================================================

async function generarDatosRadar(forzar = false) {
  const [regionales, nacionales, espectaculos] = await Promise.all([
    consultarRssGooglePorSitios(MEDIOS_REGIONALES, '4h', 'regional'),
    consultarRssGooglePorSitios(MEDIOS_NACIONALES, '3h', 'nacional'),
    consultarRssGooglePorSitios(MEDIOS_ESPECTACULOS, '3h', 'espectaculos')
  ]);

  const candidatas = [...regionales, ...nacionales, ...espectaculos].filter(item => !noticiasEnviadasRadar.has(item.titulo));
  if (candidatas.length === 0) return null;

  const elegida = seleccionarNoticiaRelevante(candidatas);
  if (!elegida) return null;

  noticiasEnviadasRadar.add(elegida.titulo);

  const [extraido, contexto] = await Promise.all([
    extraerNoticiaDeLink(elegida.link),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const textoCompleto = `CATEGORÍA: ${elegida.categoriaOrigen.toUpperCase()}\nMEDIO DE ORIGEN: ${elegida.medio}\nTITULAR: ${elegida.titulo}\n${extraido.textoExtraido}`;

  const noticiaIA = await procesarNoticiaConIA(textoCompleto, contexto, false);
  if (noticiaIA.descartar) return null;

  const { urlFinal, fuenteAuto } = await auditarYResolverImagen({
    fotoCandidataUrl: extraido.fotoExtraida,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    busquedaWebSugerida: noticiaIA.busqueda_foto_web,
    promptIaSugerido: noticiaIA.prompt_imagen_ia
  });

  const esEspectaculo = elegida.categoriaOrigen === 'espectaculos';
  const fotoOptimizada = optimizarFotoConCloudinary(urlFinal, false, 1080);
  const fuenteFinal = fuenteAuto || elegida.medio.toUpperCase() || noticiaIA.fuente_credito || 'PRENSA';

  const imageBuffer = await renderizarFlyer({
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    datoClave: noticiaIA.dato_clave,
    autorCita: noticiaIA.autor_cita,
    fuenteCredito: fuenteFinal,
    fotoFinalUrl: fotoOptimizada,
    expandirSinCloudinary: false,
    esUrgente: !esEspectaculo,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: fotoOptimizada,
    foto_original_url: urlFinal,
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: noticiaIA.dato_clave || '',
    autor_cita: noticiaIA.autor_cita || '',
    fuente_credito: fuenteFinal,
    prompt_imagen_ia: noticiaIA.prompt_imagen_ia || 'Argentina Patagonia news journalism',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: !esEspectaculo,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA, medio: elegida.medio };
}

async function ejecutarAlertaRuta3YServicios() {
  const queryRuta = '("Ruta 3" OR "Ruta Nacional 3" OR "Ramón Santos" OR "Caleta Olivia") (corte OR tránsito OR agua OR luz OR acueducto OR viento OR alerta) when:6h';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryRuta)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(6500) });
  const xml = await resp.text();

  const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi)]
    .map(m => ({
      titulo: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: m[2].trim()
    }))
    .filter(i => !noticiasEnviadasRadar.has(i.titulo));

  if (items.length === 0) return null;
  const elegida = items[0];
  noticiasEnviadasRadar.add(elegida.titulo);

  const [extraido, contexto] = await Promise.all([
    extraerNoticiaDeLink(elegida.link),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const noticiaIA = await procesarNoticiaConIA(`ALERTA VIAL / SERVICIOS ZONA NORTE: ${elegida.titulo}\n${extraido.textoExtraido}`, contexto, false);
  if (noticiaIA.descartar) return null;

  const { urlFinal, fuenteAuto } = await auditarYResolverImagen({
    fotoCandidataUrl: extraido.fotoExtraida,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    busquedaWebSugerida: 'Ruta Nacional 3 Caleta Olivia Santa Cruz',
    promptIaSugerido: 'Patagonia Argentina coastal highway Ruta 3 traffic alert news photography'
  });

  const fotoOptimizada = optimizarFotoConCloudinary(urlFinal, false, 1080);
  const imageBuffer = await renderizarFlyer({
    categoria: 'ZONA NORTE / ALERTA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    fuenteCredito: fuenteAuto || 'VIALIDAD / SERVICIOS',
    fotoFinalUrl: fotoOptimizada,
    expandirSinCloudinary: false,
    esUrgente: true,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: fotoOptimizada,
    foto_original_url: urlFinal,
    categoria: 'ZONA NORTE / ALERTA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: '',
    autor_cita: '',
    fuente_credito: fuenteAuto || 'VIALIDAD / SERVICIOS',
    prompt_imagen_ia: 'Patagonia highway Ruta 3 news photography',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: true,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA };
}

async function ejecutarResumenDiarioCarrusel() {
  const [regionales, nacionales, espectaculos] = await Promise.all([
    consultarRssGooglePorSitios(MEDIOS_REGIONALES, '24h', 'regional'),
    consultarRssGooglePorSitios(MEDIOS_NACIONALES, '24h', 'nacional'),
    consultarRssGooglePorSitios(MEDIOS_ESPECTACULOS, '24h', 'espectaculos')
  ]);

  const titulares = [...regionales.slice(0, 8), ...nacionales.slice(0, 8), ...espectaculos.slice(0, 5)]
    .map(t => `- [${t.medio}] ${t.titulo}`)
    .join('\n');

  const promptResumen = `Sos el Editor Jefe de 'EL REGISTRO SUR' (Caleta Olivia, Santa Cruz). Redactá estrictamente en castellano.
A partir de los hechos confirmados de hoy en Argentina y Santa Cruz, armá el RESUMEN DIARIO EN CARRUSEL de 5 placas:
- Placa 1 (Portada): "LO QUE PASÓ HOY EN EL SUR"
- Placas 2, 3, 4 y 5: Las 4 noticias más importantes del día (1 de Caleta Olivia, 1 de Santa Cruz/energía, 1 de economía/política nacional, 1 de deportes o espectáculo viral).

REGLAS ESTRICTAS:
- PROHIBIDO emojis o banderas en los títulos y bajadas de las placas.
- Titulares cortos (4 a 7 palabras) y bajadas equilibradas (10 a 13 palabras) sin palabras sueltas abajo.
- En "copy", usá texto 100% plano en castellano sin números como 1), con emojis seguros de Facebook (🚨, 📰, 📍, 👇) y hashtags en minúsculas.

Titulares del día:
${titulares}

Devolvé ÚNICAMENTE este JSON:
{
  "slides": [
    { "titulo": "LO QUE PASÓ HOY EN EL SUR", "destacar": "HOY EN EL SUR", "bajada": "Los cuatro temas que marcaron la jornada en la región y el país" },
    { "titulo": "TITULAR TEMA 1", "destacar": "PALABRA CLAVE", "bajada": "Síntesis factual en 12 palabras" },
    { "titulo": "TITULAR TEMA 2", "destacar": "PALABRA CLAVE", "bajada": "Síntesis factual en 12 palabras" },
    { "titulo": "TITULAR TEMA 3", "destacar": "PALABRA CLAVE", "bajada": "Síntesis factual en 12 palabras" },
    { "titulo": "TITULAR TEMA 4", "destacar": "PALABRA CLAVE", "bajada": "Síntesis factual en 12 palabras" }
  ],
  "copy": "📰 RESUMEN DEL DÍA EN EL REGISTRO SUR 📍\\n\\nRepaso rápido con los hechos clave de hoy en Caleta Olivia, Santa Cruz y el país.\\n\\nDeslizá para ver cada tema y seguí @elregistrosur para estar informado 👇\\n\\n---\\n\\n#noticias #elregistrosur #caletaolivia #santacruz #resumendeldia #patagonia"
}`;

  const parsed = await llamarGroqChat([{ role: 'user', content: promptResumen }]);
  const slides = (parsed.slides || []).slice(0, 5);
  const fotoBase = construirUrlPollinationsHD('Caleta Olivia Patagonia Argentina dusk city coast editorial photography');

  const buffers = [];
  for (let i = 0; i < slides.length; i++) {
    const buf = await renderizarFlyer({
      categoria: 'RESUMEN DEL DÍA',
      titulo: limpiarEmojis(slides[i].titulo),
      destacar: limpiarEmojis(slides[i].destacar),
      bajada: limpiarEmojis(slides[i].bajada),
      fuenteCredito: 'EL REGISTRO SUR',
      fotoFinalUrl: fotoBase,
      expandirSinCloudinary: false,
      esUrgente: false,
      esHistoria: false,
      modoVisual: 'estandar',
      numeroSlide: `${i + 1}/${slides.length}`
    });
    buffers.push(buf);
  }

  const copyLimpia = filtrarEmojisSegurosRedes(parsed.copy);

  guardarEnColaBorradores({
    foto_url: fotoBase,
    foto_original_url: fotoBase,
    categoria: 'RESUMEN DEL DÍA',
    titulo: limpiarEmojis(slides[0].titulo),
    destacar: limpiarEmojis(slides[0].destacar),
    bajada: limpiarEmojis(slides[0].bajada),
    copy: copyLimpia,
    dato_clave: '',
    autor_cita: '',
    fuente_credito: 'EL REGISTRO SUR',
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
  const fotoClima = construirUrlPollinationsHD('Caleta Olivia Patagonia Argentina coastal city sea sky dramatic weather photography');

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
    categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    dato_clave: `${clima.rafagasHoy} KM/H`,
    autor_cita: '',
    fuente_credito: 'SERVICIO METEOROLÓGICO',
    prompt_imagen_ia: 'Caleta Olivia Patagonia coastal weather',
    fill_mode: 'cover',
    modo_visual: 'estandar',
    urgente: clima.rafagasHoy >= 70,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA };
}

// ============================================================================
// TAREAS PROGRAMADAS CADA 30 MINUTOS (RADAR 21 MEDIOS + RUTA 3 + CLIMA + RESUMEN)
// ============================================================================

setInterval(async () => {
  try {
    const radar = await generarDatosRadar(false);
    if (radar) {
      await enviarFotoConBotonesTelegram(
        radar.imageBuffer,
        `🚨 RADAR (${radar.medio.toUpperCase()}) — ¿QUERÉS PUBLICARLO?\n\n${radar.noticiaIA.copy}`
      );
    } else {
      const alertaVial = await ejecutarAlertaRuta3YServicios();
      if (alertaVial) {
        await enviarFotoConBotonesTelegram(
          alertaVial.imageBuffer,
          `🚧 ALERTA RUTA 3 / SERVICIOS — ¿QUERÉS PUBLICARLO?\n\n${alertaVial.noticiaIA.copy}`
        );
      }
    }

    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Rio_Gallegos' }));
    const fechaHoy = ahoraAR.toISOString().slice(0, 10);

    if (ahoraAR.getHours() === 8 && ahoraAR.getMinutes() >= 25 && ultimoClimaDiaEnviado !== fechaHoy) {
      ultimoClimaDiaEnviado = fechaHoy;
      const { imageBuffer, noticiaIA } = await ejecutarParteClima();
      await enviarFotoConBotonesTelegram(imageBuffer, `📢 PARTE DIARIO DE CLIMA Y VIENTO:\n\n${noticiaIA.copy}`);
    }

    if (ahoraAR.getHours() === 21 && ahoraAR.getMinutes() < 35 && ultimoResumenDiaEnviado !== fechaHoy) {
      ultimoResumenDiaEnviado = fechaHoy;
      const resumen = await ejecutarResumenDiarioCarrusel();
      await enviarFotoConBotonesTelegram(resumen.buffers[0], resumen.copy);
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
  if (!radar) return res.json({ enviado: false, motivo: 'Sin noticias relevantes nuevas en los 21 portales.' });
  await enviarFotoConBotonesTelegram(radar.imageBuffer, `🚨 RADAR (${radar.medio.toUpperCase()}) — ¿QUERÉS PUBLICARLO?\n\n${radar.noticiaIA.copy}`);
  res.json({ enviado: true, titulo: radar.noticiaIA.titulo, medio: radar.medio });
});

app.get('/clima', async (req, res) => {
  const { imageBuffer, noticiaIA } = await ejecutarParteClima();
  await enviarFotoConBotonesTelegram(imageBuffer, `📢 PARTE DIARIO DE CLIMA Y VIENTO:\n\n${noticiaIA.copy}`);
  res.json({ ok: true, titulo: noticiaIA.titulo });
});

// ============================================================================
// ENDPOINT PRINCIPAL DE TELEGRAM / MAKE
// ============================================================================

app.post('/generar', async (req, res) => {
  try {
    let {
      foto_url,
      file_path,
      file_id,
      texto_crudo,
      callback_query_id,
      categoria,
      titulo,
      destacar,
      bajada,
      fill_mode
    } = req.body;

    let copy = '';
    texto_crudo = (texto_crudo || '').trim();

    if (callback_query_id) {
      await responderCallbackTelegram(callback_query_id, '⚡ Aplicando acción en El Registro Sur...');
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

    // 1. DESCARTAR BORRADOR ACTUAL Y RECUPERAR EL ANTERIOR EN COLA
    if (comando === 'descartar') {
      const descartadoTitulo = ultimoEstado.titulo || 'Borrador';
      if (colaBorradores.length > 0) {
        ultimoEstado = colaBorradores.shift();
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}".\n↩️ Recuperado borrador anterior en cola: "${ultimoEstado.titulo}".`);
      } else {
        ultimoEstado.imagen_buffer = null;
        ultimoEstado.titulo = '';
        await enviarMensajeTelegram(`🗑️ Descartado: "${descartadoTitulo}". La cola de borradores quedó vacía.`);
      }
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 2. AYUDA / COMANDOS
    if (comando === 'comandos' || comando === 'ayuda') {
      const textoAyuda = `🤖 COMANDOS DE EL REGISTRO SUR:\n\n.radar → Busca la noticia más importante o viral en tus 21 portales\n.ruta3 → Revisa estado de Ruta Nacional N° 3 y servicios\n.resumen → Arma carrusel de 5 placas con lo más importante del día\n.marca [crédito] → Estampa marca de agua de El Registro Sur en fotos de vecinos\n.clima → Parte meteorológico de Caleta Olivia\n.urgente / .normal → Cambia el color de alerta\n.cita / .dato / .carrusel / .historia → Formatos especiales\n.expandir / .auditar / .ia [tema] → Ajustes de imagen\n.editar [cambio] → Corrige textos del borrador actual\n.descartar → Descarta la placa actual\n.publicar → Sube a Facebook e Instagram`;
      await enviarMensajeTelegram(textoAyuda);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

    // 3. MARCA DE AGUA PARA FOTOS DE VECINOS (.marca)
    if (comando === 'marca') {
      const fotoOrigen = nuevaFotoTelegram || ultimoEstado.foto_original_url;
      if (!fotoOrigen) throw new Error('Enviá una foto junto con .marca para estampar el logo de El Registro Sur.');

      const creditoVecino = argumento || 'MATERIAL EXCLUSIVO';
      const bufMarcada = await estamparMarcaDeAguaFoto(fotoOrigen, creditoVecino);

      const captionMarca = `📢 REGISTRO EXCLUSIVO EN EL REGISTRO SUR 📍\n\nMaterial enviado a nuestra redacción (${creditoVecino}).\n\nSeguí @elregistrosur para ver toda la cobertura de Caleta Olivia y Santa Cruz 👇\n\n---\n\n#noticias #elregistrosur #caletaolivia #santacruz #exclusivo #patagonia`;

      guardarEnColaBorradores({
        foto_url: fotoOrigen,
        foto_original_url: fotoOrigen,
        categoria: 'EXCLUSIVO / VECINOS',
        titulo: 'REGISTRO EXCLUSIVO DE VECINOS',
        destacar: 'EXCLUSIVO',
        bajada: creditoVecino,
        copy: captionMarca,
        dato_clave: '',
        autor_cita: '',
        fuente_credito: creditoVecino.toUpperCase(),
        prompt_imagen_ia: '',
        fill_mode: 'contain',
        modo_visual: 'estandar',
        urgente: false,
        imagen_buffer: bufMarcada,
        historia_buffer: null,
        carrusel_buffers: []
      });

      return res.json({
        ok: true,
        copy: captionMarca,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: bufMarcada.toString('base64')
      });
    }

    // 4. RADAR EN VIVO SOBRE LOS 21 MEDIOS (.radar)
    if (comando === 'radar' || comando === 'comandoradar') {
      const radar = await generarDatosRadar(true);
      if (!radar) {
        await enviarMensajeTelegram('🔎 Revisé los 21 portales y no hay noticias relevantes nuevas en este momento.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: `🚨 RADAR (${radar.medio.toUpperCase()}) — ¿QUERÉS PUBLICARLO?\n\n${ultimoEstado.copy}`,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    // 5. ALERTA RUTA 3 Y SERVICIOS (.ruta3)
    if (comando === 'ruta3' || comando === 'ruta') {
      const alertaVial = await ejecutarAlertaRuta3YServicios();
      if (!alertaVial) {
        await enviarMensajeTelegram('✅ Sin cortes ni alertas recientes reportadas en Ruta Nacional N° 3 o servicios de Caleta Olivia.');
        return res.json({ ok: true, descartado: true, imagen_base64: '' });
      }
      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: `🚧 ALERTA RUTA 3 / SERVICIOS:\n\n${ultimoEstado.copy}`,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    // 6. RESUMEN DIARIO EN CARRUSEL (.resumen)
    if (comando === 'resumen') {
      const resumen = await ejecutarResumenDiarioCarrusel();
      for (let i = 1; i < resumen.buffers.length; i++) {
        const f = new FormData();
        f.append('chat_id', EDITOR_CHAT_ID);
        f.append('photo', new Blob([resumen.buffers[i]], { type: 'image/png' }), `resumen_${i + 1}.png`);
        f.append('caption', `📑 Placa ${i + 1}/${resumen.buffers.length} del resumen diario`);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: f });
      }
      return res.json({
        ok: true,
        categoria: 'RESUMEN DEL DÍA',
        titulo: ultimoEstado.titulo,
        copy: resumen.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: resumen.buffers[0].toString('base64')
      });
    }

    // 7. CLIMA (.clima)
    if (comando === 'clima' || comando === 'comandoclima') {
      await ejecutarParteClima();
      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    // 8. MODOS ESPECIALES (.cita / .dato)
    if ((comando === 'cita' || comando === 'dato') && ultimoEstado.titulo) {
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: comando
      });
      ultimoEstado.modo_visual = comando;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // 9. CARRUSEL 3x (.carrusel)
    if (comando === 'carrusel' && ultimoEstado.titulo) {
      const noticiaIA = await procesarNoticiaConIA(`Generá el carrusel de 3 placas para esta noticia: ${ultimoEstado.titulo}. ${ultimoEstado.copy}`, 'Borrador ya verificado.', true);
      const slides = (noticiaIA.slides_carrusel && noticiaIA.slides_carrusel.length >= 3)
        ? noticiaIA.slides_carrusel.slice(0, 3)
        : [
            { titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada },
            { titulo: 'EL CONTEXTO Y LOS DATOS', destacar: 'LOS DATOS', bajada: ultimoEstado.bajada },
            { titulo: 'IMPACTO EN SANTA CRUZ', destacar: 'SANTA CRUZ', bajada: 'Seguí toda la cobertura en @elregistrosur' }
          ];

      const buffers = [];
      for (let i = 0; i < 3; i++) {
        const buf = await renderizarFlyer({
          categoria: ultimoEstado.categoria,
          titulo: slides[i].titulo,
          destacar: slides[i].destacar,
          bajada: slides[i].bajada,
          fuenteCredito: ultimoEstado.fuente_credito,
          fotoFinalUrl: ultimoEstado.foto_url,
          expandirSinCloudinary: false,
          esUrgente: ultimoEstado.urgente,
          esHistoria: false,
          modoVisual: 'estandar',
          numeroSlide: `${i + 1}/3`
        });
        buffers.push(buf);
      }

      ultimoEstado.imagen_buffer = buffers[0];
      ultimoEstado.carrusel_buffers = buffers;

      for (let i = 1; i < 3; i++) {
        const formSlide = new FormData();
        formSlide.append('chat_id', EDITOR_CHAT_ID);
        formSlide.append('photo', new Blob([buffers[i]], { type: 'image/png' }), `carrusel_${i + 1}.png`);
        formSlide.append('caption', `📑 Placa ${i + 1}/3 del carrusel`);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formSlide
        });
      }

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: slides[0].titulo,
        destacar: slides[0].destacar,
        bajada: slides[0].bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: buffers[0].toString('base64')
      });
    }

    // 10. AUDITORÍA MANUAL DE FOTO (.auditar)
    if ((comando === 'auditar' || comando === 'comandoauditar') && ultimoEstado.titulo) {
      const { urlFinal, fuenteAuto } = await auditarYResolverImagen({
        fotoCandidataUrl: ultimoEstado.foto_original_url,
        esFotoManualDelEditor: false,
        titulo: ultimoEstado.titulo,
        busquedaWebSugerida: ultimoEstado.titulo,
        promptIaSugerido: ultimoEstado.prompt_imagen_ia,
        forzarBusquedaNueva: true
      });

      const fotoOptimizada = optimizarFotoConCloudinary(urlFinal, false, 1080);
      const fuenteFinal = fuenteAuto || ultimoEstado.fuente_credito;

      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: fuenteFinal,
        fotoFinalUrl: fotoOptimizada,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: ultimoEstado.modo_visual
      });

      ultimoEstado.foto_url = fotoOptimizada;
      ultimoEstado.foto_original_url = urlFinal;
      ultimoEstado.fuente_credito = fuenteFinal;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // 11. HISTORIA VERTICAL 9:16 (.historia)
    if ((comando === 'historia' || comando === 'comandohistoria') && ultimoEstado.titulo) {
      const historiaBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain' && !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: ultimoEstado.urgente,
        esHistoria: true,
        modoVisual: ultimoEstado.modo_visual
      });
      ultimoEstado.historia_buffer = historiaBuffer;
      return res.json({
        ok: true,
        es_historia: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-historia.png?t=${Date.now()}`,
        imagen_base64: historiaBuffer.toString('base64')
      });
    }

    // 12. EXPANDIR FOTO (.expandir)
    if ((comando === 'expandir' || comando === 'comandoexpandir') && ultimoEstado.titulo) {
      const fotoExpandida = optimizarFotoConCloudinary(ultimoEstado.foto_original_url, true, 1080);

      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: fotoExpandida,
        expandirSinCloudinary: !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: 'estandar'
      });

      ultimoEstado.foto_url = fotoExpandida;
      ultimoEstado.fill_mode = 'contain';
      ultimoEstado.modo_visual = 'estandar';
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // 13. URGENTE / NORMAL / OTRA FOTO IA
    if ((comando === 'urgente' || comando === 'comandourgente') && !argumento && !nuevaFotoTelegram && ultimoEstado.titulo) {
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
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain' && !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: true,
        esHistoria: false,
        modoVisual: ultimoEstado.modo_visual
      });
      ultimoEstado.categoria = nuevaCat;
      ultimoEstado.urgente = true;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    if ((comando === 'normal' || comando === 'comandonormal') && ultimoEstado.titulo) {
      const fotoMejorada = optimizarFotoConCloudinary(ultimoEstado.foto_original_url, false, 1080);
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria.replace(/^URGENTE\s*\/\s*/i, ''),
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: fotoMejorada,
        expandirSinCloudinary: false,
        esUrgente: false,
        esHistoria: false,
        modoVisual: 'estandar'
      });
      ultimoEstado.foto_url = fotoMejorada;
      ultimoEstado.urgente = false;
      ultimoEstado.fill_mode = 'cover';
      ultimoEstado.modo_visual = 'estandar';
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    if ((comando === 'ia' || comando === 'comandoia') && ultimoEstado.titulo) {
      const promptFinal = argumento
        ? `${argumento}, photorealistic news journalism photography, sharp focus, no text`
        : ultimoEstado.prompt_imagen_ia;
      const nuevaFotoIA = construirUrlPollinationsHD(promptFinal);

      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: 'ILUSTRACIÓN IA',
        fotoFinalUrl: nuevaFotoIA,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: ultimoEstado.modo_visual
      });

      ultimoEstado.foto_url = nuevaFotoIA;
      ultimoEstado.foto_original_url = nuevaFotoIA;
      ultimoEstado.fuente_credito = 'ILUSTRACIÓN IA';
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        reply_markup_json: replyMarkupJson,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // 14. PROCESAMIENTO DE NOTICIA NUEVA O .EDITAR
    let textoParaProcesar = comando ? argumento : texto_crudo;
    const urlDetectada = textoParaProcesar.match(/https?:\/\/[^\s]+/i)?.[0];
    let fotoDeLink = '';
    let fuenteLink = '';

    const [extraidoLink, contextoWeb] = await Promise.all([
      urlDetectada ? extraerNoticiaDeLink(urlDetectada) : Promise.resolve({ fotoExtraida: '', fuenteDominio: '', textoExtraido: '' }),
      buscarContextoEnGoogleNews(textoParaProcesar)
    ]);

    if (urlDetectada) {
      fotoDeLink = extraidoLink.fotoExtraida;
      fuenteLink = extraidoLink.fuenteDominio;
      if (extraidoLink.textoExtraido) {
        textoParaProcesar += `\n\n[DATOS EXTRAÍDOS DEL LINK]:\n${extraidoLink.textoExtraido}`;
      }
    }

    const fotoNuevaRecibida = nuevaFotoTelegram || fotoDeLink;
    const esEdicion = comando === 'editar' || comando === 'modificar' || comando === 'comandoeditar';
    const esUrgente = comando === 'urgente' || comando === 'comandourgente' || (esEdicion && ultimoEstado.urgente);

    let promptImagenIA = ultimoEstado.prompt_imagen_ia;
    let busquedaFotoWeb = '';
    let datoClave = ultimoEstado.dato_clave;
    let autorCita = ultimoEstado.autor_cita;
    let fuenteCredito = fuenteLink || ultimoEstado.fuente_credito;

    if (textoParaProcesar.length > 0) {
      const noticiaIA = await procesarNoticiaConIA(textoParaProcesar, contextoWeb || 'Contexto verificado.', esEdicion);

      if (!esEdicion && noticiaIA.descartar) {
        await enviarMensajeTelegram(`ℹ️ La noticia fue descartada por falta de respaldo verificable: ${noticiaIA.motivo_descarte || ''}`);
        return res.json({
          ok: true,
          descartado: true,
          motivo: noticiaIA.motivo_descarte || 'Sin respaldo verificable',
          imagen_base64: ''
        });
      }

      categoria = noticiaIA.categoria || ultimoEstado.categoria || 'NOTICIAS / ACTUALIDAD';
      titulo = noticiaIA.titulo || ultimoEstado.titulo || '';
      destacar = noticiaIA.destacar || '';
      bajada = noticiaIA.bajada || ultimoEstado.bajada || '';
      copy = noticiaIA.copy || '';
      datoClave = noticiaIA.dato_clave || '';
      autorCita = noticiaIA.autor_cita || '';
      fuenteCredito = fuenteLink || noticiaIA.fuente_credito || 'ARCHIVO';
      promptImagenIA = noticiaIA.prompt_imagen_ia || 'journalism news photography Argentina Patagonia';
      busquedaFotoWeb = noticiaIA.busqueda_foto_web || titulo;
    }

    let fotoBase = fotoNuevaRecibida || (esEdicion ? ultimoEstado.foto_original_url : '');

    if (!esEdicion || !fotoBase) {
      const resultadoAuditoria = await auditarYResolverImagen({
        fotoCandidataUrl: fotoBase,
        esFotoManualDelEditor: Boolean(nuevaFotoTelegram),
        titulo,
        busquedaWebSugerida: busquedaFotoWeb,
        promptIaSugerido: promptImagenIA
      });
      fotoBase = resultadoAuditoria.urlFinal;
      if (resultadoAuditoria.fuenteAuto) fuenteCredito = resultadoAuditoria.fuenteAuto;
    }

    const usarModoExpandido = fill_mode === 'contain' || (esEdicion && ultimoEstado.fill_mode === 'contain');
    const fotoFinalUrl = optimizarFotoConCloudinary(fotoBase, usarModoExpandido, 1080);

    const imageBuffer = await renderizarFlyer({
      categoria,
      titulo,
      destacar,
      bajada,
      datoClave,
      autorCita,
      fuenteCredito,
      fotoFinalUrl,
      expandirSinCloudinary: usarModoExpandido && !process.env.CLOUDINARY_CLOUD_NAME,
      esUrgente,
      esHistoria: false,
      modoVisual: 'estandar'
    });

    const nuevoEstado = {
      foto_url: fotoFinalUrl,
      foto_original_url: fotoBase,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      dato_clave: datoClave,
      autor_cita: autorCita,
      fuente_credito: fuenteCredito,
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
    } else {
      guardarEnColaBorradores(nuevoEstado);
    }

    return res.json({
      ok: true,
      es_edicion: esEdicion,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      reply_markup_json: replyMarkupJson,
      url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
      imagen_base64: imageBuffer.toString('base64')
    });
  } catch (err) {
    console.error('Error en /generar:', err.message);
    await enviarMensajeTelegram(`⚠️ Aviso del servidor al procesar el pedido: ${err.message}`);
    // Devuelve 200 OK con imagen_base64 vacía para no bloquear ni encolar Make
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
app.listen(PORT, () => console.log(`El Registro Sur 2K + Radar 21 Medios listo en puerto ${PORT}`));
