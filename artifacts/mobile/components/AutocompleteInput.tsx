import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: object;
}

export default function AutocompleteInput({
  value, onChangeText, suggestions, placeholder, autoCapitalize = "words", style,
}: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const filtered = value.trim().length > 0
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()) &&
        s.toLowerCase() !== value.toLowerCase()
      ).slice(0, 6)
    : [];

  const showList = focused && filtered.length > 0;

  return (
    <View>
      <TextInput
        style={[{
          backgroundColor: colors.input,
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.foreground,
          fontFamily: "Inter_400Regular",
          borderBottomLeftRadius: showList ? 0 : 12,
          borderBottomRightRadius: showList ? 0 : 12,
        }, style]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 160)}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
      {showList && (
        <View style={{
          borderWidth: 1, borderTopWidth: 0, borderColor: colors.primary,
          borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
          backgroundColor: colors.card, overflow: "hidden",
        }}>
          {filtered.map((item, index) => (
            <TouchableOpacity
              key={item}
              onPress={() => { onChangeText(item); setFocused(false); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 11,
                borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border,
                flexDirection: "row", alignItems: "center", gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1 }}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
