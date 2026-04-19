// ============================================================================
// lib/db.ts — module Postgres async avec fallback Supabase REST
// Destination : art-core/art-core/lib/db.ts ET pass-core/lib/db.ts
// ----------------------------------------------------------------------------
// Stratégie :
//   - Tente d'abord postgres-js direct (rapide, SQL natif)
//   - En cas d'échec auth (password rotated etc.), fallback sur Supabase REST
//     via SUPABASE_SERVICE_ROLE_KEY — parse le SQL et traduit vers PostgREST
//   - Les patterns supportés par le translator couvrent SELECT/INSERT/UPDATE/
//     DELETE simples avec WHERE x = ?. Pas de JOINs complexes, RETURNING OK.
// ============================================================================

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL) console.warn("[db] DATABASE_URL manquant");

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __pgOk: boolean | undefined; // cache du résultat du ping, évite de retenter postgres à chaque call
}

export const sql =
  globalThis.__pg ||
  postgres(DATABASE_URL || "postgres://localhost/dev", {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalThis.__pg = sql;

// ----------------------------------------------------------------------------
// REST helpers (PostgREST via Supabase)
// ----------------------------------------------------------------------------

function restHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!SUPA_URL || !SUPA_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant");
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...restHeaders(), ...(init?.headers as any) },
  });
}

/** Construit une querystring PostgREST à partir d'un objet de filtres (col → valeur). */
function buildFilterQs(filters: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === null) parts.push(`${k}=is.null`);
    else parts.push(`${k}=eq.${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

async function restSelect(table: string, filters: Record<string, any> = {}, opts: { limit?: number; orderBy?: string; orderDir?: "asc" | "desc"; columns?: string } = {}): Promise<any[]> {
  const qs: string[] = [];
  qs.push(`select=${opts.columns ?? "*"}`);
  const f = buildFilterQs(filters);
  if (f) qs.push(f);
  if (opts.orderBy) qs.push(`order=${opts.orderBy}.${opts.orderDir ?? "asc"}`);
  if (opts.limit) qs.push(`limit=${opts.limit}`);
  const r = await restFetch(`${table}?${qs.join("&")}`, { method: "GET", headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`REST select ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function restInsert(table: string, data: any | any[], returning: boolean = false): Promise<any[]> {
  const headers: Record<string, string> = returning ? { Prefer: "return=representation" } : { Prefer: "return=minimal" };
  const r = await restFetch(table, { method: "POST", headers, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(`REST insert ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (!returning) return [];
  return r.json();
}

async function restUpdate(table: string, data: any, filters: Record<string, any>): Promise<any[]> {
  const qs = buildFilterQs(filters);
  const r = await restFetch(`${table}?${qs}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(`REST update ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function restDelete(table: string, filters: Record<string, any>): Promise<number> {
  const qs = buildFilterQs(filters);
  const r = await restFetch(`${table}?${qs}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!r.ok) throw new Error(`REST delete ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return 1;
}

// ----------------------------------------------------------------------------
// SQL translator : parse SQL simple → REST
// ----------------------------------------------------------------------------

function convertPlaceholders(text: string): string {
  let out = "", i = 0, n = 0;
  while (i < text.length) {
    const ch = text[i], nx = text[i + 1];
    if (ch === "'") { out += ch; i++; while (i < text.length) { out += text[i]; if (text[i] === "'") { if (text[i + 1] === "'") { out += text[++i]; } else { i++; break; } } i++; } continue; }
    if (ch === '"') { out += ch; i++; while (i < text.length && text[i] !== '"') { out += text[i++]; } if (i < text.length) out += text[i++]; continue; }
    if (ch === "-" && nx === "-") { while (i < text.length && text[i] !== "\n") out += text[i++]; continue; }
    if (ch === "/" && nx === "*") { out += "/*"; i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) out += text[i++]; if (i < text.length) { out += "*/"; i += 2; } continue; }
    if (ch === "?" && (nx === "?" || nx === "|" || nx === "&")) { out += ch + nx; i += 2; continue; }
    if (ch === "?") { out += `$${++n}`; i++; continue; }
    out += ch; i++;
  }
  return out;
}

/** Essaie d'exécuter via REST. Retourne { rows, rowCount } ou throw. */
async function sqlViaRest(text: string, params: any[]): Promise<{ rows: any[]; rowCount: number }> {
  const normalized = text.trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();

  // DELETE FROM <table> WHERE <col> = ? [AND <col2> = ?]
  let m = normalized.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)$/i);
  if (m) {
    const [, table, whereRaw] = m;
    const filters = parseWhere(whereRaw, params);
    const n = await restDelete(table, filters);
    return { rows: [], rowCount: n };
  }

  // INSERT INTO <table> (cols) VALUES (?, ?, 'lit', NOW(), ...) [RETURNING col]
  m = normalized.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)(?:\s+RETURNING\s+(.+))?$/i);
  if (m) {
    const [, table, colsRaw, valuesRaw, returningRaw] = m;
    const cols = colsRaw.split(",").map(c => c.trim());
    // Parse chaque valeur : ? -> params[idx++], 'str' -> str, NOW() -> timestamp,
    // nombre -> nombre, NULL -> null, TRUE/FALSE -> bool, autre -> literal string
    const values = splitCommasNotInParens(valuesRaw);
    if (values.length !== cols.length) {
      throw new Error(`sqlViaRest INSERT: mismatch cols(${cols.length}) vs values(${values.length})`);
    }
    let pIdx = 0;
    const data: any = {};
    for (let i = 0; i < cols.length; i++) {
      const v = values[i].trim();
      if (v === "?") {
        data[cols[i]] = params[pIdx++];
      } else if (/^NOW\(\)$/i.test(v)) {
        data[cols[i]] = new Date().toISOString();
      } else if (/^NULL$/i.test(v)) {
        data[cols[i]] = null;
      } else if (/^TRUE$/i.test(v)) {
        data[cols[i]] = true;
      } else if (/^FALSE$/i.test(v)) {
        data[cols[i]] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(v)) {
        data[cols[i]] = Number(v);
      } else if (/^'.*'$/.test(v)) {
        data[cols[i]] = v.slice(1, -1).replace(/''/g, "'");
      } else {
        data[cols[i]] = v; // dernier recours : littéral brut
      }
    }
    const wantReturning = !!returningRaw;
    const result = await restInsert(table, data, wantReturning);
    return { rows: result, rowCount: result.length || 1 };
  }

  // UPDATE <table> SET col = ?, col2 = ? WHERE <where>
  m = normalized.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
  if (m) {
    const [, table, setRaw, whereRaw] = m;
    let pIdx = 0;
    const setPairs = splitCommasNotInParens(setRaw);
    const data: any = {};
    for (const pair of setPairs) {
      const [col, val] = pair.split("=").map(s => s.trim());
      if (val === "?") { data[col] = params[pIdx++]; }
      else if (/^NOW\(\)$/i.test(val)) { data[col] = new Date().toISOString(); }
      else if (/^\d+$/.test(val)) { data[col] = Number(val); }
      else { data[col] = val.replace(/^['"]|['"]$/g, ""); }
    }
    const filters = parseWhere(whereRaw, params, pIdx);
    const result = await restUpdate(table, data, filters);
    return { rows: result, rowCount: result.length };
  }

  // SELECT ... FROM <table> [WHERE ...] [ORDER BY ...] [LIMIT n]
  m = normalized.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+|\?))?$/i);
  if (m) {
    const [, cols, table, whereRaw, orderRaw, limitRaw] = m;
    const filters = whereRaw ? parseWhere(whereRaw, params) : {};
    const columns = cols.trim() === "*" ? "*" : cols.trim();
    let limit: number | undefined;
    if (limitRaw === "?") { limit = Number(params[params.length - 1]); }
    else if (limitRaw) { limit = Number(limitRaw); }
    let orderBy: string | undefined, orderDir: "asc" | "desc" | undefined;
    if (orderRaw) {
      const o = orderRaw.trim().split(/\s+/);
      orderBy = o[0];
      orderDir = (o[1]?.toLowerCase() === "desc" ? "desc" : "asc");
    }
    const rows = await restSelect(table, filters, { limit, orderBy, orderDir, columns: columns === "*" ? undefined : columns });
    return { rows, rowCount: rows.length };
  }

  throw new Error(`sqlViaRest: pattern non supporté pour "${normalized.slice(0, 100)}"`);
}

function splitCommasNotInParens(s: string): string[] {
  const out: string[] = [];
  let cur = "", depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseWhere(whereRaw: string, params: any[], startIdx: number = 0): Record<string, any> {
  const filters: Record<string, any> = {};
  let pIdx = startIdx;
  // Support des AND chainés. Pas d'OR, pas de parens complexes, pas de NOW()
  // Enlève d'éventuels "AND <col> > NOW() - ..." que REST supporte différemment
  const cleaned = whereRaw.replace(/\s+AND\s+\w+\s*>\s*NOW\(\).*$/i, "");
  const conds = cleaned.split(/\s+AND\s+/i);
  for (const c of conds) {
    const cm = c.match(/^(\w+(?:\.\w+)?)\s*=\s*(\?|\d+|'[^']*'|[A-Z_]+)$/i);
    if (!cm) continue;
    const col = cm[1].split(".").pop()!;
    let val: any = cm[2];
    if (val === "?") val = params[pIdx++];
    else if (/^\d+$/.test(val)) val = Number(val);
    else if (val.startsWith("'")) val = val.slice(1, -1);
    else if (/^NULL$/i.test(val)) val = null;
    filters[col] = val;
  }
  return filters;
}

// ----------------------------------------------------------------------------
// Public API — query / queryOne / queryAll avec fallback REST
// ----------------------------------------------------------------------------

export async function query(text: string, params: any[] = []): Promise<number> {
  if (globalThis.__pgOk !== false) {
    try {
      const pgText = convertPlaceholders(text);
      const result = await sql.unsafe(pgText, params);
      globalThis.__pgOk = true;
      return result.count ?? 0;
    } catch (e: any) {
      if (isAuthError(e)) globalThis.__pgOk = false;
      else throw e;
    }
  }
  const { rowCount } = await sqlViaRest(text, params);
  return rowCount;
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | undefined> {
  if (globalThis.__pgOk !== false) {
    try {
      const pgText = convertPlaceholders(text);
      const rows = await sql.unsafe<T[]>(pgText, params);
      globalThis.__pgOk = true;
      return rows[0];
    } catch (e: any) {
      if (isAuthError(e)) globalThis.__pgOk = false;
      else throw e;
    }
  }
  const { rows } = await sqlViaRest(text, params);
  return rows[0] as T | undefined;
}

export async function queryAll<T = any>(text: string, params: any[] = []): Promise<T[]> {
  if (globalThis.__pgOk !== false) {
    try {
      const pgText = convertPlaceholders(text);
      const rows = await sql.unsafe<T[]>(pgText, params);
      globalThis.__pgOk = true;
      return rows;
    } catch (e: any) {
      if (isAuthError(e)) globalThis.__pgOk = false;
      else throw e;
    }
  }
  const { rows } = await sqlViaRest(text, params);
  return rows as T[];
}

function isAuthError(e: any): boolean {
  const m = (e?.message || "").toLowerCase();
  return (
    m.includes("password authentication failed") ||
    m.includes("tenant/user") ||
    m.includes("enotfound") ||
    m.includes("econnrefused") ||
    e?.code === "28P01"
  );
}

// ----------------------------------------------------------------------------
// Business helpers
// ----------------------------------------------------------------------------

export async function getUserByEmail(email: string) {
  try { const rows = await restSelect("users", { email }, { limit: 1 }); return rows[0]; }
  catch { return queryOne("SELECT * FROM users WHERE email = ?", [email]); }
}

export async function getUserById(id: string) {
  try { const rows = await restSelect("users", { id }, { limit: 1 }); return rows[0]; }
  catch { return queryOne("SELECT * FROM users WHERE id = ?", [id]); }
}

export async function createSession(userId: string, token: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const result = await restInsert("sessions", { user_id: userId, token, expires_at: expiresAt }, true);
    return { id: result[0]?.id, token, expires_at: expiresAt };
  } catch {
    const row = await queryOne<any>("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?) RETURNING id", [userId, token, expiresAt]);
    return { id: row?.id, token, expires_at: expiresAt };
  }
}

export async function getSessionByToken(token: string) {
  try {
    const rows = await restSelect("sessions", { token }, { limit: 1 });
    const s = rows[0]; if (!s) return undefined;
    if (new Date(s.expires_at) <= new Date()) return undefined;
    return s;
  } catch {
    return queryOne("SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()", [token]);
  }
}

export async function deleteSession(token: string) {
  try { await restDelete("sessions", { token }); }
  catch { await query("DELETE FROM sessions WHERE token = ?", [token]); }
}

export async function getUserByToken(token: string) {
  try {
    const sessions = await restSelect("sessions", { token }, { limit: 1 });
    const s = sessions[0];
    if (!s) return undefined;
    if (new Date(s.expires_at) <= new Date()) return undefined;
    const users = await restSelect("users", { id: s.user_id }, { limit: 1 });
    return users[0];
  } catch {
    return queryOne<any>(
      `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW()`,
      [token]
    );
  }
}

export async function getArtworkById(id: string) {
  try {
    const rows = await restSelect("artworks", { id }, { limit: 1 });
    const a = rows[0]; if (!a) return undefined;
    const users = await restSelect("users", { id: a.artist_id }, { limit: 1 });
    const u = users[0] || {};
    return { ...a, artist_name: u.full_name as name || u.full_name, artist_username: u.username, artist_avatar: u.avatar_url, artist_bio: u.bio };
  } catch {
    return queryOne<any>(
      `SELECT a.*, u.full_name as artist_name, u.username as artist_username, u.avatar_url as artist_avatar
       FROM artworks a JOIN users u ON a.artist_id = u.id WHERE a.id = ?`,
      [id]
    );
  }
}

export async function getArtworks(opts: { artistId?: string; limit?: number } = {}) {
  const { artistId, limit = 50 } = opts;
  try {
    const filters: any = {};
    if (artistId) filters.artist_id = artistId;
    const arts = await restSelect("artworks", filters, { limit, orderBy: "created_at", orderDir: "desc" });
    // Enrichir avec user infos
    const artistIds = [...new Set(arts.map((a: any) => a.artist_id))];
    const users = artistIds.length ? await restSelect("users", {}, { columns: "id,name,full_name,username,avatar_url" }) : [];
    const byId: any = {};
    for (const u of users) byId[u.id] = u;
    return arts.map((a: any) => ({ ...a, artist_name: byId[a.artist_id]?.name || byId[a.artist_id]?.full_name, artist_username: byId[a.artist_id]?.username, artist_avatar: byId[a.artist_id]?.avatar_url }));
  } catch {
    const join = `SELECT a.*, u.full_name as artist_name, u.username as artist_username, u.avatar_url as artist_avatar
                  FROM artworks a JOIN users u ON a.artist_id = u.id`;
    if (artistId) return queryAll<any>(`${join} WHERE a.artist_id = ? ORDER BY a.created_at DESC LIMIT ?`, [artistId, limit]);
    return queryAll<any>(`${join} ORDER BY a.created_at DESC LIMIT ?`, [limit]);
  }
}

export async function getGaugeEntries(artworkId: string) {
  try {
    const entries = await restSelect("gauge_entries", { artwork_id: artworkId }, { orderBy: "created_at", orderDir: "desc" });
    const initiateIds = [...new Set(entries.map((e: any) => e.initiate_id))];
    const users = initiateIds.length ? await restSelect("users", {}, { columns: "id,name,full_name,username" }) : [];
    const byId: any = {};
    for (const u of users) byId[u.id] = u;
    return entries.map((e: any) => ({ ...e, initiate_name: byId[e.initiate_id]?.name || byId[e.initiate_id]?.full_name, initiate_username: byId[e.initiate_id]?.username }));
  } catch {
    return queryAll<any>(
      `SELECT g.*, u.full_name as initiate_name, u.username as initiate_username
       FROM gauge_entries g JOIN users u ON g.initiate_id = u.id
       WHERE g.artwork_id = ? ORDER BY g.created_at DESC`,
      [artworkId]
    );
  }
}

/** Ping DB — tente postgres direct, sinon REST. */
export async function pingDb(): Promise<{ ok: boolean; latencyMs: number; via?: string; error?: string; details?: any }> {
  const t0 = Date.now();
  try { await sql`SELECT 1 AS ok`; return { ok: true, latencyMs: Date.now() - t0, via: "postgres-js" }; }
  catch (pgErr: any) {
    if (SUPA_URL && SUPA_KEY) {
      try {
        const r = await restFetch("artworks?select=count", { method: "GET", headers: { Prefer: "count=exact" } });
        if (r.ok) return { ok: true, latencyMs: Date.now() - t0, via: "supabase-rest", details: { artworks_range: r.headers.get("content-range") } };
        return { ok: false, latencyMs: Date.now() - t0, error: `REST ${r.status}`, details: { pg_error: pgErr?.message } };
      } catch (restErr: any) {
        return { ok: false, latencyMs: Date.now() - t0, error: "both_failed", details: { pg_error: pgErr?.message, rest_error: restErr?.message } };
      }
    }
    return { ok: false, latencyMs: Date.now() - t0, via: "postgres-js", error: pgErr?.message ?? String(pgErr) };
  }
}

// ── getDb() — Supabase admin client (service role, bypasses RLS) ──────────
// Utilisé par les routes /api/merchants/* qui interagissent directement avec
// Supabase via .from().select(). Les autres routes utilisent query/queryOne.
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
let _sbAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null;
export function getDb() {
  if (_sbAdmin) return _sbAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[db.getDb] SUPABASE_URL / SERVICE_ROLE_KEY manquants");
  }
  _sbAdmin = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _sbAdmin;
}
