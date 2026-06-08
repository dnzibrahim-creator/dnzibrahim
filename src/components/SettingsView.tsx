import React, { useState, useEffect, useRef } from "react";
import { Download, Upload, Trash2, Key, MonitorSmartphone, Monitor, Moon, Sun, Cloud, HardDrive, ShieldAlert } from "lucide-react";
import { Check } from "../types";

interface SettingsViewProps {
  checks: Check[];
  setChecks: React.Dispatch<React.SetStateAction<Check[]>>;
}

export default function SettingsView({ checks, setChecks }: SettingsViewProps) {
  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // AI Settings State
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">("gemini");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeySaved, setAiKeySaved] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On mount, load settings from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("appTheme") as "light" | "dark";
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");

    const savedProvider = localStorage.getItem("aiProvider") as "gemini" | "openai";
    if (savedProvider) setAiProvider(savedProvider);

    const savedKey = localStorage.getItem("aiApiKey");
    if (savedKey) setAiApiKey(savedKey);
  }, []);

  // Theme toggle side effect
  useEffect(() => {
    localStorage.setItem("appTheme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const saveAiSettings = () => {
    localStorage.setItem("aiProvider", aiProvider);
    localStorage.setItem("aiApiKey", aiApiKey);
    setAiKeySaved(true);
    setTimeout(() => setAiKeySaved(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(checks, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `cek_portfoy_yedek_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        if (Array.isArray(jsonData)) {
          // Simple validation
          if (jsonData.length > 0 && !jsonData[0].id) {
            alert("Geçersiz yedek dosyası formatı!");
            return;
          }
          if (window.confirm(`${jsonData.length} adet çek verisi içe aktarılacak. Mevcut verilerin üstüne mi yazılsın (Tamam), eklensin mi (İptal)?`)) {
            setChecks(jsonData);
          } else {
            setChecks(prev => [...prev, ...jsonData]);
          }
          alert("Veriler başarıyla içe aktarıldı!");
        }
      } catch (err) {
        alert("Dosya okunamadı. Geçerli bir JSON dosyası yükleyin.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAll = () => {
    if (window.confirm("DİKKAT: Tüm çek verileriniz kalıcı olarak silinecektir. Emin misiniz?")) {
      if (window.confirm("Bu işlem GERİ ALINAMAZ. Son kez onaylıyor musunuz?")) {
        setChecks([]);
        localStorage.removeItem("checksData");
        alert("Tüm veriler temizlendi.");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      
      {/* Görünüm ve Tema Ayarları */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-2xs">
        <h3 className="font-sans font-bold text-lg text-slate-800 mb-1">Görünüm Ayarları</h3>
        <p className="text-sm text-slate-400 mb-6">Uygulamanın arayüz temasını kişiselleştirin.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <button 
            onClick={() => setTheme("light")}
            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition ${theme === "light" ? "border-slate-800 bg-slate-50 ring-2 ring-slate-800/10" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
          >
            <Sun className="w-8 h-8 mb-2 text-amber-500" />
            <span className="text-sm font-semibold text-slate-700">Açık Tema</span>
          </button>
          
          <button 
            onClick={() => setTheme("dark")}
            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition ${theme === "dark" ? "border-slate-800 bg-slate-800 text-white ring-2 ring-slate-800/50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
          >
            <Moon className="w-8 h-8 mb-2 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-700">Koyu Tema</span>
          </button>
        </div>
      </div>

      {/* Yapay Zeka Ayarları */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-2xs">
        <h3 className="font-sans font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-indigo-500" />
          Yapay Zeka (AI) Tercihleri
        </h3>
        <p className="text-sm text-slate-400 mb-6">Analiz ve chatbot işlemleri için kullanmak istediğiniz AI modelini ve kişisel API anahtarınızı girin.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">AI Sağlayıcısı</label>
            <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-xs">
              <button
                onClick={() => setAiProvider("gemini")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${aiProvider === "gemini" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Google Gemini
              </button>
              <button
                onClick={() => setAiProvider("openai")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${aiProvider === "openai" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                OpenAI (GPT)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-slate-400" />
              API Anahtarı ({aiProvider === "gemini" ? "Gemini API Key" : "OpenAI Secret Key"})
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 font-mono"
            />
            <p className="text-xs text-slate-400 mt-2 max-w-md">
              Girdiğiniz anahtar sadece sizin tarayıcınıza (local storage) kaydedilir ve güvenle sistem yöneticimize sunucudan proxylenerek iletilir. Sunucuda saklanmaz.
            </p>
          </div>

          <div>
            <button
              onClick={saveAiSettings}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${aiKeySaved ? "bg-emerald-600 text-white" : "bg-slate-800 text-white hover:bg-slate-900"}`}
            >
              {aiKeySaved ? "Ayarlar Kaydedildi ✓" : "AI Ayarlarını Kaydet"}
            </button>
          </div>
        </div>
      </div>

      {/* Veri Yönetimi & Yedekleme */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-2xs">
        <h3 className="font-sans font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-blue-500" />
          Veri Yönetimi ve Yedekleme
        </h3>
        <p className="text-sm text-slate-400 mb-6">Mevcut çek verilerinizi cihazınıza veya buluta kaydedin.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="p-4 border border-gray-100 rounded-xl bg-slate-50">
            <h4 className="font-semibold text-sm text-slate-700 mb-2">Cihaza Kaydet / Yükle</h4>
            <div className="space-y-3">
              <button
                onClick={handleExportJson}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 transition rounded-lg text-sm text-slate-700 shadow-sm"
              >
                <Download className="w-4 h-4" /> Portföyü Telefona/PC'ye İndir
              </button>
              
              <div>
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImportJson} 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 transition rounded-lg text-sm text-slate-700 shadow-sm"
                >
                  <Upload className="w-4 h-4" /> Yedek Dosyasını Yükle
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-red-100">
          <h4 className="font-semibold text-sm text-red-600 mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Tehlikeli Bölge
          </h4>
          <p className="text-xs text-slate-400 mb-3">Tüm çek verilerinizi sistemden kalıcı olarak silmek istiyorsanız bu butonu kullanın.</p>
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition rounded-xl"
          >
            <Trash2 className="w-4 h-4" /> Diğer Verileri Sil
          </button>
        </div>

      </div>

    </div>
  );
}
