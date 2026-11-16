import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const { sql } = await import("../lib/db");
  await sql`create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table app_migrations enable row level security`;
  const dir = join(process.cwd(), "db/migrations");
  const applied = new Set((await sql`select name from app_migrations`).map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    process.stdout.write(`applying ${file} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into app_migrations (name) values (${file})`;
    });
    console.log("ok");
  }
  console.log("migrations up to date");
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
