import { Worker } from "bullmq";
import { connection } from "../queue";
import { prisma } from "../db";
import { generateVariation } from "../services/claude";
import { verifyAnswer, VerificationRequest } from "../services/verification";

interface GenerationJobData {
  seedProblemId: string;
}

export const generationWorker = new Worker<GenerationJobData>(
  "problem-generation",
  async (job) => {
    const seed = await prisma.seedProblem.findUniqueOrThrow({
      where: { id: job.data.seedProblemId }
    });

    const variation = await generateVariation({
      questionText: seed.questionText,
      solutionSteps: seed.solutionSteps as unknown as string[],
      verificationType: seed.verificationType,
      verificationParams: seed.verificationParams as Record<string, number>
    });

    const claimedAnswer = parseFloat(variation.correct_answer);
    let verificationStatus: "AUTO_VERIFIED" | "FAILED_VERIFICATION" | "HUMAN_FLAGGED" = "HUMAN_FLAGGED";

    if (!Number.isNaN(claimedAnswer)) {
      try {
        const verification = await verifyAnswer({
          problem_type: seed.verificationType.toLowerCase() as VerificationRequest["problem_type"],
          inputs: variation.variation_params.params,
          claimed_answer: claimedAnswer
        });
        verificationStatus = verification.verified ? "AUTO_VERIFIED" : "FAILED_VERIFICATION";
      } catch {
        verificationStatus = "HUMAN_FLAGGED";
      }
    }

    const saved = await prisma.generatedVariation.create({
      data: {
        seedProblemId: seed.id,
        questionText: variation.question_text,
        answer: variation.correct_answer,
        solutionSteps: variation.solution_steps as any,
        variationParams: variation.variation_params as any,
        verificationStatus,
        llmModelVersion: "claude-sonnet-4-6"
      }
    });

    // Failed verification never gets served — only auto-verified rows are
    // eligible in the problem-selection query (see routes/problems.ts).
    return { variationId: saved.id, verificationStatus };
  },
  { connection, concurrency: 3 }
);

generationWorker.on("failed", (job, err) => {
  console.error(`[generationWorker] job ${job?.id} failed:`, err.message);
});
