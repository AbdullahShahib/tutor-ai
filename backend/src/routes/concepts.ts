import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const conceptSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  chapter: z.string(),
  topic: z.string(),
  difficultyTier: z.number().int()
});

export default async function conceptRoutes(app: FastifyInstance) {
  app.get("/concepts", { preHandler: requireAuth }, async (_req, reply) => {
    const concepts = await prisma.concept.findMany({
      orderBy: [{ subject: "asc" }, { chapter: "asc" }, { topic: "asc" }],
      select: { id: true, subject: true, chapter: true, topic: true, difficultyTier: true }
    });
    return reply.send(z.array(conceptSchema).parse(concepts));
  });
}