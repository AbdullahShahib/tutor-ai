import { FastifyRequest, FastifyReply } from "fastify";
import { firebaseAuth } from "../firebase";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new Error("Missing bearer token");

    const token = header.slice("Bearer ".length);
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.user = { sub: decoded.uid, email: decoded.email, role: decoded.role ?? "STUDENT" };
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
