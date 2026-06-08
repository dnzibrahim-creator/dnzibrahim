import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export type AIProviderType = "openai" | "gemini";

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AIContextType {
  provider: AIProviderType;
  setProvider: (p: AIProviderType) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  isConfigured: boolean;
  messages: AIMessage[];
  addMessage: (msg: Omit<AIMessage, "id" | "timestamp">) => AIMessage;
  clearMessages: () => void;
  sendMessage: (text: string, systemPrompt?: string, onChunk?: (partial: string) => void) => Promise<string>;
  scanCheckImage: (base64Image: string) => Promise<ScannedCheckData | null>;
  retryLastMessage: (systemPrompt?: string, onChunk?: (partial: string) => void) => Promise<string | null>;
}

export interface ScannedCheckData {
  bankName?: string;
  customerName?: string;
  serialNumber?: string;
  amount?: number;
  dueDate?: string;
  note?: string;
  confidence?: Record<string, number>;
}

const AI_PROVIDER_KEY = "@cek_ai_provider_v1";
const AI_MESSAGES_KEY = "@cek_ai_messages_v1";
const SECURE_KEY = "cek_ai_apikey_v1";
const LEGACY_SETTINGS_KEY = "@cek_ai_settings_v1";
const MAX_HISTORY = 10;

const AIContext = createContext<AIContextType | null>(null);

const CHECK_SCAN_PROMPT = `Sen bir Türk bankacılık uzmanısın. Çek görselini analiz et. Aşağıdaki JSON formatında yanıt ver:

{
  "bankName": "Banka adı veya null",
  "bankName_confidence": 0.0-1.0,
  "customerName": "Keşideci adı veya null",
  "customerName_confidence": 0.0-1.0,
  "serialNumber": "Seri no veya null",
  "serialNumber_confidence": 0.0-1.0,
  "amount": sayı veya null,
  "amount_confidence": 0.0-1.0,
  "dueDate": "YYYY-MM-DD veya null",
  "dueDate_confidence": 0.0-1.0,
  "note": "varsa ek not veya null"
}

Tutar için: nokta ve virgül ayraçlarını kaldır, sadece sayıyı ver (örn: 15.000,00 → 15000).
Okunamayan alanlar için null kullan, güven skorunu düşük tut (0.3 altı = şüpheli).
SADECE JSON döndür, başka metin ekleme.`;

const FINANCE_SYSTEM_PROMPT = `Sen "Çek Yönetimi" uygulamasının yapay zeka finans asistanısın.

TEMEL KURALLAR:
- Sadece Türkçe yanıt ver
- Sadece sağlanan çek verilerini kullan
- Olmayan veya belirsiz verileri asla uydurma
- Hesaplamalar sağlanan verilerden yapılmalı
- Eksik bilgi varsa açıkça "Bu veri mevcut değil" de
- Finansal tavsiye değil, veri analizi yap
- Kısa ve net ol`;

function parseAIError(err: unknown, provider: AIProviderType): string {
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  if (low.includes("401") || low.includes("invalid_api_key") || low.includes("api key") || low.includes("authentication")) {
    return `${provider === "openai" ? "OpenAI" : "Gemini"} API anahtarı geçersiz. Ayarlar > AI bölümünden kontrol edin.`;
  }
  if (low.includes("429") || low.includes("quota") || low.includes("rate limit")) {
    return "API kullanım limitine ulaşıldı. Lütfen biraz bekleyip tekrar deneyin.";
  }
  if (low.includes("timeout") || low.includes("timed out")) {
    return "İstek zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.";
  }
  if (low.includes("network") || low.includes("fetch") || low.includes("connect")) {
    return "İnternet bağlantısı kurulamadı. Ağ bağlantınızı kontrol edin.";
  }
  if (low.includes("503") || low.includes("unavailable") || low.includes("overloaded")) {
    return `${provider === "openai" ? "OpenAI" : "Gemini"} servisi şu an yoğun. Biraz bekleyip tekrar deneyin.`;
  }
  if (low.includes("400") || low.includes("malformed") || low.includes("invalid")) {
    return "İstek oluşturulurken hata oluştu. Lütfen tekrar deneyin.";
  }
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
}

async function callOpenAIStream(
  apiKey: string,
  messages: { role: string; content: string | object[] }[],
  systemPrompt: string,
  onChunk: (partial: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reqMessages: { role: string; content: string | object[] }[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o", messages: reqMessages, max_tokens: 2048, stream: true }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API hatası: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Akış başlatılamadı");
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) { full += delta; onChunk(full); }
      } catch {}
    }
  }
  return full;
}

async function callGemini(
  apiKey: string,
  messages: AIMessage[],
  systemPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const contents: { role: string; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Anlıyorum, çek verilerini analiz etmeye hazırım." }] },
    ...messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2048 } }),
      signal,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini API hatası: ${res.status}`);
  }
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAIVision(apiKey: string, base64: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }] }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API hatası: ${res.status}`);
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGeminiVision(apiKey: string, base64: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini API hatası: ${res.status}`);
  }
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function parseTurkishMoney(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number" && !isNaN(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return undefined;
  const cleaned = s
    .replace(/₺/g, "")
    .replace(/\s/g, "")
    .replace(/^(\d{1,3})(\.\d{3})+,(\d{2})$/, (_, a, b, c) => a + b.replace(/\./g, "") + "." + c)
    .replace(/^(\d{1,3})(,\d{3})+\.(\d{2})$/, (_, a, b, c) => a + b.replace(/,/g, "") + "." + c)
    .replace(/^(\d[\d.]*),(\d{1,2})$/, (_, a, b) => a.replace(/\./g, "") + "." + b)
    .replace(/^(\d[\d,]*)\.(\d{1,2})$/, (_, a, b) => a.replace(/,/g, "") + "." + b)
    .replace(/[.,]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function genId() { return Date.now().toString() + Math.random().toString(36).slice(2, 7); }

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      const isRetryable = msg.includes("timeout") || msg.includes("network") || msg.includes("fetch") || msg.includes("503") || msg.includes("overloaded");
      if (!isRetryable || i === retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProviderState] = useState<AIProviderType>("gemini");
  const [apiKey, setApiKeyState] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const legacy = await AsyncStorage.getItem(LEGACY_SETTINGS_KEY);
        if (legacy) {
          const p = JSON.parse(legacy);
          if (p.apiKey) {
            await SecureStore.setItemAsync(SECURE_KEY, p.apiKey);
            await AsyncStorage.removeItem(LEGACY_SETTINGS_KEY);
          }
          if (p.provider) setProviderState(p.provider);
        }
        const savedProvider = await AsyncStorage.getItem(AI_PROVIDER_KEY);
        if (savedProvider) setProviderState(savedProvider as AIProviderType);
        const key = await SecureStore.getItemAsync(SECURE_KEY);
        if (key) setApiKeyState(key);
      } catch {}
    })();
    AsyncStorage.getItem(AI_MESSAGES_KEY).then((d) => {
      if (d) setMessages(JSON.parse(d));
    }).catch(() => {});
  }, []);

  const saveProvider = (p: AIProviderType) => AsyncStorage.setItem(AI_PROVIDER_KEY, p).catch(() => {});
  const saveKey = (k: string) => SecureStore.setItemAsync(SECURE_KEY, k).catch(() => {});

  const setProvider = (p: AIProviderType) => { setProviderState(p); saveProvider(p); };
  const setApiKey = (k: string) => { setApiKeyState(k); saveKey(k); };

  const addMessage = useCallback((msg: Omit<AIMessage, "id" | "timestamp">): AIMessage => {
    const newMsg: AIMessage = { ...msg, id: genId(), timestamp: Date.now() };
    setMessages((prev) => {
      const next = [...prev, newMsg];
      AsyncStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return newMsg;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    AsyncStorage.removeItem(AI_MESSAGES_KEY).catch(() => {});
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    systemPrompt?: string,
    onChunk?: (partial: string) => void
  ): Promise<string> => {
    const userMsg: AIMessage = { id: genId(), role: "user", content: text, timestamp: Date.now() };
    const sysPrompt = systemPrompt ?? FINANCE_SYSTEM_PROMPT;
    let response = "";

    const currentMessages = await new Promise<AIMessage[]>((resolve) => {
      setMessages((prev) => {
        const next = [...prev, userMsg];
        AsyncStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(next)).catch(() => {});
        resolve(next);
        return next;
      });
    });

    const apiMessages = currentMessages.slice(-MAX_HISTORY);

    const runOpenAI = async () => {
      const openaiMsgs = apiMessages.map((m) => ({ role: m.role as string, content: m.content }));
      if (onChunk) {
        return await callOpenAIStream(apiKey, openaiMsgs, sysPrompt, onChunk);
      } else {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: sysPrompt }, ...openaiMsgs], max_tokens: 2048 }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API hatası: ${res.status}`); }
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content ?? "";
      }
    };

    const runGemini = async () => callGemini(apiKey, apiMessages, sysPrompt);

    try {
      response = await withRetry(provider === "openai" ? runOpenAI : runGemini);
    } catch (primaryErr) {
      const errMsg = primaryErr instanceof Error ? primaryErr.message.toLowerCase() : "";
      const isKeyError = errMsg.includes("401") || errMsg.includes("invalid_api_key") || errMsg.includes("authentication");
      if (!isKeyError) {
        try {
          response = await withRetry(provider === "openai" ? runGemini : runOpenAI);
          response = `[Yedek sağlayıcıya geçildi]\n\n${response}`;
        } catch {
          throw new Error(parseAIError(primaryErr, provider));
        }
      } else {
        throw new Error(parseAIError(primaryErr, provider));
      }
    }

    const assistantMsg: AIMessage = { id: genId(), role: "assistant", content: response, timestamp: Date.now() };
    setMessages((prev) => {
      const next = [...prev, assistantMsg];
      AsyncStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return response;
  }, [provider, apiKey]);

  const retryLastMessage = useCallback(async (
    systemPrompt?: string,
    onChunk?: (partial: string) => void
  ): Promise<string | null> => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return null;
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const next = prev.slice(0, realIdx);
      AsyncStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    await new Promise((r) => setTimeout(r, 50));
    return sendMessage(lastUser.content, systemPrompt, onChunk);
  }, [messages, sendMessage]);

  const scanCheckImage = useCallback(async (base64Image: string): Promise<ScannedCheckData | null> => {
    let raw = "";
    if (provider === "openai") {
      raw = await withRetry(() => callOpenAIVision(apiKey, base64Image, CHECK_SCAN_PROMPT));
    } else {
      raw = await withRetry(() => callGeminiVision(apiKey, base64Image, CHECK_SCAN_PROMPT));
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const confidence: Record<string, number> = {};
      const fields: (keyof ScannedCheckData)[] = ["bankName", "customerName", "serialNumber", "amount", "dueDate"];
      for (const f of fields) {
        const cKey = `${f}_confidence`;
        if (typeof parsed[cKey] === "number") confidence[f] = parsed[cKey] as number;
      }
      const amount = parseTurkishMoney(parsed.amount);
      return {
        bankName: typeof parsed.bankName === "string" ? parsed.bankName : undefined,
        customerName: typeof parsed.customerName === "string" ? parsed.customerName : undefined,
        serialNumber: typeof parsed.serialNumber === "string" ? parsed.serialNumber : undefined,
        amount,
        dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : undefined,
        note: typeof parsed.note === "string" ? parsed.note : undefined,
        confidence,
      };
    } catch { return null; }
  }, [provider, apiKey]);

  return (
    <AIContext.Provider value={{ provider, setProvider, apiKey, setApiKey, isConfigured: apiKey.length > 10, messages, addMessage, clearMessages, sendMessage, scanCheckImage, retryLastMessage }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextType {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be inside AIProvider");
  return ctx;
}
