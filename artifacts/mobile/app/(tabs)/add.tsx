import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform, Image, Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useChecks, Check } from "@/context/ChecksContext";
import { useAI } from "@/context/AIContext";
import { useBanks } from "@/hooks/useBanks";
import CurrencyInput, { parseTurkishAmount } from "@/components/CurrencyInput";
import AutocompleteInput from "@/components/AutocompleteInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function toDisplayDate(iso: string) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; }
function parseDisplayDate(display: string): string | null {
  const cleaned = display.replace(/[^0-9.\/\-]/g, "");
  const sep = cleaned.includes(".") ? "." : cleaned.includes("/") ? "/" : "-";
  const parts = cleaned.split(sep);
  if (parts.length !== 3) return null;
  let d: string, m: string, y: string;
  if (parts[0].length === 4) { [y, m, d] = parts; }
  else { [d, m, y] = parts; }
  if (!d || !m || !y) return null;
  const dd = d.padStart(2, "0"), mm = m.padStart(2, "0");
  const yy = y.length === 2 ? "20" + y : y;
  if (isNaN(Date.parse(`${yy}-${mm}-${dd}`))) return null;
  return `${yy}-${mm}-${dd}`;
}

type CheckType = "received" | "given";

interface FormData {
  checkType: CheckType;
  bankName: string;
  customerName: string;
  serialNumber: string;
  amount: string;
  dueDate: string;
  note: string;
  givenTo: string;
  imageUri: string;
}

const EMPTY_FORM: FormData = {
  checkType: "given",
  bankName: "",
  customerName: "",
  serialNumber: "",
  amount: "",
  dueDate: toDisplayDate(todayStr()),
  note: "",
  givenTo: "",
  imageUri: "",
};

const CUSTOMERS_KEY = "@cek_customers_v1";

async function loadCustomers(): Promise<string[]> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const d = await AsyncStorage.getItem(CUSTOMERS_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

async function saveCustomers(list: string[]) {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
  } catch {}
}

export default function AddScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCheck, forceAddCheck, updateCheck, checks } = useChecks();
  const { isConfigured, scanCheckImage } = useAI();
  const { banks } = useBanks();
  const params = useLocalSearchParams();
  const editId = params.editId as string | undefined;

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [customers, setCustomers] = useState<string[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState<Check | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadCustomers().then((stored) => {
      const fromChecks = checks.map((c) => c.customerName).filter(Boolean);
      const combined = Array.from(new Set([...stored, ...fromChecks])).slice(0, 300);
      setCustomers(combined);
    });
  }, [checks]);

  useEffect(() => {
    if (editId) {
      const existing = checks.find((c) => c.id === editId);
      if (existing) {
        setForm({
          checkType: existing.checkType ?? "received",
          bankName: existing.bankName,
          customerName: existing.customerName,
          serialNumber: existing.serialNumber ?? "",
          amount: existing.amount.toLocaleString("tr-TR"),
          dueDate: toDisplayDate(existing.dueDate),
          note: existing.note ?? "",
          givenTo: existing.givenTo ?? "",
          imageUri: existing.imageUri ?? "",
        });
      }
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editId]);

  const update = (key: keyof FormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.bankName.trim()) newErrors.bankName = "Banka adı gerekli";
    if (!form.customerName.trim()) newErrors.customerName = "Müşteri adı gerekli";
    const amt = parseTurkishAmount(form.amount);
    if (!form.amount || amt <= 0) newErrors.amount = "Geçerli bir tutar girin";
    const isoDate = parseDisplayDate(form.dueDate);
    if (!isoDate) newErrors.dueDate = "Geçerli tarih girin (GG.AA.YYYY)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === "web") { Alert.alert("Web", "Fotoğraf ekleme yalnızca mobil cihazlarda desteklenir."); return; }
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ["images"] as unknown as typeof ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      update("imageUri", result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { Alert.alert("Hata", e instanceof Error ? e.message : "Fotoğraf seçilemedi."); }
  };

  const handleScanImage = async () => {
    if (!isConfigured) { Alert.alert("AI Gerekli", "Fotoğraf taramak için AI ayarlarından API anahtarı giriniz.", [{ text: "Ayarlara Git", onPress: () => router.push("/(tabs)/ai") }, { text: "İptal" }]); return; }
    if (Platform.OS === "web") { Alert.alert("Web", "Fotoğraf tarama yalnızca mobil cihazlarda desteklenir."); return; }
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ["images"] as unknown as typeof ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Hata", "Görsel verisi alınamadı."); return; }
      setScanning(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const scanned = await scanCheckImage(asset.base64);
      if (!scanned) { Alert.alert("Tarama Başarısız", "Çek bilgileri okunamadı. Lütfen daha net bir fotoğraf deneyin."); setScanning(false); return; }
      const updates: Partial<FormData> = { imageUri: asset.uri };
      if (scanned.bankName) updates.bankName = scanned.bankName;
      if (scanned.customerName) updates.customerName = scanned.customerName;
      if (scanned.serialNumber) updates.serialNumber = scanned.serialNumber;
      if (scanned.amount && scanned.amount > 0) updates.amount = scanned.amount.toLocaleString("tr-TR");
      if (scanned.dueDate) updates.dueDate = toDisplayDate(scanned.dueDate);
      if (scanned.note) updates.note = scanned.note;
      setForm((prev) => ({ ...prev, ...updates }));
      const lowConfidence = Object.entries(scanned.confidence ?? {}).filter(([, v]) => v < 0.5).map(([k]) => k);
      if (lowConfidence.length > 0) {
        Alert.alert("Tarama Tamamlandı", `Bilgiler dolduruldu. Şu alanlar düşük güvenilirlikte: ${lowConfidence.join(", ")}. Lütfen kontrol edin.`);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) { Alert.alert("Hata", e instanceof Error ? e.message : "Fotoğraf işlenemedi."); }
    setScanning(false);
  };

  const handleSave = async () => {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setSaving(true);
    const isoDate = parseDisplayDate(form.dueDate)!;
    const amt = parseTurkishAmount(form.amount);
    const data = {
      checkType: form.checkType,
      bankName: form.bankName.trim(),
      customerName: form.customerName.trim(),
      serialNumber: form.serialNumber.trim() || undefined,
      amount: amt,
      dueDate: isoDate,
      note: form.note.trim() || undefined,
      givenTo: form.givenTo.trim() || undefined,
      imageUri: form.imageUri || undefined,
    };

    if (editId) {
      updateCheck(editId, data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      const { isDuplicate, existing } = addCheck(data);
      if (isDuplicate && existing) {
        setSaving(false);
        setShowDuplicateWarning(existing);
        return;
      }
      const customerName = form.customerName.trim();
      if (customerName) {
        const updated = Array.from(new Set([customerName, ...customers])).slice(0, 100);
        setCustomers(updated);
        saveCustomers(updated);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm({ ...EMPTY_FORM, checkType: form.checkType });
    }
    setSaving(false);
  };

  const handleForceAdd = () => {
    const isoDate = parseDisplayDate(form.dueDate)!;
    const amt = parseTurkishAmount(form.amount);
    forceAddCheck({
      checkType: form.checkType,
      bankName: form.bankName.trim(),
      customerName: form.customerName.trim(),
      serialNumber: form.serialNumber.trim() || undefined,
      amount: amt,
      dueDate: isoDate,
      note: form.note.trim() || undefined,
      givenTo: form.givenTo.trim() || undefined,
      imageUri: form.imageUri || undefined,
    });
    setShowDuplicateWarning(null);
    setForm({ ...EMPTY_FORM, checkType: form.checkType });
  };

  const styles = makeStyles(colors, insets);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const FieldError = ({ field }: { field: keyof FormData }) =>
    errors[field] ? <Text style={styles.errorText}>{errors[field]}</Text> : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        {editId && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{editId ? "Çeki Düzenle" : "Yeni Çek Ekle"}</Text>
        {isConfigured && !editId && (
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: colors.primary + "18" }]}
            onPress={handleScanImage}
            disabled={scanning}
          >
            {scanning ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="camera" size={18} color={colors.primary} />}
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "web" ? 120 : 100 }}
      >
        {showDuplicateWarning && (
          <View style={[styles.dupWarning, { backgroundColor: colors.warning + "18", borderColor: colors.warning }]}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dupTitle, { color: colors.warning }]}>Benzer çek mevcut!</Text>
              <Text style={[styles.dupDesc, { color: colors.foreground }]}>
                {showDuplicateWarning.customerName} — {showDuplicateWarning.amount.toLocaleString("tr-TR")} ₺ — Vade: {toDisplayDate(showDuplicateWarning.dueDate)}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={[styles.dupBtn, { backgroundColor: colors.warning }]} onPress={handleForceAdd}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Yine de Ekle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dupBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowDuplicateWarning(null)}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Çek Türü</Text>
          <View style={styles.typeRow}>
            {([
              { val: "received" as CheckType, icon: "download" as const, label: "Alınan Çek" },
              { val: "given" as CheckType, icon: "upload" as const, label: "Verilen Çek" },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.val}
                style={[styles.typeBtn, form.checkType === opt.val && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => update("checkType", opt.val)}
              >
                <Feather name={opt.icon} size={16} color={form.checkType === opt.val ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.typeBtnText, { color: form.checkType === opt.val ? "#fff" : colors.mutedForeground }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Banka</Text>
          <AutocompleteInput
            value={form.bankName}
            onChangeText={(t) => update("bankName", t)}
            suggestions={banks}
            placeholder="Banka adı seçin veya yazın"
          />
          <FieldError field="bankName" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Müşteri / Keşideci Adı</Text>
          <AutocompleteInput
            value={form.customerName}
            onChangeText={(t) => update("customerName", t)}
            suggestions={customers}
            placeholder="Müşteri adı veya ticari ünvan"
          />
          <FieldError field="customerName" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tutar (₺)</Text>
          <CurrencyInput
            value={form.amount}
            onChangeText={(raw) => update("amount", raw)}
            placeholder="0,00"
            placeholderTextColor={colors.mutedForeground}
            style={{
              backgroundColor: colors.input, borderWidth: 1,
              borderColor: errors.amount ? colors.destructive : colors.border,
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
              fontSize: 20, color: colors.foreground, fontFamily: "Inter_700Bold",
            }}
          />
          <FieldError field="amount" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Vade Tarihi</Text>
          <TouchableOpacity
            style={[styles.textInput, { paddingVertical: 14, borderColor: errors.dueDate ? colors.destructive : colors.border }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Feather name="calendar" size={16} color={form.dueDate ? colors.primary : colors.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 15, color: form.dueDate ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {form.dueDate || "Tarih seçin"}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <FieldError field="dueDate" />
        </View>

        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={(() => {
              const p = parseDisplayDate(form.dueDate);
              if (p) { const [y, m, d] = p.split("-"); return new Date(+y, +m - 1, +d); }
              return new Date();
            })()}
            mode="date"
            display="default"
            onChange={(e, date) => {
              setShowDatePicker(false);
              if (e.type !== "dismissed" && date) update("dueDate", toDisplayDate(date.toISOString().split("T")[0]));
            }}
          />
        )}
        {showDatePicker && Platform.OS === "ios" && (
          <Modal transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
            <View style={{ backgroundColor: colors.card, paddingBottom: 30 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 12 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: colors.primary, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={(() => {
                  const p = parseDisplayDate(form.dueDate);
                  if (p) { const [y, m, d] = p.split("-"); return new Date(+y, +m - 1, +d); }
                  return new Date();
                })()}
                mode="date"
                display="spinner"
                onChange={(_, date) => { if (date) update("dueDate", toDisplayDate(date.toISOString().split("T")[0])); }}
                locale="tr"
              />
            </View>
          </Modal>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Seri Numarası (Opsiyonel)</Text>
          <AutocompleteInput
            value={form.serialNumber}
            onChangeText={(t) => update("serialNumber", t)}
            suggestions={[]}
            placeholder="Çek seri numarası"
            autoCapitalize="none"
          />
        </View>

        {form.checkType === "given" && (
          <View style={styles.section}>
            <Text style={styles.label}>Kime Verildi (Opsiyonel)</Text>
            <AutocompleteInput
              value={form.givenTo}
              onChangeText={(t) => update("givenTo", t)}
              suggestions={customers}
              placeholder="Alıcı adı"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Not (Opsiyonel)</Text>
          <AutocompleteInput
            value={form.note}
            onChangeText={(t) => update("note", t)}
            suggestions={[]}
            placeholder="Açıklama veya hatırlatma notu"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Çek Fotoğrafı</Text>
          {form.imageUri ? (
            <View style={{ position: "relative" }}>
              <Image source={{ uri: form.imageUri }} style={styles.imgPreview} resizeMode="contain" />
              <TouchableOpacity
                style={[styles.imgRemoveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => update("imageUri", "")}
              >
                <Feather name="x" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handlePickPhoto}
              >
                <Feather name="image" size={16} color={colors.foreground} />
                <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Fotoğraf Ekle</Text>
              </TouchableOpacity>
              {isConfigured && (
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary }]}
                  onPress={handleScanImage}
                  disabled={scanning}
                >
                  {scanning
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Feather name="cpu" size={16} color={colors.primary} />}
                  <Text style={[styles.photoBtnText, { color: colors.primary }]}>AI ile Tara & Doldur</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name={editId ? "check" : "plus-circle"} size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{editId ? "Değişiklikleri Kaydet" : "Çeki Ekle"}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    scanBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    section: { marginBottom: 16 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
    label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 },
    typeRow: { flexDirection: "row", gap: 12 },
    typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    textInput: { flexDirection: "row", alignItems: "center", backgroundColor: colors.input, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
    errorText: { fontSize: 12, color: colors.destructive, marginTop: 4, fontFamily: "Inter_400Regular" },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
    saveBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
    dupWarning: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
    dupTitle: { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 2 },
    dupDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
    dupBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    imgPreview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: colors.muted },
    imgRemoveBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    photoButtons: { flexDirection: "column", gap: 8 },
    photoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
    photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
}
