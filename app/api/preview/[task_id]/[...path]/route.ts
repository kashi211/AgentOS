import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    const contentType = res.headers.get("content-type") ?? "text/plain";
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch {
    return new NextResponse("Upstream error", { status: 502 });
  }
}
