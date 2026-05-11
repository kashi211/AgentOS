import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local — strip surrounding quotes from values
const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const raw = trimmed.slice(eqIdx + 1).trim();
  process.env[key] = raw.replace(/^["']|["']$/g, "");
}

const results = [];
function pass(name) { results.push({ name, status: "✅ PASS" }); }
function fail(name, reason) { results.push({ name, status: "❌ FAIL", reason }); }

// ── 1. Anthropic ──────────────────────────────────────────────
try {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  const data = await res.json();
  if (data.content) pass("Anthropic");
  else fail("Anthropic", data.error?.message ?? JSON.stringify(data));
} catch (e) {
  fail("Anthropic", e.message);
}

// ── 2. Neon PostgreSQL ────────────────────────────────────────
try {
  // Neon HTTP API requires the unpooled endpoint + Neon-Connection-String header
  const url = new URL(process.env.DATABASE_URL_UNPOOLED);
  const neonHttpUrl = `https://${url.hostname}/sql`;
  const res = await fetch(neonHttpUrl, {
    method: "POST",
    headers: {
      "Neon-Connection-String": process.env.DATABASE_URL_UNPOOLED,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT 1 AS ok" }),
  });
  const data = await res.json();
  if (res.ok && data.rows) pass("PostgreSQL (Neon)");
  else fail("PostgreSQL (Neon)", data.message ?? JSON.stringify(data));
} catch (e) {
  fail("PostgreSQL (Neon)", e.message);
}

// ── 3. Upstash Redis ──────────────────────────────────────────
try {
  const redisUrl = process.env.UPSTASH_REDIS_URL.replace(/\/$/, "");
  const res = await fetch(`${redisUrl}/ping`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_TOKEN}` },
  });
  const text = await res.text();
  if (text.includes("PONG")) pass("Redis (Upstash)");
  else fail("Redis (Upstash)", text);
} catch (e) {
  fail("Redis (Upstash)", e.message);
}

// ── 4. Pinecone ───────────────────────────────────────────────
try {
  const res = await fetch("https://api.pinecone.io/indexes", {
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY,
      "X-Pinecone-API-Version": "2024-07",
    },
  });
  const data = await res.json();
  if (res.ok) pass(`Pinecone (${data.indexes?.length ?? 0} indexes found)`);
  else fail("Pinecone", data.message ?? JSON.stringify(data));
} catch (e) {
  fail("Pinecone", e.message);
}

// ── 5. Cloudflare R2 ─────────────────────────────────────────
try {
  // Verify public bucket URL is reachable (any HTTP response = bucket exists)
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "");
  const res = await fetch(`${publicUrl}/test-probe`, { method: "HEAD" });
  // 404 = bucket reachable but file doesn't exist (expected)
  // 403 = bucket private (expected for non-public objects)
  // anything other than network error = R2 is up
  if ([403, 404, 200].includes(res.status)) {
    pass(`Cloudflare R2 (public URL reachable, status ${res.status})`);
  } else {
    fail("Cloudflare R2", `Unexpected status ${res.status}`);
  }
} catch (e) {
  fail("Cloudflare R2", e.message);
}

// ── Print results ─────────────────────────────────────────────
console.log("\n── AgentOS Environment Test ──────────────────\n");
for (const r of results) {
  console.log(`${r.status}  ${r.name}`);
  if (r.reason) console.log(`         ${r.reason}`);
}
console.log("\n──────────────────────────────────────────────\n");
