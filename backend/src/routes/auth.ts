import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  gradeLevel: z.string().optional(),
  targetExam: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/profile", { preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      gradeLevel: z.string().max(50).optional(),
      targetExam: z.string().max(100).optional()
    }).parse(req.body);
    const userId = (req.user as { sub: string }).sub;
    const email = (req.user as { email?: string }).email;
    if (!email) return reply.code(400).send({ error: "Firebase account has no email" });

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail && existingByEmail.id !== userId) {
      return reply.code(409).send({ error: "Email is already linked to another account" });
    }

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { name: body.name, gradeLevel: body.gradeLevel, targetExam: body.targetExam },
      create: {
        id: userId,
        email,
        passwordHash: "firebase-managed",
        name: body.name,
        gradeLevel: body.gradeLevel,
        targetExam: body.targetExam
      }
    });

    return reply.send({ token: req.headers.authorization?.slice("Bearer ".length), user: { id: user.id, name: user.name, email: user.email } });
  });

  app.post("/auth/signup", async (req, reply) => {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(body.password, salt);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: `${salt}:${hash}`,
        name: body.name,
        gradeLevel: body.gradeLevel,
        targetExam: body.targetExam
      }
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.code(201).send({ token, user: { id: user.id, name: user.name, email: user.email } });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });

    const [salt, storedHash] = user.passwordHash.split(":");
    const hash = hashPassword(body.password, salt);
    if (hash !== storedHash) return reply.code(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
}
