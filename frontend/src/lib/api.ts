const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, init);
  } catch {
    throw new Error("Cannot reach the server. Check that the API is running, then try again.");
  }
  if (!response.ok) {
    let detail = "The request could not be completed.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch { /* Keep the fallback message. */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function uploadBody(file: File): FormData {
  const body = new FormData();
  body.append("file", file);
  return body;
}
