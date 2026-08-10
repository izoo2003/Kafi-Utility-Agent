export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: T;
    ok?: boolean;
  };

  if (!res.ok) {
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }

  return (payload.data ?? payload) as T;
}
