import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./env";
import authRoutes from "./routes/auth";
import problemRoutes from "./routes/problems";
import attemptRoutes from "./routes/attempts";
import conceptRoutes from "./routes/concepts";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.jwtSecret });

  app.get("/health", async () => ({ status: "ok", env: env.nodeEnv }));

  await app.register(authRoutes);
  await app.register(problemRoutes);
  await app.register(attemptRoutes);
  await app.register(conceptRoutes);

  await app.listen({ port: env.port, host: "0.0.0.0" });

  // Import workers so they start consuming their queues. Split into a
  // separate process in production (see README) once volume justifies it.
  await import("./workers/generationWorker");
  await import("./workers/diagnosisWorker");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
