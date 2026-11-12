const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '25mb' }));

// Leemos la plantilla HTML v3 base
const templateHtml = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');

app.post('/generar', async (req, res) => {
  try {
    const { foto_url, categoria, titulo, destacar, bajada, fill_mode } = req.body;

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

    // Inyectamos los datos recibidos dentro de la plantilla
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

    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de El Registro Sur listo en puerto ${PORT}`));
