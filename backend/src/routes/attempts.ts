import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { diagnosisQueue } from "../queue";
import { defaultMasteryState, updateMastery, decideNextAction } from "../services/adaptive";
import { env } from "../env";

const submitAttemptSchema = z.object({
  conceptId: z.string().uuid(),
  seedProblemId: z.string().uuid().optional(),
  variationId: z.string().uuid().optional(),
  submittedAnswer: z.string().min(1).max(2_000),
  timeTakenSeconds: z.number().int().min(0).max(86_400).optional(),
  hintUsed: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(128)
}).refine((body) => Boolean(body.seedProblemId) !== Boolean(body.variationId), {
  message: "Provide exactly one of seedProblemId or variationId"
});

function answersMatch(submitted: string, correct: string): boolean {
  const a = parseFloat(submitted);
  const b = parseFloat(correct);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.abs(a - b) <= 0.05;
  return submitted.trim().toLowerCase() === correct.trim().toLowerCase();
}

export default async function attemptRoutes(app: FastifyInstance) {
  app.post("/attempts", { preHandler: requireAuth }, async (req, reply) => {
    const body = submitAttemptSchema.parse(req.body);
    const userId = (req.user as any).sub as string;

    if (!body.seedProblemId && !body.variationId) {
      return reply.code(400).send({ error: "Provide seedProblemId or variationId" });
    }

    const existingAttempt = await prisma.studentAttempt.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: body.idempotencyKey } }
    });
    if (existingAttempt) {
      const mastery = await prisma.studentConceptMastery.findUnique({
        where: { userId_conceptId: { userId, conceptId: body.conceptId } }
      });
      const currentMastery = mastery ?? defaultMasteryState();
      return reply.send({
        attemptId: existingAttempt.id,
        isCorrect: existingAttempt.isCorrect,
        mastery: currentMastery,
        nextAction: decideNextAction(currentMastery, existingAttempt.isCorrect, env.masteryAdvanceThreshold),
        diagnosisPending: !existingAttempt.isCorrect
      });
    }

    let correctAnswer: string;
    if (body.variationId) {
      const variation = await prisma.generatedVariation.findUnique({
        where: { id: body.variationId },
        include: { seedProblem: true }
      });
      if (!variation || variation.seedProblem.conceptId !== body.conceptId) {
        return reply.code(400).send({ error: "Problem does not belong to the requested concept" });
      }
      correctAnswer = variation.answer;
    } else if (body.seedProblemId) {
      const seed = await prisma.seedProblem.findUnique({ where: { id: body.seedProblemId } });
      if (!seed || seed.conceptId !== body.conceptId) {
        return reply.code(400).send({ error: "Problem does not belong to the requested concept" });
      }
      correctAnswer = seed.correctAnswer;
    } else {
      return reply.code(400).send({ error: "Provide seedProblemId or variationId" });
    }

    const isCorrect = answersMatch(body.submittedAnswer, correctAnswer);

    const { attempt, updated } = await prisma.$transaction(async (tx) => {
      const attemptCount = await tx.studentAttempt.count({ where: { userId } });
      const attempt = await tx.studentAttempt.create({
        data: {
          userId,
          seedProblemId: body.seedProblemId,
          variationId: body.variationId,
          submittedAnswer: body.submittedAnswer,
          isCorrect,
          timeTakenSeconds: body.timeTakenSeconds,
          hintUsed: body.hintUsed ?? false,
          attemptNumber: attemptCount + 1,
          idempotencyKey: body.idempotencyKey
        }
      });

      const existingMastery = await tx.studentConceptMastery.upsert({
        where: { userId_conceptId: { userId, conceptId: body.conceptId } },
        update: {},
        create: { userId, conceptId: body.conceptId, ...defaultMasteryState() }
      });

      const updated = updateMastery(
        {
          masteryScore: existingMastery.masteryScore,
          pTransit: existingMastery.pTransit,
          pSlip: existingMastery.pSlip,
          pGuess: existingMastery.pGuess,
          consecutiveCorrect: existingMastery.consecutiveCorrect,
          consecutiveIncorrect: existingMastery.consecutiveIncorrect
        },
        isCorrect
      );

      await tx.studentConceptMastery.update({
        where: { userId_conceptId: { userId, conceptId: body.conceptId } },
        data: {
          masteryScore: updated.masteryScore,
          consecutiveCorrect: updated.consecutiveCorrect,
          consecutiveIncorrect: updated.consecutiveIncorrect,
          lastAttemptedAt: new Date()
        }
      });

      return { attempt, updated };
    });

    const nextAction = decideNextAction(updated, isCorrect, env.masteryAdvanceThreshold);

    // 3. If wrong, enqueue the diagnosis job — async, never blocks the response.
    if (!isCorrect) {
      await diagnosisQueue.add("diagnose", { attemptId: attempt.id }, { attempts: 3 });
    }

    return reply.send({
      attemptId: attempt.id,
      isCorrect,
      mastery: updated,
      nextAction,
      diagnosisPending: !isCorrect
    });
  });

  /** Poll for the async diagnosis once it lands (or push via WebSocket in production). */
  app.get("/attempts/:id/diagnosis", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attempt = await prisma.studentAttempt.findFirst({ where: { id, userId: (req.user as any).sub } });
    if (!attempt) return reply.code(404).send({ error: "Attempt not found" });
    const intervention = await prisma.aIIntervention.findUnique({ where: { attemptId: id } });
    if (!intervention) return reply.code(202).send({ status: "pending" });
    return reply.send({ status: "ready", intervention });
  });
}
