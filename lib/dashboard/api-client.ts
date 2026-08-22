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
    const details = (
      payload as {
        details?: {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
        };
      }
    ).details;
    if (payload.error === "Validation failed" && details) {
      const parts: string[] = [];
      for (const [field, msgs] of Object.entries(details.fieldErrors ?? {})) {
        if (msgs?.length) parts.push(`${field}: ${msgs.join(", ")}`);
      }
      if (details.formErrors?.length) parts.push(...details.formErrors);
      if (parts.length) throw new Error(parts.join("; "));
    }
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }

  return (payload.data ?? payload) as T;
}
