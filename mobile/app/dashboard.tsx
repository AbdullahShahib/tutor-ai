import { View, Text, StyleSheet, ScrollView } from "react-native";

// Wire this up to a GET /mastery?userId= endpoint (straightforward addition
// to the backend following the same pattern as problems.ts) once you have
// more than one concept's worth of data to show.
export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your progress</Text>
      <Text style={styles.body}>
        Concept mastery bars render here from StudentConceptMastery rows,
        same shape as the demo artifact above.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F0", padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#1C2340", marginBottom: 10 },
  body: { fontSize: 15, color: "#565C78", lineHeight: 22 }
});
