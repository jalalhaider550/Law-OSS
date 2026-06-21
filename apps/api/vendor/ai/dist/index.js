"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAI = callAI;
exports.streamAI = streamAI;
exports.verifyApiKey = verifyApiKey;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function callAI(apiKey, provider, messages, systemPrompt, maxTokens = 1800) {
    if (provider === 'google' || provider === 'gemini') {
        return callGemini(apiKey, messages, systemPrompt, maxTokens);
    }
    return callClaude(apiKey, messages, systemPrompt, maxTokens);
}
async function* streamAI(apiKey, provider, messages, systemPrompt, maxTokens = 2000) {
    if (provider === 'google' || provider === 'gemini') {
        const result = await callGemini(apiKey, messages, systemPrompt, maxTokens);
        yield result;
        return;
    }
    yield* streamClaude(apiKey, messages, systemPrompt, maxTokens);
}
async function callClaude(apiKey, messages, system, maxTokens) {
    const client = new sdk_1.default({ apiKey });
    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages,
    });
    return response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
}
async function* streamClaude(apiKey, messages, system, maxTokens) {
    const client = new sdk_1.default({ apiKey });
    const stream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages,
    });
    for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
            yield event.delta.text;
        }
    }
}
async function callGemini(apiKey, messages, system, maxTokens) {
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
        }),
    });
    const d = await r.json();
    if (d.error)
        throw new Error(`GEMINI_ERROR:${d.error.code}:${d.error.message}`);
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
async function verifyApiKey(provider, apiKey) {
    if (!apiKey || apiKey.trim().length < 10)
        return false;
    if (provider === 'google' || provider === 'gemini') {
        return apiKey.startsWith('AIza');
    }
    // Claude keys start with sk-ant-
    return apiKey.startsWith('sk-ant-');
}
