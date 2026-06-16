import type {
  Matter,
  Contract,
  TimeEntry,
  GeneratedDocument,
  AgentChatInput,
  AgentSession,
  Message,
  ResearchResult,
  ApiKeyStatus,
  DraftedDocument,
} from '../types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function apiCall<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...((options.headers as Record<string, string>) || {}) },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new ApiError(body.error || 'Request failed', res.status)
  }

  return res.json()
}

export const mattersApi = {
  list: (token: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiCall<Matter[]>(`/api/matters${qs}`, {}, token)
  },
  get: (token: string, id: string) => apiCall<Matter>(`/api/matters/${id}`, {}, token),
  create: (token: string, data: Partial<Matter>) =>
    apiCall<Matter>('/api/matters', { method: 'POST', body: JSON.stringify(data) }, token),
  update: (token: string, id: string, data: Partial<Matter>) =>
    apiCall<Matter>(`/api/matters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  delete: (token: string, id: string) =>
    apiCall<void>(`/api/matters/${id}`, { method: 'DELETE' }, token),
}

export const contractsApi = {
  upload: async (token: string, file: File, matterId?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (matterId) form.append('matterId', matterId)
    const res = await fetch(`${API_BASE}/api/contracts/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(body.error || 'Upload failed', res.status)
    }
    return res.json()
  },
  list: (token: string) => apiCall<Contract[]>('/api/contracts', {}, token),
  get: (token: string, id: string) => apiCall<Contract>(`/api/contracts/${id}`, {}, token),
  tabular: (token: string, contractIds: string[], name?: string) =>
    apiCall('/api/contracts/tabular', {
      method: 'POST', body: JSON.stringify({ contractIds, name }),
    }, token),
  delete: (token: string, id: string) =>
    apiCall<void>(`/api/contracts/${id}`, { method: 'DELETE' }, token),
}

export const agentsApi = {
  chat: (token: string, data: AgentChatInput) =>
    apiCall<{ response: string; provider: string }>(
      '/api/agents/chat',
      { method: 'POST', body: JSON.stringify(data) },
      token
    ),

  chatStream: (
    token: string,
    data: AgentChatInput,
    callbacks: {
      onToken: (text: string) => void
      onDone: (fullText: string) => void
      onError: (error: string) => void
    }
  ): void => {
    let fullText = ''
    fetch(`${API_BASE}/api/agents/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          callbacks.onError((body as { error?: string }).error || 'Agent request failed')
          return
        }
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw || raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw) as {
                token?: string
                done?: boolean
                fullText?: string
                error?: string
              }
              if (parsed.token) { callbacks.onToken(parsed.token); fullText += parsed.token }
              if (parsed.done) { callbacks.onDone(parsed.fullText || fullText); return }
              if (parsed.error) { callbacks.onError(parsed.error); return }
            } catch { /* ignore parse errors */ }
          }
        }
        callbacks.onDone(fullText)
      })
      .catch(e => callbacks.onError((e as Error).message || 'Network error'))
  },

  saveSession: (token: string, agentId: string, messages: Message[]) =>
    apiCall('/api/agents/sessions', {
      method: 'POST', body: JSON.stringify({ agentId, messages }),
    }, token),

  getSession: (token: string, agentId: string): Promise<AgentSession | null> =>
    apiCall<AgentSession | null>(`/api/agents/sessions/${agentId}`, {}, token).catch(() => null),
}

export const researchApi = {
  search: (token: string, q: string, jurisdiction?: string) => {
    const params = new URLSearchParams({ q })
    if (jurisdiction) params.set('jurisdiction', jurisdiction)
    return apiCall<ResearchResult>(`/api/research?${params}`, {}, token)
  },
}

export const documentsApi = {
  generate: (token: string, documentJson: DraftedDocument) =>
    apiCall<{ documentId: string; signedUrl: string; filename: string }>(
      '/api/documents/generate',
      { method: 'POST', body: JSON.stringify({ documentJson }) },
      token
    ),
  get: (token: string, id: string) =>
    apiCall<GeneratedDocument>(`/api/documents/${id}`, {}, token),
  update: (token: string, id: string, documentJson: DraftedDocument) =>
    apiCall<{ updated: boolean }>(
      `/api/documents/${id}`,
      { method: 'PATCH', body: JSON.stringify({ documentJson }) },
      token
    ),
  download: (token: string, id: string) =>
    apiCall<{ url: string }>(`/api/documents/${id}/download`, {}, token),
}

export const timeEntriesApi = {
  list: (token: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiCall<TimeEntry[]>(`/api/time-entries${qs}`, {}, token)
  },
  create: (token: string, data: Partial<TimeEntry>) =>
    apiCall<TimeEntry>('/api/time-entries', { method: 'POST', body: JSON.stringify(data) }, token),
  update: (token: string, id: string, data: Partial<TimeEntry>) =>
    apiCall<TimeEntry>(
      `/api/time-entries/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token
    ),
  delete: (token: string, id: string) =>
    apiCall<void>(`/api/time-entries/${id}`, { method: 'DELETE' }, token),
}

export const apiKeysApi = {
  status: (token: string) => apiCall<ApiKeyStatus>('/api/api-keys/status', {}, token),
  save: (token: string, provider: string, apiKey: string) =>
    apiCall('/api/api-keys', { method: 'POST', body: JSON.stringify({ provider, apiKey }) }, token),
  remove: (token: string) => apiCall('/api/api-keys', { method: 'DELETE' }, token),
}
