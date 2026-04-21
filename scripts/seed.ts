/**
 * Supabase 시드 스크립트
 * CSV 데이터를 읽어 Supabase 테이블에 삽입한다.
 *
 * 실행 순서:
 * 1. ingredients
 * 2. ingredient_groups
 * 3. ingredient_group_members
 * 4. ingredient_aliases
 * 5. products
 * 6. product_ingredients
 * 7. conflict_rules
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// .env.local 파일에서 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// service_role key 우선 사용 (RLS bypass) → 없으면 publishable key로 fallback
// service_role key 사용 권장:
//   Supabase Dashboard > Project Settings > API > service_role key
//   .env.local에 SUPABASE_SERVICE_ROLE_KEY=<key> 추가
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ 환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY(혹은 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 설정되지 않았습니다."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CSV 파일 경로
const DATA_DIR = path.resolve(process.cwd(), "data");
const TOY_DIR = path.join(DATA_DIR, "toyfiles");
const CSV_DIR = path.join(DATA_DIR, "csv");

/**
 * RFC 4180 준수 CSV 파싱 함수
 * 큰따옴표로 감싸진 필드 내 쉼표를 올바르게 처리한다.
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header.trim()] = values[index] ?? "";
    });
    records.push(record);
  }

  return records;
}

/**
 * 단일 CSV 라인을 필드 배열로 파싱한다.
 * 큰따옴표 이스케이프 처리 포함.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // 큰따옴표 이스케이프: ""는 하나의 "로 처리
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
}

/**
 * CSV 파일을 읽고 파싱하여 반환한다.
 */
function readCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseCSV(content);
}

/**
 * 빈 문자열을 null로 변환한다.
 */
function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  return value;
}

/**
 * 각 테이블의 row count를 출력한다.
 */
async function printTableCounts() {
  const tables = [
    "ingredients",
    "ingredient_groups",
    "ingredient_group_members",
    "ingredient_aliases",
    "products",
    "product_ingredients",
    "conflict_rules",
  ];

  console.log("\n=== 최종 테이블 row count ===");
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error(`  ${table}: 오류 - ${error.message}`);
    } else {
      console.log(`  ${table}: ${count}행`);
    }
  }
}

// ─────────────────────────────────────────────
// 1단계: ingredients 삽입
// ─────────────────────────────────────────────
async function seedIngredients(): Promise<Map<string, string>> {
  console.log("\n[1/7] ingredients 삽입 중...");
  const rows = readCSV(path.join(TOY_DIR, "toy_ingredients.csv"));

  const records = rows.map((row) => ({
    name: row["name"],
    name_en: emptyToNull(row["name_en"]),
    category: emptyToNull(row["category"]),
    is_restricted: row["is_restricted"]?.toUpperCase() === "TRUE",
    restrict_info: emptyToNull(row["restrict_info"]),
  }));

  const { error } = await supabase
    .from("ingredients")
    .upsert(records, { onConflict: "name" });

  if (error) {
    console.error("  ❌ 오류:", error.message);
    throw error;
  }
  console.log(`  ✅ ${records.length}개 upsert 완료`);

  // name → id 매핑 맵 반환
  const { data, error: fetchError } = await supabase
    .from("ingredients")
    .select("id, name");
  if (fetchError) throw fetchError;

  const map = new Map<string, string>();
  data?.forEach((row) => map.set(row.name, row.id));
  console.log(`  매핑 맵 생성: ${map.size}개`);
  return map;
}

// ─────────────────────────────────────────────
// 2단계: ingredient_groups 삽입
// ─────────────────────────────────────────────
async function seedIngredientGroups(): Promise<Map<string, string>> {
  console.log("\n[2/7] ingredient_groups 삽입 중...");
  const rows = readCSV(path.join(CSV_DIR, "ingredient_groups.csv"));

  const records = rows.map((row) => ({
    group_name: row["group_name"],
    description: emptyToNull(row["description"]),
  }));

  const { error } = await supabase
    .from("ingredient_groups")
    .upsert(records, { onConflict: "group_name" });

  if (error) {
    console.error("  ❌ 오류:", error.message);
    throw error;
  }
  console.log(`  ✅ ${records.length}개 upsert 완료`);

  // group_name → id 매핑 맵 반환
  const { data, error: fetchError } = await supabase
    .from("ingredient_groups")
    .select("id, group_name");
  if (fetchError) throw fetchError;

  const map = new Map<string, string>();
  data?.forEach((row) => map.set(row.group_name, row.id));
  console.log(`  매핑 맵 생성: ${map.size}개`);
  return map;
}

// ─────────────────────────────────────────────
// 3단계: ingredient_group_members 삽입
// ─────────────────────────────────────────────
async function seedIngredientGroupMembers(
  ingredientMap: Map<string, string>,
  groupMap: Map<string, string>
) {
  console.log("\n[3/7] ingredient_group_members 삽입 중...");
  const rows = readCSV(path.join(CSV_DIR, "ingredient_group_members.csv"));

  let skipped = 0;
  const records: { group_id: string; ingredient_id: string }[] = [];

  for (const row of rows) {
    const groupId = groupMap.get(row["group_name"]);
    const ingredientId = ingredientMap.get(row["ingredient_name"]);

    if (!groupId) {
      console.warn(`  ⚠️  그룹 없음 - 스킵: "${row["group_name"]}"`);
      skipped++;
      continue;
    }
    if (!ingredientId) {
      console.warn(`  ⚠️  성분 없음 - 스킵: "${row["ingredient_name"]}"`);
      skipped++;
      continue;
    }
    records.push({ group_id: groupId, ingredient_id: ingredientId });
  }

  if (records.length > 0) {
    // 중복 방지: 기존에 없는 조합만 삽입
    const { error } = await supabase
      .from("ingredient_group_members")
      .upsert(records, {
        onConflict: "group_id,ingredient_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("  ❌ 오류:", error.message);
      throw error;
    }
  }

  console.log(`  ✅ ${records.length}개 삽입 완료 (스킵: ${skipped}개)`);
}

// ─────────────────────────────────────────────
// 4단계: ingredient_aliases 삽입
// ─────────────────────────────────────────────
async function seedIngredientAliases(ingredientMap: Map<string, string>) {
  console.log("\n[4/7] ingredient_aliases 삽입 중...");
  const rows = readCSV(path.join(CSV_DIR, "ingredient_aliases.csv"));

  let skipped = 0;
  const records: { alias: string; ingredient_id: string; source: string }[] =
    [];

  for (const row of rows) {
    const ingredientId = ingredientMap.get(row["ingredient_name"]);

    if (!ingredientId) {
      console.warn(`  ⚠️  성분 없음 - 스킵: "${row["ingredient_name"]}"`);
      skipped++;
      continue;
    }

    const source = row["source"] === "auto" ? "auto" : "manual";
    records.push({
      alias: row["alias"],
      ingredient_id: ingredientId,
      source,
    });
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from("ingredient_aliases")
      .upsert(records, { onConflict: "alias", ignoreDuplicates: true });

    if (error) {
      console.error("  ❌ 오류:", error.message);
      throw error;
    }
  }

  console.log(`  ✅ ${records.length}개 삽입 완료 (스킵: ${skipped}개)`);
}

// ─────────────────────────────────────────────
// 5단계: products 삽입
// ─────────────────────────────────────────────
async function seedProducts(): Promise<Map<string, string>> {
  console.log("\n[5/7] products 삽입 중...");
  const rows = readCSV(path.join(TOY_DIR, "toy_products.csv"));

  const records = rows.map((row) => ({
    name: row["name"],
    brand: emptyToNull(row["brand"]),
    category: row["category"],
    oliveyoung_id: emptyToNull(row["oliveyoung_id"]),
    oliveyoung_rank: row["oliveyoung_rank"]
      ? parseInt(row["oliveyoung_rank"], 10)
      : null,
    source_url: emptyToNull(row["source_url"]),
    raw_ingredients_text: emptyToNull(row["raw_ingredients_text"]),
  }));

  const { error } = await supabase
    .from("products")
    .upsert(records, { onConflict: "oliveyoung_id" });

  if (error) {
    console.error("  ❌ 오류:", error.message);
    throw error;
  }
  console.log(`  ✅ ${records.length}개 upsert 완료`);

  // name → id 매핑 맵 반환
  const { data, error: fetchError } = await supabase
    .from("products")
    .select("id, name");
  if (fetchError) throw fetchError;

  const map = new Map<string, string>();
  data?.forEach((row) => map.set(row.name, row.id));
  console.log(`  매핑 맵 생성: ${map.size}개`);
  return map;
}

// ─────────────────────────────────────────────
// 6단계: product_ingredients 삽입
// ─────────────────────────────────────────────
async function seedProductIngredients(
  productMap: Map<string, string>,
  ingredientMap: Map<string, string>
) {
  console.log("\n[6/7] product_ingredients 삽입 중...");
  const rows = readCSV(path.join(TOY_DIR, "toy_product_ingredients.csv"));

  let skipped = 0;
  const records: {
    product_id: string;
    ingredient_id: string;
    display_order: number;
    raw_name: string;
  }[] = [];

  for (const row of rows) {
    const productId = productMap.get(row["product_name"]);
    const ingredientId = ingredientMap.get(row["ingredient_name"]);

    if (!productId) {
      console.warn(`  ⚠️  제품 없음 - 스킵: "${row["product_name"]}"`);
      skipped++;
      continue;
    }
    if (!ingredientId) {
      console.warn(
        `  ⚠️  성분 없음 - 스킵: "${row["ingredient_name"]}" (제품: ${row["product_name"]})`
      );
      skipped++;
      continue;
    }

    records.push({
      product_id: productId,
      ingredient_id: ingredientId,
      display_order: parseInt(row["display_order"], 10),
      raw_name: row["raw_name"],
    });
  }

  if (records.length > 0) {
    // 배치로 삽입 (Supabase 단일 요청 크기 제한 고려)
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("product_ingredients")
        .insert(batch);

      if (error) {
        // 이미 삽입된 데이터라면 무시
        if (error.code === "23505") {
          console.warn(
            `  ⚠️  중복 데이터 스킵 (batch ${Math.floor(i / BATCH_SIZE) + 1})`
          );
        } else {
          console.error("  ❌ 오류:", error.message);
          throw error;
        }
      }
    }
  }

  console.log(`  ✅ ${records.length}개 삽입 완료 (스킵: ${skipped}개)`);
}

// ─────────────────────────────────────────────
// 7단계: conflict_rules 삽입
// ─────────────────────────────────────────────
async function seedConflictRules(ingredientMap: Map<string, string>) {
  console.log("\n[7/7] conflict_rules 삽입 중...");
  const rows = readCSV(path.join(CSV_DIR, "conflict_rules.csv"));

  // conflict_rules에서 ingredient 타입으로 참조된 이름 수집
  // ingredients 테이블에 없으면 generic placeholder로 자동 추가
  const missingIngredients = new Set<string>();
  for (const row of rows) {
    if (
      row["a_type"] === "ingredient" &&
      !ingredientMap.has(row["ingredient_a"])
    ) {
      missingIngredients.add(row["ingredient_a"]);
    }
    if (
      row["b_type"] === "ingredient" &&
      !ingredientMap.has(row["ingredient_b"])
    ) {
      missingIngredients.add(row["ingredient_b"]);
    }
  }

  if (missingIngredients.size > 0) {
    const placeholders = Array.from(missingIngredients).map((name) => ({
      name,
      name_en: null,
      category: "generic (충돌 규칙 참조용)",
      is_restricted: false,
      restrict_info: null,
    }));
    console.log(
      `  충돌 규칙 참조 성분 ${placeholders.length}개를 generic으로 추가: ${Array.from(missingIngredients).join(", ")}`
    );
    const { error: insertErr } = await supabase
      .from("ingredients")
      .upsert(placeholders, { onConflict: "name" });
    if (insertErr) {
      console.error("  ❌ generic 성분 추가 오류:", insertErr.message);
      throw insertErr;
    }
    // 맵 갱신
    const { data: refreshed } = await supabase
      .from("ingredients")
      .select("id, name")
      .in("name", Array.from(missingIngredients));
    refreshed?.forEach((r) => ingredientMap.set(r.name, r.id));
  }

  const records = rows.map((row) => {
    let ingredientA = row["ingredient_a"];
    let ingredientB = row["ingredient_b"];
    let aType = row["a_type"];
    let bType = row["b_type"];

    // canonical 순서 보장: ingredient_a < ingredient_b (사전순)
    if (ingredientA > ingredientB) {
      [ingredientA, ingredientB] = [ingredientB, ingredientA];
      [aType, bType] = [bType, aType];
    }

    return {
      ingredient_a: ingredientA,
      ingredient_b: ingredientB,
      a_type: aType,
      b_type: bType,
      conflict_type: row["conflict_type"],
      severity: emptyToNull(row["severity"]),
      reason_ko: row["reason_ko"],
      recommend: emptyToNull(row["recommend"]),
      source: emptyToNull(row["source"]),
    };
  });

  const { error } = await supabase.from("conflict_rules").insert(records);

  if (error) {
    // 중복 삽입 시 무시
    if (error.code === "23505") {
      console.warn("  ⚠️  일부 중복 데이터 스킵");
    } else {
      console.error("  ❌ 오류:", error.message);
      throw error;
    }
  } else {
    console.log(`  ✅ ${records.length}개 삽입 완료`);
  }
}

// ─────────────────────────────────────────────
// integrity check: conflict_rules 참조 무결성 검사
// ─────────────────────────────────────────────
async function runIntegrityCheck() {
  console.log("\n=== 무결성 검사 ===");
  let issueCount = 0;

  // conflict_rules 전체 조회
  const { data: rules, error: rulesError } = await supabase
    .from("conflict_rules")
    .select("ingredient_a, ingredient_b, a_type, b_type");
  if (rulesError) {
    console.error("  ❌ conflict_rules 조회 실패:", rulesError.message);
    return;
  }

  // ingredients 이름 목록
  const { data: ingredientRows } = await supabase
    .from("ingredients")
    .select("name");
  const ingredientNames = new Set((ingredientRows ?? []).map((r) => r.name));

  // ingredient_groups 이름 목록
  const { data: groupRows } = await supabase
    .from("ingredient_groups")
    .select("group_name");
  const groupNames = new Set((groupRows ?? []).map((r) => r.group_name));

  for (const rule of rules ?? []) {
    if (
      rule.a_type === "ingredient" &&
      !ingredientNames.has(rule.ingredient_a)
    ) {
      console.warn(`  ⚠️  a_type:ingredient 불일치 - "${rule.ingredient_a}"`);
      issueCount++;
    }
    if (
      rule.b_type === "ingredient" &&
      !ingredientNames.has(rule.ingredient_b)
    ) {
      console.warn(`  ⚠️  b_type:ingredient 불일치 - "${rule.ingredient_b}"`);
      issueCount++;
    }
    if (rule.a_type === "group" && !groupNames.has(rule.ingredient_a)) {
      console.warn(`  ⚠️  a_type:group 불일치 - "${rule.ingredient_a}"`);
      issueCount++;
    }
    if (rule.b_type === "group" && !groupNames.has(rule.ingredient_b)) {
      console.warn(`  ⚠️  b_type:group 불일치 - "${rule.ingredient_b}"`);
      issueCount++;
    }
  }

  if (issueCount === 0) {
    console.log("  ✅ 무결성 검사 통과: 불일치 0건");
  } else {
    console.warn(`  ⚠️  불일치 ${issueCount}건 발견`);
  }
}

// ─────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────
async function main() {
  console.log("🌱 Supabase 시드 스크립트 시작");
  console.log(`   URL: ${SUPABASE_URL}`);

  try {
    // 1. ingredients
    const ingredientMap = await seedIngredients();

    // 2. ingredient_groups
    const groupMap = await seedIngredientGroups();

    // 3. ingredient_group_members
    await seedIngredientGroupMembers(ingredientMap, groupMap);

    // 4. ingredient_aliases
    await seedIngredientAliases(ingredientMap);

    // 5. products
    const productMap = await seedProducts();

    // 6. product_ingredients
    await seedProductIngredients(productMap, ingredientMap);

    // 7. conflict_rules (ingredientMap 전달: generic 성분 자동 추가용)
    await seedConflictRules(ingredientMap);

    // 최종 row count 출력
    await printTableCounts();

    // 무결성 검사 (가능한 경우)
    await runIntegrityCheck();

    console.log("\n✅ 시드 완료!");
  } catch (err) {
    console.error("\n❌ 시드 실패:", err);
    process.exit(1);
  }
}

main();
