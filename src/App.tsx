import SettingsView from "./components/SettingsView";
import React, { useState, useEffect, useMemo } from "react";
import { Check, CheckTotals } from "./types";
import { sampleChecks } from "./sampleData";
import DashboardStats from "./components/DashboardStats";
import CheckCard from "./components/CheckCard";
import AddCheckModal from "./components/AddCheckModal";
import ReportGenerator from "./components/ReportGenerator";
import AIChatBot from "./components/AIChatBot";
import { 
  Plus, 
  Search, 
  Filter, 
  Settings, 
  FileSpreadsheet, 
  Bot, 
  Grid, 
  Wallet, 
  RefreshCw, 
  ArrowRightLeft, 
  Calendar,
  Sparkles,
  Info,
  Building,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  ChevronRight,
  X,
  CheckSquare,
  Archive,
  ListTodo
} from "lucide-react";

export default function App() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "archive" | "reports" | "ai" | "settings">("dashboard");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "received" | "given">("given");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "endorsed" | "overdue">("overdue");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCheckIds, setSelectedCheckIds] = useState<Set<string>>(new Set());

  // Settings page textboxes
  const [backupJsonStr, setBackupJsonStr] = useState("");
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [restoreJsonStr, setRestoreJsonStr] = useState("");
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const STORAGE_KEY = "@cek_yonetimi_v1";

  // 1. Initial State Load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setChecks(parsed);
        } else {
          setChecks(sampleChecks);
        }
      } else {
        // Load realistic sample checks if nothing is configured
        setChecks(sampleChecks);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleChecks));
      }
    } catch {
      setChecks(sampleChecks);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save updates to storage
  const saveToStorage = (updatedChecks: Check[]) => {
    setChecks(updatedChecks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedChecks));
    // Reset backup state representation
    setBackupJsonStr(JSON.stringify(updatedChecks, null, 2));
  };

  // 2. State Actions (Mirroring Mobile App rules precisely)
  const handleAddCheck = (newCheckData: Omit<Check, "id" | "createdAt">) => {
    // Normalization & Duplicate checks
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const existingMatch = checks.find((c) => 
      c.status === "pending" &&
      Math.abs(c.amount - newCheckData.amount) < 0.01 &&
      c.dueDate === newCheckData.dueDate &&
      normalize(c.customerName) === normalize(newCheckData.customerName) &&
      (!newCheckData.serialNumber || !c.serialNumber || c.serialNumber === newCheckData.serialNumber)
    );

    if (existingMatch) {
      // Return details to trigger warning
      return { isDuplicate: true, existing: existingMatch };
    }

    const brandNewCheck: Check = {
      ...newCheckData,
      id: "check-" + Date.now().toString(),
      createdAt: new Date().toISOString().split("T")[0]
    };

    saveToStorage([brandNewCheck, ...checks]);
    return { isDuplicate: false };
  };

  const handleForceAddCheck = (newCheckData: Omit<Check, "id" | "createdAt">) => {
    const brandNewCheck: Check = {
      ...newCheckData,
      id: "check-" + Date.now().toString(),
      createdAt: new Date().toISOString().split("T")[0]
    };
    saveToStorage([brandNewCheck, ...checks]);
  };

  const handleEditCheckSubmit = (updatedCheck: Check) => {
    const updated = checks.map(c => c.id === updatedCheck.id ? updatedCheck : c);
    saveToStorage(updated);
    setEditingCheck(null);
  };

  const handleDeleteCheck = (id: string) => {
    const updated = checks.filter((c) => c.id !== id);
    saveToStorage(updated);
  };

  const handleStatusChange = (id: string, newStatus: "pending" | "paid" | "endorsed", details?: string) => {
    const updated = checks.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          status: newStatus,
          givenTo: newStatus === "endorsed" ? details : c.givenTo
        };
      }
      return c;
    });
    saveToStorage(updated);
  };

  // Selection Logic
  const handleLongPress = (check: Check) => {
    if (!selectionMode) {
      setSelectionMode(true);
      const newSet = new Set(selectedCheckIds);
      newSet.add(check.id);
      setSelectedCheckIds(newSet);
    }
  };

  const handleSelect = (check: Check) => {
    const newSet = new Set(selectedCheckIds);
    if (newSet.has(check.id)) {
      newSet.delete(check.id);
      if (newSet.size === 0) setSelectionMode(false);
    } else {
      newSet.add(check.id);
    }
    setSelectedCheckIds(newSet);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedCheckIds(new Set());
  };

  // Reset database state back to sample checks or empty
  const handleResetSampleData = () => {
    if (window.confirm("Portföyü örnek verilerle doldurmak istiyor musunuz? Mevcut tüm verileriniz silinecektir!")) {
      saveToStorage(sampleChecks);
    }
  };

  const handleClearAllData = () => {
    if (window.confirm("Portföyünüzü tamamen sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
      saveToStorage([]);
    }
  };

  // Filter Options Setup
  const availableYears = useMemo(() => {
    const years = new Set(checks.map(c => c.dueDate.split("-")[0]));
    return Array.from(years).sort().reverse();
  }, [checks]);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", 
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  // 4. Searching & Filtering
  const homeChecks = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const q = searchQuery.toLowerCase().trim();
    return checks.filter((c) => {
      // Only Pending and non-overdue
      if (c.status !== "pending" || c.dueDate < todayStr) return false;
      
      const checkYear = c.dueDate.split("-")[0];
      const checkMonth = c.dueDate.split("-")[1];
      if (yearFilter !== "all" && checkYear !== yearFilter) return false;
      if (monthFilter !== "all" && checkMonth !== monthFilter) return false;

      if (q) {
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesBank = c.bankName.toLowerCase().includes(q);
        const matchesSerial = c.serialNumber?.toLowerCase().includes(q) || false;
        const matchesNote = c.note?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesBank && !matchesSerial && !matchesNote) {
          return false;
        }
      }
      return true;
    });
  }, [checks, searchQuery, yearFilter, monthFilter]);

  const filteredChecks = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const q = searchQuery.toLowerCase().trim();

    return checks.filter((c) => {
      // 1. Search Query parsing
      if (q) {
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesBank = c.bankName.toLowerCase().includes(q);
        const matchesSerial = c.serialNumber?.toLowerCase().includes(q) || false;
        const matchesNote = c.note?.toLowerCase().includes(q) || false;

        if (!matchesName && !matchesBank && !matchesSerial && !matchesNote) {
          return false;
        }
      }

      // 2. Type Filter
      if (typeFilter !== "all" && c.checkType !== typeFilter) {
        return false;
      }

      // 3. Status Filter (including overdue logic)
      if (statusFilter === "overdue") {
        if (c.status !== "pending" || c.dueDate >= todayStr) return false;
      } else if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }

      // 4. Date Filters
      const [y, m, d] = c.dueDate.split("-");
      if (yearFilter !== "all" && y !== yearFilter) return false;
      if (monthFilter !== "all" && parseInt(m, 10).toString() !== monthFilter) return false;

      return true;
    });
  }, [checks, searchQuery, typeFilter, statusFilter, yearFilter, monthFilter]);

  // Derived Stats
  const { totalPendingAmount, filteredPendingAmount, selectedAmount, selectedCount, filterActive } = useMemo(() => {
    let tPending = 0;
    checks.forEach(c => {
      if (c.status === "pending") tPending += c.amount;
    });

    let fPending = 0;
    const currentList = activeTab === "dashboard" ? homeChecks : filteredChecks;
    currentList.forEach(c => {
      if (c.status === "pending") fPending += c.amount;
    });

    let sAmount = 0;
    selectedCheckIds.forEach(id => {
      const ch = checks.find(c => c.id === id);
      if (ch) sAmount += ch.amount;
    });

    const isFilterActive = activeTab === "dashboard" ? (searchQuery !== "" || yearFilter !== "all" || monthFilter !== "all") : (yearFilter !== "all" || monthFilter !== "all" || typeFilter !== "all" || statusFilter !== "all" || searchQuery !== "");

    return {
      totalPendingAmount: tPending,
      filteredPendingAmount: fPending,
      selectedAmount: sAmount,
      selectedCount: selectedCheckIds.size,
      filterActive: isFilterActive
    };
  }, [checks, homeChecks, filteredChecks, selectedCheckIds, yearFilter, monthFilter, typeFilter, statusFilter, searchQuery, activeTab]);


  // 5. Backup & Restore logic
  const handleBackupGenerate = () => {
    setBackupJsonStr(JSON.stringify(checks, null, 2));
  };

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(backupJsonStr);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleRestoreImport = () => {
    setRestoreError("");
    setRestoreSuccess(false);

    try {
      const parsed = JSON.parse(restoreJsonStr);
      if (Array.isArray(parsed)) {
        // Simple type verification
        const isValid = parsed.every((item) => 
          item.bankName && 
          item.customerName && 
          typeof item.amount === "number" &&
          item.dueDate
        );

        if (isValid) {
          saveToStorage(parsed);
          setRestoreSuccess(true);
          setRestoreJsonStr("");
        } else {
          setRestoreError("Yüklenen şablon geçersiz çek formatına sahip.");
        }
      } else {
        setRestoreError("Girdiğiniz veri geçerli bir JSON dizisi olmalıdır.");
      }
    } catch (err: any) {
      setRestoreError("JSON ayrıştırma hatası: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24 md:pb-28">
      {/* Sticky Selection Banner */}
      {selectionMode && selectedCount > 0 && (
        <div className="sticky top-0 z-50 bg-emerald-600 border-b border-emerald-700 px-4 py-3 shadow-lg flex items-center justify-between transition-all animate-in slide-in-from-top-2 text-white">
          <div className="flex items-center gap-3">
             <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/50">
               <CheckSquare className="w-4 h-4" />
             </span>
             <div>
                <p className="text-[10px] sm:text-xs font-bold tracking-wider uppercase opacity-90 text-emerald-50">
                  {selectedCount} Çek Seçili
                </p>
                <h3 className="text-lg sm:text-xl font-bold font-mono mt-0.5 leading-none">
                  {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(selectedAmount)}
                </h3>
             </div>
          </div>
          <button 
            onClick={exitSelectionMode}
            className="p-2 hover:bg-emerald-500/50 rounded-xl transition flex items-center justify-center"
            title="Seçim modundan çık"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Statistics Dashboard always visible on top of panels */}
        <DashboardStats 
          totalPendingAmount={totalPendingAmount}
          filteredPendingAmount={filteredPendingAmount}
          selectedAmount={selectedAmount}
          selectedCount={selectedCount}
          filterActive={filterActive}
        />

        {/* Action Tabs Panel Navigation Moved to Fixed Bottom */}

        {/* Tab Items Panel Renderers */}
        <div className="transition-all duration-300">
          
          {/* TAB 1: DASHBOARD PORTFOLIO LIST OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Searching and Filter Actions Panel */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
                
                <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                  {/* Search Bar Input */}
                  <div className="relative w-full md:flex-1 flex items-center border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-slate-500 bg-slate-50/50 px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
                    <input
                      type="text"
                      placeholder="Banka, müşteri, mülk sahibi veya seri numarası ile arayın..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm bg-transparent focus:outline-none placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="text-xs text-gray-400 hover:text-slate-600 font-bold px-1"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full">
                  <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-2 py-1 flex-1 md:flex-none">
                    <Calendar className="w-4 h-4 text-slate-400 ml-1" />
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 focus:outline-none focus:ring-0 cursor-pointer min-w-[90px]"
                    >
                      <option value="all">Tüm Yıllar</option>
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>

                    <div className="w-px h-4 bg-gray-300 mx-1"></div>

                    <select
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 focus:outline-none focus:ring-0 cursor-pointer min-w-[100px]"
                    >
                      <option value="all">Tüm Aylar</option>
                      {monthNames.map((m, i) => {
                        const mStr = (i + 1).toString().padStart(2, "0");
                        return <option key={mStr} value={mStr}>{m}</option>
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Core Cheques Grid */}
              {loading ? (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                  <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">Veri portföyü yükleniyor...</p>
                </div>
              ) : homeChecks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100 px-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <h4 className="font-sans font-bold text-slate-800 text-sm">Bekleyen Çek Bulunamadı</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                    Şu anda günü gelmemiş bekleyen çekiniz bulunmuyor. Yeni bir çek ekleyebilir veya Çek Özeti sayfasından diğer çeklerinizi görüntüleyebilirsiniz.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                    }}
                    className="mt-4 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg transition duration-200"
                  >
                    Aramayı Temizle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {homeChecks.map((item) => (
                    <CheckCard
                      key={item.id}
                      check={item}
                      onDelete={handleDeleteCheck}
                      onStatusChange={handleStatusChange}
                      onEdit={setEditingCheck}
                      onLongPress={handleLongPress}
                      onSelect={handleSelect}
                      selectionMode={selectionMode}
                      isSelected={selectedCheckIds.has(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB ARCHIVE: HISTORY & FILTER MASTER LIST */}
          {activeTab === "archive" && (
            <div className="space-y-6">
              
              {/* Searching and Filter Actions Panel */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
                
                <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                  {/* Search Bar Input */}
                  <div className="relative w-full md:flex-1 flex items-center border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-slate-500 bg-slate-50/50 px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
                    <input
                      type="text"
                      placeholder="Banka, müşteri, mülk sahibi veya seri numarası ile arayın..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm bg-transparent focus:outline-none placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="text-xs text-gray-400 hover:text-slate-600 font-bold px-1"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 w-full">
                  {/* Select Received vs Given */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setTypeFilter("all")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        typeFilter === "all" ? "bg-white text-slate-800 shadow-3xs" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Tümü
                    </button>
                    <button
                      onClick={() => setTypeFilter("received")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        typeFilter === "received" ? "bg-white text-emerald-700 shadow-3xs" : "text-slate-500 hover:text-emerald-700"
                      }`}
                    >
                      Alınan
                    </button>
                    <button
                      onClick={() => setTypeFilter("given")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        typeFilter === "given" ? "bg-white text-sky-700 shadow-3xs" : "text-slate-500 hover:text-sky-700"
                      }`}
                    >
                      Verilen
                    </button>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 shadow-3xs hover:bg-slate-50 transition min-h-[34px]"
                  >
                    <option value="all">Tüm Durumlar</option>
                    <option value="pending">Sadece Bekleyen Çekler</option>
                    <option value="overdue">Sadece Vadesi Geçmiş Çekler</option>
                    <option value="paid">Sadece Ödenen/Kapatılanlar</option>
                    <option value="endorsed">Sadece Ciro Edilenler</option>
                  </select>

                  {/* Year Filter */}
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 shadow-3xs hover:bg-slate-50 transition min-h-[34px]"
                  >
                    <option value="all">Tüm Yıllar</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  {/* Month Filter */}
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 shadow-3xs hover:bg-slate-50 transition min-h-[34px]"
                  >
                    <option value="all">Tüm Aylar</option>
                    {monthNames.map((m, i) => (
                      <option key={i+1} value={(i+1).toString()}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Core Cheques Grid */}
              {loading ?
                <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                  <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">Veri portföyü yükleniyor...</p>
                </div>
              : filteredChecks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100 px-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-sans font-bold text-slate-800 text-sm">Filtrelere Uygun Çek Bulunamadı</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                    Aradığınız arama kriterlerine uygun çek bulunamadı. Filtreleri temizleyebilir veya yeni bir çek katarak başlayabilirsiniz.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setYearFilter("all");
                      setMonthFilter("all");
                    }}
                    className="mt-4 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg transition duration-200"
                  >
                    Tüm Filtreleri Sıfırla
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredChecks.map((item) => (
                    <CheckCard
                      key={item.id}
                      check={item}
                      onDelete={handleDeleteCheck}
                      onStatusChange={handleStatusChange}
                      onEdit={setEditingCheck}
                      onLongPress={handleLongPress}
                      onSelect={handleSelect}
                      selectionMode={selectionMode}
                      isSelected={selectedCheckIds.has(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REPORTS VIEW FRAME */}
          {activeTab === "reports" && (
            <ReportGenerator checks={checks} />
          )}

          {/* TAB 3: CONTEXT AI CHATBOT FRAME */}
          {activeTab === "ai" && (
            <AIChatBot checks={checks} />
          )}

          {/* TAB 4: SYSTEM SETTINGS WITH EXPORT RESTORE */}
          {activeTab === "settings" && (
            <SettingsView checks={checks} setChecks={setChecks} />
          )}

        </div>
      </main>

      {/* Bottom Action Tabs Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-2 pt-2 pb-5 sm:pb-4 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <div className="max-w-xl mx-auto flex items-end justify-between gap-1 relative">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pb-1 pt-2 px-1 text-[10px] sm:text-xs font-bold rounded-2xl transition ${
              activeTab === "dashboard"
                ? "text-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Grid className={`w-6 h-6 sm:w-7 sm:h-7 ${activeTab === "dashboard" ? "hidden" : "block"}`} />
            <Grid className={`w-6 h-6 sm:w-7 sm:h-7 bg-slate-800 text-white p-1 rounded-lg ${activeTab === "dashboard" ? "block" : "hidden"}`} />
            <span className="truncate">Ana Sayfa</span>
          </button>
          
          <button
            onClick={() => setActiveTab("archive")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pb-1 pt-2 px-1 text-[10px] sm:text-xs font-bold rounded-2xl transition ${
              activeTab === "archive"
                ? "text-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Archive className={`w-6 h-6 sm:w-7 sm:h-7 ${activeTab === "archive" ? "hidden" : "block"}`} />
            <Archive className={`w-6 h-6 sm:w-7 sm:h-7 bg-slate-800 text-white p-1 rounded-lg ${activeTab === "archive" ? "block" : "hidden"}`} />
            <span className="truncate">Çek Özeti</span>
          </button>

          {/* Central Add Button */}
          <div className="relative flex-[0.8] sm:flex-1 flex justify-center -top-5 sm:-top-6 z-50">
             <button
               onClick={() => setIsAddModalOpen(true)}
               className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 text-white rounded-full shadow-lg shadow-slate-800/30 hover:bg-slate-900 transition-transform active:scale-95 border-4 border-slate-50"
             >
                <Plus className="w-8 h-8 sm:w-9 sm:h-9" />
             </button>
          </div>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pb-1 pt-2 px-1 text-[10px] sm:text-xs font-bold rounded-2xl transition ${
              activeTab === "reports"
                ? "text-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FileSpreadsheet className={`w-6 h-6 sm:w-7 sm:h-7 ${activeTab === "reports" ? "hidden" : "block"}`} />
            <FileSpreadsheet className={`w-6 h-6 sm:w-7 sm:h-7 bg-slate-800 text-white p-1 rounded-lg ${activeTab === "reports" ? "block" : "hidden"}`} />
            <span className="truncate">Raporlar</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pb-1 pt-2 px-1 text-[10px] sm:text-xs font-bold rounded-2xl transition ${
              activeTab === "settings"
                ? "text-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings className={`w-6 h-6 sm:w-7 sm:h-7 ${activeTab === "settings" ? "hidden" : "block"}`} />
            <Settings className={`w-6 h-6 sm:w-7 sm:h-7 bg-slate-800 text-white p-1 rounded-lg ${activeTab === "settings" ? "block" : "hidden"}`} />
            <span className="truncate">Ayarlar</span>
          </button>
        </div>
      </div>

      {/* Sliding Dialog Modal Component wrapper for ADD & EDIT */}
      <AddCheckModal
        isOpen={isAddModalOpen || !!editingCheck}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCheck(null);
        }}
        onAdd={handleAddCheck}
        onForceAdd={handleForceAddCheck}
        editCheck={editingCheck}
        onEditSubmit={handleEditCheckSubmit}
      />

      {/* Visual Elegant Footer */}
      <footer className="bg-white border-t border-gray-100 mt-auto py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-medium">Akıllı Çek Yönetim Paneli — Her Hak Saklıdır © 2026</p>
          <p className="font-mono text-[10px] text-gray-400 mt-1">Sistem Portu: 3000 | Companion Engine V1.0</p>
        </div>
      </footer>
    </div>
  );
}
