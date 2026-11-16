"use server";
import { sql } from "../db";
import { back, fail, lineCtx, opt, str, uuid } from "../action-utils";

async function funnelId(lineId: string): Promise<string> {
  const [f] = await sql`select id from funnel_definitions where business_line_id = ${lineId} order by created_at limit 1`;
  if (f) return f.id;
  const [n] = await sql`insert into funnel_definitions (business_line_id) values (${lineId}) returning id`;
  return n.id;
}

// ───────────── Funnel builder

export async function saveFunnelStep(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const fid = await funnelId(line.id);
  const id = uuid(fd, "id");
  const op = str(fd, "op");
  const name = str(fd, "name");
  if (!id) {
    if (!name) return fail("Podaj nazwę kroku.");
    await sql`insert into funnel_steps (funnel_id, name, position)
              values (${fid}, ${name}, (select coalesce(max(position), -1) + 1 from funnel_steps where funnel_id = ${fid}))`;
    return back();
  }
  if (op === "delete") await sql`delete from funnel_steps where id = ${id} and funnel_id = ${fid}`;
  else if (op === "up" || op === "down") {
    const steps = await sql<{ id: string }[]>`select id from funnel_steps where funnel_id = ${fid} order by position, name`;
    const i = steps.findIndex((s) => s.id === id);
    const j = op === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < steps.length) [steps[i], steps[j]] = [steps[j], steps[i]];
    await sql.begin(async (tx) => {
      for (const [p, s] of steps.entries()) await tx`update funnel_steps set position = ${p} where id = ${s.id}`;
    });
  } else if (name) await sql`update funnel_steps set name = ${name} where id = ${id} and funnel_id = ${fid}`;
  return back();
}

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export async function saveFunnelData(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  const fid = await funnelId(line.id);
  const start = opt(fd, "period_start");
  const end = opt(fd, "period_end");
  if (!start || !end) return fail("Podaj zakres dat (od–do).");
  if (end < start) return fail("Data końcowa nie może być wcześniejsza niż początkowa.");
  const segment = str(fd, "segment");
  const source = str(fd, "source");
  const steps = await sql<{ id: string }[]>`select id from funnel_steps where funnel_id = ${fid}`;
  let saved = 0;
  await sql.begin(async (tx) => {
    for (const s of steps) {
      const volume = num(fd.get(`volume_${s.id}`));
      if (volume == null) continue;
      await tx`insert into funnel_data (funnel_id, step_id, period_start, period_end, segment, source, volume, revenue)
               values (${fid}, ${s.id}, ${start}, ${end}, ${segment}, ${source}, ${volume}, ${num(fd.get(`revenue_${s.id}`))})
               on conflict (step_id, period_start, period_end, segment, source)
               do update set volume = excluded.volume, revenue = excluded.revenue`;
      saved++;
    }
  });
  if (!saved) return fail("Wpisz wolumen dla co najmniej jednego kroku.");
  return back({ notice: "Zapisano dane funnelu." });
}

export async function deleteFunnelDataset(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const fid = await funnelId(line.id);
  await sql`delete from funnel_data where funnel_id = ${fid} and period_start = ${str(fd, "period_start")}
            and period_end = ${str(fd, "period_end")} and segment = ${str(fd, "segment")} and source = ${str(fd, "source")}`;
  return back();
}

// ───────────── Data Room

function splitRow(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) {
      out.push(cur.trim());
      cur = "";
    }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Best-effort table detection (CSV / TSV / pasted spreadsheet). The raw content is always kept untouched. */
function parseTable(raw: string): { columns: string[]; rows: string[][] } | null {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  for (const d of ["\t", ";", ",", "|"]) {
    const head = splitRow(lines[0], d);
    if (head.length < 2) continue;
    const rows = lines.slice(1, 501).map((l) => splitRow(l, d));
    if (rows.filter((r) => r.length === head.length).length >= rows.length * 0.8) return { columns: head, rows };
  }
  return null;
}

export async function addImport(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const file = fd.get("file");
  let raw = String(fd.get("raw_content") ?? "");
  let filename: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!/\.(txt|csv|tsv|md)$/i.test(file.name)) return fail("Obsługiwane pliki: TXT, CSV, TSV. Dane z XLSX wklej jako tabelę (kopiuj–wklej z arkusza).");
    filename = file.name;
    raw = await file.text();
  }
  if (!raw.trim()) return fail("Wklej treść albo wybierz plik.");
  const name = str(fd, "name") || filename || "Import";
  const parsed = parseTable(raw);
  await sql`insert into data_imports ${sql({
    business_line_id: line.id, name, kind: str(fd, "kind") || "raw_text", import_date: opt(fd, "import_date") ?? new Date().toISOString().slice(0, 10),
    source: str(fd, "source"), description: str(fd, "description"), filename, raw_content: raw,
    parsed_content: parsed ? sql.json(parsed) : null, created_by: user.id,
  })}`;
  return back({ notice: parsed ? `Zaimportowano — rozpoznano tabelę (${parsed.rows.length} wierszy).` : "Zaimportowano jako surowy tekst." });
}

export async function saveBusinessDescription(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  await sql`update business_lines set description = ${str(fd, "description")} where id = ${line.id}`;
  return back({ notice: "Zapisano opis biznesu." });
}

export async function saveMetric(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  if (id && str(fd, "op") === "delete") {
    await sql`delete from metrics where id = ${id} and business_line_id = ${line.id}`;
    return back();
  }
  const name = str(fd, "name");
  const value = str(fd, "value");
  if (!name || !value) return fail("Podaj nazwę i wartość metryki.");
  await sql`insert into metrics ${sql({
    business_line_id: line.id, name, value, unit: str(fd, "unit"), constraint_id: uuid(fd, "constraint_id"),
    period_start: opt(fd, "period_start"), period_end: opt(fd, "period_end"), source: str(fd, "source"), note: str(fd, "note"), created_by: user.id,
  })}`;
  return back();
}

// ───────────── Decision log

export async function saveDecision(fd: FormData) {
  const { line, user } = await lineCtx(fd, "manage");
  const id = uuid(fd, "id");
  const decision = str(fd, "decision");
  if (!decision) return fail("Wpisz treść decyzji.");
  const data = {
    decision, decision_date: opt(fd, "decision_date") ?? new Date().toISOString().slice(0, 10), why: str(fd, "why"),
    evidence: str(fd, "evidence"), owner_id: uuid(fd, "owner_id"), expected_result: str(fd, "expected_result"),
    review_date: opt(fd, "review_date"), result: str(fd, "result"),
  };
  if (id) await sql`update decisions set ${sql(data)} where id = ${id} and business_line_id = ${line.id}`;
  else await sql`insert into decisions ${sql({ ...data, business_line_id: line.id, created_by: user.id })}`;
  return back({ notice: "Zapisano decyzję." });
}
