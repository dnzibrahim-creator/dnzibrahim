import React, { useRef } from "react";
import { TextInput, TextInputProps, StyleProp, TextStyle } from "react-native";

function formatTurkish(raw: string): string {
  if (!raw) return "";
  const hasComma = raw.includes(",");
  const [intPart, decPart] = raw.split(",");
  const digits = intPart.replace(/\D/g, "");
  if (!digits && !hasComma) return "";
  const num = parseInt(digits || "0", 10);
  const intFormatted = isNaN(num) ? "0" : num.toLocaleString("tr-TR");
  if (hasComma) {
    const dec = (decPart ?? "").replace(/\D/g, "").slice(0, 2);
    return intFormatted + "," + dec;
  }
  return intFormatted;
}

export function parseTurkishAmount(display: string): number {
  if (!display) return 0;
  const cleaned = display.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

interface CurrencyInputProps extends Omit<TextInputProps, "value" | "onChangeText" | "keyboardType"> {
  value: string;
  onChangeText: (raw: string, numericValue: number) => void;
  style?: StyleProp<TextStyle>;
}

export default function CurrencyInput({ value, onChangeText, style, ...rest }: CurrencyInputProps) {
  const rawRef = useRef(value);

  const handleChange = (text: string) => {
    const stripped = text.replace(/\./g, "");
    const digits = stripped.replace(/[^\d,]/g, "");
    const commaCount = (digits.match(/,/g) || []).length;
    const normalized = commaCount > 1
      ? digits.slice(0, digits.lastIndexOf(","))
      : digits;
    rawRef.current = normalized;
    onChangeText(normalized, parseTurkishAmount(normalized));
  };

  const display = formatTurkish(value);

  return (
    <TextInput
      {...rest}
      value={display}
      onChangeText={handleChange}
      keyboardType="decimal-pad"
      style={style}
    />
  );
}
