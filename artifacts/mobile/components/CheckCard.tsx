import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { Check, useChecks } from "@/context/ChecksContext";
import { router } from "expo-router";

interface Props {
  check: Check;
  showStatus?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onSelect?: () => void;
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function formatAmount(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function CheckCard({ check, showStatus = false, selectionMode = false, isSelected = false, onLongPress, onSelect }: Props) {
  const colors = useColors();
  const { deleteCheck, markAsPaid, markAsEndorsed } = useChecks();
  const [menuVisible, setMenuVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const days = daysUntil(check.dueDate);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 3;
  const urgencyColor = isOverdue ? colors.destructive : isUrgent ? colors.warning : colors.success;

  const statusLabel: Record<string, string> = { pending: "Bekleyen", paid: "Ödendi", endorsed: "Arkası Yazıldı" };
  const statusColor: Record<string, string> = { pending: colors.warning, paid: colors.success, endorsed: colors.primary };

  const handlePress = () => {
    if (selectionMode && onSelect) { onSelect(); return; }
  };

  const handleLongPress = () => {
    if (!selectionMode && onLongPress) { onLongPress(); return; }
    if (selectionMode && onSelect) { onSelect(); return; }
  };

  const handleMenu = () => {
    if (selectionMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(true);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert("Çeki Sil", "Bu çeki silmek istediğinizden emin misiniz?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); deleteCheck(check.id); } },
    ]);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    router.push({ pathname: "/(tabs)/add", params: { editId: check.id } });
  };

  const styles = makeStyles(colors);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={[styles.card, isSelected && { borderColor: colors.primary, borderWidth: 2, opacity: 0.92 }]}
      >
        <View style={[styles.urgencyBar, { backgroundColor: urgencyColor }]} />
        <View style={styles.body}>
          <View style={styles.row}>
            <View style={styles.leftCol}>
              <Text style={styles.customerName} numberOfLines={1}>{check.customerName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={styles.bankName}>{check.bankName}</Text>
                {check.checkType && (
                  <View style={[styles.typeBadge, {
                    backgroundColor: check.checkType === "received" ? colors.success + "20" : colors.warning + "20",
                  }]}>
                    <Feather
                      name={check.checkType === "received" ? "download" : "upload"}
                      size={9}
                      color={check.checkType === "received" ? colors.success : colors.warning}
                    />
                    <Text style={[styles.typeBadgeText, {
                      color: check.checkType === "received" ? colors.success : colors.warning,
                    }]}>
                      {check.checkType === "received" ? "Alınan" : "Verilen"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.amount}>{formatAmount(check.amount)}</Text>
              {selectionMode ? (
                <View style={[styles.checkbox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {isSelected && <Feather name="check" size={12} color="#fff" />}
                </View>
              ) : (
                <TouchableOpacity onPress={handleMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={13} color={urgencyColor} />
              <Text style={[styles.metaText, { color: urgencyColor }]}>
                {formatDate(check.dueDate)}
                {isOverdue ? `  (${Math.abs(days)} gün geçti)` : days === 0 ? "  (Bugün!)" : `  (${days} gün)`}
              </Text>
            </View>
            {showStatus && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor[check.status] + "22" }]}>
                <Text style={[styles.statusText, { color: statusColor[check.status] }]}>{statusLabel[check.status]}</Text>
              </View>
            )}
          </View>

          {(check.serialNumber || check.givenTo) && (
            <View style={styles.metaRow}>
              {check.serialNumber ? (
                <><Feather name="hash" size={12} color={colors.mutedForeground} /><Text style={styles.metaSmall}>{check.serialNumber}</Text></>
              ) : null}
              {check.givenTo ? (
                <><Feather name="user" size={12} color={colors.mutedForeground} style={{ marginLeft: 10 }} /><Text style={styles.metaSmall}>{check.givenTo}</Text></>
              ) : null}
            </View>
          )}

          {check.note ? (
            <View style={styles.metaRow}>
              <Feather name="file-text" size={12} color={colors.mutedForeground} />
              <Text style={styles.metaSmall} numberOfLines={1}>{check.note}</Text>
            </View>
          ) : null}

          {check.imageUri ? (
            <TouchableOpacity style={styles.imageThumbnailRow} onPress={() => !selectionMode && setImageViewerVisible(true)}>
              <Image source={{ uri: check.imageUri }} style={styles.imageThumbnail} resizeMode="cover" />
              <View style={styles.imageLabel}>
                <Feather name="image" size={12} color={colors.primary} />
                <Text style={[styles.imageLabelText, { color: colors.primary }]}>Çek Fotoğrafı</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerVisible(false)}>
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          {check.imageUri && <Image source={{ uri: check.imageUri }} style={styles.imageViewerImg} resizeMode="contain" />}
        </View>
      </Modal>

      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{check.customerName}</Text>
            {check.status === "pending" && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); markAsPaid(check.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
                  <Feather name="check-circle" size={18} color={colors.success} />
                  <Text style={[styles.menuItemText, { color: colors.success }]}>Ödendi Olarak İşaretle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); markAsEndorsed(check.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
                  <Feather name="edit-3" size={18} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.primary }]}>Arkası Yazıldı</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Feather name="edit-2" size={18} color={colors.foreground} />
              <Text style={styles.menuItemText}>Düzenle</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
              <Text style={[styles.menuItemText, { color: colors.destructive }]}>Sil</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      marginHorizontal: 16,
      marginVertical: 6,
      flexDirection: "row",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
    urgencyBar: { width: 4 },
    body: { flex: 1, padding: 14, gap: 6 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    leftCol: { flex: 1, marginRight: 12 },
    rightCol: { alignItems: "flex-end", gap: 6 },
    customerName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    bankName: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    amount: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    typeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.mutedForeground, alignItems: "center", justifyContent: "center" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    metaSmall: { fontSize: 12, color: colors.mutedForeground, flexShrink: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    imageThumbnailRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginTop: 4, borderRadius: colors.radius - 4, overflow: "hidden",
      backgroundColor: colors.primary + "08", borderWidth: 1, borderColor: colors.primary + "20", padding: 6,
    },
    imageThumbnail: { width: 48, height: 36, borderRadius: 6 },
    imageLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
    imageLabelText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
    imageViewerClose: { position: "absolute", top: 50, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 },
    imageViewerImg: { width: "100%", height: "80%" },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
    menu: { backgroundColor: colors.card, borderRadius: 16, padding: 8, width: 260, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },
    menuTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, paddingHorizontal: 12, paddingVertical: 8 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10 },
    menuItemText: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground },
    menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  });
}
