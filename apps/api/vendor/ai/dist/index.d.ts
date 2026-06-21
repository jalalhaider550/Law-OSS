export declare function callAI(apiKey: string, provider: string, messages: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, systemPrompt: string, maxTokens?: number): Promise<string>;
export declare function streamAI(apiKey: string, provider: string, messages: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, systemPrompt: string, maxTokens?: number): AsyncGenerator<string>;
export declare function verifyApiKey(provider: string, apiKey: string): Promise<boolean>;
