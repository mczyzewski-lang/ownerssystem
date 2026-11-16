import postgres from "postgres";

// Server-side only. Works with Supabase Postgres (use the pooled "Transaction" connection string
// on serverless hosts — prepared statements are disabled for that reason) and plain PostgreSQL.
const globalForDb = globalThis as unknown as { __gaosSql?: postgres.Sql };

export const sql: postgres.Sql =
  globalForDb.__gaosSql ??
  postgres(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/gaos", {
    prepare: false,
    max: 10,
    onnotice: () => {},
    // keep DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });

if (process.env.NODE_ENV !== "production") globalForDb.__gaosSql = sql;

export type Tx = postgres.TransactionSql | postgres.Sql;
