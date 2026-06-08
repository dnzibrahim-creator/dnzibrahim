import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useChecks, Check } from "@/context/ChecksContext";

type FilterType = "all" | "pending" | "overdue" | "paid" | "endorsed";

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Tümü", pending: "Bekleyen", overdue: "Vadesi Geçmiş", paid: "Ödendi", endorsed: "Arkası Yazıldı",
};

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function formatDate(s: string) { const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; }
function formatAmount(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function getFilteredChecks(checks: Check[], filter: FilterType, year?: number, month?: number): Check[] {
  const today = new Date().toISOString().split("T")[0];
  let result = checks;
  switch (filter) {
    case "pending": result = checks.filter((c) => c.status === "pending" && c.dueDate >= today); break;
    case "overdue": result = checks.filter((c) => c.status === "pending" && c.dueDate < today); break;
    case "paid": result = checks.filter((c) => c.status === "paid"); break;
    case "endorsed": result = checks.filter((c) => c.status === "endorsed"); break;
  }
  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    result = result.filter((c) => c.dueDate.startsWith(prefix));
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function generateCSV(checks: Check[]): string {
  const header = "Müşteri Adı,Banka,Seri No,Tutar (TL),Vade Tarihi,Kime Verildi,Not,Durum";
  const statusLabel: Record<string, string> = { pending: "Bekleyen", paid: "Ödendi", endorsed: "Arkası Yazıldı" };
  const rows = checks.map((c) =>
    `"${c.customerName}","${c.bankName}","${c.serialNumber ?? ""}","${c.amount}","${formatDate(c.dueDate)}","${c.givenTo ?? ""}","${c.note ?? ""}","${statusLabel[c.status]}"`
  );
  return [header, ...rows].join("\n");
}

function generateHTML(checks: Check[], title: string): string {
  const statusLabel: Record<string, string> = { pending: "Bekleyen", paid: "Ödendi", endorsed: "Arkası Yazıldı" };
  const statusColor: Record<string, string> = { pending: "#F59E0B", paid: "#16A34A", endorsed: "#2563EB" };
  const total = checks.reduce((s, c) => s + c.amount, 0);
  const rows = checks.map((c) => `
    <tr>
      <td>${c.customerName}</td><td>${c.bankName}</td><td>${c.serialNumber || "-"}</td>
      <td style="text-align:right;font-weight:600">${formatAmount(c.amount)}</td>
      <td>${formatDate(c.dueDate)}</td><td>${c.givenTo || "-"}</td><td>${c.note || "-"}</td>
      <td><span style="color:${statusColor[c.status]};font-weight:600">${statusLabel[c.status]}</span></td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1a2332}h1{color:#1B4F8A;font-size:18px;margin-bottom:4px}.meta{color:#64748b;font-size:10px;margin-bottom:16px}.total{background:#1B4F8A;color:white;padding:10px 16px;border-radius:8px;display:inline-block;margin-bottom:20px;font-size:14px;font-weight:bold}table{width:100%;border-collapse:collapse}th{background:#1B4F8A;color:white;padding:8px;text-align:left;font-size:10px}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}</style>
  </head><body>
  <h1>Çek Raporu — ${title}</h1>
  <div class="meta">Oluşturulma: ${new Date().toLocaleDateString("tr-TR")}</div>
  <div class="total">Toplam: ${formatAmount(total)} (${checks.length} çek)</div>
  <table><thead><tr><th>Müşteri</th><th>Banka</th><th>Seri No</th><th>Tutar</th><th>Vade</th><th>Kime</th><th>Not</th><th>Durum</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checks } = useChecks();
  const [filter, setFilter] = useState<FilterType>("pending");
  const [useMonth, setUseMonth] = useState(false);
  const now = new Date();
  const [selYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);

  const filtered = getFilteredChecks(checks, filter, useMonth ? selYear : undefined, useMonth ? selMonth : undefined);
  const total = filtered.reduce((s, c) => s + c.amount, 0);
  const reportTitle = `${FILTER_LABELS[filter]}${useMonth ? ` — ${MONTHS[selMonth - 1]} ${selYear}` : ""}`;

  const exportCSV = async () => {
    if (filtered.length === 0) { Alert.alert("Boş Rapor", "Seçilen filtrede çek bulunmuyor."); return; }
    if (Platform.OS === "web") { Alert.alert("Web", "CSV dışa aktarma yalnızca mobil cihazlarda desteklenir."); return; }
    setLoading("csv");
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const Sharing = await import("expo-sharing");
      const csv = generateCSV(filtered);
      const path = (FileSystem.cacheDirectory ?? "") + `cek-rapor-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Raporu Paylaş" });
      } else { Alert.alert("Paylaşım kullanılamıyor"); }
    } catch { Alert.alert("Hata", "Rapor oluşturulurken hata oluştu"); }
    setLoading(null);
  };

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert("Boş Rapor", "Seçilen filtrede çek bulunmuyor."); return; }
    if (Platform.OS === "web") { Alert.alert("Web", "PDF dışa aktarma yalnızca mobil cihazlarda desteklenir."); return; }
    setLoading("pdf");
    try {
      const Print = await import("expo-print");
      const Sharing = await import("expo-sharing");
      const html = generateHTML(filtered, reportTitle);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "PDF Raporu Paylaş" });
      } else { Alert.alert("Paylaşım kullanılamıyor"); }
    } catch { Alert.alert("Hata", "PDF oluşturulurken hata oluştu"); }
    setLoading(null);
  };

  const styles = makeStyles(colors, insets);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 90 }}>
      <View style={{ paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={styles.title}>Raporlar</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Filtre</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <TouchableOpacity key={f} style={[styles.filterChip, filter === f && { backgroundColor: colors.primary }]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterChipText, filter === f ? { color: "#fff" } : { color: colors.mutedForeground }]}>{FILTER_LABELS[f]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.monthToggle} onPress={() => setUseMonth(!useMonth)}>
          <View style={[styles.toggle, useMonth && { backgroundColor: colors.primary }]}>
            {useMonth && <Feather name="check" size={12} color="#fff" />}
          </View>
          <Text style={styles.monthToggleText}>Aylık Filtre Uygula</Text>
        </TouchableOpacity>
        {useMonth && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <TouchableOpacity key={m} style={[styles.filterChip, m === selMonth && { backgroundColor: colors.primary }]} onPress={() => setSelMonth(m)}>
                <Text style={[styles.filterChipText, m === selMonth ? { color: "#fff" } : { color: colors.mutedForeground }]}>
                  {MONTHS[m - 1].slice(0, 3)} {selYear}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={[styles.summaryBox, { backgroundColor: colors.card }]}>
        <Text style={styles.summaryBoxTitle}>{reportTitle}</Text>
        <Text style={styles.summaryBoxAmount}>{formatAmount(total)}</Text>
        <Text style={[styles.summaryBoxCount, { color: colors.mutedForeground }]}>{filtered.length} çek</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Dışa Aktar</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.success, opacity: loading ? 0.7 : 1 }]} onPress={exportCSV} disabled={!!loading}>
            {loading === "csv" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="file-text" size={20} color="#fff" />}
            <Text style={styles.exportBtnText}>Excel / CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.destructive, opacity: loading ? 0.7 : 1 }]} onPress={exportPDF} disabled={!!loading}>
            {loading === "pdf" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="file" size={20} color="#fff" />}
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Özet Tablo</Text>
        {filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>Bu filtrede kayıt bulunmuyor</Text>
          </View>
        ) : (
          <View style={[styles.table, { backgroundColor: colors.card }]}>
            {filtered.slice(0, 20).map((c, i) => (
              <View key={c.id} style={[styles.tableRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tableCustomer, { color: colors.foreground }]} numberOfLines={1}>{c.customerName}</Text>
                  <Text style={[styles.tableMeta, { color: colors.mutedForeground }]}>{c.bankName} • {formatDate(c.dueDate)}</Text>
                </View>
                <Text style={[styles.tableAmount, { color: colors.foreground }]}>{formatAmount(c.amount)}</Text>
              </View>
            ))}
            {filtered.length > 20 && (
              <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 12, fontSize: 12 }}>+{filtered.length - 20} çek daha (rapora dahil)</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 },
    section: { paddingHorizontal: 16, marginBottom: 8 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10, marginTop: 12 },
    filterRow: { gap: 8, paddingVertical: 4 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    monthToggle: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    toggle: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
    monthToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    summaryBox: { marginHorizontal: 16, borderRadius: colors.radius + 4, padding: 20, alignItems: "center", marginVertical: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    summaryBoxTitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 8 },
    summaryBoxAmount: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.primary },
    summaryBoxCount: { fontSize: 13, marginTop: 4 },
    exportRow: { flexDirection: "row", gap: 12 },
    exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius },
    exportBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    emptyBox: { borderRadius: colors.radius, padding: 24 },
    table: { borderRadius: colors.radius, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
    tableCustomer: { fontSize: 14, fontFamily: "Inter_500Medium" },
    tableMeta: { fontSize: 11, marginTop: 2 },
    tableAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  });
}
