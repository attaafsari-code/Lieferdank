import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import approvedBrandMark from "../assets/brand-mark-approved.png";
import approvedWordmark from "../assets/brand-wordmark.png";
export const colors = { navy: "#0b2545", blue: "#1a5ce0", blueLight: "#5b97ee", coral: "#ff4d4a", canvas: "#f5f8fb", muted: "#53677d", line: "#dae3ed", danger: "#a42d34", soft: "#edf3f9", success: "#1f7a4d" };
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas }, body: { padding: 20, gap: 16, paddingBottom: 32 },
  card: { backgroundColor: "white", borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.line },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.navy, letterSpacing: -0.4 }, title: { fontSize: 19, lineHeight: 25, fontWeight: "700", color: colors.navy },
  text: { fontSize: 16, lineHeight: 24, color: colors.navy }, muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, value: { fontSize: 27, lineHeight: 33, fontWeight: "800", color: colors.navy },
  error: { color: colors.danger, backgroundColor: "#fff0f0", padding: 16, borderRadius: 14, fontSize: 15, lineHeight: 21 },
  notice: { color: colors.navy, backgroundColor: colors.soft, padding: 16, borderRadius: 14, fontSize: 15, lineHeight: 21 },
  input: { minHeight: 50, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, color: colors.navy, fontSize: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.navy, marginBottom: 7 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 },
});
export function Button({ title, onPress, disabled, subtle, danger }: { title: string; onPress: () => void; disabled?: boolean; subtle?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 50, padding: 14, borderRadius: 13, backgroundColor: danger ? colors.danger : subtle ? colors.soft : colors.blue, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, alignItems: "center", justifyContent: "center" })}>
    <Text style={{ color: subtle ? colors.navy : "white", fontSize: 15, fontWeight: "700", textAlign: "center" }}>{title}</Text></Pressable>;
}
/** Text-only action (e.g. "Passwort vergessen?") with a full 44 pt touch target. */
export function TextLink({ title, onPress, small, align = "center" }: { title: string; onPress: () => void; small?: boolean; align?: "center" | "flex-start" }) {
  return <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} hitSlop={6}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignItems: align, paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
    <Text style={{ color: small ? colors.muted : colors.blue, fontSize: small ? 13 : 15, fontWeight: small ? "600" : "700" }}>{title}</Text></Pressable>;
}
/** Inputs never autocorrect or capitalize unless a caller asks: iOS must not alter e-mails or passwords. */
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} autoCorrect={false} spellCheck={false} placeholderTextColor="#8a9aab" style={[styles.input, props.multiline ? { minHeight: 96, textAlignVertical: "top" } : null]} {...props} /></View>;
}
export function Loading({ label = "LieferDank wird geladen …" }: { label?: string }) { return <View style={[styles.card, { alignItems: "center" }]}><ActivityIndicator size="large" color={colors.blue} accessibilityLabel="Wird geladen" /><Text style={styles.muted}>{label}</Text></View>; }
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Segmented<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (value: T) => void; label: string }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", backgroundColor: colors.soft, borderRadius: 14, padding: 4, gap: 4 }}>
    {options.map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: value === key }} accessibilityLabel={title} onPress={() => onChange(key)}
      style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: value === key ? "white" : "transparent", borderWidth: value === key ? 1 : 0, borderColor: colors.line }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: "700", color: value === key ? colors.blue : colors.muted }}>{title}</Text></Pressable>)}
  </View>;
}
export function Avatar({ initials }: { initials: string }) {
  return <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.blue, fontWeight: "800", fontSize: 16 }}>{initials}</Text></View>;
}

/** Pixel-preserving crop of the approved original logo, including the box's top tape. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return <Image source={approvedBrandMark} style={{ width: size * 950 / 503, height: size }} resizeMode="contain" accessibilityLabel="LieferDank-Logo" accessible />;
}
/** Original lettering, cut from the same approved logo (scripts/brand/generate_brand_assets.py). */
export function BrandWordmark({ height = 21 }: { height?: number }) {
  return <Image source={approvedWordmark} style={{ width: height * 1476 / 239, height }} resizeMode="contain" accessibilityLabel="Lieferdank" accessible />;
}
export function FilterChip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: 22, backgroundColor: selected ? colors.blue : "white", borderWidth: 1, borderColor: selected ? colors.blue : colors.line }}>
    <Text style={{ color: selected ? "white" : colors.navy, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{title}</Text>
  </Pressable>;
}
