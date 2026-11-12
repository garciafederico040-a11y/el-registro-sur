async function estructurarNoticiaConGemini(textoCrudo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta configurar GEMINI_API_KEY en Render.');
  }

  const systemPrompt = `Sos el editor general de 'El Registro Sur'. A partir del texto crudo enviado desde la calle, devolvé ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "categoria": "SECCIÓN en mayúsculas (ej. POLÍTICA, SOCIEDAD, POLICIALES, JUDICIAL, ECONOMÍA)",
  "titulo": "Titular corto en mayúsculas, directo e impactante (máx 8 palabras)",
  "destacar": "Frase clave exacta del título que debe ir resaltada en celeste",
  "bajada": "1 oración corta con el dato clave complementario (máx 15 palabras)",
  "copy": "Texto plano limpio para Instagram y Facebook (sin viñetas ni asteriscos): título en mayúsculas con 2 emojis relevantes, bajada periodística en 2 párrafos cortos y al final 4 hashtags incluyendo #ElRegistroSur #CaletaOlivia #SantaCruz"
}`;

  const modelos = ['gemini-3.8-flash', 'gemini-3.8-flash-lite'];
  let ultimoError = '';

  for (const modelo of modelos) {
    for (let intento = 1; intento <= 2; intento++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: textoCrudo }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(rawText);
      }

      ultimoError = await response.text();
      if (response.status === 503 || response.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw new Error(`Error de Gemini (${response.status}): ${ultimoError}`);
    }
  }

  throw new Error(`Gemini saturado tras varios intentos: ${ultimoError}`);
}
