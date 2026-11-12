const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const templateHtml = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');
const TELEGRAM_TOKEN = '9253246227:AAFaJzhi3uxaoWLuxg9E0HZ4WfT0YdPts6w';

// Guarda en memoria el último borrador (textos, foto y PNG renderizado)
let ultimoEstado = {
  foto_url: '',
  categoria: '',
  titulo: '',
  destacar: '',
  bajada: '',
  copy: '',
  fill_mode: 'cover',
  imagen_buffer: null
};

// Convierte file_id o file_path de Telegram en una URL pública válida de imagen
async function resolverFotoTelegram(valorRecibido) {
  if (!valorRecibido || !valorRecibido.trim()) return '';
  const limpio = valorRecibido.trim();

  if (limpio.startsWith('http://') || limpio.startsWith('https://')) {
    return limpio;
  }

  // Si ya tiene barra (ej. "photos/file_10.jpg"), es un file_path directo
  if (limpio.includes('/')) {
    return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${limpio}`;
  }

  // Si no tiene barra, es un file_id: consultamos el file_path real a Telegram
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${limpio}`);
  const data = await resp.json();
  if (data.ok && data.result && data.result.file_path) {
    return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`;
  }
  return '';
}

async function procesarNoticiaConIA(textoCrudo, esEdicion = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Falta configurar GROQ_API_KEY en Render.');
  }

  const systemPrompt = `Sos el Editor Jefe de 'EL REGISTRO SUR' (@elregistrosur | elregistrosur.com.ar), medio periodístico digital de Caleta Olivia, Santa Cruz, bajo el lema "El sur tiene registro".

LÍNEA EDITORIAL Y FILTRO POLÍTICO (CRÍTICO):
1. Tono institucional, periodístico, factual, directo y moderno.
2. Posicionamiento editorial: Pro-gestión tanto hacia el Gobierno Nacional (Javier Milei: equilibrio fiscal, desregulación, baja de inflación, orden público, firmeza institucional) como hacia el Gobierno Provincial de Santa Cruz (Claudio Vidal: producción, trabajo, reactivación energética/petrolera en el Golfo San Jorge, obras, educación y auditoría del Estado).
3. Enfoque crítico mediante datos duros y contraste implícito frente al kirchnerismo, el desmanejo de gestiones anteriores, la burocracia estatal o bloqueos sindicales/piqueteros que afecten servicios o producción.
4. Cumplimiento Meta Ads: jamás uses insultos, agravios personales ni lenguaje militante burdo. El respaldo o la crítica se construyen con jerarquía informativa, verbos precisos y datos verificables.
5. Amplitud temática: cubrís noticias locales (Caleta Olivia y Zona Norte), provinciales (Santa Cruz), nacionales (Argentina), internacionales, economía, energía, policiales, judiciales, deportes, ciencia y espectáculos. Nunca inventes cifras ni nombres que no estén en el texto recibido.

REGLAS ESTRICTAS DE FORMATO Y LONGITUD:
Devolvé ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "categoria": "Formato SECCIÓN / SUBTEMA en MAYÚSCULAS (ej. SANTA CRUZ / GESTIÓN, ECONOMÍA / ENERGÍA, POLÍTICA / NACIÓN, CALETA OLIVIA / SERVICIOS, POLICIALES / JUDICIALES, INTERNACIONAL / MUNDO)",
  "titulo": "Titular en MAYÚSCULAS, muy corto, directo y con gancho (entre 4 y 8 palabras máximo para no sobrecargar la placa)",
  "destacar": "Subcadena EXACTA dentro de 'titulo' (2 a 4 palabras clave) que irá resaltada en color celeste",
  "bajada": "1 sola oración corta y contundente con el dato clave (máximo 15 palabras, sin repetir el título)",
  "copy": "Texto 100% plano para Meta Business Suite (Instagram y Facebook). PROHIBIDO usar viñetas, guiones de lista, asteriscos (*) o negritas (**). Debe respetar exactamente esta estructura separada por saltos de línea (\\n\\n):\\n1) TITULAR EN MAYÚSCULAS acompañado de 2 emojis relevantes.\\n2) De 2 a 3 párrafos cortos, limpios y periodísticos explicando los hechos y el contexto.\\n3) Línea fija: Toda la cobertura en @elregistrosur\\n4) Pregunta abierta buscando interacción en comentarios cerrada con: Te leemos en comentarios 👇\\n5) Línea separadora: ---\\n6) Entre 6 y 8 hashtags ESTRICTAMENTE EN MINÚSCULAS (ej. #noticias #elregistrosur #caletaolivia #santacruz más hashtags del tema en minúsculas)."
}`;

  const userMessage = esEdicion
    ? `Este es el borrador actual del flyer de El Registro Sur:\n${JSON.stringify({
        categoria: ultimoEstado.categoria,
        titulo: ultimoEstado.titulo,
        destacar: ultimoEstado.destacar,
        bajada: ultimoEstado.bajada,
        copy: ultimoEstado.copy
      }, null, 2)}\n\nEl director solicita esta modificación o corrección desde Telegram: "${textoCrudo}".\nAplicá exactamente el cambio pedido respetando todas las reglas de formato (sin asteriscos ni viñetas, hashtags en minúsculas, título corto) y devolvé el JSON actualizado.`
    : `Redactá la pieza periodística completa a partir de este cable/información:\n"${textoCrudo}"`;

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
  const rawText = data?.choices?.[0]?.message?.content;
  return JSON.parse(rawText);
}

app.post('/generar', async (req, res) => {
  try {
    let { foto_url, file_path, file_id, texto_crudo, categoria, titulo, destacar, bajada, fill_mode } = req.body;
    let copy = '';

    // 1. Resolver foto nueva si enviaron imagen desde Telegram
    const entradaFoto = foto_url || file_path || file_id || '';
    const nuevaFotoUrl = await resolverFotoTelegram(entradaFoto);

    const tieneFotoNueva = Boolean(nuevaFotoUrl);
    const esEdicion = !tieneFotoNueva && Boolean(ultimoEstado.foto_url);

    const fotoFinalUrl = tieneFotoNueva ? nuevaFotoUrl : (ultimoEstado.foto_url || '');

    // 2. Redactar o modificar con IA según el mensaje
    if (texto_crudo && texto_crudo.trim().length > 0) {
      const noticiaIA = await procesarNoticiaConIA(texto_crudo.trim(), esEdicion);
      categoria = noticiaIA.categoria || ultimoEstado.categoria || 'NOTICIAS / ACTUALIDAD';
      titulo = noticiaIA.titulo || ultimoEstado.titulo || '';
      destacar = noticiaIA.destacar || '';
      bajada = noticiaIA.bajada || ultimoEstado.bajada || '';
      copy = noticiaIA.copy || '';
    }

    const modoRelleno = fill_mode || ultimoEstado.fill_mode || 'cover';

    // 3. Renderizar con Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

    let htmlModificado = templateHtml
      .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', (titulo || '').replace(/"/g, '&quot;'))
      .replace('VENTA DE TIERRAS A EXTRANJEROS', (destacar || '').replace(/"/g, '&quot;'))
      .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', (bajada || '').replace(/"/g, '&quot;'))
      .replace('POLÍTICA', (categoria || '').replace(/"/g, '&quot;'));

    if (fotoFinalUrl) {
      htmlModificado = htmlModificado.replace(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g, fotoFinalUrl);
    }

    if (modoRelleno) {
      htmlModificado = htmlModificado.replace('value="cover"', `value="${modoRelleno}"`);
    }

    await page.setContent(htmlModificado, { waitUntil: 'networkidle0' });

    // Refuerzo en el DOM por si la plantilla usa <img> o background-image con otra URL
    if (fotoFinalUrl) {
      await page.evaluate((url) => {
        const imgs = document.querySelectorAll('#canvas img');
        imgs.forEach(img => {
          if (img.src.includes('unsplash') || img.id.includes('bg') || img.className.includes('bg') || img.width > 400) {
            img.src = url;
          }
        });
      }, fotoFinalUrl);
      await new Promise(r => setTimeout(r, 600));
    }

    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 600));

    const canvasElement = await page.$('#canvas');
    const imageBuffer = await canvasElement.screenshot({ type: 'png' });
    await browser.close();

    // Guardamos el resultado en memoria para ediciones o para publicar en IG/FB
    ultimoEstado = {
      foto_url: fotoFinalUrl,
      categoria,
      titulo,
      destacar,
      bajada,
      copy,
      fill_mode: modoRelleno,
      imagen_buffer: imageBuffer
    };

    return res.json({
      ok: true,
      es_edicion: esEdicion,
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

// Endpoint para que Instagram/Facebook descarguen la última imagen generada
app.get('/ultima-imagen.png', (req, res) => {
  if (!ultimoEstado.imagen_buffer) {
    return res.status(404).send('Todavía no hay una imagen en memoria.');
  }
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  res.send(ultimoEstado.imagen_buffer);
});

// Endpoint para recuperar los datos del último flyer aprobado al escribir "PUBLICAR"
app.get('/ultimo-borrador', (req, res) => {
  if (!ultimoEstado.imagen_buffer) {
    return res.status(404).json({ error: 'No hay borrador en memoria para publicar.' });
  }
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
app.listen(PORT, () => console.log(`Servidor de El Registro Sur listo en puerto ${PORT}`));
