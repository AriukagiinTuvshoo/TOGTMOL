import { handleBondookRequest } from "@/lib/assistant/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleBondookRequest(request, "quiz");
