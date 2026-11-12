const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '25mb' }));

// Leemos la plantilla HTML v3 base
const templateHtml = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');

async function estructurarNoticiaConGemini(textoCrudo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta configurar la variable GEMINI_API_KEY en Render.');
  }

  const systemPrompt = `Sos el editor general de 'El Registro Sur'. A partir del texto crudo enviado desde la calle, devolvé ÚNICAMENTE un objeto JSON válido (sin bloques markdown ni texto extra) con esta estructura exacta:
{
  "categoria": "SECCIÓN en mayúsculas (ej. POLÍTICA, SOCIEDAD, POLICIALES, JUDICIAL, ECONOMÍA)",
  "titulo": "Titular corto en mayúsculas, directo e impactante (máx 8 palabras)",
  "destacar": "Frase clave exacta del título que debe ir resaltada en celeste",
  "bajada": "1 oración corta con el dato clave complementario (máx 15 palabras)",
  "copy": "Texto plano limpio para Instagram y Facebook (sin viñetas ni asteriscos): título en mayúsculas con 2 emojis relevantes, bajada periodística en 2 párrafos cortos y al final 4 hashtags incluyendo #ElRegistroSur #CaletaOlivia #SantaCruz"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            parts: [{ text: textoCrudo }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Gemini (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini no devolvió contenido.');
  }

  return JSON.parse(rawText);
}

app.post('/generar', async (req, res) => {
  try {
    let { foto_url, texto_crudo, categoria, titulo, destacar, bajada, fill_mode } = req.body;
    let copy = '';

    // Si viene texto_crudo desde Make/Telegram, Gemini redacta todo automáticamente
    if (texto_crudo && texto_crudo.trim().length > 0) {
      const noticiaIA = await estructurarNoticiaConGemini(texto_crudo);
      categoria = noticiaIA.categoria || categoria || 'NOTICIA';
      titulo = noticiaIA.titulo || titulo || '';
      destacar = noticiaIA.destacar || destacar || '';
      bajada = noticiaIA.bajada || bajada || '';
      copy = noticiaIA.copy || '';
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

    // Inyectamos los datos dentro de la plantilla
    let htmlModificado = templateHtml
      .replace('FALLO DE LA CORTE: REHABILITAN LA VENTA DE TIERRAS A EXTRANJEROS TRAS EL DNU DE MILEI', (titulo || '').replace(/"/g, '&quot;'))
      .replace('VENTA DE TIERRAS A EXTRANJEROS', (destacar || '').replace(/"/g, '&quot;'))
      .replace('El máximo tribunal revocó la sentencia que frenaba el artículo 154 del DNU 70/23 al determinar que los excombatientes de Malvinas carecen de legitimación para demandar.', (bajada || '').replace(/"/g, '&quot;'))
      .replace('POLÍTICA', (categoria || '').replace(/"/g, '&quot;'))
      .replace('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1080&q=85', foto_url || '');

    if (fill_mode) {
      htmlModificado = htmlModificado.replace('value="cover"', `value="${fill_mode}"`);
    }

    await page.setContent(htmlModificado, { waitUntil: 'networkidle0' });

    // Esperar a que las fuentes y el canvas se rendericen
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 600));

    // Captura exacta del lienzo en 1080x1080
    const canvasElement = await page.$('#canvas');
    const imageBuffer = await canvasElement.screenshot({ type: 'png' });

    await browser.close();

    // Si vino texto_crudo, devolvemos JSON con la imagen en base64 + los textos redactados
    if (texto_crudo && texto_crudo.trim().length > 0) {
      return res.json({
        ok: true,
        categoria,
        titulo,
        destacar,
        bajada,
        copy,
        imagen_base64: imageBuffer.toString('base64')
      });
    }

    // Modo clásico binario si se llama sin texto_crudo
    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de El Registro Sur listo en puerto ${PORT}`));
