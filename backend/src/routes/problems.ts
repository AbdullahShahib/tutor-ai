import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { generationQueue } from "../queue";
import { defaultMasteryState } from "../services/adaptive";

const nextProblemQuery = z.object({
  conceptId: z.string().uuid()
});

export default async function problemRoutes(app: FastifyInstance) {
  /**
   * Returns the next problem to serve for (student, concept):
   *   1. Prefer an unseen AUTO_VERIFIED variation from the pool.
   *   2. If the pool is exhausted, enqueue a generation job against a
   *      seed at the right difficulty and fall back to another seed's
   *      variation (or the seed itself) so the student is never blocked
   *      on a synchronous LLM call.
   */
  app.get("/problems/next", { preHandler: requireAuth }, async (req, reply) => {
    const { conceptId } = nextProblemQuery.parse(req.query);
    const userId = (req.user as any).sub as string;

    const mastery = await prisma.studentConceptMastery.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      update: {},
      create: { userId, conceptId, ...defaultMasteryState() }
    });

    const targetDifficulty = mastery.masteryScore < 0.5 ? 1 : mastery.masteryScore < 0.75 ? 2 : 3;

    const seenVariationIds = (
      await prisma.studentAttempt.findMany({
        where: { userId, variation: { seedProblem: { conceptId } } },
        select: { variationId: true }
      })
    )
      .map((a: { variationId: string | null }) => a.variationId)
      .filter((id: string | null): id is string => Boolean(id));

    const availableVariation = await prisma.generatedVariation.findFirst({
      where: {
        verificationStatus: "AUTO_VERIFIED",
        id: { notIn: seenVariationIds },
        seedProblem: { conceptId, difficulty: targetDifficulty, status: "APPROVED" }
      },
      orderBy: { servedCount: "asc" }
    });

    if (availableVariation) {
      await prisma.generatedVariation.update({
        where: { id: availableVariation.id },
        data: { servedCount: { increment: 1 } }
      });
      return reply.send({
        source: "variation",
        problem: {
          id: availableVariation.id,
          questionText: availableVariation.questionText
        }
      });
    }

    // Pool exhausted at this difficulty — pick a seed to generate from,
    // enqueue the job, and serve the seed itself in the meantime so the
    // student is never left waiting on the LLM.
    const seed = await prisma.seedProblem.findFirst({
      where: { conceptId, difficulty: targetDifficulty, status: "APPROVED" },
      orderBy: { createdAt: "asc" }
    });

    if (!seed) {
      return reply.code(404).send({ error: "No approved problems available for this concept/difficulty" });
    }

    await generationQueue.add(
      "generate",
      {
        seedProblemId: seed.id
      },
      { jobId: `generate:${seed.id}:${targetDifficulty}`, attempts: 3, backoff: { type: "exponential", delay: 2000 } }
    );

    return reply.send({
      source: "seed_fallback",
      problem: { id: seed.id, questionText: seed.questionText },
      note: "New variations are generating in the background."
    });
  });
}
