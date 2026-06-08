import React, { useState, useRef, useEffect } from "react";
import { Check } from "../types";
import { 
  Calendar, 
  Building2, 
  User, 
  Tag, 
  FileText, 
  CheckCircle2, 
  ArrowRightLeft, 
  Trash2, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Share2,
  Edit,
  MoreHorizontal
} from "lucide-react";

interface CheckCardProps {
  key?: string;
  check: Check;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: "pending" | "paid" | "endorsed", details?: string) => void;
  onEdit?: (check: Check) => void;
  onLongPress?: (check: Check) => void;
  onSelect?: (check: Check) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}

export default function CheckCard({ 
  check, 
  onDelete, 
  onStatusChange, 
  onEdit, 
  onLongPress, 
  onSelect, 
  isSelected = false, 
  selectionMode = false 
}: CheckCardProps) {
  const [showEndorseInput, setShowEndorseInput] = useState(false);
  const [endorseTarget, setEndorseTarget] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const pressTimeout = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wasLongPressed = useRef(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startPress = () => {
    wasLongPressed.current = false;
    pressTimeout.current = setTimeout(() => {
      wasLongPressed.current = true;
      if (onLongPress) onLongPress(check);
    }, 500); // 500ms long press
  };

  const endPress = () => {
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current);
    }
  };

  const handleCardClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (wasLongPressed.current) {
      wasLongPressed.current = false;
      return;
    }
    
    if (selectionMode && onSelect) {
      onSelect(check);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = check.status === "pending" && check.dueDate < todayStr;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div 
      id={`check-card-${check.id}`}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onClick={handleCardClick}
      className={`relative bg-white border rounded-xl transition-all duration-300 ${
        isSelected ? "border-indigo-500 shadow-md ring-1 ring-indigo-500" : "border-gray-100 shadow-xs hover:shadow-md hover:border-slate-200"
      } ${selectionMode ? "cursor-pointer" : ""}`}
    >
      {/* Visual Cheque Border Ribbon based on Cheque Type */}
      <div 
        className={`absolute top-0 left-0 w-1.5 h-full rounded-l-xl ${
          check.checkType === "received" ? "bg-emerald-500" : "bg-sky-500"
        }`} 
      />

      {isSelected && (
        <div className="absolute top-3 right-3 z-10 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="p-4 min-h-[182px] border-solid">
        {/* Header containing Bank, Badge and Sum */}
        <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100 min-h-[58px]">
          <div className="flex gap-2.5">
            <span 
              className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${
                check.checkType === "received" 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "bg-sky-50 text-sky-700"
              }`}
              title={check.checkType === "received" ? "Alınan Çek" : "Verilen Çek"}
            >
              {check.checkType === "received" ? (
                <ArrowDownLeft className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
            </span>
            <div className="flex flex-col">
              <h4 className="font-sans font-semibold text-gray-900 flex items-center leading-none text-[13px] mt-0.5">
                {check.bankName}
              </h4>
              <p className="font-mono text-[10px] text-slate-500 font-semibold bg-slate-50 px-1 py-0.5 rounded border border-slate-100 mt-1.5 w-fit">
                S.N: {check.serialNumber || "Belirtilmemiş"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 relative">
            <div className="flex items-center gap-1">
              {check.status === "paid" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Ödendi
                </span>
              )}
              {check.status === "endorsed" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Ciro Edildi
                </span>
              )}
              {check.status === "pending" && !isOverdue && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                  Bekliyor
                </span>
              )}
              {check.status === "pending" && isOverdue && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                  Gecikmiş
                </span>
              )}

              {/* Dropdown menu trigger */}
              {!selectionMode && (
                <div ref={dropdownRef} className="relative ml-0.5 block">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  
                  {showDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 rounded-lg py-1 z-30 text-left">
                      {check.status === "pending" && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowDropdown(false); onStatusChange(check.id, "paid"); }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-emerald-700 font-medium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {check.checkType === "received" ? "Tahsil Edildi" : "Öde"}
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowDropdown(false); setShowEndorseInput(!showEndorseInput); }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-indigo-700 font-medium"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Ciro Et
                          </button>
                        </>
                      )}
                      {(check.status === "paid" || check.status === "endorsed") && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowDropdown(false); onStatusChange(check.id, "pending"); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Geri Al (Bekliyor)
                        </button>
                      )}

                      {onEdit && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowDropdown(false); onEdit(check); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium border-t border-slate-50"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Düzenle
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDropdown(false);
                          if (window.confirm(`${check.bankName} çekini silmek istediğinize emin misiniz?`)) {
                            onDelete(check.id);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Sil
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="font-mono text-base font-bold text-slate-800">
              {formatCurrency(check.amount)}
            </span>
          </div>
        </div>

        {/* Content detail grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-3 text-xs mb-3 text-gray-600">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-400 w-20 shrink-0">
              {check.checkType === "received" ? "Keşideci:" : "Alacaklı:"}
            </span>
            <span className="font-semibold text-gray-800 truncate">{check.customerName}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-400 w-20 shrink-0">Vade:</span>
            <span className={`font-semibold text-xs ${isOverdue ? "text-[#8a2e16] bg-[#f7f0f0] border border-[#f0f3f8] w-[76px] inline-block text-center rounded py-0.5" : "text-gray-800"}`}>
              {formatDate(check.dueDate)}
            </span>
          </div>

          {check.status === "endorsed" && check.givenTo && (
            <div className="flex items-center gap-1.5 md:col-span-2 bg-indigo-50/50 p-2 rounded-md border border-indigo-50 mt-0.5 min-h-[30px]">
               <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
               <span className="text-[10px] text-indigo-700 w-20 shrink-0 font-medium">Ciro Edilen:</span>
               <span className="font-semibold text-indigo-900 truncate">{check.givenTo}</span>
            </div>
          )}

          {check.note && (
             <div className="flex items-start gap-1.5 md:col-span-2 bg-slate-50 p-2 rounded-md border border-slate-100 mt-0.5 min-h-[30px]">
                <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-[10px] text-gray-500 italic leading-relaxed">{check.note}</span>
             </div>
          )}
        </div>

        {/* Card Iteractive Footer is removed, actions shifted to header 3 dots dropdown */}

        {/* Expandable Endorse Input Section */}
        {showEndorseInput && check.status === "pending" && !selectionMode && (
          <div className="mt-3 pt-3 border-t border-dashed border-gray-200" onClick={(e) => e.stopPropagation()}>
            <label className="block text-[11px] font-medium text-gray-700 mb-1.5">
              Ciro Edilen / Teslim Edilen Cari Adı veya Unvanı:
            </label>
            <div className="flex gap-1.5">
              <input
                id={`field-endorse-target-${check.id}`}
                type="text"
                placeholder="Örn: Ege Metal Sanayi"
                value={endorseTarget}
                onChange={(e) => setEndorseTarget(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                id={`btn-confirm-endorse-${check.id}`}
                disabled={!endorseTarget.trim()}
                onClick={() => {
                  onStatusChange(check.id, "endorsed", endorseTarget.trim());
                  setShowEndorseInput(false);
                  setEndorseTarget("");
                }}
                className="px-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-medium rounded-md transition"
              >
                Onayla
              </button>
              <button
                onClick={() => {
                  setShowEndorseInput(false);
                  setEndorseTarget("");
                }}
                className="px-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[11px] font-medium rounded-md transition"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
