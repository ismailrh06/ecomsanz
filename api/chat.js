const fs = require('node:fs');
const path = require('node:path');

function loadKnowledge() {
  try {
    const p = path.join(process.cwd(), 'data', 'chatbot-knowledge.json');
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      brand: { name: 'Kevin Dropshipping IA', language: 'es', tone: 'claro y profesional' },
      rules: [],
      faq: []
    };
  }
}

function simpleFallbackAnswer(message, knowledge) {
  const text = (message || '').toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const item of knowledge.faq || []) {
    const score = (item.keywords || []).reduce((acc, kw) => {
      return acc + (text.includes(String(kw).toLowerCase()) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best?.answer) {
    return `${best.answer} Si quieres, te ayudo a elegir el siguiente paso ahora mismo.`;
  }

  return 'Buena pregunta. Para darte una respuesta precisa según tu caso, te recomiendo reservar una llamada y te guiamos paso a paso.';
}

async function callOpenAI({ message, history, knowledge }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return simpleFallbackAnswer(message, knowledge);
  }

  const systemPrompt = [
    `Eres el asistente comercial de ${knowledge.brand?.name || 'Kevin Dropshipping IA'}.`,
    `Idioma: ${knowledge.brand?.language || 'es'}.`,
    `Tono: ${knowledge.brand?.tone || 'claro y profesional'}.`,
    'Usa SOLO la base de conocimiento disponible para responder.',
    'Si no hay datos exactos, dilo con honestidad y sugiere reservar una llamada.',
    'No inventes precios, resultados, garantías ni cifras no incluidas.',
    'Responde en 2 a 5 frases máximo.',
    'Base de conocimiento:',
    JSON.stringify(knowledge)
  ].join('\n');

  const compactHistory = Array.isArray(history)
    ? history.slice(-8).map((h) => ({ role: h.role, content: h.content }))
    : [];

  const input = [
    { role: 'system', content: systemPrompt },
    ...compactHistory,
    { role: 'user', content: message }
  ];

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input,
      temperature: 0.4,
      max_output_tokens: 220
    })
  });

  if (!r.ok) {
    return simpleFallbackAnswer(message, knowledge);
  }

  const data = await r.json();
  const text = data.output_text || '';
  if (!text.trim()) {
    return simpleFallbackAnswer(message, knowledge);
  }

  return text.trim();
}

async function chatHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const knowledge = loadKnowledge();
    const answer = await callOpenAI({ message, history, knowledge });

    return res.status(200).json({ answer });
  } catch {
    return res.status(500).json({
      answer: 'Ahora mismo no puedo responder con IA. Escríbenos por WhatsApp y te ayudamos enseguida.'
    });
  }
}

module.exports = chatHandler;
