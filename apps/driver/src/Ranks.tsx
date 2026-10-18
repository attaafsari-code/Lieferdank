import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { RANKS, RANK_EXPLANATION, REWARD_PREVIEW, rankBadgeSvg, type RankId, type RankProgress } from "../../../src/lib/ranks";
import { Button, Card, Loading, styles, colors, TextLink } from "./ui";
import { describeMilestone } from "./api";

export function RankBadge({ id, size = 44 }: { id: RankId; size?: number }) { return <SvgXml xml={rankBadgeSvg(id)} width={size} height={size * 1.25} accessibilityLabel={`${RANKS.find(r => r.id === id)?.label} · LieferDank-Rang`} />; }
export function RankSummary({ progress: p }: { progress: RankProgress }) {
  return <><View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>{p.current ? <RankBadge id={p.current.id} /> : null}<View style={{ flex: 1 }}><Text style={styles.title}>{p.current?.label ?? "Dein erstes Abzeichen wartet"}</Text><Text style={styles.muted}>{p.count.toLocaleString("de-DE")} gültige Danke</Text></View></View>
    <Text style={styles.text}>{p.maximum ? "Höchster Rang erreicht: Legende" : `Nächster Rang: ${p.next!.label} · ${p.target.toLocaleString("de-DE")} Danke`}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Fortschritt zum nächsten Rang" accessibilityValue={{ min: 0, max: 100, now: p.percent }} style={{ height: 10, borderRadius: 5, backgroundColor: colors.soft, overflow: "hidden" }}><View style={{ height: 10, width: `${p.percent}%`, borderRadius: 5, backgroundColor: p.current?.color ?? colors.blue }} /></View>
    <Text style={styles.muted}>{p.maximum ? `${p.count.toLocaleString("de-DE")} gültige Danke` : `${p.count.toLocaleString("de-DE")} von ${p.target.toLocaleString("de-DE")}`} · {p.percent} %{"\n"}{p.maximum ? "Alle Ränge erreicht" : `Noch ${p.remaining.toLocaleString("de-DE")} Danke`}</Text>
  </>;
}
export function RanksScreen({ api, onBack, onColors, onShare, achievements = [] }: { api: <T>(path: string) => Promise<T>; onBack: () => void; onColors: () => void; onShare: () => void; achievements?: { id: string; type: string; value: number }[] }) {
  const [progress, setProgress] = useState<RankProgress | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current; setBusy(true); setError("");
    try { const next = await api<RankProgress>("/api/v1/me/rank"); if (current === request.current) setProgress(next); }
    catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : "Dein Rang ist gerade nicht verfügbar."); }
    finally { if (current === request.current) setBusy(false); }
  }, [api]);
  useEffect(() => { void load(); const sub = AppState.addEventListener("change", state => { if (state === "active") void load(); }); return () => { request.current++; sub.remove(); }; }, [load]);
  return <><TextLink title="Zurück zur Übersicht" align="flex-start" onPress={onBack} /><Text style={styles.heading}>Rang & Meilensteine</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!progress ? <><Loading label="Dein Rang wird geladen …" />{error ? <Button title="Erneut laden" disabled={busy} onPress={() => void load()} /> : null}</> : <>
      <Card><RankSummary progress={progress} /></Card>
      {RANKS.map(rank => { const reached = progress.count >= rank.threshold; return <Card key={rank.id}><View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}><View style={{ opacity: reached ? 1 : 0.4 }}><RankBadge id={rank.id} /></View><View style={{ flex: 1 }}><Text style={styles.title}>{rank.label}</Text><Text style={styles.muted}>{rank.threshold.toLocaleString("de-DE")} Danke · {reached ? "Erreicht" : `Noch ${(rank.threshold - progress.count).toLocaleString("de-DE")}`}</Text><Text style={styles.text}>Abzeichen{rank.id !== "start" ? " · Rangfarbe" : ""}{rank.reward ? " · Reward" : ""}</Text></View></View></Card>; })}
      {achievements.some(item => item.type !== "thank_you_count") ? <Card><Text style={styles.title}>Weitere Meilensteine</Text>{achievements.filter(item => item.type !== "thank_you_count").map(item => <Text key={item.id} style={styles.text}>{describeMilestone(item.type, item.value).title}</Text>)}</Card> : null}
      <Card><Text style={styles.title}>Rewards · vorbereitete Vorschau</Text><Text style={styles.muted}>{REWARD_PREVIEW}</Text></Card>
      <Text style={styles.muted}>{RANK_EXPLANATION}</Text><Button title="Rangfarben auf deiner Karte ansehen" onPress={onColors} /><Button subtle title="Öffentliches Rangprofil teilen" onPress={onShare} />
    </>}
  </>;
}
