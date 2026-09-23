export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "togtmol",
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    timestamp: new Date().toISOString(),
  });
}
