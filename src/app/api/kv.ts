// Helper to interface with Vercel KV storage via REST API
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) {
    // Local development fallback to memory or environment
    return null;
  }
  try {
    const res = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.result) {
      try {
        return JSON.parse(data.result) as T;
      } catch {
        return data.result as unknown as T;
      }
    }
  } catch (err) {
    console.error(`[KV] Get error for key ${key}:`, err);
  }
  return null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (!KV_URL || !KV_TOKEN) {
    return;
  }
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: stringValue
    });
  } catch (err) {
    console.error(`[KV] Set error for key ${key}:`, err);
  }
}
