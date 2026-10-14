import React from "react";
import Svg, { G, Line, Path } from "react-native-svg";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
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

/** Same transparent vector mark as the web: all-blue parcel, heart without a white rim, no wordmark. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return <Svg width={size * 45 / 40} height={size} viewBox="-1 0 45 40" accessibilityLabel="LieferDank-Logo" accessible>
    <G stroke={colors.blueLight} strokeWidth={2.6} strokeLinecap="round">
      <Line x1={2} y1={13} x2={9} y2={13} /><Line x1={1} y1={20} x2={7} y2={20} /><Line x1={3} y1={27} x2={9} y2={27} />
    </G>
    <Path d="M13.5 12 23.5 7l10 5v12l-10 5-10-5z" fill="none" stroke={colors.blue} strokeWidth={2.8} strokeLinejoin="round" />
    <Path d="M13.5 12 23.5 17l10-5M23.5 17v12" fill="none" stroke={colors.blue} strokeWidth={2.2} strokeLinejoin="round" />
    <Path d="M28 27.4c0-2.55 2-4.35 4.2-4.35 1.3 0 2.45.6 3.1 1.55.65-.95 1.8-1.55 3.1-1.55 2.2 0 4.2 1.8 4.2 4.35 0 3.9-5.25 7.2-7.3 8.5-2.05-1.3-7.3-4.6-7.3-8.5z" fill={colors.coral} />
  </Svg>;
}
export function FilterChip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: 22, backgroundColor: selected ? colors.blue : "white", borderWidth: 1, borderColor: selected ? colors.blue : colors.line }}>
    <Text style={{ color: selected ? "white" : colors.navy, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{title}</Text>
  </Pressable>;
}

/** Native preview of the personal LieferDank card (85.6 × 54 mm), drawn with views instead of the print SVG. */
export function CardPreview({ qrSvg, code, headline, name, QrView }: { qrSvg: string; code: string; headline: string; name: string; QrView: React.ComponentType<{ xml: string; width: string | number; height: string | number }> }) {
  return <View accessible accessibilityLabel={`Vorschau deiner LieferDank-Karte: ${headline}, ${name}, Code ${code}`} style={{ width: "100%", aspectRatio: 85.6 / 54, backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: "4.5%", justifyContent: "space-between", shadowColor: colors.navy, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><BrandMark size={16} /><Text style={{ fontSize: 13, fontWeight: "800", color: colors.navy, letterSpacing: -0.3 }}>Liefer<Text style={{ color: colors.coral }}>dank</Text></Text></View>
      <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.8, color: "#8798b3" }}>KEINE APP NÖTIG</Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingVertical: 6 }}>
      <View style={{ height: "100%", aspectRatio: 1 }}><QrView xml={qrSvg} width="100%" height="100%" /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: "800", color: colors.navy }} numberOfLines={3}>{headline}{/[♥❤]/.test(headline) ? "" : " "}{/[♥❤]/.test(headline) ? null : <Text style={{ color: colors.coral }}>♥</Text>}</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy }} numberOfLines={1} adjustsFontSizeToFit>{name}</Text>
      </View>
    </View>
    <View style={{ borderTopWidth: 1, borderTopColor: "#e7ecf4", paddingTop: 5, flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
      <Text style={{ fontSize: 8, color: "#5b6b80" }} numberOfLines={1}>Danke sagen kostenlos · Trinkgeld freiwillig</Text>
      <Text style={{ fontSize: 8, color: "#5b6b80", fontWeight: "600" }}>{code}</Text>
    </View>
  </View>;
}
