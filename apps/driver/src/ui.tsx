import React from "react";
import Svg, { G, Line, Path } from "react-native-svg";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
export const colors = { navy: "#0b2545", blue: "#1a5ce0", coral: "#ff4d4a", canvas: "#f5f8fb", muted: "#53677d", line: "#dae3ed" };
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas }, body: { padding: 20, gap: 16, paddingBottom: 32 },
  card: { backgroundColor: "white", borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.line },
  heading: { fontSize: 28, fontWeight: "800", color: colors.navy, fontFamily: "Jakarta" }, title: { fontSize: 19, fontWeight: "700", color: colors.navy },
  text: { fontSize: 16, lineHeight: 24, color: colors.navy }, muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, value: { fontSize: 27, fontWeight: "800", color: colors.navy },
  error: { color: "#a42d34", backgroundColor: "#fff0f0", padding: 16, borderRadius: 14, fontSize: 15 },
  input: { minHeight: 50, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, color: colors.navy, fontSize: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.navy, marginBottom: 7 },
});
export function Button({ title, onPress, disabled, subtle, danger }: { title: string; onPress: () => void; disabled?: boolean; subtle?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 50, padding: 14, borderRadius: 13, backgroundColor: danger ? "#a42d34" : subtle ? "#edf3f9" : colors.blue, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, alignItems: "center", justifyContent: "center" })}>
    <Text style={{ color: subtle ? colors.navy : "white", fontSize: 15, fontWeight: "700", textAlign: "center" }}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} {...props} /></View>; }
export function Loading() { return <View style={styles.card}><ActivityIndicator size="large" color={colors.blue} accessibilityLabel="Wird geladen" /><Text style={styles.muted}>LieferDank wird geladen …</Text></View>; }
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }

/** Same transparent vector mark as the web; no embedded wordmark or raster border. */
export function BrandMark() {
  return <Svg width={38} height={38} viewBox="0 0 40 40" accessibilityLabel="LieferDank-Logo" accessible>
    <G stroke="#4b8ef0" strokeWidth={2.6} strokeLinecap="round" opacity={0.9}>
      <Line x1={2} y1={12.5} x2={9} y2={12.5} /><Line x1={1} y1={19.5} x2={7} y2={19.5} /><Line x1={3} y1={26.5} x2={9} y2={26.5} />
    </G>
    <Path d="M13.5 11.5 23.5 6.5l10 5v12l-10 5-10-5z" fill="none" stroke={colors.navy} strokeWidth={2.8} strokeLinejoin="round" />
    <Path d="M13.5 11.5 23.5 16.5l10-5M23.5 16.5v12" fill="none" stroke={colors.blue} strokeWidth={2.2} strokeLinejoin="round" />
    <Path d="M24.6 27.6c0-2.1 1.7-3.6 3.5-3.6 1.05 0 2 .5 2.55 1.3.55-.8 1.5-1.3 2.55-1.3 1.8 0 3.5 1.5 3.5 3.6 0 3.2-4.35 5.95-6.05 7-1.7-1.05-6.05-3.8-6.05-7z" fill={colors.coral} stroke="#fff" strokeWidth={2.2} />
  </Svg>;
}
export function FilterChip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: 22, backgroundColor: selected ? colors.blue : "white", borderWidth: 1, borderColor: selected ? colors.blue : colors.line }}>
    <Text style={{ color: selected ? "white" : colors.navy, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{title}</Text>
  </Pressable>;
}
