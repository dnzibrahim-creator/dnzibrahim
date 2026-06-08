import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useChecks, Check } from "@/context/ChecksContext";
import CheckCard from "@/components/CheckCard";

type FilterType = "all" | "paid" | "endorsed";

function formatAmount(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

export default function CompletedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getCompletedChecks } = useChecks();
  const [filter, setFilter] = useState<FilterType>("all");

  const allCompleted = getCompletedChecks();
  const filtered: Check[] = filter === "all" ? allCompleted : allCompleted.filter((c) => c.status === filter);
  const totalAmount = filtered.reduce((s, c) => s + c.amount, 0);
  const paidCount = allCompleted.filter((c) => c.status === "paid").length;
  const endorsedCount = allCompleted.filter((c) => c.status === "endorsed").length;

  const styles = makeStyles(colors, insets);

  const Header = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Tamamlanan Çekler</Text>
      </View>
      {allCompleted.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.success }]}>
            <Feather name="check-circle" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.summaryCount}>{paidCount}</Text>
            <Text style={styles.summaryLabel}>Ödendi</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <Feather name="edit-3" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.summaryCount}>{endorsedCount}</Text>
            <Text style={styles.summaryLabel}>Arkası Yazıldı</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Feather name="layers" size={18} color={colors.mutedForeground} />
            <Text style={[styles.summaryCount, { color: colors.foreground }]}>{formatAmount(totalAmount)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Toplam</Text>
          </View>
        </View>
      )}
      <View style={styles.filterRow}>
        {([
          { key: "all", label: "Tümü" },
          { key: "paid", label: "Ödendi" },
          { key: "endorsed", label: "Arkası Yazıldı" },
        ] as { key: FilterType; label: string }[]).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && { backgroundColor: colors.primary }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key ? { color: "#fff" } : { color: colors.mutedForeground }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {filter === "all" ? "Tüm Tamamlananlar" : filter === "paid" ? "Ödendi" : "Arkası Yazıldı"}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{filtered.length}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CheckCard check={item} showStatus />}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>{allCompleted.length === 0 ? "Henüz tamamlanan çek yok" : "Bu filtrede çek bulunmuyor"}</Text>
            <Text style={styles.emptySubText}>{allCompleted.length === 0 ? "Ödenen veya arkası yazılan çekler burada görünür" : "Farklı bir filtre seçin"}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 90 }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
    summaryCard: { flex: 1, borderRadius: colors.radius, padding: 14, alignItems: "center", gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    summaryCount: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
    summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
    filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    sectionCount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    empty: { alignItems: "center", paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    emptySubText: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 40 },
  });
}
