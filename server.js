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
const CLAVE_GROQ_RESPALDO = ['gsk', 'C9XrhxVzidzc2quADlxqWGdyb3FYYXpRiM09cKPoYBu0jkb3QE8v'].join('_');

const FUENTES_RSS_RADAR = [
  { url: 'https://laopinionaustral.com.ar/feed/', medio: 'LA OPINIÓN AUSTRAL', categoria: 'regional' },
  { url: 'https://infocaleta.com/v2/feed/', medio: 'INFOCALETA', categoria: 'regional' },
  { url: 'https://lagacetadesantacruz.com.ar/feed/', medio: 'LA GACETA SANTA CRUZ', categoria: 'regional' },
  { url: 'https://ecosdelsur.com/feed/', medio: 'ECOS DEL SUR', categoria: 'regional' },
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('("Caleta Olivia" OR "Santa Cruz" OR "Claudio Vidal" OR "Ruta 3" OR site:tiemposur.com.ar OR site:adnsur.com.ar OR site:elpatagonico.com) when:24h') + '&hl=es-419&gl=AR&ceid=AR:es-419', medio: 'PATAGONIA', categoria: 'regional' },
  { url: 'https://www.infobae.com/arc/outboundfeeds/rss/', medio: 'INFOBAE', categoria: 'nacional' },
  { url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', medio: 'LA NACIÓN', categoria: 'nacional' },
  { url: 'https://www.clarin.com/rss/lo-ultimo/', medio: 'CLARÍN', categoria: 'nacional' },
  { url: 'https://www.pagina12.com.ar/rss/portada', medio: 'PÁGINA 12', categoria: 'nacional' },
  { url: 'https://eleconomista.com.ar/feed/', medio: 'EL ECONOMISTA', categoria: 'nacional' },
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('(site:tn.com.ar OR site:tycsports.com OR site:iprofesional.com) when:12h') + '&hl=es-419&gl=AR&ceid=AR:es-419', medio: 'NACIONAL', categoria: 'nacional' },
  { url: 'https://www.paparazzi.com.ar/feed/', medio: 'PAPARAZZI', categoria: 'espectaculos' },
  { url: 'https://exitoina.perfil.com/feed', medio: 'EXITOÍNA', categoria: 'espectaculos' },
  { url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('(site:primiciasya.com OR site:ciudad.com.ar OR site:pronto.com.ar) when:24h') + '&hl=es-419&gl=AR&ceid=AR:es-419', medio: 'ESPECTÁCULOS', categoria: 'espectaculos' }
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
let ultimoComandoTexto = '';
let ultimoComandoTimestamp = 0;
let indiceClaveGroq = 0;

app.get('/ping', (req, res) => res.status(200).send('OK - El Registro Sur 2K + Multi-Key activo'));

const EMOJIS_SEGUROS_META = new Set([
  '🚨', '🔴', '🟠', '🟡', '🚧', '🚔', '🚒', '🚑', '🛑',
  '💨', '🌀', '🌊', '💧', '☔', '⛄', '⛅', '⚡', '🔥', '🌈',
  '💰', '💵', '📈', '📉', '📊', '⛽', '🏭', '🚜', '🚛', '🚢', '🐟',
  '📢', '📣', '📰', '📋', '📄', '📜', '🏥', '🏫', '🎓', '👷', '🤝', '📍', '📅', '🕒',
  '⚽', '🏆', '🏅', '🎭', '🎶',
  '👇', '👉', '📲', '💬', '✅', '❌'
]);

const CONECTORES_COLGADOS = new Set([
  'DE', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS',
  'A', 'AL', 'DEL', 'EN', 'CON', 'POR', 'PARA', 'SIN', 'TRAS',
  'ANTE', 'BAJO', 'SOBRE', 'ENTRE', 'HACIA', 'HASTA', 'DESDE',
  'Y', 'E', 'O', 'U', 'NI', 'QUE', 'SE', 'SU', 'SUS', 'LO', 'LE', 'LES', 'MAS', 'MÁS', 'MUY'
]);

function limpiarPalabraSignos(palabra) {
  return String(palabra || '').replace(/^[^A-ZÁÉÍÓÚÜÑ0-9]+|[^A-ZÁÉÍÓÚÜÑ0-9]+$/gi, '').toUpperCase();
}

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

// Garantiza que las palabras destacadas tengan coherencia semántica completa (jamás corta en "BUQUE DE LA")
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
      let coincide = true;
      for (let j = 0; j < palabrasDes.length; j++) {
        if (limpiarPalabraSignos(palabrasTit[i + j]) !== limpiarPalabraSignos(palabrasDes[j])) {
          coincide = false;
          break;
        }
      }
      if (coincide) {
        idxInicio = i;
        break;
      }
    }
  }

  let idxFin = idxInicio !== -1 ? idxInicio + palabrasDes.length - 1 : -1;

  if (idxInicio === -1) {
    idxInicio = 0;
    idxFin = Math.min(2, palabrasTit.length - 1);
  }

  while (idxInicio < idxFin && ['DE', 'DEL', 'Y', 'E', 'O', 'U', 'A', 'CON', 'POR', 'EN'].includes(limpiarPalabraSignos(palabrasTit[idxInicio]))) {
    idxInicio++;
  }

  while (idxFin < palabrasTit.length - 1 && CONECTORES_COLGADOS.has(limpiarPalabraSignos(palabrasTit[idxFin]))) {
    idxFin++;
  }

  if (idxFin < palabrasTit.length - 1 && ['DE', 'DEL', 'AL'].includes(limpiarPalabraSignos(palabrasTit[idxFin]))) {
    idxFin++;
  }

  while (idxFin > idxInicio && CONECTORES_COLGADOS.has(limpiarPalabraSignos(palabrasTit[idxFin]))) {
    idxFin--;
  }

  if (idxInicio === 0 && idxFin >= palabrasTit.length - 1 && palabrasTit.length >= 5) {
    idxFin = Math.min(3, palabrasTit.length - 2);
    while (idxFin < palabrasTit.length - 1 && CONECTORES_COLGADOS.has(limpiarPalabraSignos(palabrasTit[idxFin]))) {
      idxFin++;
    }
  }

  return {
    titulo: tit,
    destacar: palabrasTit.slice(idxInicio, idxFin + 1).join(' ')
  };
}

function limpiarBajadaPeriodistica(bajada) {
  let baj = limpiarEmojis(bajada);
  if (!baj) return '';
  baj = baj.charAt(0).toUpperCase() + baj.slice(1);
  if (!/[.!?]$/.test(baj)) baj += '.';
  return baj;
}

function obtenerListaClavesGroq() {
  const raw = process.env.GROQ_API_KEY || '';
  const desdeEnv = raw.split(',').map(k => k.trim()).filter(Boolean);
  const todas = [...new Set([...desdeEnv, CLAVE_GROQ_RESPALDO].filter(Boolean))];
  if (todas.length === 0) throw new Error('Falta configurar GROQ_API_KEY.');
  return todas;
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
        temperature: 0.25,
        messages
      };
      if (usarJsonMode) {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyPayload)
      });

      if (resp.status === 429 || resp.status === 413) {
        ultimoError = `Groq (${resp.status}) límite alcanzado`;
        if (claves.length === 1 || intento >= claves.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
        continue;
      }

      if (!resp.ok) {
        ultimoError = `Error de Groq (${resp.status}): ${await resp.text()}`;
        if (resp.status === 400 && intento < totalIntentos - 1) continue;
        throw new Error(ultimoError);
      }

      const data = await resp.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      const matchJson = rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = matchJson ? matchJson[0] : rawContent;
      return JSON.parse(jsonStr);
    } catch (e) {
      ultimoError = e.message;
      if (intento === totalIntentos - 1) throw new Error(ultimoError);
      if (claves.length === 1) await new Promise(r => setTimeout(r, 1200));
    }
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

  if (!resp.ok) {
    throw new Error(`Error transcribiendo audio (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json();
  return (data.text || '').slice(0, 1400);
}

async function extraerNoticiaDeLink(url) {
  try {
    if (!url || url.includes('news.google.com')) {
      return { fotoExtraida: '', fuenteDominio: '', textoExtraido: '' };
    }
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await resp.text();

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                         html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]+class=["'][^"']*wp-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
                         html.match(/<article[\s\S]*?<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);

    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    const htmlSinBasura = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

    const parrafos = [...htmlSinBasura.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(t => t.length > 55 && !t.includes('{') && !t.includes('function('))
      .slice(0, 5)
      .join('\n')
      .slice(0, 1100);

    let fotoUrl = ogImageMatch ? ogImageMatch[1] : '';
    if (fotoUrl && fotoUrl.startsWith('/')) {
      const origin = new URL(url).origin;
      fotoUrl = `${origin}${fotoUrl}`;
    }

    const dominio = new URL(url).hostname.replace('www.', '').split('.')[0].toUpperCase();
    const tituloLimpio = (ogTitleMatch ? ogTitleMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 200);
    const bajadaMeta = (ogDescMatch ? ogDescMatch[1] : '').replace(/\s{2,}/g, ' ').trim().slice(0, 300);

    return {
      fotoExtraida: fotoUrl,
      fuenteDominio: dominio,
      textoExtraido: `TÍTULO ORIGINAL: ${tituloLimpio}\nBAJADA: ${bajadaMeta}\nCUERPO: ${parrafos}`.slice(0, 1400)
    };
  } catch (e) {
    return { fotoExtraida: '', fuenteDominio: '', textoExtraido: '' };
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
    if (queryLimpia.length < 5) return '';

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryLimpia)}&hl=es-419&gl=AR&ceid=AR:es-419`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const xml = await resp.text();

    const bloques = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    const items = bloques.slice(0, 4).map(b => {
      const tit = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
      return tit ? `- ${tit}` : '';
    }).filter(Boolean).join('\n').slice(0, 450);

    return items ? `\nANTECEDENTES EN MEDIOS:\n${items}` : '';
  } catch (e) {
    return '';
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

      const imgMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) ||
                       itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                       itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
                       itemXml.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) ||
                       (contentMatch && contentMatch[1].match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i));

      const titulo = (tituloMatch ? tituloMatch[1] : '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/<[^>]+>/g, '')
        .trim();

      const link = (linkMatch ? linkMatch[1] : '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .trim();

      const textoRssBruto = (descMatch ? descMatch[1] : '') + ' ' + (contentMatch ? contentMatch[1] : '');
      const bajadaRss = textoRssBruto
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 500);

      const medio = sourceMatch
        ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        : fuente.medio;

      return {
        titulo,
        link,
        medio,
        categoriaOrigen: fuente.categoria,
        fotoRss: imgMatch ? imgMatch[1] : '',
        bajadaRss
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

function seleccionarNoticiaRelevante(candidatas, ignorarHistorial = false) {
  if (!candidatas || candidatas.length === 0) return null;

  const regexDescartar = /hor[óo]scopo|quiniela|loter[íi]a|crucigrama|efem[ée]rides|receta|tarot|predicciones/i;
  const regexPrioridadMaxima = /caleta olivia|santa cruz|claudio vidal|ruta 3|ruta nacional 3|ram[óo]n santos|zona norte|pico truncado|las heras|r[íi]o gallegos|ypf|petr[óo]leo|servicios p[úu]blicos|distrigas|acueducto/i;
  const regexImpactoNacional = /milei|d[óo]lar|inflaci[óo]n|anses|jubilados|combustible|nafta|sueldo|paro|corte|tarifa|impuesto|banco central|selecci[óo]n argentina|boca|river|messi|colapinto|gobierno|empresarios|salarios/i;
  const regexBombasEspectaculos = /wanda|icardi|china su[áa]rez|tinelli|susana|mirtha|gran hermano|lam|esc[áa]ndalo|separaci[óo]n|denuncia|luck ra|tiago pzk|la joaqui|duki|mar[íi]a becerra|l-gante|occhiato|granados/i;

  const disponibles = candidatas.filter(c => {
    if (regexDescartar.test(c.titulo)) return false;
    if (!ignorarHistorial && noticiasEnviadasRadar.has(c.titulo)) return false;
    return true;
  });

  if (disponibles.length === 0) return null;

  const puntuadas = disponibles
    .map(c => {
      let puntos = 10;
      if (regexPrioridadMaxima.test(c.titulo)) puntos += 55;
      if (c.categoriaOrigen === 'regional') puntos += 30;
      if (regexImpactoNacional.test(c.titulo)) puntos += 35;
      if (c.categoriaOrigen === 'espectaculos') {
        puntos += regexBombasEspectaculos.test(c.titulo) ? 32 : -5;
      }
      if (c.fotoRss) puntos += 8;
      return { ...c, puntos };
    })
    .sort((a, b) => b.puntos - a.puntos);

  return puntuadas[0];
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

function construirUrlPollinationsHD(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&seed=${seed}`;
}

async function descargarYValidarImagen(url, timeoutMs = 5500) {
  if (!url) return null;
  if (url.startsWith('data:image/')) return { url, dataUrl: url };
  if (!url.startsWith('http')) return null;
  if (/logo|favicon|avatar|placeholder|default|icon|sprite|blank|1x1|banner-site/i.test(url)) {
    return null;
  }
  try {
    const resp = await fetch(url, {
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
    if (buffer.length < 10000 || buffer.length > 9 * 1024 * 1024) return null;

    return {
      url,
      dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      bytes: buffer.length
    };
  } catch (e) {
    return null;
  }
}

async function buscarFotoRealEnWeb(consulta) {
  if (!consulta || consulta.trim().length < 3) return null;

  try {
    const bingUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(consulta + ' Argentina')}&first=0&count=8&mmasync=1`;
    const resp = await fetch(bingUrl, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await resp.text();
    const urls = [...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;/gi)]
      .map(m => m[1])
      .filter(u => /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(u))
      .slice(0, 4);

    if (urls.length > 0) {
      const validaciones = await Promise.all(urls.map(u => descargarYValidarImagen(u, 4000)));
      const encontrada = validaciones.find(Boolean);
      if (encontrada) return encontrada;
    }
  } catch (e) {}

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
        .filter(r => (r.width || 0) >= 650 && (r.height || 0) >= 400)
        .slice(0, 4);

      const resultados = await Promise.all(candidatas.map(c => descargarYValidarImagen(c.image, 4000)));
      const primeraValida = resultados.find(Boolean);
      if (primeraValida) return primeraValida;
    }
  } catch (e) {}

  return null;
}

async function auditarYResolverImagen({
  fotoCandidataUrl,
  esFotoManualDelEditor,
  titulo,
  busquedaWebSugerida,
  promptIaSugerido,
  forzarBusquedaNueva = false
}) {
  if (fotoCandidataUrl && !forzarBusquedaNueva) {
    const validada = await descargarYValidarImagen(fotoCandidataUrl, 5500);
    if (validada) {
      return {
        urlFinal: validada.dataUrl,
        urlOriginal: validada.url,
        fuenteAuto: esFotoManualDelEditor ? 'GENTILEZA / ARCHIVO' : ''
      };
    }
  }

  const queryWeb = busquedaWebSugerida || `${titulo} Santa Cruz Argentina`;
  const fotoWeb = await buscarFotoRealEnWeb(queryWeb);
  if (fotoWeb) {
    return {
      urlFinal: fotoWeb.dataUrl,
      urlOriginal: fotoWeb.url,
      fuenteAuto: 'ARCHIVO / PRENSA'
    };
  }

  const urlIa = construirUrlPollinationsHD(promptIaSugerido || 'Patagonia Argentina coastal city journalism news photography');
  const validadaIa = await descargarYValidarImagen(urlIa, 9000);
  if (validadaIa) {
    return {
      urlFinal: validadaIa.dataUrl,
      urlOriginal: urlIa,
      fuenteAuto: 'ILUSTRACIÓN IA'
    };
  }

  const fallbackPatagonia = await buscarFotoRealEnWeb('Caleta Olivia Santa Cruz Patagonia');
  if (fallbackPatagonia) {
    return {
      urlFinal: fallbackPatagonia.dataUrl,
      urlOriginal: fallbackPatagonia.url,
      fuenteAuto: 'ARCHIVO'
    };
  }

  return { urlFinal: urlIa, urlOriginal: urlIa, fuenteAuto: 'ARCHIVO' };
}

// ============================================================================
// CEREBRO EDITORIAL: COHERENCIA, ESTÉTICA DE 3 A 4 RENGLONES Y DESTACADO LIMPIO
// ============================================================================

async function procesarNoticiaConIA(textoCrudo, contextoWeb = '', esEdicion = false) {
  const textoRecortado = String(textoCrudo || '').slice(0, 1500);
  const contextoRecortado = String(contextoWeb || '').slice(0, 450);

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur), diario periodístico digital de Caleta Olivia, Santa Cruz.
IDIOMA: Castellano de Argentina 100% natural, fluido y periodístico.

REGLA 1 — PALABRAS DESTACADAS EN EL TÍTULO ("destacar"):
- El campo "destacar" define qué palabras del "titulo" se pintan de color celeste/rojo en la placa.
- OBLIGATORIO: Debe ser una FRASE COMPLETA CON SENTIDO PROPIO Y AUTÓNOMO (un sujeto completo, una acción completa o un lugar completo) de entre 2 y 4 palabras consecutivas que estén exactamente dentro de "titulo".
- PROHIBIDO CORTAR EN CONECTORES: Jamás termines ni empieces "destacar" en artículos o preposiciones sueltas como "DE", "LA", "EL", "DEL", "A", "AL", "EN", "CON", "POR".
  * EJEMPLO MAL: "BUQUE DE LA" o "ARRIBÓ A" o "GOBIERNO DE".
  * EJEMPLO BIEN: "BUQUE DE LA ARMADA" o "CALETA OLIVIA" o "NUEVO PARTE CLIMÁTICO".

REGLA 2 — SUBTÍTULO DE LA PLACA ("bajada"): COHERENCIA Y ESTÉTICA DE 3 A 4 RENGLONES:
- PRIORIDAD ABSOLUTA: Coherencia periodística, redacción natural y estética visual.
- Apuntá idealmente a 3 renglones visuales en la placa, pero PUEDE EXTENDERSE HASTA 4 RENGLONES (entre 20 y 32 palabras / 135 a 210 caracteres) siempre que lo necesite para cerrar la idea con total sentido, fluidez y coherencia.
- Escribí con todos los artículos y conectores naturales del castellano ("El patrullero oceánico...", "arribó este domingo al muelle..."). Prohibido comer artículos estilo telegrama y prohibido rellenar con frases huecas o gerundios robóticos ("realizando ingreso", "bajo medidas de seguridad").
- Explicá con claridad qué pasó, quiénes intervienen y por qué importa o qué impacto real tiene en Caleta Olivia, Santa Cruz o el país.

REGLA 3 — VOZ Y FORMATO REDES ("copy"):
- Cero emojis y cero banderas en "categoria", "titulo", "destacar" y "bajada".
- En "copy": No repitas textualmente la bajada en el primer párrafo. Prohibido usar números como "1)". Usá 2 emojis seguros en el encabezado en mayúsculas y 👇 en el cierre, eligiendo SOLO de esta lista compatible con Facebook: 🚨 🔴 🟠 🟡 🚧 🚔 🚒 🚑 🛑 💨 🌀 🌊 💧 ☔ ⛄ ⛅ ⚡ 🔥 💰 💵 📈 📉 📊 ⛽ 🏭 🚜 🚛 🚢 🐟 📢 📣 📰 📋 📄 📜 🏥 🏫 🎓 👷 🤝 📍 📅 🕒 ⚽ 🏆 🏅 🎭 🎶 👇 👉 📲 💬 ✅ ❌

Devolvé ÚNICAMENTE este JSON:
{
  "descartar": false,
  "categoria": "SECCIÓN / SUBTEMA EN MAYÚSCULAS SIN EMOJIS",
  "titulo": "TITULAR EN MAYÚSCULAS SIN EMOJIS (5 a 8 palabras)",
  "destacar": "FRASE COMPLETA CON SENTIDO PROPIO DENTRO DEL TITULO (jamás cortar en DE, LA, EL, A)",
  "bajada": "Subtítulo periodístico coherente, fluido y estético en castellano SIN EMOJIS (de 20 a 32 palabras para formar 3 renglones ideales o hasta 4 renglones bien cerrados), explicando el hecho y su impacto real con naturalidad.",
  "dato_clave": "Cifra central si existe, o vacío",
  "autor_cita": "Nombre y cargo si hay cita, o vacío",
  "fuente_credito": "Crédito corto en MAYÚSCULAS",
  "copy": "Texto plano en castellano separado por \\n\\n: encabezado en MAYÚSCULAS con 2 emojis seguros; luego 2 a 3 párrafos fluidos con datos verificados, contexto y consecuencia real; luego cierre invitando a seguir @elregistrosur terminado en 👇; luego ---; luego 6 a 8 hashtags en minúsculas (#noticias #elregistrosur #caletaolivia #santacruz).",
  "slides_carrusel": [
    { "titulo": "TITULAR PORTADA", "destacar": "FRASE CON SENTIDO", "bajada": "Subtítulo coherente y bien redactado de 3 a 4 renglones (20 a 30 palabras) sobre el hecho principal." },
    { "titulo": "ANTECEDENTES Y DATOS CLAVE", "destacar": "DATOS CLAVE", "bajada": "Subtítulo coherente y bien redactado de 3 a 4 renglones (20 a 30 palabras) con las cifras y el contexto." },
    { "titulo": "IMPACTO EN LA REGIÓN", "destacar": "IMPACTO EN LA REGIÓN", "bajada": "Subtítulo coherente y bien redactado de 3 a 4 renglones (20 a 30 palabras) sobre la consecuencia directa." }
  ],
  "busqueda_foto_web": "3 a 5 palabras clave en castellano para buscar foto real de prensa",
  "prompt_imagen_ia": "Photorealistic editorial news photography prompt in English (16 words, no text)"
}`;

  const userMessage = esEdicion
    ? `Borrador actual:\n${JSON.stringify({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: String(ultimoEstado.copy || '').slice(0, 700)
      })}\n\nCambio pedido: "${textoRecortado}". Devolvé JSON priorizando coherencia y estética (3 a 4 renglones en bajada y destacado con sentido completo).`
    : `Noticia:\n"${textoRecortado}"\n${contextoRecortado}\nRedactá en castellano de Argentina fluido y coherente en JSON, con destacado semántico completo y bajada estética de 3 a 4 renglones.`;

  const parsed = await llamarGroqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]);

  let cat = limpiarEmojis(parsed.categoria).toUpperCase();
  if (!cat.includes('/')) {
    cat = cat ? `CALETA OLIVIA / ${cat}` : 'SANTA CRUZ / ACTUALIDAD';
  }
  parsed.categoria = cat;

  const titDes = asegurarDestacadoEnTitulo(parsed.titulo, parsed.destacar);
  parsed.titulo = titDes.titulo;
  parsed.destacar = titDes.destacar;
  parsed.bajada = limpiarBajadaPeriodistica(parsed.bajada);
  parsed.copy = filtrarEmojisSegurosRedes(parsed.copy);

  if (Array.isArray(parsed.slides_carrusel)) {
    parsed.slides_carrusel = parsed.slides_carrusel.map(s => {
      const td = asegurarDestacadoEnTitulo(s.titulo, s.destacar);
      return {
        titulo: td.titulo,
        destacar: td.destacar,
        bajada: limpiarBajadaPeriodistica(s.bajada)
      };
    });
  }

  return parsed;
}

// ============================================================================
// MOTOR GRÁFICO 2K RETINA + ESTÉTICA DE 3 A 4 RENGLONES EN SUBTÍTULO
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
        <img id="bg-blur" src="${srcSeguro}" />
        <img id="main-img" src="${srcSeguro}" />
        <div id="watermark-center">EL REGISTRO SUR</div>
        <div id="badge-bottom">
          <span id="brand">EL REGISTRO SUR</span>
          <span id="sub">${creditoLimpio} • @ELREGISTROSUR</span>
        </div>
      </div>
    </body>
    </html>`;

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
  expandirSinCloudinary,
  esUrgente,
  esHistoria = false,
  modoVisual = 'estandar',
  numeroSlide = ''
}) {
  let fotoSegura = fotoFinalUrl;
  if (fotoFinalUrl && !fotoFinalUrl.startsWith('data:image/')) {
    const descargada = await descargarYValidarImagen(fotoFinalUrl, 6500);
    if (descargada) {
      fotoSegura = descargada.dataUrl;
    } else {
      const respaldoWeb = await buscarFotoRealEnWeb(titulo || 'Caleta Olivia Santa Cruz');
      if (respaldoWeb) fotoSegura = respaldoWeb.dataUrl;
    }
  }

  const alto = esHistoria ? 1920 : 1080;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: alto, deviceScaleFactor: 2 });

    const catLimpia = limpiarEmojis(categoria).toUpperCase();
    const { titulo: titLimpio, destacar: desLimpio } = asegurarDestacadoEnTitulo(titulo, destacar);
    const bajLimpia = limpiarBajadaPeriodistica(bajada);

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

      function blindarTipografiaProlija(el, esSubtitulo = false) {
        if (!el) return;
        el.style.textWrap = 'pretty';

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

          if (anchoUltima >= anchoPrimera * 0.45 || lineas.length >= 4) break;

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
          if (url && img.src !== url) {
            img.src = url;
            try { await img.decode(); } catch (e) {}
          }
          fotoPrincipal = img;
          if (expandir && url) {
            img.style.objectFit = 'contain';
            img.parentElement.style.backgroundImage = `url("${url}")`;
            img.parentElement.style.backgroundSize = 'cover';
            img.parentElement.style.backgroundPosition = 'center';
            img.parentElement.style.backdropFilter = 'blur(28px)';
          }
        }
      }

      if (url) {
        canvas.querySelectorAll('*').forEach(el => {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && (bg.includes('unsplash') || bg.includes('http') || bg.includes('data:image'))) {
            el.style.backgroundImage = `url("${url}")`;
          }
        });
      }

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
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.86);font-size:25px;line-height:1.36;font-weight:400;border-left:4px solid ${accentColor};padding-left:20px;">${bajada}</div>
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
              <div class="texto-equilibrado sub-bajada" style="color:rgba(255,255,255,0.86);font-size:26px;line-height:1.36;">${bajada}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:22px;">
              <span style="color:#ffffff;font-weight:900;font-size:22px;letter-spacing:1.5px;">EL REGISTRO SUR</span>
              <span style="color:${accentColor};font-weight:700;font-size:19px;">@elregistrosur</span>
            </div>
          `;
        }
        canvas.appendChild(overlay);
        overlay.querySelectorAll('.texto-equilibrado').forEach(el => blindarTipografiaProlija(el, el.classList.contains('sub-bajada')));
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
        if (el.innerText && el.innerText.trim().length > 4) {
          blindarTipografiaProlija(el, false);
        }
      });

      const subtitulos = canvas.querySelectorAll('p, .bajada, [class*="sub"], [class*="desc"]');
      subtitulos.forEach(el => {
        if (el.innerText && el.innerText.trim().length > 20) {
          blindarTipografiaProlija(el, true);
        }
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
      url: fotoSegura,
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

    await new Promise(r => setTimeout(r, 300));
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

async function generarDatosRadar(forzar = false) {
  const candidatas = await obtenerTodasLasCandidatasRadar();
  if (candidatas.length === 0) return null;

  let elegida = seleccionarNoticiaRelevante(candidatas, false);
  if (!elegida && forzar) {
    elegida = seleccionarNoticiaRelevante(candidatas, true);
  }
  if (!elegida) return null;

  noticiasEnviadasRadar.add(elegida.titulo);

  const [extraido, contexto] = await Promise.all([
    extraerNoticiaDeLink(elegida.link),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const textoCompleto = `CATEGORÍA: ${elegida.categoriaOrigen.toUpperCase()}\nMEDIO DE ORIGEN: ${elegida.medio}\nTITULAR: ${elegida.titulo}\nRESUMEN RSS: ${elegida.bajadaRss || ''}\n${extraido.textoExtraido}`;

  const noticiaIA = await procesarNoticiaConIA(textoCompleto, contexto || 'Noticia verificada en portal oficial.', false);

  const fotoInicial = extraido.fotoExtraida || elegida.fotoRss || '';
  const { urlFinal, urlOriginal, fuenteAuto } = await auditarYResolverImagen({
    fotoCandidataUrl: fotoInicial,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    busquedaWebSugerida: noticiaIA.busqueda_foto_web,
    promptIaSugerido: noticiaIA.prompt_imagen_ia
  });

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
    expandirSinCloudinary: false,
    esUrgente: false,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: urlFinal,
    foto_original_url: urlOriginal || urlFinal,
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
    urgente: false,
    imagen_buffer: imageBuffer,
    historia_buffer: null,
    carrusel_buffers: []
  });

  return { imageBuffer, noticiaIA, medio: elegida.medio };
}

async function ejecutarAlertaRuta3YServicios() {
  const queryRuta = '("Ruta 3" OR "Ruta Nacional 3" OR "Ramón Santos" OR "Caleta Olivia") (corte OR tránsito OR agua OR luz OR acueducto OR viento OR alerta) when:24h';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryRuta)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const items = await leerUnFeedRss({ url, medio: 'VIALIDAD / SERVICIOS', categoria: 'regional' });

  const nuevos = items.filter(i => !noticiasEnviadasRadar.has(i.titulo));
  const elegida = nuevos[0] || items[0];
  if (!elegida) return null;

  noticiasEnviadasRadar.add(elegida.titulo);

  const [extraido, contexto] = await Promise.all([
    extraerNoticiaDeLink(elegida.link),
    buscarContextoEnGoogleNews(elegida.titulo)
  ]);

  const noticiaIA = await procesarNoticiaConIA(`ALERTA VIAL / SERVICIOS ZONA NORTE: ${elegida.titulo}\n${extraido.textoExtraido}`, contexto || 'Reporte vial y de servicios.', false);

  const { urlFinal, urlOriginal, fuenteAuto } = await auditarYResolverImagen({
    fotoCandidataUrl: extraido.fotoExtraida || elegida.fotoRss,
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    busquedaWebSugerida: 'Ruta Nacional 3 Caleta Olivia Santa Cruz',
    promptIaSugerido: 'Patagonia Argentina coastal highway Ruta 3 traffic alert news photography'
  });

  const imageBuffer = await renderizarFlyer({
    categoria: 'ZONA NORTE / ALERTA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    fuenteCredito: fuenteAuto || 'VIALIDAD / SERVICIOS',
    fotoFinalUrl: urlFinal,
    expandirSinCloudinary: false,
    esUrgente: true,
    esHistoria: false,
    modoVisual: 'estandar'
  });

  guardarEnColaBorradores({
    foto_url: urlFinal,
    foto_original_url: urlOriginal || urlFinal,
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
  const candidatas = await obtenerTodasLasCandidatasRadar();
  const titulares = candidatas.slice(0, 14)
    .map(t => `- [${t.medio}] ${t.titulo}`)
    .join('\n')
    .slice(0, 1400);

  const promptResumen = `Sos el Editor Jefe de 'EL REGISTRO SUR' (Caleta Olivia, Santa Cruz). Redactá estrictamente en castellano natural y fluido.
A partir de los hechos confirmados de hoy en Argentina y Santa Cruz, armá el RESUMEN DIARIO EN CARRUSEL de 5 placas:
- Placa 1 (Portada): "LO QUE PASÓ HOY EN EL SUR"
- Placas 2, 3, 4 y 5: Las 4 noticias más importantes del día (1 de Caleta Olivia, 1 de Santa Cruz/energía, 1 de economía/política nacional, 1 de deportes o espectáculo viral).

REGLAS ESTRICTAS:
- PROHIBIDO emojis o banderas en los títulos y bajadas de las placas.
- "destacar": Frase completa con sentido propio dentro del título (prohibido cortar en DE, LA, EL, A).
- "bajada": Subtítulo coherente, fluido y estético de 3 a 4 renglones (20 a 30 palabras) con todos sus artículos.
- En "copy", usá texto 100% plano en castellano sin números como 1), con emojis seguros de Facebook (🚨, 📰, 📍, 👇) y hashtags en minúsculas.

Titulares del día:
${titulares}

Devolvé ÚNICAMENTE este JSON:
{
  "slides": [
    { "titulo": "LO QUE PASÓ HOY EN EL SUR", "destacar": "LO QUE PASÓ HOY", "bajada": "Repaso completo por los cuatro hechos más relevantes que marcaron la jornada informativa en Caleta Olivia, la provincia de Santa Cruz y el país." },
    { "titulo": "TITULAR TEMA 1", "destacar": "FRASE CON SENTIDO", "bajada": "Oración informativa coherente y natural de 20 a 30 palabras explicando el hecho y su impacto directo en la comunidad." },
    { "titulo": "TITULAR TEMA 2", "destacar": "FRASE CON SENTIDO", "bajada": "Oración informativa coherente y natural de 20 a 30 palabras explicando el hecho y su impacto directo en la comunidad." },
    { "titulo": "TITULAR TEMA 3", "destacar": "FRASE CON SENTIDO", "bajada": "Oración informativa coherente y natural de 20 a 30 palabras explicando el hecho y su impacto directo en la comunidad." },
    { "titulo": "TITULAR TEMA 4", "destacar": "FRASE CON SENTIDO", "bajada": "Oración informativa coherente y natural de 20 a 30 palabras explicando el hecho y su impacto directo en la comunidad." }
  ],
  "copy": "📰 RESUMEN DEL DÍA EN EL REGISTRO SUR 📍\\n\\nRepaso rápido con los hechos clave de hoy en Caleta Olivia, Santa Cruz y el país.\\n\\nDeslizá para ver cada tema y seguí @elregistrosur para estar informado 👇\\n\\n---\\n\\n#noticias #elregistrosur #caletaolivia #santacruz #resumendeldia #patagonia"
}`;

  const parsed = await llamarGroqChat([{ role: 'user', content: promptResumen }]);
  const slides = (parsed.slides || []).slice(0, 5);
  const { urlFinal: fotoBase } = await auditarYResolverImagen({
    fotoCandidataUrl: '',
    esFotoManualDelEditor: false,
    titulo: 'Caleta Olivia Santa Cruz Patagonia',
    busquedaWebSugerida: 'Caleta Olivia Santa Cruz costanera',
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina dusk city coast editorial photography'
  });

  const buffers = [];
  for (let i = 0; i < slides.length; i++) {
    const td = asegurarDestacadoEnTitulo(slides[i].titulo, slides[i].destacar);
    const buf = await renderizarFlyer({
      categoria: 'RESUMEN DEL DÍA / SANTA CRUZ',
      titulo: td.titulo,
      destacar: td.destacar,
      bajada: limpiarBajadaPeriodistica(slides[i].bajada),
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
    categoria: 'RESUMEN DEL DÍA / SANTA CRUZ',
    titulo: limpiarEmojis(slides[0].titulo),
    destacar: limpiarEmojis(slides[0].destacar),
    bajada: limpiarBajadaPeriodistica(slides[0].bajada),
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
  const { urlFinal: fotoClima } = await auditarYResolverImagen({
    fotoCandidataUrl: '',
    esFotoManualDelEditor: false,
    titulo: 'Clima Caleta Olivia Costanera',
    busquedaWebSugerida: 'Costanera Caleta Olivia Santa Cruz mar cielo',
    promptIaSugerido: 'Caleta Olivia Patagonia Argentina coastal city sea sky dramatic weather photography'
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

setInterval(async () => {
  try {
    const radar = await generarDatosRadar(false);
    if (radar) {
      await enviarFotoConBotonesTelegram(
        radar.imageBuffer,
        `🚨 RADAR (${radar.medio.toUpperCase()}) — ¿QUERÉS PUBLICARLO?\n\n${radar.noticiaIA.copy}`
      );
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
  if (!radar) return res.json({ enviado: false, motivo: 'Sin noticias disponibles.' });
  await enviarFotoConBotonesTelegram(radar.imageBuffer, `🚨 RADAR (${radar.medio.toUpperCase()}) — ¿QUERÉS PUBLICARLO?\n\n${radar.noticiaIA.copy}`);
  res.json({ enviado: true, titulo: radar.noticiaIA.titulo, medio: radar.medio });
});

app.get('/clima', async (req, res) => {
  const { imageBuffer, noticiaIA } = await ejecutarParteClima();
  await enviarFotoConBotonesTelegram(imageBuffer, `📢 PARTE DIARIO DE CLIMA Y VIENTO:\n\n${noticiaIA.copy}`);
  res.json({ ok: true, titulo: noticiaIA.titulo });
});

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

    const ahoraMs = Date.now();
    if (texto_crudo && texto_crudo === ultimoComandoTexto && (ahoraMs - ultimoComandoTimestamp) < 8000) {
      return res.status(200).json({ ok: true, descartado: true, imagen_base64: '' });
    }
    ultimoComandoTexto = texto_crudo;
    ultimoComandoTimestamp = ahoraMs;

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

    if (comando === 'comandos' || comando === 'ayuda') {
      const textoAyuda = `🤖 COMANDOS DE EL REGISTRO SUR:\n\n.radar → Busca la noticia más importante o viral en tus 21 portales\n.ruta3 → Revisa estado de Ruta Nacional N° 3 y servicios\n.resumen → Arma carrusel de 5 placas con lo más importante del día\n.marca [crédito] → Estampa marca de agua de El Registro Sur en fotos de vecinos\n.clima → Parte meteorológico de Caleta Olivia\n.urgente / .normal → Cambia el color de alerta\n.cita / .dato / .carrusel / .historia → Formatos especiales\n.expandir / .auditar / .ia [tema] → Ajustes de imagen\n.editar [cambio] → Corrige textos del borrador actual\n.descartar → Descarta la placa actual\n.publicar → Sube a Facebook e Instagram`;
      await enviarMensajeTelegram(textoAyuda);
      return res.json({ ok: true, descartado: true, imagen_base64: '' });
    }

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
        destacar: 'REGISTRO EXCLUSIVO',
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

    if (comando === 'radar' || comando === 'comandoradar') {
      const radar = await generarDatosRadar(true);
      if (!radar) {
        await enviarMensajeTelegram('🔎 No se pudieron leer los portales en este momento. Intentá de nuevo en unos segundos.');
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

    if (comando === 'carrusel' && ultimoEstado.titulo) {
      const noticiaIA = await procesarNoticiaConIA(`Generá el carrusel de 3 placas para esta noticia: ${ultimoEstado.titulo}. ${ultimoEstado.copy}`, 'Borrador ya verificado.', true);
      const slides = (noticiaIA.slides_carrusel && noticiaIA.slides_carrusel.length >= 3)
        ? noticiaIA.slides_carrusel.slice(0, 3)
        : [
            { titulo: ultimoEstado.titulo, destacar: ultimoEstado.destacar, bajada: ultimoEstado.bajada },
            { titulo: 'EL CONTEXTO Y LOS DATOS CLAVE', destacar: 'DATOS CLAVE', bajada: ultimoEstado.bajada },
            { titulo: 'IMPACTO DIRECTO EN SANTA CRUZ', destacar: 'SANTA CRUZ', bajada: ultimoEstado.bajada }
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

    if ((comando === 'auditar' || comando === 'comandoauditar') && ultimoEstado.titulo) {
      const { urlFinal, urlOriginal, fuenteAuto } = await auditarYResolverImagen({
        fotoCandidataUrl: '',
        esFotoManualDelEditor: false,
        titulo: ultimoEstado.titulo,
        busquedaWebSugerida: ultimoEstado.titulo,
        promptIaSugerido: ultimoEstado.prompt_imagen_ia,
        forzarBusquedaNueva: true
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
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: ultimoEstado.modo_visual
      });

      ultimoEstado.foto_url = urlFinal;
      ultimoEstado.foto_original_url = urlOriginal || urlFinal;
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
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain',
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

    if ((comando === 'expandir' || comando === 'comandoexpandir') && ultimoEstado.titulo) {
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: true,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: 'estandar'
      });

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
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain',
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
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria.replace(/^URGENTE\s*\/\s*/i, ''),
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        datoClave: ultimoEstado.dato_clave,
        autorCita: ultimoEstado.autor_cita,
        fuenteCredito: ultimoEstado.fuente_credito,
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: false,
        esUrgente: false,
        esHistoria: false,
        modoVisual: 'estandar'
      });
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
        fuenteCredito: 'ILUSTRACIÓN IA',
        fotoFinalUrl: fotoFinalIA,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false,
        modoVisual: ultimoEstado.modo_visual
      });

      ultimoEstado.foto_url = fotoFinalIA;
      ultimoEstado.foto_original_url = nuevaUrlIA;
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
        textoParaProcesar = `${textoParaProcesar}\n\n${extraidoLink.textoExtraido}`.slice(0, 1500);
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

    let fotoFinalParaPlaca = esEdicion ? ultimoEstado.foto_url : '';
    let fotoOriginalGuardar = esEdicion ? ultimoEstado.foto_original_url : '';

    if (fotoNuevaRecibida || !esEdicion || !fotoFinalParaPlaca) {
      const resultadoAuditoria = await auditarYResolverImagen({
        fotoCandidataUrl: fotoNuevaRecibida || fotoOriginalGuardar,
        esFotoManualDelEditor: Boolean(nuevaFotoTelegram),
        titulo,
        busquedaWebSugerida: busquedaFotoWeb,
        promptIaSugerido: promptImagenIA
      });
      fotoFinalParaPlaca = resultadoAuditoria.urlFinal;
      fotoOriginalGuardar = resultadoAuditoria.urlOriginal || resultadoAuditoria.urlFinal;
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
      expandirSinCloudinary: usarModoExpandido,
      esUrgente,
      esHistoria: false,
      modoVisual: 'estandar'
    });

    const nuevoEstado = {
      foto_url: fotoFinalParaPlaca,
      foto_original_url: fotoOriginalGuardar,
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
app.listen(PORT, () => console.log(`El Registro Sur 2K + Multi-Key listo en puerto ${PORT}`));
