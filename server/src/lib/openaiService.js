/**
 * Serviço OpenAI: expandir siglas (ex: C/B -> Com Bomba) e gerar FAQs ('Patos')
 */
let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY não definida');
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

/**
 * Expande siglas em texto usando OpenAI.
 * Ex: "Máquina C/B" -> "Máquina Com Bomba"
 */
async function expandAcronyms(text, options = {}) {
  const client = getClient();
  const model = options.model || 'gpt-4o-mini';

  const prompt = `Estás a processar nomes de equipamento de hotelaria/restauração em português de Portugal.
Dado o texto abaixo, expande todas as siglas e abreviaturas comuns para o português de Portugal, mantendo o resto do texto igual.
Exemplos: C/B -> Com Bomba, SS -> Aço Inox, CE -> Conformidade Europeia, VENT -> Ventilado, REVERS -> Reversível.
Responde APENAS com o texto já expandido, sem explicações.

Texto:
${text}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.2,
  });

  const result = completion.choices[0]?.message?.content?.trim();
  return result || text;
}

/**
 * Gera FAQs ('Patos') para um produto com base no nome e descrição.
 * Devolve array de { pergunta, resposta }
 */
async function generateFaqs(productName, productDescription, options = {}) {
  const client = getClient();
  const model = options.model || 'gpt-4o-mini';
  const count = options.count || 5;

  const prompt = `Gera exatamente ${count} perguntas frequentes (FAQs) sobre o seguinte produto de equipamento de hotelaria/restauração.
Cada FAQ deve ser útil para um comprador B2B (hotéis, restaurantes). Respostas curtas e objetivas em português de Portugal.

Produto: ${productName}
${productDescription ? `Descrição/contexto: ${productDescription}` : ''}

Responde em JSON com o formato: [{"pergunta": "...", "resposta": "..."}, ...]
Apenas o array JSON, sem markdown nem texto extra.`;

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '[]';
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.map((f) => ({ q: f.pergunta || f.question, a: f.resposta || f.answer })) : [];
  } catch {
    return [];
  }
}

/**
 * Otimiza texto de produto (expandir siglas + opcionalmente melhorar redação)
 */
async function optimizeProductText(text, options = {}) {
  const expanded = await expandAcronyms(text, options);
  return expanded;
}

module.exports = {
  expandAcronyms,
  generateFaqs,
  optimizeProductText,
};
