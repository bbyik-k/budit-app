import { describe, it, expect } from "vitest";
import { parseIngredientText } from "@/lib/ingredients/parse";

/**
 * parseIngredientText 단위 테스트 (실 DB 불필요)
 *
 * 케이스는 data/products_seed_cleaned.csv 358건의 실제 표기에서 뽑았다.
 */
describe("parseIngredientText", () => {
  describe("괄호 깊이 분리", () => {
    it("괄호 안 쉼표는 분리하지 않는다", () => {
      expect(parseIngredientText("나이아신아마이드(1,000ppm), 정제수")).toEqual(
        ["나이아신아마이드", "정제수"]
      );
    });

    it("괄호 안에 여러 성분이 나열돼도 한 토큰으로 유지한다", () => {
      expect(
        parseIngredientText("정제수, 향료(리날룰, 리모넨), 글리세린")
      ).toEqual(["정제수", "향료(리날룰, 리모넨)", "글리세린"]);
    });

    it("공백 구분 모드에서도 괄호 안 공백을 무시한다", () => {
      expect(
        parseIngredientText("온천수(아벤느 온천수) 글리세린 펜틸렌글라이콜")
      ).toEqual(["온천수(아벤느 온천수)", "글리세린", "펜틸렌글라이콜"]);
    });

    it("닫히지 않은 괄호에도 깊이가 음수로 내려가지 않는다", () => {
      expect(parseIngredientText("정제수), 글리세린")).toEqual([
        "정제수)",
        "글리세린",
      ]);
    });
  });

  describe("공백 전용 구분", () => {
    it("쉼표가 없으면 공백으로 분리한다", () => {
      expect(parseIngredientText("정제수 글리세린 부틸렌글라이콜")).toEqual([
        "정제수",
        "글리세린",
        "부틸렌글라이콜",
      ]);
    });

    it("연속 공백이 있어도 빈 토큰을 만들지 않는다", () => {
      expect(parseIngredientText("정제수   글리세린\t부틸렌글라이콜")).toEqual([
        "정제수",
        "글리세린",
        "부틸렌글라이콜",
      ]);
    });

    it("성분명 쉼표만 있는 공백 구분 표기도 올바르게 분리한다", () => {
      // 쉼표가 "1,2-" 뿐이면 구분자가 아니므로 공백 구분으로 판정해야 한다
      expect(parseIngredientText("정제수 1,2-헥산다이올 글리세린")).toEqual([
        "정제수",
        "1,2-헥산다이올",
        "글리세린",
      ]);
    });
  });

  describe("대괄호 노이즈 제거", () => {
    it("대괄호로 감싼 제품명을 제거한다", () => {
      expect(parseIngredientText("[알로에수딩] 정제수, 글리세린")).toEqual([
        "정제수",
        "글리세린",
      ]);
    });

    it("목록 중간에 낀 대괄호도 제거하고 앞뒤를 이어붙이지 않는다", () => {
      expect(
        parseIngredientText("병풀추출물 [알로에수딩] 정제수, 부틸렌글라이콜")
      ).toEqual(["병풀추출물 정제수", "부틸렌글라이콜"]);
    });
  });

  describe("@ 구분자", () => {
    it("@를 쉼표와 동일하게 취급한다", () => {
      expect(parseIngredientText("정제수@글리세린@부틸렌글라이콜")).toEqual([
        "정제수",
        "글리세린",
        "부틸렌글라이콜",
      ]);
    });

    it("@와 쉼표가 섞여 있어도 처리한다", () => {
      expect(parseIngredientText("정제수@글리세린, 향료")).toEqual([
        "정제수",
        "글리세린",
        "향료",
      ]);
    });
  });

  describe("성분명 내부의 숫자 쉼표", () => {
    it("숫자 사이 쉼표는 분리하지 않는다", () => {
      expect(parseIngredientText("정제수, 1,2-헥산다이올, 글리세린")).toEqual([
        "정제수",
        "1,2-헥산다이올",
        "글리세린",
      ]);
    });

    it("다른 화학 명명법에도 동일하게 적용된다", () => {
      expect(parseIngredientText("2,3-부탄다이올, 1,3-부틸렌글라이콜")).toEqual(
        ["2,3-부탄다이올", "1,3-부틸렌글라이콜"]
      );
    });

    it("숫자와 문자 사이 쉼표는 정상적으로 분리한다", () => {
      expect(parseIngredientText("피이지-20, 카보머")).toEqual([
        "피이지-20",
        "카보머",
      ]);
    });
  });

  describe("함량 단위 제거 (normalizeName 연동)", () => {
    it("괄호 안 함량 표기를 제거한다", () => {
      expect(
        parseIngredientText("레티놀(500IU/g), 티트리잎가루(3 ppm)")
      ).toEqual(["레티놀", "티트리잎가루"]);
    });

    it("퍼센트 표기도 제거한다", () => {
      expect(parseIngredientText("나이아신아마이드(2%), 정제수")).toEqual([
        "나이아신아마이드",
        "정제수",
      ]);
    });

    it("문자가 섞인 괄호는 유지한다", () => {
      expect(parseIngredientText("토코페롤(비타민E), 정제수")).toEqual([
        "토코페롤(비타민E)",
        "정제수",
      ]);
    });
  });

  describe("빈 입력", () => {
    it.each([
      ["빈 문자열", ""],
      ["공백만", "   "],
      ["쉼표만", ",,,"],
      ["공백과 쉼표", " , , "],
      ["대괄호만", "[알로에수딩]"],
    ])("%s는 빈 배열을 반환한다", (_label, input) => {
      expect(parseIngredientText(input)).toEqual([]);
    });
  });

  describe("중복 토큰", () => {
    it("중복을 제거하지 않고 그대로 유지한다", () => {
      expect(parseIngredientText("정제수, 정제수")).toEqual([
        "정제수",
        "정제수",
      ]);
    });

    it("정규화 후 같아지는 토큰도 각각 유지한다", () => {
      expect(parseIngredientText("레티놀(0.1%), 레티놀")).toEqual([
        "레티놀",
        "레티놀",
      ]);
    });
  });

  describe("기타", () => {
    it("단일 성분은 한 토큰으로 반환한다", () => {
      expect(parseIngredientText("동백나무씨오일")).toEqual(["동백나무씨오일"]);
    });

    it("구분자 앞뒤 공백을 정리한다", () => {
      expect(parseIngredientText("정제수 , 미네랄오일 , 글리세린")).toEqual([
        "정제수",
        "미네랄오일",
        "글리세린",
      ]);
    });
  });
});
