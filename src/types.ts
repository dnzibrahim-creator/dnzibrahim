export interface Check {
  id: string;
  checkType: "received" | "given"; // received = Alınan, given = Verilen
  bankName: string;
  customerName: string; // Keşideci / Müşteri Adı
  serialNumber?: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  note?: string;
  givenTo?: string; // Ciro Edilen / Teslim Edilen Kişi
  status: "pending" | "paid" | "endorsed"; // pending = Bekliyor, paid = Ödendi/Tahsil Edildi, endorsed = Ciro Edildi
  createdAt: string;
  imageUri?: string;
}

export interface CheckTotals {
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  endorsedCount: number;
  pendingAmount: number;
  overdueAmount: number;
  paidAmount: number;
  endorsedAmount: number;
  totalCount: number;
  totalAmount: number;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
