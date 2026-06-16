import Anthropic from '@anthropic-ai/sdk'

export async function callAI(
  apiKey: string,
  provider: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  maxTokens = 1800
): Promise<string> {
  if (provider === 'google' || provider === 'gemini') {
    return callGemini(apiKey, messages, systemPrompt, maxTokens)
  }
  return callClaude(apiKey, messages, systemPrompt, maxTokens)
}

export async function* streamAI(
  apiKey: string,
  provider: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  maxTokens = 2000
): AsyncGenerator<string> {
  if (provider === 'google' || provider === 'gemini') {
    const result = await callGemini(apiKey, messages, systemPrompt, maxTokens)
    yield result
    return
  }
  yield* streamClaude(apiKey, messages, systemPrompt, maxTokens)
}

async function callClaude(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
  })
  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
}

async function* streamClaude(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  maxTokens: number
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey })
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
  })
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}

async function callGemini(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  maxTokens: number
): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    }),
  })
  const d = await r.json() as {
    error?: { code: number; message: string }
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  if (d.error) throw new Error(`GEMINI_ERROR:${d.error.code}:${d.error.message}`)
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function verifyApiKey(
  provider: string,
  apiKey: string
): Promise<boolean> {
  if (!apiKey || apiKey.trim().length < 10) return false
  if (provider === 'google' || provider === 'gemini') {
    return apiKey.startsWith('AIza')
  }
  // Claude keys start with sk-ant-
  return apiKey.startsWith('sk-ant-')
}
