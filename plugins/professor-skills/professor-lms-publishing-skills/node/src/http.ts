export async function expectJson(response: Response, provider: string): Promise<any> {
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  if (!response.ok) {
    const detail = typeof body?.message === "string"
      ? body.message
      : typeof body?.error === "string" ? body.error : text.slice(0, 500);
    throw new Error(`${provider} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return body;
}
