/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      // 이모지 접두사를 선택적으로 허용: "✨ feat(scope): 설명" 또는 "feat: 설명"
      headerPattern: /^(?:[^\w\s]+\s)?(\w+)(?:\(([^)]*)\))?!?:\s(.+)$/,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "chore",
        "ci",
        "revert",
        "build",
      ],
    ],
    // 한국어 커밋 메시지 허용
    "subject-case": [0],
    // 제목 길이 제한
    "header-max-length": [2, "always", 100],
  },
};
