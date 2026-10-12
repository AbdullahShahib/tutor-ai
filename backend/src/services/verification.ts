import { env } from "../env";

/**
 * Calls the Python/SymPy verification microservice to independently
 * re-derive a generated problem's answer before it's ever stored or
 * served to a student. This is the hallucination firewall described
 * in the architecture doc — treat failures as "do not serve", not as
 * warnings.
 */
export interface VerificationRequest {
  problem_type: "kinematics" | "newtons_second_law" | "kinetic_energy";
  inputs: Record<string, number>;
  claimed_answer: number;
}

export interface VerificationResponse {
  verified: boolean;
  computed_answer: number;
  tolerance: number;
  detail?: string;
}

export async function verifyAnswer(req: VerificationRequest): Promise<VerificationResponse> {
  const res = await fetch(`${env.verificationServiceUrl}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    throw new Error(`Verification service error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as VerificationResponse;
}
