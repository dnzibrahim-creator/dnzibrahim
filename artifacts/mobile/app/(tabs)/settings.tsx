import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTheme, PRESET_COLORS } from "@/context/ThemeContext";
import { useChecks } from "@/context/ChecksContext";
import { useAI } from "@/context/AIContext";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { primaryColor, setPrimaryColor, forceDark, setForceDark } = useTheme();
  const { exportData, importData, checks } = useChecks();
  const { isConfigured, provider } = useAI();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const getJson = () => exportData();

  const handleSaveToPhone = async () => {
    if (Platform.OS === "web") { Alert.alert("Web", "Bu özellik yalnızca mobil cihazlarda çalışır."); return; }
    setSaving(true);
    try {
      const json = getJson();
      const fileName = `cek-yedek-${new Date().toISOString().split("T")[0]}.json`;
      const FileSystem = await import("expo-file-system/legacy");
      const Sharing = await import("expo-sharing");
      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, "application/json");
          await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
          Alert.alert("Başarılı", `Dosya kaydedildi:\n${fileName}`);
        }
      } else {
        const path = (FileSystem.cacheDirectory ?? "") + fileName;
        await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Yedeği Kaydet" });
        } else { Alert.alert("Paylaşım kullanılamıyor"); }
      }
    } catch { Alert.alert("Hata", "Yedek alınırken bir sorun oluştu."); }
    setSaving(false);
  };

  const handleShare = async () => {
    if (Platform.OS === "web") { Alert.alert("Web", "Bu özellik yalnızca mobil cihazlarda çalışır."); return; }
    setSharing(true);
    try {
      const json = getJson();
      const fileName = `cek-yedek-${new Date().toISOString().split("T")[0]}.json`;
      const FileSystem = await import("expo-file-system/legacy");
      const Sharing = await import("expo-sharing");
      const path = (FileSystem.cacheDirectory ?? "") + fileName;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Yedeği Paylaş" });
      } else { Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım özelliği desteklenmiyor."); }
    } catch { Alert.alert("Hata", "Paylaşım sırasında bir sorun oluştu."); }
    setSharing(false);
  };

  const handleRestore = async () => {
    if (Platform.OS === "web") { Alert.alert("Web", "Bu özellik yalnızca mobil cihazlarda çalışır."); return; }
    try {
      const DocumentPicker = await import("expo-document-picker");
      const FileSystem = await import("expo-file-system/legacy");
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      let content: string;
      try {
        content = await FileSystem.readAsStringAsync(asset.uri);
      } catch {
        const tmpUri = (FileSystem.cacheDirectory ?? "") + "import_backup_tmp.json";
        await FileSystem.copyAsync({ from: asset.uri, to: tmpUri });
        content = await FileSystem.readAsStringAsync(tmpUri);
        await FileSystem.deleteAsync(tmpUri, { idempotent: true });
      }
      Alert.alert("Geri Yükle", "Mevcut tüm veriler silinecek. Devam etmek istiyor musunuz?", [
        { text: "İptal", style: "cancel" },
        { text: "Geri Yükle", style: "destructive", onPress: () => {
          const ok = importData(content);
          if (ok) Alert.alert("Başarılı", "Veriler geri yüklendi.");
          else Alert.alert("Hata", "Geçersiz yedek dosyası.");
        }},
      ]);
    } catch (e) {
      Alert.alert("Hata", "Dosya okuma hatası: " + (e instanceof Error ? e.message : "Bilinmeyen hata"));
    }
  };

  const styles = makeStyles(colors, topPad);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 90 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ayarlar</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="droplet" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Tema Rengi</Text>
        </View>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorSwatch, { backgroundColor: c }, primaryColor === c && styles.colorSwatchSelected]}
              onPress={() => setPrimaryColor(c)}
            >
              {primaryColor === c && <Feather name="check" size={14} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="sun" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Görünüm</Text>
        </View>
        {([
          { label: "Sistem Teması", val: null, icon: "smartphone" as const },
          { label: "Aydınlık", val: false, icon: "sun" as const },
          { label: "Karanlık", val: true, icon: "moon" as const },
        ]).map((opt) => (
          <TouchableOpacity
            key={String(opt.val)}
            style={[styles.optionRow, forceDark === opt.val && { backgroundColor: colors.primary + "18" }]}
            onPress={() => setForceDark(opt.val)}
          >
            <Feather name={opt.icon} size={16} color={forceDark === opt.val ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.optionText, forceDark === opt.val && { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{opt.label}</Text>
            <View style={{ flex: 1 }} />
            {forceDark === opt.val && <Feather name="check" size={16} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Yapay Zeka (AI)</Text>
          <View style={[styles.aiStatusBadge, { backgroundColor: isConfigured ? colors.success + "20" : colors.muted }]}>
            <View style={[styles.aiStatusDot, { backgroundColor: isConfigured ? colors.success : colors.mutedForeground }]} />
            <Text style={[styles.aiStatusText, { color: isConfigured ? colors.success : colors.mutedForeground }]}>{isConfigured ? "Aktif" : "Kurulmadı"}</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sağlayıcı</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{provider === "openai" ? "ChatGPT (OpenAI)" : "Google Gemini"}</Text>
        </View>
        <View style={[styles.statRow, { borderBottomWidth: 0, marginBottom: 8 }]}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Durum</Text>
          <Text style={[styles.statValue, { color: isConfigured ? colors.success : colors.mutedForeground }]}>{isConfigured ? "API anahtarı tanımlı" : "API anahtarı gerekli"}</Text>
        </View>
        <TouchableOpacity style={[styles.aiConfigBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/ai")}>
          <Feather name="settings" size={16} color="#fff" />
          <Text style={styles.aiConfigBtnText}>AI Ayarlarını Aç</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="database" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Veriler</Text>
        </View>
        {[
          { label: "Toplam Çek", value: checks.length, color: colors.foreground },
          { label: "Bekleyen", value: checks.filter((c) => c.status === "pending").length, color: colors.warning },
          { label: "Ödendi", value: checks.filter((c) => c.status === "paid").length, color: colors.success },
          { label: "Arkası Yazıldı", value: checks.filter((c) => c.status === "endorsed").length, color: colors.primary },
        ].map((row, i, arr) => (
          <View key={row.label} style={[styles.statRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
            <Text style={[styles.statValue, { color: row.color }]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="save" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Yedek & Geri Yükleme</Text>
        </View>
        <Text style={[styles.backupInfo, { color: colors.mutedForeground }]}>
          Verilerinizi telefona kaydedebilir veya WhatsApp, Drive gibi uygulamalarla paylaşabilirsiniz.
        </Text>
        <TouchableOpacity style={[styles.backupBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSaveToPhone} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="smartphone" size={18} color="#fff" />}
          <Text style={styles.backupBtnText}>Telefona Kaydet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backupBtn, { backgroundColor: colors.secondary, marginTop: 10, opacity: sharing ? 0.7 : 1 }]} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="share-2" size={18} color={colors.primary} />}
          <Text style={[styles.backupBtnText, { color: colors.primary }]}>Paylaş</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backupBtn, { backgroundColor: colors.secondary, marginTop: 10 }]} onPress={handleRestore}>
          <Feather name="upload" size={18} color={colors.primary} />
          <Text style={[styles.backupBtnText, { color: colors.primary }]}>Geri Yükle</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>Çek Yönetimi v2.0</Text>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    card: { backgroundColor: colors.card, borderRadius: colors.radius + 4, marginHorizontal: 16, marginTop: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
    cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
    colorSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    colorSwatchSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4 },
    optionText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    aiStatusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    aiStatusDot: { width: 6, height: 6, borderRadius: 3 },
    aiStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    aiConfigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: colors.radius },
    aiConfigBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
    statLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
    statValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
    backupInfo: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
    backupBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius },
    backupBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    version: { textAlign: "center", fontSize: 12, marginTop: 20 },
  });
}
