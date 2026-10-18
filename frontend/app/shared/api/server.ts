export async function serverApi<T>(path: string): Promise<T> {
  const origin = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${origin}/api/v1/${path}`, {
      signal: AbortSignal.timeout(7000),
      headers: { "X-Forwarded-Proto": "https" },
    });
  } catch {
    throw new Response("Сервис временно недоступен", { status: 503 });
  }
  if (!response.ok)
    throw new Response(
      response.status === 404
        ? "Страница не найдена"
        : "Сервис временно недоступен",
      { status: response.status === 404 ? 404 : 503 },
    );
  return response.json() as Promise<T>;
}
