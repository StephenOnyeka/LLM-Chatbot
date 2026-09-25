import pg from "pg";
import dns from "node:dns";
import { env, isProd } from "./env.js";

// Custom DNS resolver fallback to prevent Windows getaddrinfo EAI_AGAIN errors with Supabase pooler
const origLookup = dns.lookup;
const customLookup = (hostname: string, options: any, callback: any) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "object" && options !== null ? options : {};

  dns.resolve4(hostname, (err, addresses) => {
    if (err || !addresses || addresses.length === 0) {
      origLookup(hostname, opts, cb);
    } else {
      if (opts.all) {
        cb(null, addresses.map((a) => ({ address: a, family: 4 })));
      } else {
        cb(null, addresses[0], 4);
      }
    }
  });
};
(dns.lookup as any) = customLookup;



export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("Unexpected pg pool error", err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[] | undefined);
}
