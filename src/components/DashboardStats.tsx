import React from "react";
import { Check, CheckTotals } from "../types";
import { Wallet, Calendar, CheckSquare } from "lucide-react";

interface DashboardStatsProps {
  totalPendingAmount: number;
  filteredPendingAmount: number;
  selectedAmount: number;
  selectedCount: number;
  filterActive: boolean;
}

export default function DashboardStats({ 
  totalPendingAmount, 
  filteredPendingAmount, 
  selectedAmount, 
  selectedCount, 
  filterActive 
}: DashboardStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Tüm Bekleyenler & Dönem Toplamı */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs flex items-center">
        {/* Sol - Tüm Bekleyen (Büyük) */}
        <div className="flex-1 pr-4 border-r border-gray-100">
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Tüm Bekleyenler
          </p>
          <h3 className="text-xl sm:text-2xl font-bold font-mono text-slate-800">
            {formatCurrency(totalPendingAmount)}
          </h3>
        </div>

        {/* Sağ - Seçili Dönem / Filtre (Daha Küçük) */}
        <div className="flex-[0.7] pl-4">
          <p className={`text-[10px] font-semibold tracking-wider uppercase mb-1 flex items-center gap-1.5 ${filterActive ? 'text-indigo-500' : 'text-slate-400'}`}>
            <Calendar className="w-3.5 h-3.5" /> {filterActive ? "Filtreli Dönem" : "Dönem Toplamı"}
          </p>
          <h3 className={`text-base sm:text-lg font-bold font-mono ${filterActive ? "text-indigo-600" : "text-slate-600"}`}>
            {formatCurrency(filteredPendingAmount)}
          </h3>
        </div>
      </div>
    </div>
  );
}
