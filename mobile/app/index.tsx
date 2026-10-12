import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { login, signup } from "../lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      router.replace("/practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Tutor</Text>
      <Text style={styles.subtitle}>Physics · adaptive practice</Text>

      {mode === "signup" && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FAF7F0" />
        ) : (
          <Text style={styles.buttonText}>{mode === "login" ? "Log in" : "Sign up"}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")}>
        <Text style={styles.switchText}>
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FAF7F0" },
  title: { fontSize: 28, fontWeight: "700", color: "#1C2340" },
  subtitle: { fontSize: 15, color: "#565C78", marginBottom: 32 },
  input: {
    borderWidth: 1.5,
    borderColor: "#1C2340",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#FFFFFF"
  },
  button: {
    backgroundColor: "#1C2340",
    borderRadius: 6,
    padding: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonText: { color: "#FAF7F0", fontWeight: "600", fontSize: 16 },
  switchText: { color: "#2F5FA8", textAlign: "center", marginTop: 16 },
  error: { color: "#A63A2E", marginBottom: 12 }
});
