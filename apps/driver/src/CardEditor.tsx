import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Switch, Text, View } from "react-native";
import { CardArtwork } from "./CardArtwork";
import { cardColorSelection, rankColorOptions, CARD_LAYOUTS, HEADLINE_PRESETS, MAX_HEADLINE_LENGTH, type CardDesignFields } from "../../../src/lib/card/design";
import { isRankColor } from "../../../src/lib/ranks";
import { ApiError } from "./api";
import { editorSvg, sameCard, type CardEditorData } from "./card-editor";
import { Button, Card, colors, Field, Loading, styles, TextLink } from "./ui";

type Props = {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  onSaved: () => Promise<void>;
  onPhoto: () => Promise<boolean>;
  onRemovePhoto: () => Promise<void>;
  onClose: () => void;
};

export function CardEditor({ api, onSaved, onPhoto, onRemovePhoto, onClose }: Props) {
  const [data, setData] = useState<CardEditorData | null>(null);
  const [draft, setDraft] = useState<CardDesignFields | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(""); const [saved, setSaved] = useState(false); const [conflict, setConflict] = useState(false);
  const [rankColorsOpen, setRankColorsOpen] = useState(false);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const next = await api<CardEditorData>("/api/v1/me/card");
    if (mounted.current) { setData(next); setDraft(next.design); setConflict(false); }
  }, [api]);
  useEffect(() => { mounted.current = true; load().catch(e => { if (mounted.current) setError(e.message); }); return () => { mounted.current = false; }; }, [load]);
  const svg = useMemo(() => data && draft ? editorSvg(data, draft) : null, [data, draft]);
  const colorSelection = cardColorSelection(draft?.layout ?? "classic");
  const dirty = Boolean(data && draft && !sameCard(data.design, draft));
  function change(fields: Partial<CardDesignFields>) { if (draft) { setDraft({ ...draft, ...fields }); setSaved(false); } }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setSaved(false);
    try { await action(); } catch (e) { if (mounted.current) { setError(e instanceof Error ? e.message : "Bitte versuche es erneut."); if (e instanceof ApiError && e.code === "card_changed") setConflict(true); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function photo(remove: boolean) {
    if (remove) await onRemovePhoto(); else if (!await onPhoto()) return;
    const next = await api<CardEditorData>("/api/v1/me/card");
    if (mounted.current) { setData(previous => previous ? { ...previous, context: next.context } : next); setDraft(previous => previous ? { ...previous, showPhoto: !remove } : next.design); }
  }
  async function save() {
    if (!data || !draft) return;
    const next = await api<CardEditorData>("/api/v1/me/card", { method: "PATCH", body: JSON.stringify({ ...draft, updatedAt: data.design.updatedAt }) });
    if (!mounted.current) return;
    // The canonical saved state is authoritative even if reloading the separate QR fails.
    setData(next); setDraft(next.design); setConflict(false); setSaved(true);
    await onSaved();
  }
  function close() {
    if (lock.current) return;
    if (dirty) Alert.alert("Änderungen verwerfen?", "Deine zuletzt gespeicherte Karte bleibt erhalten.", [{ text: "Weiterbearbeiten", style: "cancel" }, { text: "Verwerfen", style: "destructive", onPress: onClose }]);
    else onClose();
  }
  return <>
    <TextLink title="Zurück zum QR-Code" align="flex-start" onPress={close} />
    <Text style={styles.heading}>Deine Karte bearbeiten</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!data || !draft || !svg ? <><Loading label="Dein Kartendesign wird geladen …" />{error ? <Button title="Erneut laden" disabled={busy} onPress={() => void run(load)} /> : null}</> : <>
      <Card><Text style={styles.title}>Live-Vorschau</Text>
        <View accessible accessibilityLabel={`Kartenvorschau für ${data.context.publicName}`} style={{ width: "100%", aspectRatio: 85.6 / 54 }}><CardArtwork xml={svg} /></View>
        <Text style={styles.muted}>85,6 × 54 mm · Dein QR-Code bleibt unverändert.</Text>
      </Card>
      <Card><Text style={styles.title}>Layout</Text>
        <View style={styles.row}>{CARD_LAYOUTS.map(option => <View key={option.id} style={{ flexGrow: 1, minWidth: 100 }}><Button title={option.label} subtle={draft.layout !== option.id} disabled={busy} onPress={() => change({ layout: option.id })} /></View>)}</View>
      </Card>
      <Card><View style={styles.switchRow}><Text style={[styles.text, { flex: 1 }]}>Rangabzeichen auf Karte anzeigen</Text><Switch accessibilityLabel="Rangabzeichen auf Karte anzeigen" disabled={busy} value={draft.showRankBadge} trackColor={{ true: colors.blue }} onValueChange={showRankBadge => change({ showRankBadge })} /></View></Card>
      <Card>
        <Pressable accessibilityRole="button" accessibilityLabel="Rangfarben" accessibilityState={{ expanded: rankColorsOpen }} onPress={() => setRankColorsOpen(open => !open)} style={[styles.switchRow, { minHeight: 48 }]}>
          <Text style={[styles.title, { flex: 1 }]}>Rangfarben</Text><Text style={styles.text}>{rankColorsOpen ? "−" : "+"}</Text>
        </Pressable>
        {rankColorsOpen ? <><Text style={styles.muted}>Zusätzliche Farben durch gültige Danke. Dein Hintergrund ändert sich nur durch deine Auswahl.</Text>
        <View style={styles.row}>{rankColorOptions(draft.layout).map(option => {
          const unlocked = Boolean(data.context.rank && data.context.rank.count >= option.requiredThanks);
          return <Pressable key={option.id} disabled={busy || !unlocked} accessibilityRole="radio" accessibilityLabel={`${option.label} · ${unlocked ? "Freigeschaltet" : `Ab ${option.requiredThanks} Danke`}`} accessibilityState={{ selected: draft.color === option.id, disabled: busy || !unlocked }} onPress={() => change({ color: option.id })} style={{ flexGrow: 1, minHeight: 60, padding: 12, gap: 6, borderWidth: 2, borderRadius: 12, borderColor: draft.color === option.id ? colors.blue : colors.line, opacity: unlocked ? 1 : 0.5 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: option.background, borderWidth: 1, borderColor: colors.line }} /><Text style={styles.text}>{option.label}</Text><Text style={styles.muted}>{unlocked ? "Freigeschaltet" : `Ab ${option.requiredThanks.toLocaleString("de-DE")} Danke`}</Text>
          </Pressable>;
        })}</View>
        {isRankColor(draft.color) && !data.context.rank?.unlockedColors.includes(draft.color) ? <Text style={styles.muted}>Die gespeicherte Rangfarbe ist aktuell nicht freigeschaltet. Die Vorschau nutzt Weiß/Blau. Wähle eine verfügbare Farbe, bevor du speicherst.</Text> : null}</> : null}
      </Card>
      <Card>
        <Text style={styles.title}>{colorSelection.label}</Text>
        <Text style={styles.muted}>{colorSelection.hint}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={colorSelection.label} style={styles.row}>{colorSelection.options.map(option => <Pressable key={option.id} disabled={busy} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected: (draft.color ?? "blue") === option.id, disabled: busy }} onPress={() => change({ color: option.id })} style={{ flexGrow: 1, minHeight: 48, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 12, borderWidth: 2, borderColor: (draft.color ?? "blue") === option.id ? colors.blue : colors.line }}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: option.background }} /><Text style={[styles.text, { flexShrink: 1 }]}>{option.label}</Text></Pressable>)}</View>
      </Card>
      <Card><Field label="Dein Text auf der Karte" value={draft.headline} editable={!busy} maxLength={MAX_HEADLINE_LENGTH} multiline onChangeText={headline => change({ headline })} />
        <Text style={styles.muted}>{draft.headline.length}/{MAX_HEADLINE_LENGTH} Zeichen</Text>
        {HEADLINE_PRESETS.slice(0, 3).map(preset => <TextLink key={preset} small title={preset} align="flex-start" onPress={() => { if (!busy) change({ headline: preset }); }} />)}
      </Card>
      <Card><Text style={styles.title}>Dein Foto</Text>
        {data.context.photoHref ? <Image source={{ uri: data.context.photoHref }} style={{ width: 72, height: 72, borderRadius: 36 }} accessibilityLabel="Dein Kartenfoto" /> : null}
        <Button subtle title={data.context.photoHref ? "Foto ändern" : "Foto hinzufügen"} disabled={busy} onPress={() => void run(() => photo(false))} />
        {data.context.photoHref ? <><View style={styles.switchRow}><Text style={[styles.text, { flex: 1 }]}>Foto auf der Karte zeigen</Text><Switch accessibilityLabel="Foto auf der Karte zeigen" disabled={busy} value={draft.showPhoto} trackColor={{ true: colors.blue }} onValueChange={showPhoto => change({ showPhoto })} /></View>
          <TextLink small title="Foto entfernen" onPress={() => { if (!busy) Alert.alert("Profilfoto entfernen?", "Das Foto wird aus deinem Profil und von der Karte entfernt.", [{ text: "Abbrechen", style: "cancel" }, { text: "Entfernen", style: "destructive", onPress: () => void run(() => photo(true)) }]); }} /></> : null}
        <Text style={styles.muted}>Fotoänderungen werden direkt im Profil gespeichert. Ob das Foto auch auf deiner öffentlichen Danke-Seite erscheint, stellst du im Profil ein.</Text>
        <Text style={styles.muted}>Name auf der Karte: {data.context.publicName}. Deinen öffentlichen Namen kannst du im Profil ändern.</Text>
      </Card>
      {conflict ? <Button title="Aktuellen Stand laden" subtle disabled={busy} onPress={() => Alert.alert("Aktuellen Stand laden?", "Deine ungespeicherten Änderungen werden durch die gespeicherte Karte ersetzt.", [{ text: "Abbrechen", style: "cancel" }, { text: "Laden", onPress: () => void run(load) }])} /> : null}
      {saved ? <Text accessibilityLiveRegion="polite" style={styles.notice}>Design gespeichert. Deine Karte ist auch auf der Website aktualisiert.</Text> : null}
      {busy ? <ActivityIndicator accessibilityLabel="Karte wird verarbeitet" color={colors.blue} /> : null}
      <Button title={busy ? "Bitte warten …" : "Design speichern"} disabled={busy || !dirty || conflict} onPress={() => void run(save)} />
      <Text style={styles.muted}>Zum Speichern als PDF, Teilen oder Drucken: Design speichern und zurück zum QR-Code.</Text>
    </>}
  </>;
}
