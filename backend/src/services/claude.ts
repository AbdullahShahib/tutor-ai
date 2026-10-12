import { env } from "../env";
import { z } from "zod";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export interface VariationResult {
  question_text: string;
  correct_answer: string;
  solution_steps: string[];
  variation_params: { params: Record<string, number>; changed: string[]; unchanged: string[] };
  difficulty_confirmation: string;
}

export interface DiagnosisResult {
  misconception_type: string;
  error_step: string;
  explanation: string;
  corrective_hint: string;
  encouragement_line: string;
}

async function callClaude(system: string, userContent: string): Promise<string> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userContent }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = (data.content ?? []).find((b) => b.type === "text");
  if (!textBlock || !textBlock.text) throw new Error("No text block in Claude response");
  return textBlock.text;
}

function parseJsonResponse<T>(raw: string): T {
  // Claude is instructed to return JSON only, but strip code fences defensively.
  const cleaned = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

const variationResponseSchema = z.object({
  question_text: z.string().min(1).max(10_000),
  correct_answer: z.string().min(1).max(200),
  solution_steps: z.array(z.string().min(1).max(2_000)).min(1).max(20),
  variation_params: z.object({
    params: z.record(z.number().finite()),
    changed: z.array(z.string()).max(50),
    unchanged: z.array(z.string()).max(50)
  }),
  difficulty_confirmation: z.string().max(2_000)
});

const diagnosisResponseSchema = z.object({
  misconception_type: z.string().min(1).max(200),
  error_step: z.string().min(1).max(500),
  explanation: z.string().min(1).max(2_000),
  corrective_hint: z.string().min(1).max(1_000),
  encouragement_line: z.string().min(1).max(500)
});

const VARIATION_SYSTEM_PROMPT = `You are a constrained problem-variation generator for a rigorously
QA'd educational content system. You will be given ONE seed problem
that has been human-verified as correct. Your ONLY job is to produce
a surface-level variation of it.

STRICT RULES (violating any of these makes your output unusable):
1. You may change: numeric values, names, real-world context/framing,
   units (if consistent), and wording.
2. You may NOT change: the underlying concept being tested, the
   solution method/number of steps, the difficulty level, or introduce
   any concept not present in the seed.
3. You must independently solve the problem you generate and include
   your full derivation — do not just transform the seed's answer.
4. If you cannot generate a variation that satisfies all rules above,
   return {"error": "<reason>"} instead of guessing.

OUTPUT — valid JSON only, no prose outside the JSON:
{
  "question_text": "<LaTeX-formatted question>",
  "correct_answer": "<final answer>",
  "solution_steps": ["<step 1>", "<step 2>"],
  "variation_params": {"changed": ["..."], "unchanged": ["..."]},
  "difficulty_confirmation": "<why this matches seed difficulty>"
}`;

const DIAGNOSIS_SYSTEM_PROMPT = `You are an expert, encouraging tutor. A student submitted an incorrect
answer. Your job is to find the SPECIFIC point where their reasoning
diverged from the correct method — not to just restate the full
solution.

RULES:
1. Compare the student's answer/work against the correct solution
   step-by-step. Identify the earliest step where they went wrong.
2. Name the misconception precisely.
3. Explain only from that step forward.
4. Tone: warm, specific, never condescending. No generic praise.
5. Do NOT reveal or hint at the answer to any follow-up problem.

OUTPUT — valid JSON only:
{
  "misconception_type": "<short label>",
  "error_step": "<which step in the solution this corresponds to>",
  "explanation": "<step-level correction, 2-4 sentences>",
  "corrective_hint": "<one actionable thing to do differently next time>",
  "encouragement_line": "<brief, specific, not generic>"
}`;

export async function generateVariation(seed: {
  questionText: string;
  solutionSteps: string[];
  verificationType: string;
  verificationParams: Record<string, number>;
}): Promise<VariationResult> {
  if (env.useMockLlm) return mockVariation(seed);
  const user = `SEED PROBLEM:\n${seed.questionText}\nSEED SOLUTION:\n${seed.solutionSteps.join("\n")}\nVERIFICATION TYPE: ${seed.verificationType}\nSEED PARAMETERS: ${JSON.stringify(seed.verificationParams)}`;
  const raw = await callClaude(VARIATION_SYSTEM_PROMPT, user);
  return variationResponseSchema.parse(parseJsonResponse<unknown>(raw));
}

export async function diagnoseAttempt(input: {
  questionText: string;
  solutionSteps: string[];
  studentAnswer: string;
  studentWork?: string;
}): Promise<DiagnosisResult> {
  if (env.useMockLlm) return mockDiagnosis(input);
  const user = `PROBLEM: ${input.questionText}
CORRECT SOLUTION STEPS: ${input.solutionSteps.join(" | ")}
STUDENT'S SUBMITTED ANSWER: ${input.studentAnswer}
STUDENT'S SHOWN WORK: ${input.studentWork ?? "(not provided)"}`;
  const raw = await callClaude(DIAGNOSIS_SYSTEM_PROMPT, user);
  return diagnosisResponseSchema.parse(parseJsonResponse<unknown>(raw));
}

// --- Deterministic local fixtures used when USE_MOCK_LLM=true (dev/CI only) ---

function mockVariation(seed: { questionText: string; solutionSteps: string[]; verificationType: string; verificationParams: Record<string, number> }): VariationResult {
  const params = Object.fromEntries(Object.entries(seed.verificationParams).map(([key, value]) => [key, value + 1]));
  const answer = seed.verificationType === "NEWTONS_SECOND_LAW"
    ? params.m * params.a
    : seed.verificationType === "KINETIC_ENERGY"
      ? 0.5 * params.m * params.v ** 2
      : (params.v - params.u) / params.t;
  return {
    question_text: `${seed.questionText} Use the varied values: ${JSON.stringify(params)}.`,
    correct_answer: String(answer),
    solution_steps: seed.solutionSteps,
    variation_params: { params, changed: Object.keys(params), unchanged: ["method", "difficulty"] },
    difficulty_confirmation: "mock: identical structure to seed"
  };
}

function mockDiagnosis(input: { studentAnswer: string }): DiagnosisResult {
  return {
    misconception_type: "mock_diagnosis",
    error_step: "step 2",
    explanation: `Mock explanation for submitted answer "${input.studentAnswer}". Set USE_MOCK_LLM=false and ANTHROPIC_API_KEY to get real diagnoses.`,
    corrective_hint: "Re-check the formula substitution step.",
    encouragement_line: "You're close — just one step to tighten up."
  };
}
