/**
 * Seeds the DB with a handful of human-verified seed problems across
 * the three MVP concepts. Run with: npx ts-node prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const physics = await prisma.concept.create({
    data: { subject: "Physics", chapter: "Mechanics", topic: "Kinematics", difficultyTier: 1 }
  });
  const newtons = await prisma.concept.create({
    data: { subject: "Physics", chapter: "Mechanics", topic: "Newton's Second Law", difficultyTier: 1 }
  });
  const energy = await prisma.concept.create({
    data: { subject: "Physics", chapter: "Mechanics", topic: "Kinetic Energy", difficultyTier: 1 }
  });

  await prisma.seedProblem.create({
    data: {
      conceptId: physics.id,
      difficulty: 1,
      questionType: "NUMERIC",
      questionText: "A car's velocity changes from 5 m/s to 17 m/s over 4 s, moving in a straight line. Find its acceleration.",
      correctAnswer: "3",
      verificationType: "KINEMATICS",
      verificationParams: { u: 5, v: 17, t: 4 },
      solutionSteps: [
        "Identify the known values: u = 5 m/s, v = 17 m/s, t = 4 s.",
        "Acceleration is the rate of change of velocity: a = (v − u) / t.",
        "Substitute: a = (17 − 5) / 4 = 12 / 4.",
        "a = 3 m/s²."
      ],
      status: "APPROVED",
      createdBy: "seed-script",
      approvedBy: "seed-script"
    }
  });

  await prisma.seedProblem.create({
    data: {
      conceptId: newtons.id,
      difficulty: 1,
      questionType: "NUMERIC",
      questionText: "A 10 kg crate is pushed across a frictionless floor, giving it an acceleration of 2.5 m/s². Find the net force acting on it.",
      correctAnswer: "25",
      verificationType: "NEWTONS_SECOND_LAW",
      verificationParams: { m: 10, a: 2.5 },
      solutionSteps: [
        "Newton's second law: F = m × a.",
        "Substitute: F = 10 kg × 2.5 m/s².",
        "F = 25 N."
      ],
      status: "APPROVED",
      createdBy: "seed-script",
      approvedBy: "seed-script"
    }
  });

  await prisma.seedProblem.create({
    data: {
      conceptId: energy.id,
      difficulty: 1,
      questionType: "NUMERIC",
      questionText: "A 4 kg object moves at 6 m/s. Find its kinetic energy.",
      correctAnswer: "72",
      verificationType: "KINETIC_ENERGY",
      verificationParams: { m: 4, v: 6 },
      solutionSteps: [
        "Kinetic energy formula: KE = ½ m v².",
        "Square the velocity: v² = 6² = 36.",
        "KE = ½ × 4 × 36 = 72 J."
      ],
      status: "APPROVED",
      createdBy: "seed-script",
      approvedBy: "seed-script"
    }
  });

  console.log("Seed data created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
