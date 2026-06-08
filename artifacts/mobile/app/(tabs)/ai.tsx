import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, Alert, Platform, Switch, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAI, AIMessage, AIProviderType } from "@/context/AIContext";
import { useChecks } from "@/context/ChecksContext";

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function formatAmount(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function formatDate(s: string) { const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; }

function buildContextPrompt(
  checks: ReturnType<typeof useChecks>["checks"],
  getTotals: ReturnType<typeof useChecks>["getTotals"],
  getUpcomingChecks: ReturnType<typeof useChecks>["getUpcomingChecks"]
): string {
  const today = todayStr();
  const totals = getTotals();
  const upcoming7 = getUpcomingChecks(7);
  const pending = checks.filter((c) => c.status === "pending" && c.dueDate >= today);
  const overdue = checks.filter((c) => c.status === "pending" && c.dueDate < today);
  const paid = checks.filter((c) => c.status === "paid");
  const endorsed = checks.filter((c) => c.status === "endorsed");

  const pendingByMonth: Record<string, { count: number; amount: number }> = {};
  for (const c of pending) {
    const key = c.dueDate.slice(0, 7);
    if (!pendingByMonth[key]) pendingByMonth[key] = { count: 0, amount: 0 };
    pendingByMonth[key].count++;
    pendingByMonth[key].amount += c.amount;
  }
  const monthSummary = Object.entries(pendingByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: ${v.count} çek, ${formatAmount(v.amount)}`)
    .join("\n");

  const checkList = (arr: typeof checks, label: string) =>
    arr.slice(0, 20).map((c) => `  - ${c.customerName} | ${c.bankName} | ${formatAmount(c.amount)} | Vade: ${formatDate(c.dueDate)}${c.note ? ` | Not: ${c.note}` : ""}${c.givenTo ? ` | Kime: ${c.givenTo}` : ""}`).join("\n") ||
    `  (${label} çek yok)`;

  return `Sen "Çek Yönetimi" uygulamasının yapay zeka finans asistanısın.
SADECE Türkçe yanıt ver. SADECE aşağıdaki gerçek verileri kullan. Olmayan veriyi uydurma.

=== BUGÜNÜN TARİHİ ===
${today}

=== ÖZET ===
Toplam çek sayısı: ${checks.length}
Bekleyen çekler: ${totals.pendingCount} adet, ${formatAmount(totals.pendingAmount)}
Vadesi geçmiş: ${totals.overdueCount} adet, ${formatAmount(totals.overdueAmount)}
Ödendi: ${totals.paidCount} adet
Arkası yazıldı: ${totals.endorsedCount} adet

=== SONRAKİ 7 GÜN ===
${upcoming7.length > 0 ? upcoming7.map((c) => `  - ${c.customerName} | ${formatAmount(c.amount)} | ${formatDate(c.dueDate)}`).join("\n") : "  (7 gün içinde vadesi gelen çek yok)"}

=== AYLIK DAĞILIM (Bekleyen) ===
${monthSummary || "  (veri yok)"}

=== BEKLEYEN ÇEKLER (İlk 20) ===
${checkList(pending, "bekleyen")}

=== VADESİ GEÇMİŞ ÇEKLER ===
${checkList(overdue, "vadesi geçmiş")}

=== ÖDENDİ (Son 10) ===
${checkList(paid.slice(0, 10), "ödendi")}

=== ARKASI YAZILDI (Son 10) ===
${checkList(endorsed.slice(0, 10), "arkası yazıldı")}`;
}

const QUICK_PROMPTS = [
  "Bu ay vadesi gelen çekleri say",
  "En büyük 5 çeki göster",
  "Vadesi geçmiş çekleri listele",
  "Toplam bekleyen tutarı söyle",
  "Sonraki 7 gün içinde ne kadar ödeme var?",
];

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    provider, setProvider, apiKey, setApiKey, isConfigured,
    messages, addMessage, clearMessages, sendMessage, retryLastMessage,
  } = useAI();
  const { checks, getTotals, getUpcomingChecks } = useChecks();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [useContextData, setUseContextData] = useState(true);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => { setApiKeyInput(apiKey); }, [apiKey]);

  useEffect(() => {
    if (!showSettings && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, showSettings, streamingText]);

  const handleSend = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || streaming) return;
    if (!isConfigured) { setShowSettings(true); Alert.alert("API Anahtarı Gerekli", "Lütfen ayarlardan API anahtarınızı girin."); return; }
    setInput("");
    setStreamingText("");
    setStreaming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const systemPrompt = useContextData
      ? buildContextPrompt(checks, getTotals, getUpcomingChecks)
      : "Sen bir Türk finans asistanısın. Sadece Türkçe yanıt ver.";

    try {
      await sendMessage(msgText, systemPrompt, (partial) => setStreamingText(partial));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
      addMessage({ role: "assistant", content: `⚠️ Hata: ${errMsg}` });
    }
    setStreamingText("");
    setStreaming(false);
  }, [input, streaming, isConfigured, useContextData, checks, getTotals, getUpcomingChecks, sendMessage, addMessage]);

  const handleRetry = useCallback(async () => {
    if (streaming) return;
    if (!isConfigured) { setShowSettings(true); return; }
    setStreamingText("");
    setStreaming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const systemPrompt = useContextData ? buildContextPrompt(checks, getTotals, getUpcomingChecks) : undefined;
    try {
      await retryLastMessage(systemPrompt, (partial) => setStreamingText(partial));
    } catch (err) {
      addMessage({ role: "assistant", content: `⚠️ Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}` });
    }
    setStreamingText("");
    setStreaming(false);
  }, [streaming, isConfigured, useContextData, checks, getTotals, getUpcomingChecks, retryLastMessage, addMessage]);

  const handleSaveSettings = () => {
    const trimmed = apiKeyInput.trim();
    setApiKey(trimmed);
    if (trimmed.length > 0 && trimmed.length < 10) { Alert.alert("Uyarı", "API anahtarı çok kısa görünüyor. Doğru anahtarı girdiğinizden emin olun."); return; }
    setShowSettings(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const styles = makeStyles(colors, insets, topPad);

  const renderMessage = ({ item, index }: { item: AIMessage; index: number }) => {
    const isUser = item.role === "user";
    const isLast = index === messages.length - 1;
    const showRetry = !isUser && isLast && !streaming;

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAssistant]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="cpu" size={14} color="#fff" />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card }]}>
          <Text style={[styles.msgText, { color: isUser ? "#fff" : colors.foreground }]}>{item.content}</Text>
          {showRetry && (
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
              <Text style={[styles.retryText, { color: colors.mutedForeground }]}>Tekrar dene</Text>
            </TouchableOpacity>
          )}
        </View>
        {isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Feather name="user" size={14} color={colors.primary} />
          </View>
        )}
      </View>
    );
  };

  if (showSettings) {
    return (
      <View style={styles.container}>
        <View style={styles.settingsHeader}>
          <TouchableOpacity onPress={() => { setShowSettings(false); setApiKeyInput(apiKey); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.settingsTitle}>AI Ayarları</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={styles.settingsSectionTitle}>AI Sağlayıcı</Text>
            {([
              { val: "gemini" as AIProviderType, label: "Google Gemini (Önerilen)", desc: "Gemini 2.5 Flash — Ücretsiz kota ile başlanabilir. api.google.com/ai/gemini" },
              { val: "openai" as AIProviderType, label: "ChatGPT (OpenAI)", desc: "GPT-4o — Ücretli. platform.openai.com" },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.val}
                style={[styles.providerOption, provider === opt.val && { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => setProvider(opt.val)}
              >
                <View style={[styles.radioOuter, { borderColor: provider === opt.val ? colors.primary : colors.border }]}>
                  {provider === opt.val && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerLabel, { color: colors.foreground }]}>{opt.label}</Text>
                  <Text style={[styles.providerDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={styles.settingsSectionTitle}>API Anahtarı</Text>
            <View style={styles.apiKeyRow}>
              <TextInput
                style={[styles.apiKeyInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder={provider === "openai" ? "sk-..." : "AIza..."}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!apiKeyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setApiKeyVisible(!apiKeyVisible)}>
                <Feather name={apiKeyVisible ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.apiHint, { color: colors.mutedForeground }]}>
              {provider === "openai" ? "OpenAI API anahtarınızı platform.openai.com/api-keys adresinden alın." : "Gemini API anahtarınızı aistudio.google.com/apikey adresinden alın."}
            </Text>
          </View>

          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Çek Verilerini Paylaş</Text>
                <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>Çek verileriniz AI sağlayıcısına gönderilir. Kapatırsanız genel sorular sorabilirsiniz.</Text>
              </View>
              <Switch value={useContextData} onValueChange={setUseContextData} trackColor={{ true: colors.primary }} />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveSettings}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Kaydet ve Devam Et</Text>
          </TouchableOpacity>

          {apiKeyInput.length > 0 && (
            <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.destructive }]} onPress={() => { setApiKeyInput(""); setApiKey(""); }}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.clearBtnText, { color: colors.destructive }]}>API Anahtarını Sil</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>AI Asistan</Text>
        <View style={styles.headerActions}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={() => Alert.alert("Sohbeti Temizle", "Tüm mesajlar silinecek.", [
              { text: "İptal", style: "cancel" },
              { text: "Temizle", style: "destructive", onPress: clearMessages },
            ])} style={styles.headerBtn}>
              <Feather name="trash-2" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
            <Feather name="settings" size={20} color={colors.mutedForeground} />
            {!isConfigured && <View style={[styles.badgeDot, { backgroundColor: colors.destructive }]} />}
          </TouchableOpacity>
        </View>
      </View>

      {!isConfigured ? (
        <View style={styles.setupBox}>
          <Feather name="cpu" size={48} color={colors.primary} />
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>AI Asistanı Kur</Text>
          <Text style={[styles.setupDesc, { color: colors.mutedForeground }]}>
            Çeklerinizi analiz etmek, soruları yanıtlamak ve içgörüler almak için API anahtarınızı girin.
          </Text>
          <TouchableOpacity style={[styles.setupBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSettings(true)}>
            <Feather name="settings" size={18} color="#fff" />
            <Text style={styles.setupBtnText}>AI'ı Kur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="cpu" size={36} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ne öğrenmek istersiniz?</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Çekleriniz hakkında soru sorun</Text>
              <View style={styles.quickGrid}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity key={p} style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleSend(p)}>
                    <Text style={[styles.quickChipText, { color: colors.foreground }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              ListFooterComponent={streaming ? (
                <View style={[styles.msgRow, styles.msgRowAssistant]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Feather name="cpu" size={14} color="#fff" />
                  </View>
                  <View style={[styles.msgBubble, { backgroundColor: colors.card }]}>
                    {streamingText ? (
                      <Text style={[styles.msgText, { color: colors.foreground }]}>{streamingText}</Text>
                    ) : (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>
                </View>
              ) : null}
            />
          )}

          <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 80 : 16) }]}>
            {messages.length > 0 && !streaming && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, marginBottom: 8 }}>
                {QUICK_PROMPTS.slice(0, 3).map((p) => (
                  <TouchableOpacity key={p} style={[styles.quickChipSmall, { backgroundColor: colors.secondary }]} onPress={() => handleSend(p)}>
                    <Text style={[styles.quickChipSmallText, { color: colors.primary }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={input}
                onChangeText={setInput}
                placeholder="Çekleriniz hakkında soru sorun..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                onSubmitEditing={() => handleSend()}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: (!input.trim() || streaming) ? 0.5 : 1 }]}
                onPress={() => handleSend()}
                disabled={!input.trim() || streaming}
              >
                {streaming ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>, topPad: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
    headerBtn: { padding: 4, position: "relative" },
    badgeDot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4 },
    setupBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    setupTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
    setupDesc: { textAlign: "center", fontSize: 14, lineHeight: 22 },
    setupBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
    setupBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
    emptyDesc: { fontSize: 13 },
    quickGrid: { width: "100%", gap: 8, marginTop: 8 },
    quickChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    quickChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
    quickChipSmall: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    quickChipSmallText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    msgRow: { flexDirection: "row", marginBottom: 14, gap: 8 },
    msgRowUser: { justifyContent: "flex-end" },
    msgRowAssistant: { justifyContent: "flex-start" },
    avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 },
    msgBubble: { maxWidth: "80%", borderRadius: 14, padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
    msgText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
    retryBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    retryText: { fontSize: 11, fontFamily: "Inter_400Regular" },
    inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 100, minHeight: 44 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    settingsHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 80 : insets.top + 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { padding: 4 },
    settingsTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    settingsCard: { borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    settingsSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
    providerOption: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 },
    radioInner: { width: 10, height: 10, borderRadius: 5 },
    providerLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    providerDesc: { fontSize: 11, lineHeight: 16 },
    apiKeyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    apiKeyInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
    eyeBtn: { padding: 8 },
    apiHint: { fontSize: 12, lineHeight: 18, marginTop: 8 },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    toggleDesc: { fontSize: 12, lineHeight: 18 },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14, marginBottom: 12 },
    saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
    clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
    clearBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  });
}
