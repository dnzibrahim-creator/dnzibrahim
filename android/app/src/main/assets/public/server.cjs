var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_openai = __toESM(require("openai"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
var defaultGeminiAi = process.env.GEMINI_API_KEY ? new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
}) : null;
function getAiClient(req) {
  const { provider, apiKey, customApiKey } = req.body;
  const keyToUse = customApiKey || apiKey;
  if (provider === "openai") {
    if (!keyToUse) throw new Error("OpenAI API Anahtar\u0131 bulunamad\u0131.");
    return { type: "openai", client: new import_openai.default({ apiKey: keyToUse }) };
  }
  if (keyToUse) {
    return {
      type: "gemini",
      client: new import_genai.GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      })
    };
  }
  if (defaultGeminiAi) {
    return { type: "gemini", client: defaultGeminiAi };
  }
  throw new Error("Yapay zeka i\xE7in API Anahtar\u0131 tan\u0131mlanmam\u0131\u015F.");
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: !!defaultGeminiAi,
    message: defaultGeminiAi ? "AI Service is available" : "GEMINI_API_KEY is missing"
  });
});
app.post("/api/gemini/scan", async (req, res) => {
  try {
    const aiConfig = getAiClient(req);
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "G\xF6rsel verisi (base64) zorunludur." });
    }
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const systemInstruction = `Sen bir T\xFCrk bankac\u0131l\u0131k uzman\u0131s\u0131n. \xC7ek g\xF6rselini analiz et. A\u015Fa\u011F\u0131daki JSON format\u0131nda yan\u0131t ver:

{
  "bankName": "Banka ad\u0131 veya null",
  "bankName_confidence": 0.0-1.0,
  "customerName": "Ke\u015Fideci ad\u0131 veya null",
  "customerName_confidence": 0.0-1.0,
  "serialNumber": "Seri no veya null",
  "serialNumber_confidence": 0.0-1.0,
  "amount": say\u0131 veya null,
  "amount_confidence": 0.0-1.0,
  "dueDate": "YYYY-MM-DD veya null",
  "dueDate_confidence": 0.0-1.0,
  "note": "varsa ek not veya null"
}

Tutar i\xE7in: nokta ve virg\xFCl ayra\xE7lar\u0131n\u0131 kald\u0131r, sadece say\u0131y\u0131 ver (\xF6rn: 15.000,00 \u2192 15000).
Okunamayan alanlar i\xE7in null kullan, g\xFCven skorunu d\xFC\u015F\xFCk tut (0.3 alt\u0131 = \u015F\xFCpheli).
SADECE JSON d\xF6nd\xFCr, ba\u015Fka metin ekleme.`;
    let outputText = "";
    if (aiConfig.type === "openai") {
      const openai = aiConfig.client;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${cleanBase64}` }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });
      outputText = response.choices[0].message.content || "";
    } else {
      const ai = aiConfig.client;
      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      };
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, { text: systemInstruction }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              bankName: { type: import_genai.Type.STRING },
              bankName_confidence: { type: import_genai.Type.NUMBER },
              customerName: { type: import_genai.Type.STRING },
              customerName_confidence: { type: import_genai.Type.NUMBER },
              serialNumber: { type: import_genai.Type.STRING },
              serialNumber_confidence: { type: import_genai.Type.NUMBER },
              amount: { type: import_genai.Type.NUMBER },
              amount_confidence: { type: import_genai.Type.NUMBER },
              dueDate: { type: import_genai.Type.STRING },
              dueDate_confidence: { type: import_genai.Type.NUMBER },
              note: { type: import_genai.Type.STRING }
            }
          }
        }
      });
      outputText = response.text || "";
    }
    try {
      const parsedData = JSON.parse(outputText);
      return res.json({ result: parsedData });
    } catch {
      return res.json({ result: null, rawText: outputText });
    }
  } catch (error) {
    console.error("Scan error:", error);
    return res.status(500).json({ error: error.message || "G\xF6rsel i\u015Flenirken bir hata olu\u015Ftu." });
  }
});
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const aiConfig = getAiClient(req);
    const { messages, contextData } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Mesaj ge\xE7mi\u015Fi zorunludur." });
    }
    let contextualPrompt = `Sen "\xC7ek Y\xF6netimi" uygulamas\u0131n\u0131n yapay zeka finans asistan\u0131s\u0131n.

TEMEL KURALLAR:
- Sadece T\xFCrk\xE7e yan\u0131t ver.
- Sadece sa\u011Flanan \xE7ek verilerini kullan.
- Olmayan veya belirsiz verileri asla uydurma.
- Hesaplamalar sa\u011Flanan verilerden yap\u0131lmal\u0131.
- Eksik bilgi varsa a\xE7\u0131k\xE7a "Bu veri mevcut de\u011Fil" de.
- Finansal tavsiye de\u011Fil, veri analizi yap.
- K\u0131sa, \xF6z, profesyonel ve net ol.

Sistemdeki G\xFCncel \xC7ek Verileri:
${JSON.stringify(contextData || [], null, 2)}
`;
    let responseText = "";
    if (aiConfig.type === "openai") {
      const openai = aiConfig.client;
      const apiMessages = [
        { role: "system", content: contextualPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      ];
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages
      });
      responseText = response.choices[0].message.content || "";
    } else {
      const ai = aiConfig.client;
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: contextualPrompt
        }
      });
      responseText = response.text || "";
    }
    return res.json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Sohbet i\u015Flemi s\u0131ras\u0131nda bir hata olu\u015Ftu." });
  }
});
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}
init();
//# sourceMappingURL=server.cjs.map
