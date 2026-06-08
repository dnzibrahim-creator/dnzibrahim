import React, { useState, useRef, useEffect } from "react";
import { Check } from "../types";
import { bankList } from "../sampleData";
import { 
  X, 
  Sparkles, 
  Upload, 
  HelpCircle, 
  CheckCircle, 
  Building2, 
  AlertCircle,
  FileImage,
  Coins,
  Camera,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "../utils/cropUtils";

interface AddCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newCheck: Omit<Check, "id" | "createdAt">) => { isDuplicate: boolean; existing?: Check };
  onForceAdd: (newCheck: Omit<Check, "id" | "createdAt">) => void;
  editCheck?: Check | null;
  onEditSubmit?: (updatedCheck: Check) => void;
}

// Sample base64 for a Turkish check invoice to make it easy to test
const SAMPLE_MOCK_CHECK_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`; 

export default function AddCheckModal({ isOpen, onClose, onAdd, onForceAdd, editCheck, onEditSubmit }: AddCheckModalProps) {
  // Form fields
  const [checkType, setCheckType] = useState<"received" | "given">("given");
  const [bankName, setBankName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [givenTo, setGivenTo] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // AI Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [activeImageMode, setActiveImageMode] = useState<"none" | "ai" | "attachment">("none");
  
  const fileInputRefAI = useRef<HTMLInputElement>(null);
  const cameraInputRefAI = useRef<HTMLInputElement>(null);
  const fileInputRefAttach = useRef<HTMLInputElement>(null);
  const cameraInputRefAttach = useRef<HTMLInputElement>(null);

  // Crop states
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropTarget, setCropTarget] = useState<"ai" | "attachment" | null>(null);

  // Auto-complete state
  const [customBanks, setCustomBanks] = useState<string[]>(bankList);
  const [customerHistory, setCustomerHistory] = useState<string[]>([]);
  const [givenToHistory, setGivenToHistory] = useState<string[]>([]);
  
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showGivenToDropdown, setShowGivenToDropdown] = useState(false);

  const filteredBanks = bankName 
    ? customBanks.filter((b) => b.toLowerCase().includes(bankName.toLowerCase())) 
    : customBanks;

  const filteredCustomers = customerName
    ? customerHistory.filter((c) => c.toLowerCase().includes(customerName.toLowerCase()))
    : customerHistory;

  const filteredGivenTo = givenTo
    ? givenToHistory.filter((g) => g.toLowerCase().includes(givenTo.toLowerCase()))
    : givenToHistory;

  // Duplicate checks state
  const [duplicateCheck, setDuplicateCheck] = useState<Check | null>(null);
  const [pendingCheckData, setPendingCheckData] = useState<any>(null);

  useEffect(() => {
    const savedBanks = localStorage.getItem("customBanks");
    if (savedBanks) setCustomBanks(JSON.parse(savedBanks));

    const savedCustomers = localStorage.getItem("customerHistory");
    if (savedCustomers) setCustomerHistory(JSON.parse(savedCustomers));

    const savedGivenTo = localStorage.getItem("givenToHistory");
    if (savedGivenTo) setGivenToHistory(JSON.parse(savedGivenTo));
  }, []);

  const updateHistories = (bank: string, cust: string, given: string) => {
    if (bank && !customBanks.includes(bank)) {
      const newBanks = [...customBanks, bank];
      setCustomBanks(newBanks);
      localStorage.setItem("customBanks", JSON.stringify(newBanks));
    }
    if (cust && !customerHistory.includes(cust)) {
      const newCustomers = [cust, ...customerHistory].slice(0, 50);
      setCustomerHistory(newCustomers);
      localStorage.setItem("customerHistory", JSON.stringify(newCustomers));
    }
    if (given && !givenToHistory.includes(given)) {
      const newGiven = [given, ...givenToHistory].slice(0, 50);
      setGivenToHistory(newGiven);
      localStorage.setItem("givenToHistory", JSON.stringify(newGiven));
    }
  };

  useEffect(() => {
    if (editCheck && isOpen) {
      setCheckType(editCheck.checkType);
      setBankName(editCheck.bankName);
      setCustomerName(editCheck.customerName);
      setSerialNumber(editCheck.serialNumber || "");
      setAmountStr(
        new Intl.NumberFormat("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(editCheck.amount)
      );
      setDueDate(editCheck.dueDate);
      setNote(editCheck.note || "");
      setGivenTo(editCheck.givenTo || "");
      setAttachedImage(editCheck.imageUri || null);
      setDuplicateCheck(null);
    } else if (isOpen) {
      resetForm();
    }
  }, [editCheck, isOpen]);

  if (!isOpen) return null;

  // Helper to format currency on input
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    if (!rawVal) {
      setAmountStr("");
      return;
    }
    const amountVal = parseFloat(rawVal) / 100;
    setAmountStr(
      new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amountVal)
    );
  };

  const parseFormattedAmount = (str: string): number => {
    // Converts e.g. "1.450,20" to 1450.2
    const normalized = str.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized) || 0;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "ai" | "attachment") => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropTarget(target);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropFinish = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      setCropImageSrc(null); // close cropper
      setAttachedImage(croppedImageBase64);
      
      if (cropTarget === "ai") {
        triggerAIScan(croppedImageBase64);
      }
    } catch (e) {
      console.error(e);
      setScanError("Kırpma işleminde hata oluştu.");
      setCropImageSrc(null);
    }
  };

  const triggerAIScan = async (base64String: string) => {
    setIsScanning(true);
    setScanResult(null);
    setScanError("");

    try {
      const provider = localStorage.getItem("aiProvider") || "gemini";
      const customApiKey = localStorage.getItem("aiApiKey") || "";

      const response = await fetch("/api/gemini/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image: base64String, provider, customApiKey }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Görsel taranamadı.");
      }

      if (data.result) {
        const item = data.result;
        setScanResult(item);

        // Autofill form
        if (item.bankName) setBankName(item.bankName);
        if (item.customerName) setCustomerName(item.customerName);
        if (item.serialNumber) setSerialNumber(item.serialNumber);
        if (item.dueDate) setDueDate(item.dueDate);
        if (item.note) setNote(item.note);
        if (item.amount) {
          setAmountStr(
            new Intl.NumberFormat("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(item.amount)
          );
        }
      } else {
        throw new Error("Gemini çek detaylarını çıkartamadı. Lütfen elle ekleyin.");
      }
    } catch (err: any) {
      setScanError(err.message || "Bir hata alındı.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName || !customerName || !amountStr || !dueDate) {
      alert("Lütfen zorunlu alanları doldurun (Banka, Cari Unvan, Tutar, Vade Tarihi).");
      return;
    }

    const checkBytes = parseFormattedAmount(amountStr);

    if (editCheck && onEditSubmit) {
      onEditSubmit({
        ...editCheck,
        checkType,
        bankName,
        customerName,
        serialNumber: serialNumber || undefined,
        amount: checkBytes,
        dueDate,
        note: note || undefined,
        givenTo: checkType === "given" ? (givenTo || undefined) : undefined,
        imageUri: attachedImage || undefined
      });
      updateHistories(bankName, customerName, checkType === "given" ? givenTo : "");
      onClose();
      return;
    }

    const checkData: Omit<Check, "id" | "createdAt"> = {
      checkType,
      bankName,
      customerName,
      serialNumber: serialNumber || undefined,
      amount: checkBytes,
      dueDate,
      note: note || undefined,
      givenTo: checkType === "given" ? (givenTo || undefined) : undefined,
      imageUri: attachedImage || undefined,
      status: "pending"
    };

    const duplicateCheckResult = onAdd(checkData);

    if (duplicateCheckResult.isDuplicate && duplicateCheckResult.existing) {
      // Duplicate found, show approval popup inside modal
      setDuplicateCheck(duplicateCheckResult.existing);
      setPendingCheckData(checkData);
    } else {
      updateHistories(bankName, customerName, checkType === "given" ? givenTo : "");
      resetForm();
      onClose();
    }
  };

  const handleForceAdd = () => {
    if (pendingCheckData) {
      updateHistories(pendingCheckData.bankName, pendingCheckData.customerName, pendingCheckData.checkType === "given" ? (pendingCheckData.givenTo || "") : "");
      onForceAdd(pendingCheckData);
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setCheckType("given");
    setBankName("");
    setCustomerName("");
    setSerialNumber("");
    setAmountStr("");
    setDueDate("");
    setNote("");
    setGivenTo("");
    setScanResult(null);
    setScanError("");
    setUploadedFileName("");
    setDuplicateCheck(null);
    setPendingCheckData(null);
    setCropImageSrc(null);
    setAttachedImage(null);
    setCropTarget(null);
    setActiveImageMode("none");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        id="add-check-modal-body"
        className="relative bg-white border border-gray-100 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-sans font-bold text-lg text-slate-800">{editCheck ? "Çeki Düzenle" : "Yeni Çek Ekle"}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1.5 hover:bg-slate-50 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic content scroll frame */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {cropImageSrc && (
            <div className="absolute inset-0 z-50 bg-black flex flex-col">
              <div className="relative flex-1">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={2 / 1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="p-5 bg-slate-900 border-t border-slate-800 flex justify-center gap-3">
                 <button
                   type="button"
                   onClick={handleCropFinish}
                   className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg text-sm font-bold transition flex-1 max-w-[200px]"
                 >
                   {cropTarget === "ai" ? "Kırp ve Tara" : "Kırp ve Ekle"}
                 </button>
                 <button
                   type="button"
                   onClick={() => setCropImageSrc(null)}
                   className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl shadow-lg text-sm font-bold transition flex-1 max-w-[200px]"
                 >
                   İptal
                 </button>
              </div>
            </div>
          )}

          {duplicateCheck && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl">
              <div className="flex gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-800 text-sm">Mükerrer Çek Tespiti!</h4>
                  <p className="text-xs text-rose-700 leading-relaxed mt-1">
                    Sistemde bu vade tarihine ({duplicateCheck.dueDate.split("-").reverse().join(".")}), bankaya ({duplicateCheck.bankName}) ve tutara (%{duplicateCheck.amount.toLocaleString("tr-TR")} TL) ait eşleşen bir bekleyen çek zaten mevcut.
                  </p>
                  <p className="text-xs text-rose-700 font-semibold mt-2">Yine de bu çeki kaydetmek ister misiniz?</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleForceAdd}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs"
                    >
                      Evet, Çift Kayıt Olarak Ekle
                    </button>
                    <button
                      onClick={() => setDuplicateCheck(null)}
                      className="px-3 py-1.5 border border-rose-200 bg-white hover:bg-rose-100 text-rose-800 text-xs font-semibold rounded-lg transition"
                    >
                      İptal Et, Bilgileri Düzenle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher in Form */}
              <div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckType("received")}
                    className={`flex-1 py-1 text-xs font-semibold rounded-lg transition border ${
                      checkType === "received"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Alınan Çek
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckType("given")}
                    className={`flex-1 py-1 text-xs font-semibold rounded-lg transition border ${
                      checkType === "given"
                        ? "bg-sky-50 border-sky-200 text-sky-700"
                        : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Verilen Çek
                  </button>
                </div>
              </div>

              {/* Bank Name Input with Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Banka Adı <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-lg shadow-2xs focus-within:ring-2 focus-within:ring-slate-500 bg-white">
                  <Building2 className="w-5 h-5 text-gray-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="Örn: Garanti BBVA"
                    value={bankName}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      setShowBankDropdown(true);
                    }}
                    onFocus={() => setShowBankDropdown(true)}
                    onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                    className="w-full px-3 py-2 text-sm focus:outline-none placeholder-gray-400 bg-transparent"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {showBankDropdown && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredBanks.length > 0 ? (
                      filteredBanks.map((b) => (
                        <div key={b} className="flex items-center justify-between hover:bg-slate-50 transition border-b border-gray-50">
                          <button
                            type="button"
                            onClick={() => {
                              setBankName(b);
                              setShowBankDropdown(false);
                            }}
                            className="flex-1 text-left px-4 py-2 text-sm text-gray-700"
                          >
                            {b}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-xs text-gray-400">Sonuç bulunamadı</div>
                    )}
                    <div className="border-t border-gray-100 flex p-1 sticky bottom-0 bg-white">
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const newBank = window.prompt("Yeni banka adını giriniz:");
                          if (newBank && newBank.trim()) {
                             const b = newBank.trim();
                             if (!customBanks.includes(b)) {
                               const updated = [...customBanks, b];
                               setCustomBanks(updated);
                               localStorage.setItem("customBanks", JSON.stringify(updated));
                             }
                             setBankName(b);
                             setShowBankDropdown(false);
                          }
                        }} 
                        type="button" 
                        className="flex-1 flex items-center justify-center gap-1 text-xs text-indigo-600 font-bold py-2 px-1 hover:bg-indigo-50 rounded"
                      >
                       <Plus className="w-3 h-3" /> Banka Ekle
                      </button>
                      <div className="w-px bg-gray-100 my-1 mx-1"></div>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (window.confirm("Kendi eklediğiniz tüm bankalar silinecek. Onaylıyor musunuz?")) {
                            setCustomBanks(bankList);
                            localStorage.removeItem("customBanks");
                            setBankName("");
                          }
                        }} 
                        type="button" 
                        className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-600 font-bold py-2 px-1 hover:bg-slate-50 rounded"
                      >
                        <Trash2 className="w-3 h-3"/> Bankaları Düzenle
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer / Payer Name with Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {checkType === "received" ? "Müşteri / Keşideci Cari" : "Alacaklı Firma Ünvanı"} <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-lg shadow-2xs focus-within:ring-2 focus-within:ring-slate-500 bg-white">
                  <Users className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="Firmayı girin"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    className="w-full px-3 py-2 text-sm focus:outline-none placeholder-gray-400 bg-transparent"
                  />
                </div>
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCustomerName(c);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 transition"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount and Serial Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Amount Field (TL) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Çek Tutarı (TL) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-gray-400 font-semibold font-mono">₺</span>
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={amountStr}
                      onChange={handleAmountChange}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500 font-mono text-right"
                    />
                  </div>
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Seri No / Güvenlik Kodu</label>
                  <input
                    type="text"
                    placeholder="TR-1234-56"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500 font-mono"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Vade Tarihi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Given To (Only shown for GIVEN checks) */}
              {checkType === "given" && (
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Teslim Edilen Cari Temsilci</label>
                  <input
                    type="text"
                    placeholder="Evrakı teslim alan şahıs/firma"
                    value={givenTo}
                    onChange={(e) => {
                      setGivenTo(e.target.value);
                      setShowGivenToDropdown(true);
                    }}
                    onFocus={() => setShowGivenToDropdown(true)}
                    onBlur={() => setTimeout(() => setShowGivenToDropdown(false), 200)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500"
                  />
                  {showGivenToDropdown && filteredGivenTo.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {filteredGivenTo.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setGivenTo(g);
                            setShowGivenToDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 transition"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Özel Not / Açıklama</label>
                <textarea
                  rows={2}
                  placeholder="Bu çek ile ilgili hatırlatıcı notlar..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm shadow-2xs focus:ring-2 focus:ring-slate-500 resize-none"
                />
              </div>

              {/* Image & AI Section */}
              <div className="pt-2">
                {attachedImage ? (
                  <div className="relative inline-block border border-gray-200 rounded-lg shadow-sm overflow-hidden bg-slate-50 max-h-40 mb-4">
                    <img src={attachedImage} alt="Çek Görseli" className="h-full w-auto object-contain max-h-40" />
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedImage(null);
                        setScanResult(null);
                      }}
                      className="absolute top-1 right-1 bg-white/90 text-rose-600 hover:text-rose-700 p-1 rounded-full shadow-xs"
                      title="Görseli Kaldır"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : !editCheck && (
                  <div className="flex flex-col gap-2 mb-4">
                    {activeImageMode === "none" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveImageMode("ai")}
                          className="w-full py-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200 border-dashed rounded-xl flex items-center justify-center gap-2 transition text-indigo-700"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-bold">Yapay Zeka ile Tara</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveImageMode("attachment")}
                          className="w-full py-3 bg-slate-50/50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-xl flex items-center justify-center gap-2 transition text-slate-700"
                        >
                          <Camera className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-semibold">Fotoğraf Ekle</span>
                        </button>
                      </>
                    )}

                    {activeImageMode === "ai" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRefAI}
                          onChange={(e) => handleFileUpload(e, "ai")}
                          className="hidden"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          ref={cameraInputRefAI}
                          onChange={(e) => handleFileUpload(e, "ai")}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => cameraInputRefAI.current?.click()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 transition text-white font-semibold text-sm rounded-xl shadow-xs flex-1"
                        >
                          <Camera className="w-4 h-4" />
                          Fotoğraf Çek
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRefAI.current?.click()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 transition text-indigo-700 font-semibold text-sm rounded-xl shadow-xs flex-1"
                        >
                          <FileImage className="w-4 h-4" />
                          Galeriden Ekle
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageMode("none")}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 transition text-slate-700 font-semibold text-sm rounded-xl flex-1 max-w-[80px]"
                        >
                          İptal
                        </button>
                      </div>
                    )}

                    {activeImageMode === "attachment" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRefAttach}
                          onChange={(e) => handleFileUpload(e, "attachment")}
                          className="hidden"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          ref={cameraInputRefAttach}
                          onChange={(e) => handleFileUpload(e, "attachment")}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => cameraInputRefAttach.current?.click()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-700 hover:bg-slate-800 transition text-white font-semibold text-sm rounded-xl shadow-xs flex-1"
                        >
                          <Camera className="w-4 h-4" />
                          Fotoğraf Çek
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRefAttach.current?.click()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 font-semibold text-sm rounded-xl shadow-xs flex-1"
                        >
                          <FileImage className="w-4 h-4" />
                          Galeriden Ekle
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageMode("none")}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-800 font-semibold text-sm rounded-xl flex-1 max-w-[80px]"
                        >
                          İptal
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {isScanning && (
                  <div className="flex items-center justify-center gap-3 mt-3 mb-4">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold text-indigo-700">Analiz ediliyor...</span>
                  </div>
                )}

                {scanError && (
                  <div className="mt-3 mb-4 p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{scanError}</span>
                  </div>
                )}

                {scanResult && !isScanning && (
                  <div className="mt-3 mb-4 p-2 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Bilgiler başarıyla yüklendi! Lütfen formu kontrol edin.</span>
                  </div>
                )}
              </div>



              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-200 hover:bg-slate-50 transition rounded-xl text-sm font-semibold text-slate-600"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 transition rounded-xl text-sm font-semibold text-white shadow-xs"
                >
                  {editCheck ? "Değişiklikleri Kaydet" : "Çeki Portföye Ekle"}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
}
