import { FOODS, KNOWN_KEYS, nutritionFor } from '../data/foods.mjs';

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
    if (!text) return json(res, 400, { error: 'Missing text' });

    const catalog = KNOWN_KEYS.map(k => `${k}: ${FOODS[k].label} (${FOODS[k].per})`).join('; ');
    const system = `You are a precise parser for a nutrition and workout logging app. ONLY parse the CURRENT user message. Never import foods or quantities from previous messages or context. User: ${user}.
Known local food keys: ${catalog}.
For food/drink, split the current message into ingredients. Match a known key when clearly appropriate. For a generic unqualified tortilla, prefer corn_tortilla_6in; if the user explicitly says flour/harina, use flour_tortilla_8in. For each matched item provide quantity and, when stated or reasonably inferable, grams or ml. For unknown prepared foods, use key 'unknown' and estimate only that item's calories/protein/carbs/fat conservatively. Do not invent omitted ingredients. For workouts, do not estimate calorie burn. For questions, answer concisely.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'fitness_parse',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: ['food', 'workout', 'question'] },
                name: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      key: { type: 'string', enum: [...KNOWN_KEYS, 'unknown'] },
                      label: { type: 'string' },
                      quantity: { type: 'number', minimum: 0 },
                      grams: { type: 'number', minimum: 0 },
                      ml: { type: 'number', minimum: 0 },
                      estimated_calories: { type: 'number', minimum: 0 },
                      estimated_protein_g: { type: 'number', minimum: 0 },
                      estimated_carbs_g: { type: 'number', minimum: 0 },
                      estimated_fat_g: { type: 'number', minimum: 0 }
                    },
                    required: ['key','label','quantity','grams','ml','estimated_calories','estimated_protein_g','estimated_carbs_g','estimated_fat_g']
                  }
                },
                note: { type: 'string' },
                answer: { type: 'string' }
              },
              required: ['type','name','items','note','answer']
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

    if (parsed.type !== 'food') return json(res, 200, { ...parsed, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, source: 'ai-parser', model: MODEL });

    const resolved = parsed.items.map(item => {
      if (item.key !== 'unknown') {
        const n = nutritionFor(item.key, item.quantity, item.grams, item.ml);
        return { ...item, ...n };
      }
      return {
        ...item,
        calories: Math.round(item.estimated_calories || 0),
        protein_g: +(item.estimated_protein_g || 0).toFixed(1),
        carbs_g: +(item.estimated_carbs_g || 0).toFixed(1),
        fat_g: +(item.estimated_fat_g || 0).toFixed(1),
        source: 'ai-estimate'
      };
    });

    const totals = resolved.reduce((a, i) => ({
      calories: a.calories + (i.calories || 0),
      protein_g: a.protein_g + (i.protein_g || 0),
      carbs_g: a.carbs_g + (i.carbs_g || 0),
      fat_g: a.fat_g + (i.fat_g || 0)
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    const sources = [...new Set(resolved.map(i => i.source))];
    return json(res, 200, {
      type: 'food',
      name: parsed.name || text,
      items: resolved,
      calories: Math.round(totals.calories),
      protein_g: +totals.protein_g.toFixed(1),
      carbs_g: +totals.carbs_g.toFixed(1),
      fat_g: +totals.fat_g.toFixed(1),
      note: parsed.note,
      answer: parsed.answer,
      source: sources.length === 1 ? sources[0] : 'mixed',
      model: MODEL
    });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Unable to process entry' });
  }
}
