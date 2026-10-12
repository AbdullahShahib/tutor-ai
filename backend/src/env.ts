import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  useMockLlm: (process.env.USE_MOCK_LLM ?? "true").toLowerCase() === "true",
  jwtSecret: required("JWT_SECRET"),
  verificationServiceUrl: required("VERIFICATION_SERVICE_URL"),
  masteryAdvanceThreshold: parseFloat(process.env.MASTERY_ADVANCE_THRESHOLD ?? "0.85")
};

if (env.nodeEnv === "production" && env.useMockLlm) {
  throw new Error("USE_MOCK_LLM must be false in production.");
}
if (env.nodeEnv === "production" && !env.anthropicApiKey) {
  throw new Error("ANTHROPIC_API_KEY is required in production.");
}
