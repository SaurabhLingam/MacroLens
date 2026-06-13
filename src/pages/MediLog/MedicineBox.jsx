import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  RefreshControl,
  Modal,
  TextInput,   
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isExpoGo } from "./notificationService";
import { Text } from "../../components/TextWrapper";

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  primary:     "#0D7A6F",
  primaryDark: "#085C53",
  primaryMid:  "#0F9185",
  primarySoft: "#2BADA0",
  ghostLight:  "#E6F5F4",
  ghostMid:    "#D0EEEC",
  ghostBorder: "#9FD6D1",
  amber:       "#F59E0B",
  red:         "#EF4444",
  green:       "#10B981",
  surface:     "#F0FAF9",
  white:       "#FFFFFF",
  text:        "#0A1F1E",
  textSub:     "#2C4F4C",
  textMuted:   "#6A9E99",
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const DOSE_TYPE_ICONS = {
  Tablet: "pill",
  Capsule: "pill-multiple",
  Syrup: "bottle-tonic-outline",
  Injection: "needle",
  Drops: "water-outline",
  Inhaler: "air-filter",
  Patch: "bandage",
  Cream: "lotion-outline",
};

const DOSE_COLORS = {
  Tablet: "#0EA5B0",
  Capsule: "#5A7AF5",
  Syrup: "#F59E0B",
  Injection: "#EF4444",
  Drops: "#06B6D4",
  Inhaler: "#10B981",
  Patch: "#8B5CF6",
  Cream: "#F97316",
};

const isExpiryClose = (expiryStr) => {
  try {
    const [mm, yyyy] = expiryStr.split("/");
    const expiryDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 28);
    const now = new Date();
    const diffMonths = (expiryDate - now) / (1000 * 60 * 60 * 24 * 30);
    return diffMonths < 2;
  } catch {
    return false;
  }
};

const isExpired = (expiryStr) => {
  try {
    const [mm, yyyy] = expiryStr.split("/");
    const expiryDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 28);
    return expiryDate < new Date();
  } catch {
    return false;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
const MedicineBox = ({ navigation }) => {
  const [medicines, setMedicines] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    expiringSoon: 0,
  });
  const [alertQueue, setAlertQueue] = useState([]);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [dosageModal, setDosageModal] = useState({ visible: false, med: null, newDose: "", note: "" });

  useEffect(() => {
    loadMedicines();
    const unsubscribe = navigation.addListener("focus", loadMedicines);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!currentAlert && alertQueue.length > 0) {
      setCurrentAlert(alertQueue[0]);
      setAlertQueue((q) => q.slice(1));
    }
  }, [alertQueue, currentAlert]);

  const loadMedicines = async () => {
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      if (!userEmail) return;

      const raw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds = raw ? JSON.parse(raw) : [];
      setMedicines(meds);

      const active = meds.filter((m) => m.active !== false);
      const lowStock = active.filter(
        (m) => m.remainingQuantity <= m.frequencyCount * 3,
      );
      const expiringSoon = active.filter(
        (m) => isExpiryClose(m.expiry) && !isExpired(m.expiry),
      );

      setStats({
        total: active.length,
        lowStock: lowStock.length,
        expiringSoon: expiringSoon.length,
      });

      for (const med of lowStock) {
        const alerted = await AsyncStorage.getItem(`lowstock_alert_${med.id}`);
        if (!alerted) {
            setAlertQueue((q) => [...q, med]);
            await AsyncStorage.setItem(`lowstock_alert_${med.id}`, "true");
          }
      }

      const lowStockIds = new Set(lowStock.map((m) => m.id));
      for (const med of active) {
        if (!lowStockIds.has(med.id)) {
          await AsyncStorage.removeItem(`lowstock_alert_${med.id}`);
        }
      }
    } catch (_) {}
  };

  const toggleActive = async (med) => {
    Alert.alert(
      med.active !== false ? "Deactivate Medicine" : "Reactivate Medicine",
      `${med.active !== false ? "Stop" : "Resume"} tracking ${med.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const userEmail = await AsyncStorage.getItem("currentUser");
              const raw = await AsyncStorage.getItem(`medicines_${userEmail}`);
              const meds = JSON.parse(raw || "[]");
              const idx = meds.findIndex((m) => m.id === med.id);
              if (idx !== -1) {
                meds[idx].active = !(meds[idx].active !== false);
                if (!meds[idx].active && med.notificationIds?.length) {
                  for (const nid of med.notificationIds) {
                    if (!isExpoGo) {
                      await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
                    }
                  }
                }
                await AsyncStorage.setItem(
                  `medicines_${userEmail}`,
                  JSON.stringify(meds),
                );
                loadMedicines();
              }
            } catch (_) {}
          },
        },
      ],
    );
  };

  const deleteMedicine = async (med) => {
    Alert.alert(
      "Delete Medicine",
      `Permanently remove ${med.name} and all its history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const userEmail = await AsyncStorage.getItem("currentUser");
              const raw = await AsyncStorage.getItem(`medicines_${userEmail}`);
              const meds = JSON.parse(raw || "[]").filter(
                (m) => m.id !== med.id,
              );
              if (med.notificationIds?.length) {
                for (const nid of med.notificationIds) {
                  if (!isExpoGo) {
                    await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
                  }
                }
              }
              await AsyncStorage.setItem(
                `medicines_${userEmail}`,
                JSON.stringify(meds),
              );
              const histRaw = await AsyncStorage.getItem(
                `history_${userEmail}`,
              );
              const history = JSON.parse(histRaw || "[]").filter(
                (h) => h.medicineId !== med.id,
              );
              await AsyncStorage.setItem(
                `history_${userEmail}`,
                JSON.stringify(history),
              );
              loadMedicines();
            } catch (_) {}
          },
        },
      ],
    );
  };

  const adjustStock = async (med, delta) => {
  try {
    const userEmail = await AsyncStorage.getItem("currentUser");
    const raw = await AsyncStorage.getItem(`medicines_${userEmail}`);
    const meds = JSON.parse(raw || "[]");
    const idx = meds.findIndex((m) => m.id === med.id);
    if (idx !== -1) {
      const newQty = Math.max(0, meds[idx].remainingQuantity + delta);
      meds[idx].remainingQuantity = newQty;
      if (newQty > meds[idx].quantity) {
        meds[idx].quantity = newQty;
      }
      await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds));
      loadMedicines();
    }
  } catch (_) {}
};

  const saveDosageChange = async () => {
    const { med, newDose, note } = dosageModal;
    if (!newDose.trim()) return;
    try {
      const userEmail = await AsyncStorage.getItem("currentUser");
      const raw = await AsyncStorage.getItem(`medicines_${userEmail}`);
      const meds = JSON.parse(raw || "[]");
      const idx = meds.findIndex((m) => m.id === med.id);
      if (idx !== -1) {
        meds[idx].dosage = newDose.trim();
        if (!meds[idx].dosageHistory) meds[idx].dosageHistory = [];
        meds[idx].dosageHistory.push({
          dose: newDose.trim(),
          changedAt: new Date().toISOString(),
          note: note.trim() || "Dosage updated",
        });
        await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds));
        setDosageModal({ visible: false, med: null, newDose: "", note: "" });
        loadMedicines();
      }
    } catch (_) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMedicines();
    setRefreshing(false);
  }, []);

  const filtered = medicines.filter((m) =>
    activeTab === "active" ? m.active !== false : m.active === false,
  );

  const renderCard = ({ item: med }) => {
    const color = DOSE_COLORS[med.doseType] || "#0EA5B0";
    const icon = DOSE_TYPE_ICONS[med.doseType] || "pill";
    const expired = isExpired(med.expiry);
    const expiring = isExpiryClose(med.expiry);
    const lowStock = med.remainingQuantity <= med.frequencyCount * 3;
    const stockPercent = med.quantity > 0
      ? Math.min(100, Math.round((med.remainingQuantity / med.quantity) * 100))
      : 0;

    return (
      <View style={[styles.card, expired && styles.cardExpired]}>
        {/* Top Row */}
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: color + "15" }]}>
            <MaterialCommunityIcons name={icon} size={26} color={color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.medName}>{med.name}</Text>
            {!!med.dosage && (
              <Text style={styles.medDosage}>{med.dosage}</Text>
            )}
            <View style={styles.medMetaRow}>
              <View
                style={[styles.medMetaBadge, { backgroundColor: color + "12" }]}
              >
                <Text style={[styles.medMetaBadgeText, { color }]}>
                  {med.doseType}
                </Text>
              </View>
              <Text style={styles.medFreq}>{med.frequency}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => setDosageModal({ visible: true, med, newDose: med.dosage || "", note: "" })}
              style={styles.actionBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <MaterialCommunityIcons name="clipboard-edit-outline" size={20} color="#A0AEC0" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleActive(med)}
              style={styles.actionBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <MaterialCommunityIcons
                name={
                  med.active !== false
                    ? "pause-circle-outline"
                    : "play-circle-outline"
                }
                size={20}
                color="#A0AEC0"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteMedicine(med)}
              style={[styles.actionBtn, styles.actionBtnDanger]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={20}
                color="#EF4444"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dose Timings */}
        {(med.times || []).length > 0 && (
          <View style={styles.timingsRow}>
            {med.times.map((t, i) => (
              <View
                key={i}
                style={[styles.timeChip, { backgroundColor: color + "12" }]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={11}
                  color={color}
                />
                <Text style={[styles.timeChipText, { color }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stock section */}
        <View style={styles.stockSection}>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Stock remaining</Text>
            <View style={styles.stockAdjustRow}>
              <TouchableOpacity
                onPress={() => adjustStock(med, -1)}
                style={styles.stockBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons name="minus" size={14} color="#718096" />
              </TouchableOpacity>
              <Text style={[styles.stockCount, { color: lowStock ? "#EF4444" : "#10B981" }]}>
                {med.remainingQuantity} / {med.quantity}
              </Text>
              <TouchableOpacity
                onPress={() => adjustStock(med, +1)}
                style={styles.stockBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons name="plus" size={14} color="#718096" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.stockBarBg}>
            <View
              style={[
                styles.stockBarFill,
                {
                  width: `${stockPercent}%`,
                  backgroundColor: lowStock ? "#EF4444" : "#10B981",
                },
              ]}
            />
          </View>
          {lowStock && !expired && (
            <View style={styles.alertBadge}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={13}
                color="#EF4444"
              />
              <Text style={styles.alertBadgeText}>
                {" "}
                Running low — please reorder
              </Text>
            </View>
          )}
        </View>

        {/* Expiry Row */}
        <View style={styles.expiryRow}>
          <MaterialCommunityIcons
            name={
              expired
                ? "alert-circle"
                : expiring
                  ? "alert"
                  : "check-circle-outline"
            }
            size={14}
            color={expired ? "#EF4444" : expiring ? "#F59E0B" : "#10B981"}
          />
          <Text
            style={[
              styles.expiryText,
              { color: expired ? "#EF4444" : expiring ? "#F59E0B" : "#A0AEC0" },
            ]}
          >
            {" "}
            Expires: {med.expiry}
            {expired ? " · EXPIRED" : expiring ? " · Expiring soon" : ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor= "#F0FAF9" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#2C4F4C" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Medicine Box</Text>
          <Text style={styles.subtitle}>
            All your current & past medicines
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("LogNewMedicine")}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#0D7A6F"}]}>
            {stats.total}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#EF4444" }]}>
            {stats.lowStock}
          </Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#F59E0B" }]}>
            {stats.expiringSoon}
          </Text>
          <Text style={styles.statLabel}>Expiring</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "active" && styles.tabTextActive,
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "inactive" && styles.tabActive]}
          onPress={() => setActiveTab("inactive")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "inactive" && styles.tabTextActive,
            ]}
          >
            Inactive
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0D7A6F"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons
                name="pill-multiple"
                size={48}
                color="#CBD5E0"
              />
            </View>
            <Text style={styles.emptyTitle}>No Medicines Yet</Text>
            <Text style={styles.emptyText}>
              {activeTab === "active"
                ? "Add your first medicine to start tracking."
                : "No deactivated medicines found."}
            </Text>
            {activeTab === "active" && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("LogNewMedicine")}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}> Add Medicine</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <Modal
        visible={!!currentAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrentAlert(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconRing}>
                <MaterialCommunityIcons name="pill" size={28} color="#EF4444" />
              </View>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>Low Stock Alert</Text>
              <Text style={styles.modalMedName}>{currentAlert?.name}</Text>
              <View style={styles.modalStockRow}>
                <MaterialCommunityIcons name="package-variant" size={16} color="#6A9E99" />
                <Text style={styles.modalStockText}>
                  Only{" "}
                  <Text style={styles.modalStockHighlight}>
                    {currentAlert?.remainingQuantity} doses
                  </Text>{" "}
                  remaining
                </Text>
              </View>
              <Text style={styles.modalHint}>
                You're running low. Reorder soon to avoid missing a dose.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalBtn}
              activeOpacity={0.85}
              onPress={() => setCurrentAlert(null)}
            >
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    <Modal
        visible={dosageModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setDosageModal({ visible: false, med: null, newDose: "", note: "" })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, { backgroundColor: "#E6F5F4", borderBottomColor: "#9FD6D1" }]}>
              <View style={[styles.modalIconRing, { backgroundColor: "#E6F5F4", borderColor: "#9FD6D1" }]}>
                <MaterialCommunityIcons name="pill-multiple" size={28} color="#0D7A6F" />
              </View>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>Adjust Dosage</Text>
              <Text style={styles.modalMedName}>{dosageModal.med?.name}</Text>

              {/* Dosage history timeline */}
              {(dosageModal.med?.dosageHistory?.length > 0) && (
                <View style={styles.dosageHistoryWrap}>
                  {[...dosageModal.med.dosageHistory].reverse().slice(0, 3).map((entry, i) => (
                    <View key={i} style={styles.dosageHistoryRow}>
                      <View style={styles.dosageHistoryDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dosageHistoryDose}>{entry.dose}</Text>
                        <Text style={styles.dosageHistoryMeta}>
                          {new Date(entry.changedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TextInput
                style={styles.dosageInput}
                placeholder="New dosage e.g. 1000mg"
                placeholderTextColor="#9FD6D1"
                value={dosageModal.newDose}
                onChangeText={(v) => setDosageModal((m) => ({ ...m, newDose: v }))}
              />
              <TextInput
                style={[styles.dosageInput, { marginTop: 8 }]}
                placeholder="Note e.g. Doctor increased after review"
                placeholderTextColor="#9FD6D1"
                value={dosageModal.note}
                onChangeText={(v) => setDosageModal((m) => ({ ...m, note: v }))}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 24, marginBottom: 24 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: "#E6F5F4" }]}
                onPress={() => setDosageModal({ visible: false, med: null, newDose: "", note: "" })}
              >
                <Text style={[styles.modalBtnText, { color: "#0D7A6F" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1 }]}
                onPress={saveDosageChange}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MedicineBox;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F0FAF9",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 16,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9FD6D1",
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0A1F1E",
  },

  subtitle: {
    fontSize: 13,
    color: "#6A9E99",
    marginTop: 1,
  },

  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#0D7A6F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9FD6D1",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  statNum: {
    fontSize: 26,
    fontWeight: "800",
  },

  statLabel: {
    fontSize: 11,
    color: "#6A9E99",
    marginTop: 3,
    fontWeight: "600",
  },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 10,
  },

  tab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#9FD6D1",
  },

  tabActive: {
    backgroundColor: "#0D7A6F",
    borderColor: "#0D7A6F",
  },

  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C4F4C",
  },

  tabTextActive: {
    color: "#fff",
  },

  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#9FD6D1",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },

  cardExpired: {
    opacity: 0.6,
    borderColor: "#FECACA",
    backgroundColor: "#FFF8F8",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },

  cardInfo: {
    flex: 1,
  },

  medName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A1F1E",
    marginBottom: 6,
  },

  medMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  medMetaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  medMetaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  medFreq: {
    fontSize: 12,
    color: "#6A9E99",
    fontWeight: "500",
  },

  cardActions: {
    flexDirection: "row",
    gap: 8,
  },

  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FAF9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9FD6D1",
  },

  actionBtnDanger: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FECACA",
  },

  timingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },

  timeChipText: {
    fontSize: 11,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#9FD6D1",
    marginBottom: 14,
  },

  stockSection: {
    marginBottom: 12,
  },

  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

   stockLabel: {
    fontSize: 12,
    color: "#2C4F4C",
    fontWeight: "600",
  },

  stockAdjustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  stockBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F7F9FC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  stockCount: {
    fontSize: 13,
    fontWeight: "700",
  },

  stockBarBg: {
    height: 6,
    backgroundColor: "#D0EEEC",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },

  stockBarFill: {
    height: 6,
    borderRadius: 3,
  },

  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  alertBadgeText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
  },

  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  expiryText: {
    fontSize: 12,
    fontWeight: "500",
  },

  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },

  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#E6F5F4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9FD6D1",
    marginBottom: 4,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A1F1E",
  },

  emptyText: {
    fontSize: 14,
    color: "#6A9E99",
    textAlign: "center",
    lineHeight: 20,
  },

  emptyBtn: {
    marginTop: 8,
    backgroundColor: "#0D7A6F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  emptyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,31,30,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#9FD6D1",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  modalHeader: {
    backgroundColor: "#FFF0F0",
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  modalIconRing: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFF5F5",
    borderWidth: 2,
    borderColor: "#FECACA",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A1F1E",
  },
  modalMedName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0D7A6F",
  },
  modalStockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FAF9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#9FD6D1",
    marginTop: 4,
  },
  modalStockText: {
    fontSize: 13,
    color: "#2C4F4C",
    fontWeight: "500",
  },
  modalStockHighlight: {
    color: "#EF4444",
    fontWeight: "800",
  },
  modalHint: {
    fontSize: 13,
    color: "#6A9E99",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  modalBtn: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: "#0D7A6F",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#0D7A6F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  medDosage: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0D7A6F",
    marginBottom: 4,
  },
  dosageHistoryWrap: {
    width: "100%",
    backgroundColor: "#F0FAF9",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#9FD6D1",
    marginBottom: 4,
  },
  dosageHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dosageHistoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0D7A6F",
    marginTop: 4,
    flexShrink: 0,
  },
  dosageHistoryDose: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A1F1E",
  },
  dosageHistoryMeta: {
    fontSize: 11,
    color: "#6A9E99",
    marginTop: 1,
  },
  dosageInput: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#9FD6D1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0A1F1E",
    backgroundColor: "#F0FAF9",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
