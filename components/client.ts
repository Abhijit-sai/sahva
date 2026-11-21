export class RoomRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const multipart = data instanceof FormData;
  const response = await fetch("/api/v1/rooms" + path, {
    method: data === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: multipart
      ? { "x-sahva-request": "1" }
      : { "x-sahva-request": "1", "content-type": "application/json" },
    body:
      data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new RoomRequestError(
      result.error?.code ?? "ROOM_REQUEST",
      result.error?.message ?? "Room request failed.",
    );
  return result;
}
