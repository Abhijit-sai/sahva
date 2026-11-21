export function GET() {
  return Response.json(
    { service: "sahva", status: "running" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
