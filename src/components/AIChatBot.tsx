import React, { useState, useRef, useEffect } from "react";
import { Check, AIMessage } from "../types";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Trash2, 
  Lightbulb, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface AIChatBotProps {
  checks: Check[];
}

export default function AIChatBot({ checks }: AIChatBotProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Merhabalar! Ben Çek Yönetimi Yapay Zeka Finans Asistanınızım. Portföyünüzdeki çeklerin analizini yapabilir, nakit akışınızı optimize etmeniz için tavsiyelerde bulunabilir veya vade tarihleri hakkında özet rapor hazırlayabilirim.\n\nAşağıdaki akıllı butonları kullanarak veya doğrudan sorunuzu yazarak başlayabilirsiniz!",
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const provider = localStorage.getItem("aiProvider") || "gemini";
      const customApiKey = localStorage.getItem("aiApiKey") || "";

      // Build previous message parameters matching standard model structure
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content
      }));

      // Post to our server endpoint which has the Gemini / OpenAI client
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          contextData: checks,
          provider,
          customApiKey
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sunucuyla bağlantı kurulamadı.");
      }

      const botMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Özür dilerim, bu soruya şu an tam bir yanıt oluşturamadım.",
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      const errorMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Hata oluştu: ${error.message || "Lütfen internet bağlantınızı ve Gemini API Anahtarınızı kontrol edip tekrar deneyin."}`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Sohbet geçmişini sıfırlamak istiyor musunuz?")) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Sohbet geçmişi temizlendi. Çeklerinizle ilgili yeni analiz taleplerinizi bekliyorum!",
          timestamp: Date.now()
        }
      ]);
    }
  };

  const PRESET_PROMPTS = [
    {
      label: "Portföy Özet Analizi Yap",
      query: "Portföyümün özet finansal durumunu analiz et, nakit akışımı yorumla."
    },
    {
      label: "Vadesi Geçmiş Çekler ve Risk",
      query: "Vadesi geçmiş çeklerim var mı? Tahsilat riskim nedir?"
    },
    {
      label: "Bu Ayın Ödeme Takvimi",
      query: "Bu ay vadesi gelen çekleri ve toplam ödeme planını listele."
    },
    {
      label: "Nakit Akışı Kestirimleri",
      query: "Nakit akışımı daha dengeli yönetmek için bana 3 stratejik tavsiye ver."
    }
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col h-[650px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
            <Bot className="w-5.5 h-5.5" />
          </span>
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm leading-none flex items-center gap-1.5">
              Akıllı Finans Danışmanı
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">Yapay zeka portföyünüzü anlık analiz eder ve yönlendirir.</p>
          </div>
        </div>

        <button
          id="btn-clear-chat"
          onClick={handleClearHistory}
          title="Geçmişi Temizle"
          className="p-2 border border-gray-100 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 px-2 py-1 scrollbar-thin">
        {messages.map((m) => (
          <div 
            key={m.id}
            className={`flex gap-3 max-w-[85%] ${
              m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold leading-none shrink-0 ${
              m.role === "user" ? "bg-slate-800 text-white" : "bg-indigo-50 text-indigo-700"
            }`}>
              {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </span>

            <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
              m.role === "user" 
                ? "bg-slate-800 text-white rounded-tr-none" 
                : "bg-slate-50 border border-slate-100/50 text-slate-800 rounded-tl-none"
            }`}>
              {/* Render dynamic linebreaks neatly */}
              {m.content.split("\n").map((line, i) => (
                <p key={i} className={line === "" ? "h-2" : "mb-1"}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 mr-auto max-w-[80%]">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </span>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-500 italic flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              Yapay Zeka portföyü inceliyor...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Preset quick actions */}
      <div className="my-4 pt-3 border-t border-gray-100/50">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2 flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Hızlı Analiz Şablonları
        </p>
        <div className="flex flex-wrap gap-2.5">
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              id={`btn-preset-chat-${idx}`}
              onClick={() => handleSendMessage(preset.query)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-100 transition flex items-center gap-1"
            >
              {preset.label}
              <ArrowRight className="w-3 h-3 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Input Form submission */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="flex gap-2 pt-2"
      >
        <input
          id="field-chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Yapay zekaya portföyünüz hakkında soru sorun..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 placeholder-gray-400 bg-slate-50/50"
        />
        <button
          id="btn-send-chat"
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 transition text-white rounded-xl shadow-xs flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
