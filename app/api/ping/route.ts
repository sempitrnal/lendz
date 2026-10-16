// A tiny public endpoint the app times to gauge connection quality. It must
// stay uncached and cheap; the service worker leaves it alone.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export function GET() {
  return new Response(null, { status: 204, headers });
}

export function HEAD() {
  return new Response(null, { status: 204, headers });
}
