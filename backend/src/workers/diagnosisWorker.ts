import { Worker } from "bullmq";
import { connection } from "../queue";
import { prisma } from "../db";
import { diagnoseAttempt } from "../services/claude";

interface DiagnosisJobData {
  attemptId: string;
}

export const diagnosisWorker = new Worker<DiagnosisJobData>(
  "mistake-diagnosis",
  async (job) => {
    const attempt = await prisma.studentAttempt.findUniqueOrThrow({
      where: { id: job.data.attemptId },
      include: { seedProblem: true, variation: true }
    });

    const problem = attempt.seedProblem ?? attempt.variation;
    if (!problem) throw new Error("Attempt has no associated problem");

    const questionText = "questionText" in problem ? problem.questionText : "";
    const solutionSteps = (problem.solutionSteps as unknown as string[]) ?? [];

    const diagnosis = await diagnoseAttempt({
      questionText,
      solutionSteps,
      studentAnswer: attempt.submittedAnswer
    });

    await prisma.aIIntervention.create({
      data: {
        attemptId: attempt.id,
        diagnosedMisconception: diagnosis.misconception_type,
        explanationText: diagnosis.explanation,
        correctiveHint: diagnosis.corrective_hint
      }
    });

    return { attemptId: attempt.id };
  },
  { connection, concurrency: 5 }
);

diagnosisWorker.on("failed", (job, err) => {
  console.error(`[diagnosisWorker] job ${job?.id} failed:`, err.message);
});
