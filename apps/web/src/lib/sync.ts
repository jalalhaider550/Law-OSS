export async function loadAllFromCloud(token: string): Promise<{ matters: any[]; projects: any[]; contracts: any[] }> {
  try {
    const res = await fetch('/api/sync', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { matters: [], projects: [], contracts: [] }
    return await res.json()
  } catch {
    return { matters: [], projects: [], contracts: [] }
  }
}

export async function saveToCloud(token: string, type: 'matters' | 'projects' | 'contracts', data: any[]): Promise<void> {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, data }),
    })
  } catch {
    // fail silently
  }
}
