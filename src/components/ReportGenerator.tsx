import React, { useState } from "react";
import { Check } from "../types";
import { 
  Download, 
  Printer, 
  Filter, 
  Calendar, 
  Building2, 
  TrendingDown, 
  CheckSquare, 
  Square,
  FileSpreadsheet
} from "lucide-react";

interface ReportGeneratorProps {
  checks: Check[];
}

export default function ReportGenerator({ checks }: ReportGeneratorProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "received" | "given">("given");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "endorsed">("all");
  
  const currentYearStr = new Date().getFullYear().toString();
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const availableYears = Array.from(new Set(checks.map(c => c.dueDate.split("-")[0]))).sort((a, b) => b.localeCompare(a));
  if (!availableYears.includes(currentYearStr)) {
    availableYears.unshift(currentYearStr);
  }
  const uniqueYears = Array.from(new Set(availableYears));

  const months = [
    { val: "01", label: "Ocak" }, { val: "02", label: "Şubat" }, { val: "03", label: "Mart" },
    { val: "04", label: "Nisan" }, { val: "05", label: "Mayıs" }, { val: "06", label: "Haziran" },
    { val: "07", label: "Temmuz" }, { val: "08", label: "Ağustos" }, { val: "09", label: "Eylül" },
    { val: "10", label: "Ekim" }, { val: "11", label: "Kasım" }, { val: "12", label: "Aralık" }
  ];

  const todayStr = new Date().toISOString().split("T")[0];

  // Apply filters to get matching checks
  const filteredChecks = checks.filter((c) => {
    // 1. Type
    if (typeFilter !== "all" && c.checkType !== typeFilter) return false;

    // 2. Status
    if (statusFilter !== "all" && c.status !== statusFilter) return false;

    // 3. Date
    if (filterYear !== "all") {
      const yearStr = c.dueDate.split("-")[0];
      if (yearStr !== filterYear) return false;

      if (filterMonth !== "all") {
        const monthStr = c.dueDate.split("-")[1];
        if (monthStr !== filterMonth) return false;
      }
    }

    return true;
  });

  const totalFilteredAmount = filteredChecks.reduce((sum, c) => sum + c.amount, 0);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Çek Türü",
      "Banka Adı",
      "Müşteri/Keşideci",
      "Seri Numarası",
      "Tutar (TL)",
      "Vade Tarihi",
      "Durum",
      "Açıklama/Not",
      "Ciro Edilen",
      "Kayıt Tarihi"
    ];

    const rows = filteredChecks.map((c) => [
      c.checkType === "received" ? "Alınan" : "Verilen",
      c.bankName,
      c.customerName,
      c.serialNumber || "",
      c.amount.toString(),
      c.dueDate,
      c.status === "pending" ? "Bekliyor" : c.status === "paid" ? "Ödendi" : "Ciro Edildi",
      c.note || "",
      c.givenTo || "",
      c.createdAt
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Cek_Yonetimi_Raporu_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const statusLabel: Record<string, string> = { pending: "Bekleyen", paid: "Ödendi", endorsed: "Arkası Yazıldı" };
    const printContent = `
      <html>
        <head>
          <title>Çek Raporu</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h2 { color: #1e293b; margin-bottom: 10px; }
            .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
            th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
            th { background-color: #f8fafc; color: #475569; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8fafc; }
            @media print {
              @page { margin: 1cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>Çek Raporu</h2>
          <div class="meta">Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")} | Raporlanan Kayıt: ${filteredChecks.length} adet</div>
          <table>
            <thead>
              <tr>
                <th>Tür</th>
                <th>Cari / Müşteri</th>
                <th>Banka</th>
                <th>Seri No</th>
                <th>Tutar</th>
                <th>Vade Tarihi</th>
                <th>Kime Verildi</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${filteredChecks.map(c => `
                <tr>
                  <td>${c.checkType === "received" ? "Alınan" : "Verilen"}</td>
                  <td>${c.customerName}</td>
                  <td>${c.bankName || "-"}</td>
                  <td>${c.serialNumber || "-"}</td>
                  <td>${c.amount.toLocaleString("tr-TR")} TL</td>
                  <td>${c.dueDate.split("-").reverse().join(".")}</td>
                  <td>${c.givenTo || "-"}</td>
                  <td>${statusLabel[c.status]}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      // Delay for styles to apply
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("Lütfen popup engelleyiciyi kapatın ve tekrar deneyin.");
    }
  };

  return (
    <div id="report-generator-container" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-sans font-bold text-lg text-slate-800">Gelişmiş Rapor Üretici</h3>
          <p className="text-sm text-slate-400 mt-1">
            Filtreleme kriterlerinizi belirleyin ve verilerinizi muhasebe sistemleri ile uyumlu Excel/CSV formatında indirin veya yazdırın.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-slate-50 transition rounded-xl text-sm font-semibold text-slate-600"
          >
            <Printer className="w-4 h-4" />
            PDF Rapor Al
          </button>
          
          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 transition rounded-xl text-sm font-semibold text-white shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Rapor Al
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100/50 mb-6">
        {/* Type selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Çek Türü</label>
          <select
            id="select-report-type"
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">Tümü (Giriş & Çıkış)</option>
            <option value="received">Sadece Alınan Çekler</option>
            <option value="given">Sadece Verilen Çekler</option>
          </select>
        </div>

        {/* Status selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Durum</label>
          <select
            id="select-report-status"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="pending">Portföyde (Bekliyor)</option>
            <option value="paid">Müşteri Ödedi / Tahsil Edildi</option>
            <option value="endorsed">Ciro Edildi</option>
          </select>
        </div>

        {/* Date presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zaman Dilimi (Yıl / Ay)</label>
          <div className="flex gap-2">
            <select
              id="select-report-year"
              value={filterYear}
              onChange={(e: any) => {
                setFilterYear(e.target.value);
                if (e.target.value === "all") setFilterMonth("all");
              }}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500"
            >
              <option value="all">Tüm Yıllar</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select
              id="select-report-month"
              value={filterMonth}
              onChange={(e: any) => setFilterMonth(e.target.value)}
              disabled={filterYear === "all"}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="all">Tüm Aylar</option>
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="flex border border-gray-100 rounded-xl overflow-hidden mb-6 divide-x divide-gray-100">
        <div className="flex-1 p-4 text-center">
          <p className="text-xs text-slate-400 font-medium">Filtreye Uyan Çek Adedi</p>
          <h4 className="text-xl font-bold font-mono text-slate-800 mt-1">{filteredChecks.length} adet</h4>
        </div>
        <div className="flex-1 p-4 text-center bg-slate-50/40">
          <p className="text-xs text-slate-400 font-medium">Toplam Tutar</p>
          <h4 className="text-xl font-bold font-mono text-slate-800 mt-1">
            {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalFilteredAmount)}
          </h4>
        </div>
      </div>

      {/* Printable Preview / Table list representation */}
      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Tür</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Banka ve Seri No</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Keşideci / Cari Unvan</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Vade</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Tutar</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredChecks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                  Filtrelere uygun çek bulunamadı.
                </td>
              </tr>
            ) : (
              filteredChecks.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.checkType === "received" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                    }`}>
                      {c.checkType === "received" ? "Alınan" : "Verilen"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{c.bankName}</p>
                    <p className="font-mono text-[10px] text-gray-400">S.N: {c.serialNumber || "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700 truncate max-w-[200px]">{c.customerName}</p>
                    {c.givenTo && <p className="text-[10px] text-indigo-500 font-medium">Ciro: {c.givenTo}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.dueDate.split("-").reverse().join(".")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold font-mono text-slate-800 whitespace-nowrap">
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(c.amount)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.status === "paid" 
                        ? "bg-emerald-100 text-emerald-800"
                        : c.status === "endorsed"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {c.status === "paid" ? "Ödendi" : c.status === "endorsed" ? "Ciro" : "Bekliyor"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dynamic Printing Styles injected on execution */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          /* Hide non-printable panels */
          nav, aside, header, #sidebar, button, #report-generator-container > div:first-child, .no-print {
            display: none !important;
          }
          #report-generator-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
