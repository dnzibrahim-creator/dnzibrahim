import React from "react";
import { View, Text, StyleSheet, FlatList, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useChecks } from "@/context/ChecksContext";
import CheckCard from "@/components/CheckCard";

function formatAmount(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

export default function OverdueScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getOverdueChecks } = useChecks();
  const overdueChecks = getOverdueChecks();
  const totalOverdue = overdueChecks.reduce((s, c) => s + c.amount, 0);
  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <FlatList
        data={overdueChecks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CheckCard check={item} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Vadesi Geçmiş</Text>
            {overdueChecks.length > 0 && (
              <View style={styles.totalBanner}>
                <Feather name="alert-triangle" size={16} color={colors.destructive} />
                <Text style={styles.totalText}>Toplam: {formatAmount(totalOverdue)}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={48} color={colors.success} />
            <Text style={styles.emptyTitle}>Vadesi geçmiş çek yok</Text>
            <Text style={styles.emptySubText}>Tüm çekleriniz güncel durumda</Text>
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
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 12 },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 10 },
    totalBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.destructive + "18", paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: colors.radius, borderLeftWidth: 3, borderLeftColor: colors.destructive,
    },
    totalText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.destructive },
    empty: { alignItems: "center", paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    emptySubText: { fontSize: 13, color: colors.mutedForeground },
  });
}
