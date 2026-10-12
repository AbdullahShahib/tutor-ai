import { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import {
  getNextProblem,
  getConcepts,
  submitAttempt,
  getDiagnosis,
  NextProblemResponse,
  SubmitAttemptResponse,
  DiagnosisResponse
} from "../lib/api";

export default function PracticeScreen() {
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [problem, setProblem] = useState<NextProblemResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadProblem = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setDiagnosis(null);
    setAnswer("");
    try {
      const concepts = await getConcepts();
      const selectedConceptId = concepts[0]?.id;
      if (!selectedConceptId) throw new Error("No practice concepts are available");
      setConceptId(selectedConceptId);
      const next = await getNextProblem(selectedConceptId);
      setProblem(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProblem();
  }, [loadProblem]);

  async function handleSubmit() {
    if (!problem || !answer.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitAttempt({
        conceptId: conceptId!,
        seedProblemId: problem.source === "seed_fallback" ? problem.problem.id : undefined,
        variationId: problem.source === "variation" ? problem.problem.id : undefined,
        submittedAnswer: answer,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      });
      setResult(res);
      if (!res.isCorrect) pollDiagnosis(res.attemptId);
    } finally {
      setSubmitting(false);
    }
  }

  async function pollDiagnosis(attemptId: string, attemptsLeft = 8) {
    const d = await getDiagnosis(attemptId);
    if (d.status === "ready" || attemptsLeft <= 0) {
      setDiagnosis(d);
      return;
    }
    setTimeout(() => pollDiagnosis(attemptId, attemptsLeft - 1), 1500);
  }

  if (loading || !problem) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.container}>
      <Text style={styles.question}>{problem.problem.questionText}</Text>

      <View style={styles.answerRow}>
        <TextInput
          style={styles.input}
          value={answer}
          onChangeText={setAnswer}
          keyboardType="decimal-pad"
          placeholder="0.0"
          editable={!result}
        />
        <Pressable style={styles.button} onPress={handleSubmit} disabled={!!result || submitting}>
          <Text style={styles.buttonText}>{submitting ? "Checking…" : "Check"}</Text>
        </Pressable>
      </View>

      {result && (
        <View style={[styles.feedback, result.isCorrect ? styles.correct : styles.incorrect]}>
          <Text style={styles.verdict}>{result.isCorrect ? "✓ Correct" : "✗ Not quite"}</Text>

          {!result.isCorrect && (
            <>
              {!diagnosis || diagnosis.status === "pending" ? (
                <ActivityIndicator style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <Text style={styles.note}>{diagnosis.intervention?.explanationText}</Text>
                  <Text style={styles.hint}>{diagnosis.intervention?.correctiveHint}</Text>
                </>
              )}
            </>
          )}

          <Pressable style={styles.nextButton} onPress={loadProblem}>
            <Text style={styles.nextButtonText}>
              {result.nextAction.action === "advance" ? "New topic →" : "Next problem"}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F0", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAF7F0" },
  question: { fontSize: 19, lineHeight: 28, color: "#1C2340", marginBottom: 20 },
  answerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    borderWidth: 1.5,
    borderColor: "#1C2340",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    width: 120,
    backgroundColor: "#FFFFFF"
  },
  button: { backgroundColor: "#1C2340", borderRadius: 6, paddingVertical: 10, paddingHorizontal: 18 },
  buttonText: { color: "#FAF7F0", fontWeight: "600" },
  feedback: { marginTop: 22, borderLeftWidth: 3, paddingLeft: 14 },
  correct: { borderLeftColor: "#2E6B47" },
  incorrect: { borderLeftColor: "#A63A2E" },
  verdict: { fontWeight: "700", fontSize: 16, marginBottom: 8, color: "#1C2340" },
  note: { fontSize: 15, lineHeight: 22, color: "#1C2340", marginBottom: 8 },
  hint: { fontSize: 14, color: "#565C78", marginBottom: 14 },
  nextButton: { marginTop: 10, alignSelf: "flex-start" },
  nextButtonText: { color: "#2F5FA8", fontWeight: "600" }
});
