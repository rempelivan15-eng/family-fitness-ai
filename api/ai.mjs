const MODEL = 'gpt-5-mini';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  const apiKey = (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_API_KEY ||
    process.env.open_api_key ||
    process.env.openai_api_key ||
    ''
  ).trim();

  if (!apiKey) return json(res, 500, { error: 'OpenAI API key is not configured for this deployment' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || '').trim().slice(0, 1200);
    const user = String(body.user || 'User').slice(0, 40);
    const context = body.context && typeof body.context === 'object' ? body.context : {};
    if (!text) return json(res, 400, { error: 'Missing text' });

    const system = `You are the food and exercise logging engine inside a private two-person fitness app. Parse the user's natural-language entry into a single JSON object. Be conservative and practical. Estimate calories and protein only when the entry is food or drink. Use common USDA-style serving estimates when exact nutrition is not given. If portions are ambiguous, make a reasonable estimate and say so briefly in note. For workouts, do not invent calorie burn. If the entry is a general question rather than a log entry, classify it as question and give a concise coaching answer. Do not provide medical diagnosis. User profile name: ${user}. Current daily context: ${JSON.stringify(context)}.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'fitness_log',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: ['food', 'workout', 'question'] },
                name: { type: 'string' },
                calories: { type: 'integer', minimum: 0 },
                protein_g: { type: 'number', minimum: 0 },
                note: { type: 'string' },
                answer: { type: 'string' }
              },
              required: ['type', 'name', 'calories', 'protein_g', 'note', 'answer']
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error', data);
      return json(res, response.status, { error: data?.error?.message || 'AI request failed' });
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return json(res, 502, { error: 'AI returned no content' });
    const parsed = JSON.parse(raw);
    return json(res, 200, { ...parsed, model: MODEL });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Unable to process entry' });
  }
}
