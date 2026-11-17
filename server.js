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

// Cola de hasta 5 borradores para que las alertas del radar no se pisen entre sí
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
  return texto
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\b(fortes)\b/gi, 'fuertes')
    .replace(/^\s*(?:[0-9]+[\)\.\-]|\bL[íi]nea\s*[0-9]+\s*:|\bP[áa]rrafo\s*[0-9]+\s*:)\s*/gim, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function filtrarEmojisSegurosRedes(texto) {
  if (!texto) return '';
  let limpio = texto
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

// Rotación instantánea de modelos en Groq: si gpt-oss-120b da 429, pasa al instante a llama-3.3-70b-versatile sin demorar a Make
async function llamarGroqChat(messages, timeoutMs = 14000) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta configurar GROQ_API_KEY en Render.');

  const modelosRespaldo = [
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  let ultimoError = '';
  for (const modelo of modelosRespaldo) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelo,
          response_format: { type: 'json_object' },
          messages
        })
      });

      if (resp.status === 429 || resp.status >= 500) {
        ultimoError = `Groq (${modelo}) status ${resp.status}`;
        console.warn(`${ultimoError} -> cambiando automáticamente al siguiente modelo...`);
        continue;
      }

      if (!resp.ok) {
        ultimoError = await resp.text();
        continue;
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return JSON.parse(content);
    } catch (e) {
      ultimoError = e.message;
      continue;
    }
  }
  throw new Error(`Error comunicando con Groq: ${ultimoError}`);
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
      signal: AbortSignal.timeout(9000),
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
    const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
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
// MONITOR DE LOS 21 PORTALES (REGIONALES + NACIONALES + ESPECTÁCULOS VIRALES)
// ============================================================================

async function consultarRssGooglePorSitios(dominios, ventanaTiempo = '4h', categoriaOrigen = 'general') {
  try {
    const filtroSitios = dominios.map(d => `site:${d}`).join(' OR ');
    const query = `(${filtroSitios}) when:${ventanaTiempo}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const xml = await resp.text();

    return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<\/item>/gi)]
      .map(m => ({
        titulo: m[1].replace(/<!\[CDATA\[\vert{}\]\]>/g, '').trim(),
        link: m[2].trim(),
        medio: m[3].replace(/<!\[CDATA\[\vert{}\]\]>/g, '').trim(),
        categoriaOrigen
      }));
  } catch (e) {
    return [];
  }
}

async function seleccionarNoticiaRelevanteConIA(candidatas) {
  if (candidatas.length === 0) return null;

  const listaFormateada = candidatas
    .slice(0, 26)
    .map((c, idx) => `${idx}: [${c.categoriaOrigen.toUpperCase()} | ${c.medio}] ${c.titulo}`)
    .join('\n');

  const promptCurador = `Sos el Director Periodístico de 'El Registro Sur' (Caleta Olivia, Santa Cruz). Redactá estrictamente en castellano.
Revisá estos titulares recientes de nuestros 21 portales monitoreados y elegí ÚNICAMENTE la noticia MÁS IMPORTANTE, VIRAL O RELEVANTE para publicar ahora.

CRITERIOS DE SELECCIÓN ESTRICTOS:
1. REGIONAL Y NACIONAL DE ALTO IMPACTO: Priorizar noticias de Caleta Olivia, Zona Norte, Ruta Nacional N° 3, actividad petrolera/energética/pesquera en Santa Cruz, decisiones del Gobierno Provincial (Claudio Vidal), economía argentina de impacto directo (dólar, inflación, combustibles, tarifas, ANSES, leyes clave) o eventos deportivos mayores (Selección Argentina, Boca/River, referentes patagónicos).
2. ESPECTÁCULOS Y CHISMES VIRALES: Aceptar ÚNICAMENTE bombas mediáticas, escándalos judiciales, rupturas o cruces virales de figuras masivas de primera línea en Argentina (ej. Wanda Nara, Mauro Icardi, China Suárez, Tinelli, Susana Giménez, Mirtha Legrand, Gran Hermano, referentes top del streaming como Migue Granados u Occhiato, o artistas urbanos como Luck Ra, Tiago PZK, La Joaqui, Duki, María Becerra, L-Gante).
3. DESCARTAR SIEMPRE: Horóscopos, notas de relleno de panelistas menores, clickbait sin noticia real o accidentes viales menores en otras provincias lejanas.
4. Si NINGUNA noticia de la lista tiene verdadera relevancia o impacto viral hoy, devolvé "indice": -1.

Titulares disponibles:
${listaFormateada}

Devolvé ÚNICAMENTE este JSON:
{
  "indice": 0,
  "motivo": "Por qué es importante y relevante"
}`;

  try {
    const resJson = await llamarGroqChat([{ role: 'user', content: promptCurador }], 10000);
    if (typeof resJson.indice === 'number' && resJson.indice >= 0 && candidatas[resJson.indice]) {
      return candidatas[resJson.indice];
    }
    return null;
  } catch (e) {
    return candidatas[0];
  }
}

async function obtenerDatosClimaCaleta() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=-46.4393&longitude=-67.5284&current=temperature_2m,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,wind_gusts_10m_max&timezone=America%2FArgentina%2FRio_Gallegos';
  const resp = await fetch(url);
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
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1440&height=1440&model=flux&enhance=true&nologo=true&seed=${seed}`;
}

async function descargarYValidarImagen(url) {
  if (!url || !url.startsWith('http')) return null;
  if (/logo|favicon|avatar|placeholder|default|icon|sprite|blank|1x1|banner-site/i.test(url)) {
    return null;
  }
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 18000 || buffer.length > 8 * 1024 * 1024) return null;

    const mime = contentType.split(';')[0].trim();
    return {
      url,
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      bytes: buffer.length
    };
  } catch (e) {
    return null;
  }
}

async function auditarCoherenciaConVision(imagenValidada, titulo, bajada, categoria) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !imagenValidada) {
    return { aprobada: false, razon: 'Sin imagen válida para auditar' };
  }

  const promptAuditor = `Sos el Auditor Visual Jefe del diario digital 'El Registro Sur'. Respondé estrictamente en castellano.
Analizá la imagen adjunta y comparala con esta noticia:
- SECCIÓN: ${categoria}
- TITULAR: ${titulo}
- BAJADA: ${bajada}

Criterios estrictos:
1. RECHAZAR si es un logo genérico de un diario/canal, una placa con mucho texto superpuesto, una captura borrosa o un gráfico abstracto sin relación.
2. RECHAZAR si el contenido visual contradice la noticia o muestra a una persona totalmente ajena al tema.
3. APROBAR si muestra el lugar, protagonista, actividad o escena periodística coherente con el titular y tiene nitidez aceptable.

Devolvé ÚNICAMENTE este JSON:
{
  "aprobada": true o false,
  "razon": "Explicación breve en castellano",
  "busqueda_web": "3 a 5 palabras clave en castellano para buscar una foto real de prensa en internet si fue rechazada",
  "prompt_ia_corregido": "Detailed photorealistic news photography prompt in English (20 words, natural lighting, sharp focus, no text or watermarks)"
}`;

  const modelosVision = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.2-90b-vision-preview'
  ];

  for (const modelo of modelosVision) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelo,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptAuditor },
                { type: 'image_url', image_url: { url: imagenValidada.dataUrl } }
              ]
            }
          ]
        })
      });

      if (!resp.ok) continue;
      const data = await resp.json();
      return JSON.parse(data?.choices?.[0]?.message?.content);
    } catch (e) {
      continue;
    }
  }

  return { aprobada: true, razon: 'Aprobada por validación técnica' };
}

async function auditarDisenoPlacaConVision(imageBuffer) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !imageBuffer) return { prolija: true };

  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  const promptDiseno = `Sos el Director de Arte y Control de Calidad Tipográfica de 'El Registro Sur'.
Inspeccioná esta placa periodística terminada y verificá ÚNICAMENTE estos defectos gráficos:
1. Emojis, banderas o cuadraditos de carácter roto (□) en el título o subtítulo.
2. Texto en "forma de pistolita" (una línea superior muy larga y una última línea diminuta con 1 sola palabra, número o letra colgada abajo).
3. Textos superpuestos o cortados.

Devolvé ÚNICAMENTE este JSON:
{
  "prolija": true o false,
  "defecto": "Descripción corta en castellano si prolija es false, o vacío"
}`;

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(9000),
      headers: {
