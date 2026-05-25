import { NextRequest, NextResponse } from "next/server";

// Server-side route — use private BACKEND_URL if set, else fall back to the
// public API URL (both are fine here since there's no browser CORS check).
const API =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ task_id: string; path: string[] }> }
) {
  const { task_id, path } = await params;
  const filePath = path.join("/");
  const upstream = `${API}/tasks/${task_id}/files/${filePath}`;

  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    const body = await res.text();
    // Always force text/html for .html files regardless of upstream content-type
    const isHtml = filePath.endsWith(".html");
    const contentType = isHtml
      ? "text/html; charset=utf-8"
      : (res.headers.get("content-type") ?? "text/plain");
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch {
    return new NextResponse("Upstream error", { status: 502 });
  }
}
