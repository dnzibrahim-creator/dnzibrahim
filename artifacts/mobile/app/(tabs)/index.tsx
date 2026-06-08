import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useChecks, Check } from "@/context/ChecksContext";
import CheckCard from "@/components/CheckCard";

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function formatAmount(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getPendingChecks, getOverdueChecks, getTotalPendingAmount, getMonthlyAmount } = useChecks();
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth() + 1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pendingChecks = getPendingChecks();
  const overdueChecks = getOverdueChecks();
  const totalAmount = getTotalPendingAmount();
  const selectedMonthAmount = (selectedYear && selectedMonth) ? getMonthlyAmount(selectedYear, selectedMonth) : totalAmount;
  const currentMonthAmount = getMonthlyAmount(now.getFullYear(), now.getMonth() + 1);

  const filteredChecks = useMemo(() => {
    if (!selectedYear || !selectedMonth) return pendingChecks;
    const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    return pendingChecks.filter((c) => c.dueDate.startsWith(prefix));
  }, [pendingChecks, selectedYear, selectedMonth]);

  const selectedTotal = useMemo(() => {
    return pendingChecks.filter((c) => selectedIds.has(c.id)).reduce((s, c) => s + c.amount, 0);
  }, [selectedIds, pendingChecks]);

  const years = useMemo(() => {
    const yrs = new Set<number>();
    for (let i = -2; i <= 3; i++) yrs.add(now.getFullYear() + i);
    pendingChecks.forEach((c) => yrs.add(Number(c.dueDate.slice(0, 4))));
    return Array.from(yrs).sort();
  }, [pendingChecks]);

  const handleLongPress = useCallback((check: Check) => {
    if (!selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectionMode(true);
      setSelectedIds(new Set([check.id]));
    }
  }, [selectionMode]);

  const handleSelect = useCallback((check: Check) => {
    if (!selectionMode) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(check.id)) next.delete(check.id);
      else next.add(check.id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, [selectionMode]);

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };
  const onRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); };

  const styles = makeStyles(colors, insets);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const monthLabel = (selectedYear && selectedMonth) ? `${MONTHS_SHORT[selectedMonth - 1]} ${selectedYear}` : "Tüm Çekler";

  const CalendarHeader = () => (
    <View>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>Çek Yönetimi</Text>
        {overdueChecks.length > 0 && (
          <View style={[styles.overdueBadge, { backgroundColor: colors.destructive + "20" }]}>
            <Text style={[styles.overdueBadgeText, { color: colors.destructive }]}>{overdueChecks.length} vadesi geçmiş</Text>
          </View>
        )}
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCardMain, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryLabelWhite}>Toplam Bekleyen</Text>
          <Text style={styles.summaryAmountWhite}>{formatAmount(totalAmount)}</Text>
          <Text style={styles.summaryCountWhite}>{pendingChecks.length} çek</Text>
        </View>
        <View style={styles.summaryRight}>
          <View style={[styles.summaryCardSmall, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryLabelSmall, { color: colors.mutedForeground }]}>Bu Ay</Text>
            <Text style={[styles.summaryAmountSmall, { color: colors.foreground }]}>{formatAmount(currentMonthAmount)}</Text>
          </View>
          <View style={[styles.summaryCardSmall, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryLabelSmall, { color: colors.mutedForeground }]}>Seçilen</Text>
            <Text style={[styles.summaryAmountSmall, { color: colors.primary }]}>{formatAmount(selectedMonthAmount)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
        <View style={styles.calendarInner}>
          <View style={styles.yearCol}>
            <TouchableOpacity
              style={[styles.yearPill, !selectedYear && { backgroundColor: colors.primary }]}
              onPress={() => { setSelectedYear(null); setSelectedMonth(null); }}
            >
              <Text style={[styles.yearPillText, !selectedYear ? { color: "#fff", fontFamily: "Inter_700Bold" } : { color: colors.mutedForeground }]}>Tümü</Text>
            </TouchableOpacity>
            {years.map((y) => {
              const isSelY = selectedYear === y;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearPill, isSelY && { backgroundColor: colors.primary }]}
                  onPress={() => { setSelectedYear(y); if (!selectedMonth) setSelectedMonth(now.getMonth() + 1); }}
                >
                  <Text style={[styles.yearPillText, isSelY ? { color: "#fff", fontFamily: "Inter_700Bold" } : { color: colors.mutedForeground }]}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.calDivider, { backgroundColor: colors.border }]} />
          <View style={styles.monthGrid}>
            <TouchableOpacity
              style={[styles.allBtn, (!selectedYear && !selectedMonth) && { backgroundColor: colors.primary }]}
              onPress={() => { setSelectedYear(null); setSelectedMonth(null); }}
            >
              <Text style={[styles.allBtnText, (!selectedYear && !selectedMonth) ? { color: "#fff", fontFamily: "Inter_700Bold" } : { color: colors.mutedForeground }]}>Tümü</Text>
            </TouchableOpacity>
            <View style={styles.monthRows}>
              {[0, 1, 2, 3].map((row) => (
                <View key={row} style={styles.monthRow}>
                  {[0, 1, 2].map((col) => {
                    const mIdx = row * 3 + col;
                    const m = mIdx + 1;
                    const isSel = selectedYear !== null && selectedMonth === m;
                    const isCurrent = selectedYear === now.getFullYear() && m === now.getMonth() + 1;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.monthCell, isSel && { backgroundColor: colors.primary }]}
                        onPress={() => { setSelectedMonth(m); if (!selectedYear) setSelectedYear(now.getFullYear()); }}
                      >
                        <Text style={[styles.monthCellText, isSel ? { color: "#fff", fontFamily: "Inter_700Bold" } : isCurrent ? { color: colors.primary, fontFamily: "Inter_600SemiBold" } : { color: colors.foreground }]}>
                          {MONTHS_SHORT[mIdx]}
                        </Text>
                        {isCurrent && !isSel && <View style={[styles.curDot, { backgroundColor: colors.primary }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{monthLabel}</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{filteredChecks.length} bekleyen çek</Text>
        </View>
        {(selectedYear && selectedMonth) && (
          <Text style={[styles.sectionAmount, { color: colors.primary }]}>{formatAmount(selectedMonthAmount)}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {selectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: colors.primary, paddingTop: topPad + 4 }]}>
          <TouchableOpacity onPress={exitSelection} style={styles.selCancelBtn}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.selInfo}>
            <Text style={styles.selCount}>{selectedIds.size} çek seçildi</Text>
            <Text style={styles.selTotal}>{formatAmount(selectedTotal)}</Text>
          </View>
          <TouchableOpacity onPress={exitSelection} style={styles.selDoneBtn}>
            <Text style={styles.selDoneText}>Bitti</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={filteredChecks}
        keyExtractor={(item) => item.id}
        extraData={selectionMode}
        renderItem={({ item }) => (
          <CheckCard
            check={item}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(item.id)}
            onLongPress={() => handleLongPress(item)}
            onSelect={() => handleSelect(item)}
          />
        )}
        ListHeaderComponent={CalendarHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Bekleyen çek bulunmuyor</Text>
            <Text style={styles.emptySubText}>Yeni çek eklemek için + butonuna basın</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 90 }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    selectionBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
    selCancelBtn: { padding: 4 },
    selInfo: { flex: 1, alignItems: "center" },
    selCount: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
    selTotal: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
    selDoneBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14 },
    selDoneText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 },
    headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    overdueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    overdueBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 8 },
    summaryCardMain: { flex: 1.3, borderRadius: colors.radius + 4, padding: 12 },
    summaryLabelWhite: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium" },
    summaryAmountWhite: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 6 },
    summaryCountWhite: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },
    summaryRight: { flex: 1, gap: 8 },
    summaryCardSmall: { flex: 1, borderRadius: colors.radius, padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    summaryLabelSmall: { fontSize: 10, fontFamily: "Inter_500Medium" },
    summaryAmountSmall: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 3 },
    calendarCard: { marginHorizontal: 16, borderRadius: colors.radius + 2, marginBottom: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: "hidden" },
    calendarInner: { flexDirection: "row" },
    yearCol: { width: 48, paddingVertical: 6, paddingHorizontal: 4, gap: 1, alignItems: "center" },
    yearPill: { paddingVertical: 5, paddingHorizontal: 2, borderRadius: 6, width: "100%", alignItems: "center" },
    yearPillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    calDivider: { width: 1 },
    monthGrid: { flex: 1, padding: 6, gap: 2 },
    allBtn: { borderRadius: 6, paddingVertical: 4, alignItems: "center", marginBottom: 1 },
    allBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    monthRows: { gap: 1 },
    monthRow: { flexDirection: "row", gap: 1 },
    monthCell: { flex: 1, borderRadius: 6, paddingVertical: 6, alignItems: "center", position: "relative" },
    monthCellText: { fontSize: 11 },
    curDot: { width: 3, height: 3, borderRadius: 2, position: "absolute", bottom: 1 },
    sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
    sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    sectionAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
    empty: { alignItems: "center", paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    emptySubText: { fontSize: 13, color: colors.mutedForeground },
  });
}
