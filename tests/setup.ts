import { config } from "dotenv";

// 통합 테스트는 실 DB에 붙는다. .env.local의 service_role 키를 process.env에 로드한다.
config({ path: ".env.local", quiet: true });
