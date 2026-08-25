/**
 * Supabase 전수 백업 스크립트
 *
 * 358건 제품 적재 전 되돌릴 수 있는 지점을 확보하기 위해
 * 주요 7개 테이블을 JSON 스냅샷으로 저장한다.
 *
 * 실행: pnpm backup
 * 출력: data/fixtures/backup-YYYY-MM-DD.json
 *
 * 보안: service_role 키는 process.env에서만 읽으며, 출력 JSON에는
 *       키도 프로젝트 URL도 기록하지 않는다.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// .env.local 파일에서 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 백업은 RLS를 우회해야 전수를 읽을 수 있으므로 service_role 키만 허용한다
// (unmatched_log 등 일부 테이블은 anon 키로 0행이 조회된다)
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ 환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** 백업 대상 테이블 (FK 의존성 순서 — 복구 시 이 순서대로 넣으면 된다) */
const TABLES = [
  "ingredients",
  "ingredient_groups",
  "ingredient_group_members",
  "ingredient_aliases",
  "products",
  "product_ingredients",
  "conflict_rules",
  // unmatched_log 는 재적재 전 부분 삭제(product_id IS NOT NULL) 대상이라
  // 백업에 포함해야 복구가 가능하다. products 이후여야 FK 순서가 맞는다.
  "unmatched_log",
] as const;

/** Supabase 기본 1000행 제한을 넘기기 위한 페이지 크기 */
const PAGE_SIZE = 1000;

/** DB의 실제 행 수를 count=exact로 조회한다 */
async function fetchCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(`${table} count 조회 실패: ${error.message}`);
  return count ?? 0;
}

/** range 페이징으로 테이블 전체 행을 읽는다 */
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  console.log("🗄️  Supabase 전수 백업 시작\n");

  const takenAt = new Date().toISOString();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const report: { table: string; backed: number; dbCount: number }[] = [];

  for (const table of TABLES) {
    const dbCount = await fetchCount(table);
    const rows = await fetchAllRows(table);
    tables[table] = rows;
    report.push({ table, backed: rows.length, dbCount });

    const mark = rows.length === dbCount ? "✅" : "❌";
    console.log(
      `  ${mark} ${table.padEnd(26)} 백업 ${String(rows.length).padStart(5)}행 / DB ${String(dbCount).padStart(5)}행`
    );
  }

  // 한 건이라도 어긋나면 파일을 쓰지 않고 중단한다
  const mismatched = report.filter((r) => r.backed !== r.dbCount);
  if (mismatched.length > 0) {
    console.error("\n❌ 백업 행 수와 DB 실제 count가 일치하지 않습니다:");
    for (const m of mismatched) {
      console.error(`   ${m.table}: 백업 ${m.backed}행 vs DB ${m.dbCount}행`);
    }
    console.error("   파일을 저장하지 않고 중단합니다.");
    process.exit(1);
  }

  // data/fixtures/backup-YYYY-MM-DD.json 으로 저장
  const outDir = path.resolve(process.cwd(), "data", "fixtures");
  fs.mkdirSync(outDir, { recursive: true });

  const dateStr = takenAt.slice(0, 10);
  const outPath = path.join(outDir, `backup-${dateStr}.json`);

  // 출력 페이로드에는 키·URL을 포함하지 않는다
  const payload = {
    takenAt,
    tables,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  const total = report.reduce((sum, r) => sum + r.backed, 0);

  console.log(`\n✅ 백업 완료 — 총 ${total}행, ${sizeKb}KB`);
  console.log(`   takenAt: ${takenAt}`);
  console.log(`   경로:    ${outPath}`);
}

main().catch((err) => {
  console.error("❌ 백업 실패:", err);
  process.exit(1);
});
