import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    // .env.local의 SUPABASE_SERVICE_ROLE_KEY를 로드하는 통합 테스트 전제
    setupFiles: ["./tests/setup.ts"],
    // 실 DB 왕복이 있어 기본 타임아웃(5s)으로는 부족하다
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
