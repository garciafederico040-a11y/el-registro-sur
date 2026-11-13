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

let ultimoEstado = {
  foto_url: '',
  foto_original_url: '',
  categoria: '',
  titulo: '',
  destacar: '',
  bajada: '',
  copy: '',
  prompt_imagen_ia: 'journalism news photography Argentina Patagonia',
  fill_mode: 'cover',
  urgente: false,
  imagen_buffer: null,
  historia_buffer: null
};

const noticiasEnviadasRadar = new Set();
let ultimoClimaDiaEnviado = '';

app.get('/ping', (req, res) => res.status(200).send('OK - Súper Asistente 2K + Auditor IA activo'));

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

    return {
      fotoExtraida: fotoUrl,
      textoExtraido: `TÍTULO ORIGINAL: ${ogTitleMatch ? ogTitleMatch[1] : ''}\nCUERPO: ${parrafos}`
    };
  } catch (e) {
    return { fotoExtraida: '', textoExtraido: '' };
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
      .slice(0, 4)
      .map(m => `- ${m[1].replace(/<!\[CDATA\[|\]\]>/g, '')} (${m[2]})`)
      .join('\n');

    return items ? `\nCONTEXTO RECIENTE EN MEDIOS DE ARGENTINA:\n${items}` : '';
  } catch (e) {
    return '';
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

  return `PARTE METEOROLÓGICO OFICIAL PARA CALETA OLIVIA HOY: Temperatura actual ${tempActual}°C (Mínima ${minHoy}°C / Máxima ${maxHoy}°C). Viento sostenido de ${vientoActual} km/h con ráfagas máximas previstas de hasta ${rafagasHoy} km/h en la ciudad y Ruta Nacional N° 3.`;
}

function optimizarFotoConCloudinary(fotoUrl, expandir = false, alto = 1080) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !fotoUrl || fotoUrl.includes('res.cloudinary.com')) return fotoUrl;

  if (expandir) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/c_pad,w_1440,h_${alto === 1920 ? 2560 : 1440},b_gen_fill,e_improve,e_sharpen:80,f_png,q_100/${encodeURIComponent(fotoUrl)}`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/fetch/c_limit,w_2160,h_2160,e_improve,e_sharpen:80,f_png,q_100/${encodeURIComponent(fotoUrl)}`;
}

function construirUrlPollinationsHD(prompt) {
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1440&height=1440&model=flux&enhance=true&nologo=true&seed=${seed}`;
}

// ============================================================================
// AUDITOR VISUAL DE IA + BUSCADOR DE IMÁGENES EN LA WEB
// ============================================================================

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
    // Descarta miniaturas borrosas o íconos menores a 18 KB
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

  const promptAuditor = `Sos el Auditor Visual Jefe del diario digital 'El Registro Sur'.
Analizá la imagen adjunta y comparala con esta noticia:
- SECCIÓN: ${categoria}
- TITULAR: ${titulo}
- BAJADA: ${bajada}

Criterios estrictos para APROBAR o RECHAZAR la imagen:
1. RECHAZAR si es un logo genérico de un diario/canal, una placa con mucho texto superpuesto, una captura de pantalla borrosa o un gráfico abstracto sin relación.
2. RECHAZAR si el contenido visual contradice la noticia (ej. muestra playa tropical para una noticia de nieve en Patagonia, o un político/persona totalmente ajena al tema).
3. APROBAR si muestra el lugar, protagonista, actividad o escena periodística coherente con el titular y tiene nitidez aceptable.

Devolvé ÚNICAMENTE este JSON:
{
  "aprobada": true o false,
  "razon": "Explicación breve en español",
  "busqueda_web": "3 a 5 palabras clave en español para buscar una foto real de prensa en internet si fue rechazada",
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
        signal: AbortSignal.timeout(12000),
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
      const veredicto = JSON.parse(data?.choices?.[0]?.message?.content);
      return veredicto;
    } catch (e) {
      continue;
    }
  }

  // Si el servicio de visión no responde temporalmente, aprueba la imagen si pasó el filtro técnico de peso/resolución
  return { aprobada: true, razon: 'Aprobada por validación técnica' };
}

async function buscarFotoRealEnWeb(consulta) {
  if (!consulta || consulta.trim().length < 3) return '';
  try {
    // 1. Obtener token de búsqueda de imágenes
    const initResp = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(consulta)}&iax=images&ia=images`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const initHtml = await initResp.text();
    const vqdMatch = initHtml.match(/vqd=["']([^"']+)["']/i) || initHtml.match(/vqd=([0-9-]+)/i);

    if (vqdMatch) {
      const jsonUrl = `https://duckduckgo.com/i.js?l=ar-es&o=json&q=${encodeURIComponent(consulta)}&vqd=${vqdMatch[1]}&f=,,,,,&p=1`;
      const imgResp = await fetch(jsonUrl, {
        signal: AbortSignal.timeout(7000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://duckduckgo.com/'
        }
      });
      const imgData = await imgResp.json();
      const candidatas = (imgData.results || [])
        .filter(r => (r.width || 0) >= 750 && (r.height || 0) >= 500)
        .slice(0, 5);

      for (const cand of candidatas) {
        const validada = await descargarYValidarImagen(cand.image);
        if (validada) return validada.url;
      }
    }
  } catch (e) {
    console.log('Búsqueda web de imágenes sin resultados directos, pasando a IA.');
  }
  return '';
}

async function auditarYResolverImagen({
  fotoCandidataUrl,
  esFotoManualDelEditor,
  titulo,
  bajada,
  categoria,
  busquedaWebSugerida,
  promptIaSugerido
}) {
  // Si el director mandó una foto propia desde Telegram y no pidió .auditar, la respetamos
  if (fotoCandidataUrl && esFotoManualDelEditor) {
    return { urlFinal: fotoCandidataUrl, estadoAuditoria: 'Foto enviada por el editor' };
  }

  // 1. Auditar la imagen candidata (ej. extraída de un link o web)
  if (fotoCandidataUrl) {
    const validada = await descargarYValidarImagen(fotoCandidataUrl);
    if (validada) {
      const veredicto = await auditarCoherenciaConVision(validada, titulo, bajada, categoria);
      if (veredicto.aprobada) {
        return { urlFinal: fotoCandidataUrl, estadoAuditoria: `Aprobada por Auditor IA: ${veredicto.razon}` };
      }
      console.log(`Auditor IA rechazó imagen (${veredicto.razon}). Buscando reemplazo...`);
      busquedaWebSugerida = veredicto.busqueda_web || busquedaWebSugerida;
      promptIaSugerido = veredicto.prompt_ia_corregido || promptIaSugerido;
    }
  }

  // 2. Plan B1: Buscar una foto real coherente en la web
  const queryWeb = busquedaWebSugerida || titulo;
  const fotoWebEncontrada = await buscarFotoRealEnWeb(queryWeb);
  if (fotoWebEncontrada) {
    return { urlFinal: fotoWebEncontrada, estadoAuditoria: `Reemplazada por foto real encontrada en web (${queryWeb})` };
  }

  // 3. Plan B2: Generar imagen HD coherente con IA (Pollinations Flux)
  const fotoIA = construirUrlPollinationsHD(promptIaSugerido || 'Argentina Patagonia journalism news photography');
  return { urlFinal: fotoIA, estadoAuditoria: 'Generada con IA coherente (Flux HD)' };
}

// ============================================================================
// CEREBRO EDITORIAL CON GROQ
// ============================================================================

async function procesarNoticiaConIA(textoCrudo, contextoWeb = '', esEdicion = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta configurar GROQ_API_KEY en Render.');

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur | elregistrosur.com.ar), medio periodístico digital de Caleta Olivia, Santa Cruz ("El sur tiene registro").

LÍNEA EDITORIAL Y FILTRO POLÍTICO:
1. Tono institucional, periodístico, factual, directo y moderno.
2. Posicionamiento: Pro-gestión hacia el Gobierno Nacional (Javier Milei: equilibrio fiscal, desregulación, orden, baja de inflación) y hacia el Gobierno Provincial de Santa Cruz (Claudio Vidal: producción, energía, trabajo, obras y auditoría del Estado).
3. Contraste mediante datos duros frente al kirchnerismo, desmanejos de gestiones anteriores o paros/bloqueos que afecten servicios y producción, sin insultos ni agravios para cumplir políticas de Meta Ads.

REGLAS DE SALIDA JSON:
Devolvé ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "categoria": "SECCIÓN / SUBTEMA en MAYÚSCULAS (ej. SANTA CRUZ / GESTIÓN, ECONOMÍA / ENERGÍA, POLÍTICA / NACIÓN, CALETA OLIVIA / CLIMA, URGENTE / ALERTA)",
  "titulo": "Titular en MAYÚSCULAS, corto, directo y con gancho (4 a 8 palabras máximo)",
  "destacar": "Subcadena EXACTA dentro de 'titulo' (2 a 4 palabras clave) que irá resaltada",
  "bajada": "1 sola oración corta y contundente con el dato clave (máx 15 palabras)",
  "copy": "Texto 100% plano para Instagram y Facebook (SIN viñetas, SIN guiones, SIN asteriscos ni negritas), separado por \\n\\n:\\n1) TITULAR EN MAYÚSCULAS con 2 emojis.\\n2) 2 a 3 párrafos cortos y limpios explicando hechos y contexto.\\n3) Toda la cobertura en @elregistrosur\\n4) Pregunta de debate cerrada con: Te leemos en comentarios 👇\\n5) ---\\n6) 6 a 8 hashtags ESTRICTAMENTE EN MINÚSCULAS (#noticias #elregistrosur #caletaolivia #santacruz más específicos).",
  "busqueda_foto_web": "3 a 5 palabras clave en español para buscar en internet una foto real de prensa de esta noticia",
  "prompt_imagen_ia": "Descripción fotográfica realista en inglés (18 palabras, estilo fotoperiodismo editorial, sin texto ni letras)"
}`;

  const userMessage = esEdicion
    ? `Borrador actual:\n${JSON.stringify({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy
      }, null, 2)}\n\nPedido de modificación del director: "${textoCrudo}".\n${contextoWeb}\nAplicá el cambio respetando todas las reglas y devolvé el JSON actualizado.`
    : `Información recibida:\n"${textoCrudo}"\n${contextoWeb}\nRedactá la pieza completa en JSON.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Groq (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

// ============================================================================
// MOTOR GRÁFICO 2K RETINA (2160x2160 px reales)
// ============================================================================

async function renderizarFlyer({ categoria, titulo, destacar, bajada, fotoFinalUrl, expandirSinCloudinary, esUrgente, esHistoria = false }) {
  const alto = esHistoria ? 1920 : 1080;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: alto, deviceScaleFactor: 2 });

  let htmlModificado = templateHtml
    .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', (titulo || '').replace(/"/g, '&quot;'))
    .replace('VENTA DE TIERRAS A EXTRANJEROS', (destacar || '').replace(/"/g, '&quot;'))
    .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', (bajada || '').replace(/"/g, '&quot;'))
    .replace('POLÍTICA', (categoria || '').replace(/"/g, '&quot;'));

  if (fotoFinalUrl) {
    htmlModificado = htmlModificado.replace(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g, fotoFinalUrl);
  }

  await page.setContent(htmlModificado, { waitUntil: 'networkidle0' });

  await page.evaluate(({ url, expandir, modoUrgente, modoHistoria }) => {
    document.body.style.webkitFontSmoothing = 'antialiased';
    document.body.style.textRendering = 'optimizeLegibility';

    const canvas = document.querySelector('#canvas');
    if (canvas && modoHistoria) {
      canvas.style.height = '1920px';
      document.body.style.height = '1920px';
    }

    const imgs = document.querySelectorAll('#canvas img');
    imgs.forEach(img => {
      img.style.imageRendering = '-webkit-optimize-contrast';
      if (img.src.includes('unsplash') || img.id.includes('bg') || img.className.includes('bg') || img.width > 400) {
        if (url) img.src = url;
        if (expandir && url) {
          img.style.objectFit = 'contain';
          img.parentElement.style.backgroundImage = `url("${url}")`;
          img.parentElement.style.backgroundSize = 'cover';
          img.parentElement.style.backgroundPosition = 'center';
          img.parentElement.style.backdropFilter = 'blur(28px)';
        }
      }
    });

    if (modoUrgente) {
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.color === 'rgb(56, 189, 248)' || style.color === 'rgb(0, 174, 239)') el.style.color = '#ef4444';
        if (style.backgroundColor === 'rgb(56, 189, 248)' || style.backgroundColor === 'rgb(0, 174, 239)') el.style.backgroundColor = '#ef4444';
      });
    }
  }, { url: fotoFinalUrl, expandir: expandirSinCloudinary, modoUrgente: esUrgente, modoHistoria: esHistoria });

  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 900));

  const canvasElement = await page.$('#canvas');
  const imageBuffer = await canvasElement.screenshot({ type: 'png' });
  await browser.close();
  return imageBuffer;
}

async function enviarSugerenciaTelegram(imageBuffer, prefijo, copy) {
  const form = new FormData();
  form.append('chat_id', EDITOR_CHAT_ID);
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'flyer_2k.png');
  form.append('caption', `${prefijo}\n\n${copy}`.slice(0, 1020));

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form
  });
}

async function generarDatosRadar(forzar = false) {
  const query = '("Caleta Olivia" OR "Claudio Vidal" OR "Santa Cruz" OR "Javier Milei") when:3h';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const resp = await fetch(url);
  const xml = await resp.text();

  const todos = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi)]
    .map(m => ({
      titulo: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: m[2].trim()
    }));

  const filtrados = todos.filter(item => !noticiasEnviadasRadar.has(item.titulo));
  const elegida = filtrados[0] || (forzar ? todos[0] : null);
  if (!elegida) return null;

  noticiasEnviadasRadar.add(elegida.titulo);

  const contexto = await buscarContextoEnGoogleNews(elegida.titulo);
  const noticiaIA = await procesarNoticiaConIA(`URGENTE DETECTADO: ${elegida.titulo}`, contexto, false);

  const { urlFinal } = await auditarYResolverImagen({
    fotoCandidataUrl: '',
    esFotoManualDelEditor: false,
    titulo: noticiaIA.titulo,
    bajada: noticiaIA.bajada,
    categoria: noticiaIA.categoria,
    busquedaWebSugerida: noticiaIA.busqueda_foto_web,
    promptIaSugerido: noticiaIA.prompt_imagen_ia
  });

  const fotoOptimizada = optimizarFotoConCloudinary(urlFinal, false, 1080);

  const imageBuffer = await renderizarFlyer({
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    fotoFinalUrl: fotoOptimizada,
    expandirSinCloudinary: false,
    esUrgente: true,
    esHistoria: false
  });

  ultimoEstado = {
    foto_url: fotoOptimizada,
    foto_original_url: urlFinal,
    categoria: noticiaIA.categoria,
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    prompt_imagen_ia: noticiaIA.prompt_imagen_ia || 'Argentina Patagonia news journalism',
    fill_mode: 'cover',
    urgente: true,
    imagen_buffer: imageBuffer,
    historia_buffer: null
  };

  return { imageBuffer, noticiaIA };
}

async function ejecutarParteClima() {
  const textoClima = await obtenerDatosClimaCaleta();
  const noticiaIA = await procesarNoticiaConIA(textoClima, '', false);
  const fotoClima = construirUrlPollinationsHD('Caleta Olivia Patagonia Argentina coastal city sea sky dramatic weather photography');

  const imageBuffer = await renderizarFlyer({
    categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    fotoFinalUrl: fotoClima,
    expandirSinCloudinary: false,
    esUrgente: /ráfagas de [789]\d|ráfagas de 1\d\d/i.test(textoClima),
    esHistoria: false
  });

  ultimoEstado = {
    foto_url: fotoClima,
    foto_original_url: fotoClima,
    categoria: 'CALETA OLIVIA / CLIMA',
    titulo: noticiaIA.titulo,
    destacar: noticiaIA.destacar,
    bajada: noticiaIA.bajada,
    copy: noticiaIA.copy,
    prompt_imagen_ia: 'Caleta Olivia Patagonia coastal weather',
    fill_mode: 'cover',
    urgente: false,
    imagen_buffer: imageBuffer,
    historia_buffer: null
  };

  return { imageBuffer, noticiaIA };
}

setInterval(async () => {
  try {
    const radar = await generarDatosRadar(false);
    if (radar) {
      await enviarSugerenciaTelegram(radar.imageBuffer, '🚨 SUGERENCIA URGENTE DEL RADAR:', radar.noticiaIA.copy);
    }
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Rio_Gallegos' }));
    const fechaHoy = ahoraAR.toISOString().slice(0, 10);
    if (ahoraAR.getHours() === 8 && ahoraAR.getMinutes() >= 25 && ultimoClimaDiaEnviado !== fechaHoy) {
      ultimoClimaDiaEnviado = fechaHoy;
      const { imageBuffer, noticiaIA } = await ejecutarParteClima();
      await enviarSugerenciaTelegram(imageBuffer, '🌤️ PARTE DIARIO DE CLIMA Y VIENTO:', noticiaIA.copy);
    }
  } catch (e) {
    console.error('Error en tarea programada:', e.message);
  }
}, 30 * 60 * 1000);

app.get('/radar', async (req, res) => {
  const radar = await generarDatosRadar(true);
  if (!radar) return res.json({ enviado: false, motivo: 'Sin noticias encontradas.' });
  await enviarSugerenciaTelegram(radar.imageBuffer, '🚨 SUGERENCIA URGENTE DEL RADAR:', radar.noticiaIA.copy);
  res.json({ enviado: true, titulo: radar.noticiaIA.titulo });
});

app.get('/clima', async (req, res) => {
  const { imageBuffer, noticiaIA } = await ejecutarParteClima();
  await enviarSugerenciaTelegram(imageBuffer, '🌤️ PARTE DIARIO DE CLIMA Y VIENTO:', noticiaIA.copy);
  res.json({ ok: true, titulo: noticiaIA.titulo });
});

app.post('/generar', async (req, res) => {
  try {
    let { foto_url, file_path, file_id, texto_crudo, categoria, titulo, destacar, bajada, fill_mode } = req.body;
    let copy = '';
    texto_crudo = (texto_crudo || '').trim();

    const matchComando = texto_crudo.match(/^\.([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)\s*([\s\S]*)$/);
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

    if (comando === 'comandos' || comando === 'ayuda') {
      const textoAyuda = `🤖 COMANDOS DE EL REGISTRO SUR:\n\n.urgente → Pone el flyer en rojo alerta (solo o con noticia)\n.normal → Vuelve el flyer al celeste clásico\n.editar [cambio] → Modifica textos del último flyer\n.auditar → Verifica la foto actual o busca otra coherente en la web/IA\n.expandir → Ajusta la foto entera sin recortar bordes\n.ia [descripción] → Genera un fondo nuevo en HD con IA\n.historia → Adapta el último flyer a vertical 9:16\n.clima → Genera el parte de clima y viento de Caleta Olivia\n.radar → Busca una noticia urgente ahora mismo\n.publicar → Sube el último borrador a Facebook e Instagram`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: EDITOR_CHAT_ID, text: textoAyuda })
      });
      return res.json({ ok: true, copy: textoAyuda, imagen_base64: ultimoEstado.imagen_buffer ? ultimoEstado.imagen_buffer.toString('base64') : '' });
    }

    if (comando === 'radar' || comando === 'comandoradar') {
      const radar = await generarDatosRadar(true);
      if (!radar) throw new Error('No se encontraron noticias urgentes en este momento.');
      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: `🚨 SUGERENCIA URGENTE DEL RADAR:\n\n${ultimoEstado.copy}`,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
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
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: ultimoEstado.imagen_buffer.toString('base64')
      });
    }

    if ((comando === 'auditar' || comando === 'comandoauditar') && ultimoEstado.titulo) {
      const { urlFinal, estadoAuditoria } = await auditarYResolverImagen({
        fotoCandidataUrl: ultimoEstado.foto_original_url,
        esFotoManualDelEditor: false,
        titulo: ultimoEstado.titulo,
        bajada: ultimoEstado.bajada,
        categoria: ultimoEstado.categoria,
        busquedaWebSugerida: ultimoEstado.titulo,
        promptIaSugerido: ultimoEstado.prompt_imagen_ia
      });

      const fotoOptimizada = optimizarFotoConCloudinary(urlFinal, false, 1080);
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        fotoFinalUrl: fotoOptimizada,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false
      });

      ultimoEstado.foto_url = fotoOptimizada;
      ultimoEstado.foto_original_url = urlFinal;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        auditoria: estadoAuditoria,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
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
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain' && !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: ultimoEstado.urgente,
        esHistoria: true
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
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-historia.png?t=${Date.now()}`,
        imagen_base64: historiaBuffer.toString('base64')
      });
    }

    if ((comando === 'expandir' || comando === 'comandoexpandir') && ultimoEstado.titulo) {
      const fotoExpandida = optimizarFotoConCloudinary(ultimoEstado.foto_original_url, true, 1080);

      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        fotoFinalUrl: fotoExpandida,
        expandirSinCloudinary: !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false
      });

      ultimoEstado.foto_url = fotoExpandida;
      ultimoEstado.fill_mode = 'contain';
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    if ((comando === 'urgente' || comando === 'comandourgente') && !argumento && !nuevaFotoTelegram && ultimoEstado.titulo) {
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria.includes('URGENTE') ? ultimoEstado.categoria : `URGENTE / ${ultimoEstado.categoria.split('/')[0].trim()}`,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        fotoFinalUrl: ultimoEstado.foto_url,
        expandirSinCloudinary: ultimoEstado.fill_mode === 'contain' && !process.env.CLOUDINARY_CLOUD_NAME,
        esUrgente: true,
        esHistoria: false
      });
      ultimoEstado.urgente = true;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    if ((comando === 'normal' || comando === 'comandonormal') && ultimoEstado.titulo) {
      const fotoMejorada = optimizarFotoConCloudinary(ultimoEstado.foto_original_url, false, 1080);
      const imageBuffer = await renderizarFlyer({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        fotoFinalUrl: fotoMejorada,
        expandirSinCloudinary: false,
        esUrgente: false,
        esHistoria: false
      });
      ultimoEstado.foto_url = fotoMejorada;
      ultimoEstado.urgente = false;
      ultimoEstado.fill_mode = 'cover';
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
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
        fotoFinalUrl: nuevaFotoIA,
        expandirSinCloudinary: false,
        esUrgente: ultimoEstado.urgente,
        esHistoria: false
      });

      ultimoEstado.foto_url = nuevaFotoIA;
      ultimoEstado.foto_original_url = nuevaFotoIA;
      ultimoEstado.imagen_buffer = imageBuffer;

      return res.json({
        ok: true,
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy,
        url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // Procesamiento de noticia nueva o .editar
    let textoParaProcesar = comando ? argumento : texto_crudo;
    const urlDetectada = textoParaProcesar.match(/https?:\/\/[^\s]+/i)?.[0];
    let fotoDeLink = '';
    if (urlDetectada) {
      const extraido = await extraerNoticiaDeLink(urlDetectada);
      fotoDeLink = extraido.fotoExtraida;
      if (extraido.textoExtraido) {
        textoParaProcesar += `\n\n[DATOS EXTRAÍDOS DEL LINK]:\n${extraido.textoExtraido}`;
      }
    }

    const fotoNuevaRecibida = nuevaFotoTelegram || fotoDeLink;
    const esEdicion = comando === 'editar' || comando === 'modificar' || comando === 'comandoeditar';
    const esUrgente = comando === 'urgente' || comando === 'comandourgente' || (esEdicion && ultimoEstado.urgente);

    const contextoWeb = await buscarContextoEnGoogleNews(textoParaProcesar);
    let promptImagenIA = ultimoEstado.prompt_imagen_ia;
    let busquedaFotoWeb = '';

    if (textoParaProcesar.length > 0) {
      const noticiaIA = await procesarNoticiaConIA(textoParaProcesar, contextoWeb, esEdicion);
      categoria = noticiaIA.categoria || ultimoEstado.categoria || 'NOTICIAS / ACTUALIDAD';
      titulo = noticiaIA.titulo || ultimoEstado.titulo || '';
      destacar = noticiaIA.destacar || '';
      bajada = noticiaIA.bajada || ultimoEstado.bajada || '';
      copy = noticiaIA.copy || '';
      promptImagenIA = noticiaIA.prompt_imagen_ia || 'journalism news photography Argentina Patagonia';
      busquedaFotoWeb = noticiaIA.busqueda_foto_web || titulo;
    }

    let fotoBase = fotoNuevaRecibida || (esEdicion ? ultimoEstado.foto_original_url : '');
    let estadoAuditoria = 'Sin auditoría';

    // Ejecuta el Auditor Visual de IA si no es una edición de texto puro
    if (!esEdicion || !fotoBase) {
      const resultadoAuditoria = await auditarYResolverImagen({
        fotoCandidataUrl: fotoBase,
        esFotoManualDelEditor: Boolean(nuevaFotoTelegram),
        titulo,
        bajada,
        categoria,
        busquedaWebSugerida: busquedaFotoWeb,
        promptIaSugerido: promptImagenIA
      });
      fotoBase = resultadoAuditoria.urlFinal;
      estadoAuditoria = resultadoAuditoria.estadoAuditoria;
    }

    const usarModoExpandido = fill_mode === 'contain' || (esEdicion && ultimoEstado.fill_mode === 'contain');
    const fotoFinalUrl = optimizarFotoConCloudinary(fotoBase, usarModoExpandido, 1080);

    const imageBuffer = await renderizarFlyer({
      categoria,
      titulo,
      destacar,
      bajada,
      fotoFinalUrl,
      expandirSinCloudinary: usarModoExpandido && !process.env.CLOUDINARY_CLOUD_NAME,
      esUrgente,
      esHistoria: false
    });

    ultimoEstado = {
      foto_url: fotoFinalUrl,
      foto_original_url: fotoBase,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      prompt_imagen_ia: promptImagenIA,
      fill_mode: usarModoExpandido ? 'contain' : 'cover',
      urgente: esUrgente,
      imagen_buffer: imageBuffer,
      historia_buffer: null
    };

    return res.json({
      ok: true,
      es_edicion: esEdicion,
      auditoria: estadoAuditoria,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      url_imagen_publica: `https://el-registro-sur.onrender.com/ultima-imagen.png?t=${Date.now()}`,
      imagen_base64: imageBuffer.toString('base64')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
app.listen(PORT, () => console.log(`Súper Asistente 2K + Auditor IA de El Registro Sur listo en puerto ${PORT}`));
