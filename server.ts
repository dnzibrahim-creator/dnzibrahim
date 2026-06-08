import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Default fallback client if configured in process.env
const defaultGeminiAi = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// Helper to get selected AI client
function getAiClient(req: any) {
  const { provider, apiKey, customApiKey } = req.body;
  const keyToUse = customApiKey || apiKey;
  
  if (provider === "openai") {
    if (!keyToUse) throw new Error("OpenAI API Anahtarı bulunamadı.");
    return { type: "openai", client: new OpenAI({ apiKey: keyToUse }) };
  }
  
  // Default to Gemini
  if (keyToUse) {
    return { 
      type: "gemini", 
      client: new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      })
    };
  }
  
  if (defaultGeminiAi) {
    return { type: "gemini", client: defaultGeminiAi };
  }
  
  throw new Error("Yapay zeka için API Anahtarı tanımlanmamış.");
}

// API routes FIRST
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: !!defaultGeminiAi,
    message: defaultGeminiAi ? "AI Service is available" : "GEMINI_API_KEY is missing",
  });
});

// Check Scan Endpoint via Gemini Vision (Or OpenAI Vision if configured)
app.post("/api/gemini/scan", async (req, res) => {
  try {
    const aiConfig = getAiClient(req);
    const { base64Image } = req.body;
    
    if (!base64Image) {
      return res.status(400).json({ error: "Görsel verisi (base64) zorunludur." });
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const systemInstruction = `Sen bir Türk bankacılık uzmanısın. Çek görselini analiz et. Aşağıdaki JSON formatında yanıt ver:

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

    let outputText = "";

    if (aiConfig.type === "openai") {
      const openai = aiConfig.client as OpenAI;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${cleanBase64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });
      outputText = response.choices[0].message.content || "";
    } else {
      const ai = aiConfig.client as GoogleGenAI;
      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, { text: systemInstruction }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bankName: { type: Type.STRING },
              bankName_confidence: { type: Type.NUMBER },
              customerName: { type: Type.STRING },
              customerName_confidence: { type: Type.NUMBER },
              serialNumber: { type: Type.STRING },
              serialNumber_confidence: { type: Type.NUMBER },
              amount: { type: Type.NUMBER },
              amount_confidence: { type: Type.NUMBER },
              dueDate: { type: Type.STRING },
              dueDate_confidence: { type: Type.NUMBER },
              note: { type: Type.STRING },
            },
          },
        },
      });
      outputText = response.text || "";
    }

    try {
      const parsedData = JSON.parse(outputText);
      return res.json({ result: parsedData });
    } catch {
      return res.json({ result: null, rawText: outputText });
    }
  } catch (error: any) {
    console.error("Scan error:", error);
    return res.status(500).json({ error: error.message || "Görsel işlenirken bir hata oluştu." });
  }
});

// AI Chat Endpoint with System Prompt and local Context
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const aiConfig = getAiClient(req);
    const { messages, contextData } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Mesaj geçmişi zorunludur." });
    }

    let contextualPrompt = `Sen "Çek Yönetimi" uygulamasının yapay zeka finans asistanısın.

TEMEL KURALLAR:
- Sadece Türkçe yanıt ver.
- Sadece sağlanan çek verilerini kullan.
- Olmayan veya belirsiz verileri asla uydurma.
- Hesaplamalar sağlanan verilerden yapılmalı.
- Eksik bilgi varsa açıkça "Bu veri mevcut değil" de.
- Finansal tavsiye değil, veri analizi yap.
- Kısa, öz, profesyonel ve net ol.

Sistemdeki Güncel Çek Verileri:
${JSON.stringify(contextData || [], null, 2)}
`;

    let responseText = "";

    if (aiConfig.type === "openai") {
      const openai = aiConfig.client as OpenAI;
      const apiMessages = [
        { role: "system", content: contextualPrompt },
        ...messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }))
      ];
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages as any,
      });
      responseText = response.choices[0].message.content || "";
    } else {
      const ai = aiConfig.client as GoogleGenAI;
      const contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: contextualPrompt,
        },
      });
      responseText = response.text || "";
    }

    return res.json({ response: responseText });
  } catch (error: any) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Sohbet işlemi sırasında bir hata oluştu." });
  }
});

// Vite middleware flow
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express v4, wildcard is '*'
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

init();
