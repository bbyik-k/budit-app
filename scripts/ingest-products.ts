/**
 * 제품 · 전성분 적재 스크립트
 *
 * CSV의 제품 메타를 products에 upsert하고, raw_ingredients_text를
 * parseIngredientText로 분리한 뒤 matchIngredients로 매칭해
 * product_ingredients에 적재한다.
 *
 * 실행:
 *   pnpm ingest                                  # 전량
 *   pnpm ingest -- --limit 10                    # 상위 10건만
 *   pnpm ingest -- --file data/other.csv         # 입력 파일 지정
 *   pnpm ingest -- --force                       # 이미 적재된 제품도 재처리
 *
 * 중단되어도 재실행하면 이미 product_ingredients가 있는 제품은 건너뛰고
 * 이어서 처리한다. 모든 쓰기가 upsert라 중복 실행도 안전하다.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseIngredientText } from "@/lib/ingredients/parse";
import { matchIngredients } from "@/lib/analyze/match";
import type { Database } from "@/lib/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 적재는 RLS를 우회해야 하므로 service_role 키만 허용한다
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ 환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
  );
  process.exit(1);
}

const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────
// CLI 인자
// ─────────────────────────────────────────────
interface CliOptions {
  file: string;
  limit: number | null;
  force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    file: "data/products_seed_cleaned.csv",
    limit: null,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) throw new Error("--file 뒤에 경로가 필요합니다");
      opts.file = value;
      i += 1;
    } else if (arg === "--limit") {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit 뒤에 양의 정수가 필요합니다");
      }
      opts.limit = value;
      i += 1;
    } else if (arg === "--force") {
      opts.force = true;
    } else {
      throw new Error(`알 수 없는 인자: ${arg}`);
    }
  }
  return opts;
}

// ─────────────────────────────────────────────
// CSV 파싱
// ─────────────────────────────────────────────
/**
 * 따옴표로 감싼 필드 안의 쉼표와 개행까지 처리하는 CSV 파서.
 *
 * scripts/seed.ts의 readCSV는 split("\n")을 먼저 해 따옴표 내 개행을
 * 처리하지 못한다. raw_ingredients_text는 긴 인용 필드라 그 방식으로는
 * 깨질 수 있어 여기서는 문자 단위 상태 기계로 직접 파싱한다.
 */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // 이스케이프된 큰따옴표
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty
    .slice(1)
    .map((r) =>
      Object.fromEntries(header.map((key, idx) => [key, (r[idx] ?? "").trim()]))
    );
}

/** 빈 문자열을 null로 변환 */
function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

// ─────────────────────────────────────────────
// 집계 결과
// ─────────────────────────────────────────────
interface Stats {
  productsUpserted: number;
  productsSkipped: number;
  totalTokens: number;
  uniqueTokens: Set<string>;
  exact: number;
  alias: number;
  fuzzy: number;
  unmatched: number;
  unmatchedTokens: string[];
  piUpserted: number;
  fuzzyRpcCalls: number;
}

/**
 * fuzzy RPC 호출 횟수를 세기 위해 rpc를 감싼 프록시 클라이언트를 만든다.
 * matchIngredients의 Step 3은 미매칭 후보 1건당 RPC를 1회 호출하므로
 * 이 값이 곧 병목 지표가 된다.
 */
function withRpcCounter(
  client: SupabaseClient<Database>,
  onFuzzyCall: () => void
): SupabaseClient<Database> {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return (fnName: string, args: unknown) => {
          if (fnName === "match_ingredient_fuzzy") onFuzzyCall();
          return (
            target.rpc as unknown as (n: string, a: unknown) => unknown
          ).call(target, fnName, args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient<Database>;
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const csvPath = path.resolve(process.cwd(), opts.file);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 입력 파일이 없습니다: ${csvPath}`);
    process.exit(1);
  }

  const allRows = parseCSV(fs.readFileSync(csvPath, "utf-8"));
  console.log(`📄 ${opts.file} — ${allRows.length}행 파싱`);

  // 이어하기: 이미 product_ingredients가 있는 제품은 건너뛴다
  const done = new Set<string>();
  if (!opts.force) {
    const { data, error } = await supabase
      .from("products")
      .select("oliveyoung_id, product_ingredients(product_id)")
      .not("oliveyoung_id", "is", null);
    if (error) throw new Error(`기존 적재 현황 조회 실패: ${error.message}`);
    for (const row of data ?? []) {
      const pi = row.product_ingredients as unknown[] | null;
      if (row.oliveyoung_id && pi && pi.length > 0) done.add(row.oliveyoung_id);
    }
    console.log(`↩️  이미 전성분이 적재된 제품 ${done.size}건은 건너뜁니다`);
  }

  const rows = opts.limit ? allRows.slice(0, opts.limit) : allRows;
  console.log(`🎯 처리 대상 ${rows.length}건\n`);

  const stats: Stats = {
    productsUpserted: 0,
    productsSkipped: 0,
    totalTokens: 0,
    uniqueTokens: new Set(),
    exact: 0,
    alias: 0,
    fuzzy: 0,
    unmatched: 0,
    unmatchedTokens: [],
    piUpserted: 0,
    fuzzyRpcCalls: 0,
  };

  const counted = withRpcCounter(supabase, () => {
    stats.fuzzyRpcCalls += 1;
  });

  const startedAt = Date.now();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const oliveyoungId = emptyToNull(row["oliveyoung_id"]);
    const label = `[${String(i + 1).padStart(3)}/${rows.length}] ${oliveyoungId ?? "(ID없음)"}`;

    if (oliveyoungId && done.has(oliveyoungId)) {
      stats.productsSkipped += 1;
      console.log(`${label} ⏭  이미 적재됨`);
      continue;
    }

    // ── 1. products upsert (oliveyoung_id UNIQUE 기준) ──────────────
    const rank = row["oliveyoung_rank"];
    const { data: upserted, error: productError } = await supabase
      .from("products")
      .upsert(
        {
          name: row["name"],
          brand: row["brand"],
          category: row["category"],
          subcategory: emptyToNull(row["subcategory"]),
          oliveyoung_id: oliveyoungId,
          oliveyoung_rank: rank ? Number.parseInt(rank, 10) : null,
          source_url: emptyToNull(row["source_url"]),
          raw_ingredients_text: emptyToNull(row["raw_ingredients_text"]),
        },
        { onConflict: "oliveyoung_id" }
      )
      .select("id")
      .single();

    if (productError || !upserted) {
      throw new Error(
        `${label} products upsert 실패: ${productError?.message ?? "행 반환 없음"}`
      );
    }
    stats.productsUpserted += 1;
    const productId = upserted.id;

    // ── 2. 전성분 분리 ───────────────────────────────────────────────
    const tokens = parseIngredientText(row["raw_ingredients_text"] ?? "");
    stats.totalTokens += tokens.length;
    tokens.forEach((t) => stats.uniqueTokens.add(t));

    if (tokens.length === 0) {
      console.log(`${label} ⚠️  전성분 토큰 0개 — 매칭 건너뜀`);
      continue;
    }

    // ── 3. 매칭 (미매칭은 unmatched_log에 기록) ──────────────────────
    const result = await matchIngredients(tokens, productId, {
      logUnmatched: true,
      client: counted,
      adminClient: supabase,
    });

    const byType = { exact: 0, alias: 0, fuzzy: 0 };
    for (const m of result.matched) byType[m.match_type] += 1;
    stats.exact += byType.exact;
    stats.alias += byType.alias;
    stats.fuzzy += byType.fuzzy;
    stats.unmatched += result.unmatched.length;
    stats.unmatchedTokens.push(...result.unmatched);

    // ── 4. product_ingredients upsert ────────────────────────────────
    // display_order는 원문 등장 순서를 따른다. 같은 제품 안에서 동일
    // ingredient_id가 두 번 나오면 UNIQUE(product_id, ingredient_id)와
    // 충돌하므로(한 배치 내 중복은 Postgres가 거부) 첫 등장만 남긴다.
    const orderOf = new Map<string, number>();
    tokens.forEach((t, idx) => {
      if (!orderOf.has(t)) orderOf.set(t, idx + 1);
    });

    const seen = new Set<string>();
    const records = [];
    for (const m of result.matched) {
      if (seen.has(m.ingredient_id)) continue;
      seen.add(m.ingredient_id);
      records.push({
        product_id: productId,
        ingredient_id: m.ingredient_id,
        display_order: orderOf.get(m.raw_name) ?? records.length + 1,
        raw_name: m.raw_name,
      });
    }

    if (records.length > 0) {
      const { error: piError } = await supabase
        .from("product_ingredients")
        .upsert(records, { onConflict: "product_id,ingredient_id" });

      if (piError) {
        // 42P10 = ON CONFLICT 대상 UNIQUE 제약이 없음
        if (piError.code === "42P10") {
          throw new Error(
            `${label} product_ingredients 의 UNIQUE(product_id, ingredient_id) 제약이 없습니다. ` +
              `마이그레이션이 필요합니다: ${piError.message}`
          );
        }
        throw new Error(
          `${label} product_ingredients upsert 실패: ${piError.message}`
        );
      }
      stats.piUpserted += records.length;
    }

    console.log(
      `${label} | 토큰 ${String(tokens.length).padStart(3)} | ` +
        `exact ${String(byType.exact).padStart(3)} alias ${String(byType.alias).padStart(2)} ` +
        `fuzzy ${String(byType.fuzzy).padStart(2)} unmatched ${String(result.unmatched.length).padStart(3)} | ` +
        `PI ${records.length}행`
    );
  }

  // ── 요약 ───────────────────────────────────────────────────────────
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalMatched = stats.exact + stats.alias + stats.fuzzy;
  const denom = totalMatched + stats.unmatched;
  const pct = (n: number) =>
    denom === 0 ? "0.0" : ((n / denom) * 100).toFixed(1);

  console.log("\n" + "─".repeat(62));
  console.log(`소요 시간           ${elapsedSec}초`);
  console.log(`fuzzy RPC 호출      ${stats.fuzzyRpcCalls}회`);
  console.log(
    `products upsert     ${stats.productsUpserted}건 (스킵 ${stats.productsSkipped}건)`
  );
  console.log(
    `총 성분 토큰        ${stats.totalTokens} (고유 ${stats.uniqueTokens.size})`
  );
  console.log(`  exact             ${stats.exact} (${pct(stats.exact)}%)`);
  console.log(`  alias             ${stats.alias} (${pct(stats.alias)}%)`);
  console.log(`  fuzzy             ${stats.fuzzy} (${pct(stats.fuzzy)}%)`);
  console.log(
    `  unmatched         ${stats.unmatched} (${pct(stats.unmatched)}%)`
  );
  console.log(`product_ingredients ${stats.piUpserted}행 upsert`);
  console.log("─".repeat(62));
}

main().catch((err) => {
  console.error("\n❌ 적재 중단:", err instanceof Error ? err.message : err);
  process.exit(1);
});
