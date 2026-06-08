import { Check } from "./types";

const today = new Date();
const formatDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(today.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

export const sampleChecks: Check[] = [
  {
    id: "check-1",
    checkType: "received",
    bankName: "Garanti BBVA",
    customerName: "Yılmaz İnşaat Taahhüt Ltd. Şti.",
    serialNumber: "TR-8829-103",
    amount: 145000,
    dueDate: formatDate(12), // 12 days in standard future
    status: "pending",
    note: "Yeni şantiye malzeme tedarik bedeli karşılığı.",
    createdAt: formatDate(-5),
  },
  {
    id: "check-2",
    checkType: "received",
    bankName: "İş Bankası",
    customerName: "Aras Gıda Dağıtım Sanayi",
    serialNumber: "TR-4720-993",
    amount: 85000,
    dueDate: formatDate(-4), // 4 days ago (Overdue)
    status: "pending",
    note: "Mart ayı sevkiyatı faturası ödemesi.",
    createdAt: formatDate(-30),
  },
  {
    id: "check-3",
    checkType: "given",
    bankName: "Akbank",
    customerName: "Özkan Alüminyum Metal Ticaret",
    serialNumber: "AK-9921-228",
    amount: 210000,
    dueDate: formatDate(25), // 25 days in future
    status: "pending",
    note: "Profil boru hammadde sipariş avansı.",
    createdAt: formatDate(-2),
  },
  {
    id: "check-4",
    checkType: "received",
    bankName: "Yapı Kredi",
    customerName: "Kaya Otomotiv San. Tic. A.Ş.",
    serialNumber: "TR-1029-556",
    amount: 320000,
    dueDate: formatDate(-15), // 15 days ago (Paid)
    status: "paid",
    note: "Araç filosu bakım ve yedek parça anlaşması.",
    createdAt: formatDate(-45),
  },
  {
    id: "check-5",
    checkType: "received",
    bankName: "Ziraat Bankası",
    customerName: "Yıldız Demir Çelik Anonim Şirketi",
    serialNumber: "ZR-3049-112",
    amount: 175000,
    dueDate: formatDate(-10), // 10 days ago (Endorsed)
    status: "endorsed",
    givenTo: "Ege Lojistik Nakliyat Hizmetleri",
    note: "Malzeme sevkiyat nakliyat ödemesi için ciro edildi.",
    createdAt: formatDate(-20),
  },
  {
    id: "check-6",
    checkType: "given",
    bankName: "Halkbank",
    customerName: "Vatan Elektrik Kablo Ürünleri",
    serialNumber: "HB-7023-455",
    amount: 65000,
    dueDate: formatDate(45), // 45 days in future
    status: "pending",
    note: "Depo aydınlatma armatür teslimi.",
    createdAt: formatDate(-1),
  }
];

export const bankList = [
  "Garanti BBVA",
  "Akbank",
  "Yapı Kredi",
  "İş Bankası",
  "Ziraat Bankası",
  "QNB Finansbank",
  "Vakıfbank",
  "Halkbank",
  "TEB (Türk Ekonomi Bankası)",
  "DenizBank",
  "Şekerbank",
  "Kuveyt Türk",
  "Türkiye Finans",
  "Albaraka Türk"
];
