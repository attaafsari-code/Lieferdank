import fontAsset from "../assets/jakarta.ttf";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, Switch, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFonts } from "expo-font";
import { SvgXml } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ApiError, callApi, deepLink, driverThankUrl, euro, trustedBrowserUrl, validateApiBase, type Screen } from "./api";
import type { Earning, Profile, Qr, Stats, StripeStatus, Thank } from "./types";
import { BrandMark, Button, Card, FilterChip, colors, Field, Loading, styles } from "./ui";

const BASE = validateApiBase(process.env.EXPO_PUBLIC_API_URL ?? "https://lieferdank.de", __DEV__);
const SESSION_KEY = "lieferdank.driver.session";
const REVOKE_KEY = "lieferdank.driver.pending-revocation";
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
const tabs: { screen: Screen; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { screen: "dashboard", label: "Übersicht", icon: "grid-outline" }, { screen: "earnings", label: "Einnahmen", icon: "wallet-outline" },
  { screen: "qr", label: "QR-Code", icon: "qr-code-outline" }, { screen: "thanks", label: "Danke", icon: "heart-outline" }, { screen: "profile", label: "Profil", icon: "person-outline" }
];
export default function App() { return <SafeAreaProvider><DriverApp /></SafeAreaProvider>; }
function DriverApp() {
  const [fontLoaded, fontError] = useFonts({ Jakarta: fontAsset });
  const [token, setToken] = useState<string | null>(null); const tokenRef = useRef<string | null>(null);
  const profileDirty = useRef(false);
  const [booted, setBooted] = useState(false); const [screen, setScreen] = useState<Screen>("dashboard");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [stats, setStats] = useState<Stats | null>(null); const [profile, setProfile] = useState<Profile | null>(null);
  const [stripe, setStripe] = useState<StripeStatus | null>(null); const [qr, setQr] = useState<Qr | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]); const [thanks, setThanks] = useState<Thank[]>([]);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [resetToken, setResetToken] = useState(""); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState("");
  const [consent, setConsent] = useState(false); const [pushEnabled, setPushEnabled] = useState(false); const [filter, setFilter] = useState("all");
  const [thanksCursor, setThanksCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [lastUpdated, setLastUpdated] = useState("");
  const clearSession = useCallback(async () => { profileDirty.current = false; tokenRef.current = null; setToken(null); setStats(null); setProfile(null); setStripe(null); setQr(null); setEarnings([]); setThanks([]); setPassword(""); setCurrentPassword(""); setNewPassword(""); setPushEnabled(false); await SecureStore.deleteItemAsync(SESSION_KEY); }, []);
  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    try { return await callApi<T>(BASE, path, tokenRef.current, init); }
    catch (e) { if (e instanceof ApiError && e.status === 401 && tokenRef.current) await clearSession(); throw e; }
  }, [clearSession]);
  const refresh = useCallback(async () => {
    const active = tokenRef.current; if (!active) return;
    const values = await Promise.all([api<Stats>("/api/v1/me/stats"), api<Profile>("/api/v1/me/profile"), api<StripeStatus>("/api/v1/me/stripe"), api<{ items: Earning[]; nextCursor: string | null }>("/api/v1/me/earnings"), api<{ items: Thank[]; nextCursor: string | null }>("/api/v1/me/thanks"), api<{ enabled: boolean }>("/api/v1/me/push")]);
    if (active !== tokenRef.current) return;
    setStats(values[0]); if (!profileDirty.current) setProfile(values[1]); setStripe(values[2]); setEarnings(values[3].items); setNextCursor(values[3].nextCursor); setThanks(values[4].items); setThanksCursor(values[4].nextCursor); setPushEnabled(values[5].enabled); setLastUpdated(new Date().toLocaleTimeString("de-DE"));
  }, [api]);
  async function run(action: () => Promise<void>) { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Bitte versuche es erneut."); } finally { busyRef.current = false; setBusy(false); } }
  useEffect(() => { SecureStore.getItemAsync(REVOKE_KEY).then(async pending => {
      if (!pending) return;
      try { await callApi(BASE, "/api/v1/me/logout", pending, { method: "POST" }); await SecureStore.deleteItemAsync(REVOKE_KEY); }
      catch (e) { if (e instanceof ApiError && e.status === 401) await SecureStore.deleteItemAsync(REVOKE_KEY); }
    }).catch(() => setError("Eine frühere Abmeldung konnte noch nicht synchronisiert werden. Sie wird beim nächsten Start erneut versucht."));
    SecureStore.getItemAsync(SESSION_KEY).then(t => { tokenRef.current = t; setToken(t); }).catch(() => setError("Die sichere Sitzung konnte nicht geladen werden. Bitte erneut anmelden.")).finally(() => setBooted(true)); }, []);
  useEffect(() => { if (token) { refresh().catch(e => setError(e.message)); const timer = setInterval(() => { if (AppState.currentState === "active") refresh().catch(e => setError(e.message)); }, 60000); return () => clearInterval(timer); } }, [token, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => { if (state === "active" && tokenRef.current) refresh().catch(e => setError(e.message)); });
    const onLink = async (value: string) => { const parsed = deepLink(value); if (!parsed) return;
      if (parsed.resetToken) { await clearSession(); setResetToken(parsed.resetToken); setAuthMode("reset"); }
      if (parsed.verificationToken) { await callApi(BASE, "/api/v1/auth/verification", null, { method: "POST", body: JSON.stringify({ token: parsed.verificationToken }) }); Alert.alert("E-Mail bestätigt", "Du kannst jetzt dein Auszahlungskonto einrichten."); }
      if (parsed.screen) setScreen(parsed.screen); if (tokenRef.current) await refresh(); };
    Linking.getInitialURL().then(url => { if (url) return onLink(url); }).catch(e => setError(e.message));
    const links = Linking.addEventListener("url", ({ url }) => { onLink(url).catch(e => setError(e.message)); });
    const handleNotification = (response: Notifications.NotificationResponse) => { const target = response.notification.request.content.data?.screen;
      if (["earnings", "thanks", "stripe"].includes(String(target))) setScreen(target as Screen); };
    const notifications = Notifications.addNotificationResponseReceivedListener(handleNotification);
    Notifications.getLastNotificationResponseAsync().then(r => { if (r) handleNotification(r); }).catch(() => undefined);
    return () => { sub.remove(); links.remove(); notifications.remove(); };
  }, [refresh, clearSession]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => { if (!token && authMode !== "login") { setAuthMode("login"); return true; } if (screen !== "dashboard") { setScreen("dashboard"); return true; } return false; });
    return () => back.remove();
  }, [screen, token, authMode]);
  async function openBrowser(url: string) { if (!trustedBrowserUrl(url)) throw new Error("Diese Weiterleitung ist nicht erlaubt."); await WebBrowser.openBrowserAsync(url); }
  async function saveSession(session: { token: string }) {
    await SecureStore.setItemAsync(SESSION_KEY, session.token, secureOptions); tokenRef.current = session.token; setToken(session.token); setPassword(""); setScreen("dashboard");
  }
  async function register() {
    const session = await callApi<{ token: string }>(BASE, "/api/v1/auth/mobile/register", null, { method: "POST", body: JSON.stringify({ firstName, lastName, email, password, acceptedTerms }) });
    await saveSession(session); setScreen("profile"); setAcceptedTerms(false);
    Alert.alert("Willkommen bei LieferDank", "Bestätige deine E-Mail-Adresse über den Link in deinem Postfach. Dein Danke-Code ist bereits bereit.");
  }
  async function login() { const session = await callApi<{ token: string }>(BASE, "/api/v1/auth/mobile/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
    await saveSession(session); }
  async function logout() {
    const current = tokenRef.current; if (!current) return;
    // Local logout always succeeds offline. Revocation is retried on the next start.
    await SecureStore.setItemAsync(REVOKE_KEY, current, secureOptions);
    try { await api("/api/v1/me/logout", { method: "POST" }); await SecureStore.deleteItemAsync(REVOKE_KEY); }
    catch (e) { if (e instanceof ApiError && e.status === 401) await SecureStore.deleteItemAsync(REVOKE_KEY); }
    await clearSession();
  }
  async function enablePush(value: boolean) {
    if (!value) { await api("/api/v1/me/push", { method: "DELETE" }); setPushEnabled(false); return; }
    if (!Device.isDevice) throw new Error("Push wird auf einem echten iPhone oder Android-Gerät getestet.");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Push ist für diesen Build noch nicht eingerichtet.");
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "LieferDank", importance: Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.requestPermissionsAsync(); if (permission.status !== "granted") throw new Error("Benachrichtigungen sind nicht erlaubt. Du kannst das in den Systemeinstellungen ändern.");
    const valueToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/v1/me/push", { method: "POST", body: JSON.stringify({ token: valueToken, enabled: true }) }); setPushEnabled(true);
  }
  async function savePhoto() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 }); if (result.canceled) return;
    const file = new File(result.assets[0].uri); const bytes = await file.bytes();
    await api("/api/v1/me/photo", { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }); await refresh(); }
  async function shareQr() { if (!qr) return; const file = new File(Paths.cache, "lieferdank-qr.png"); file.write(qr.qrPng.split(",")[1], { encoding: "base64" });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: "Dein LieferDank-Code" }); else await Share.share({ message: driverThankUrl(qr.code) }); }
  if (!booted || (!fontLoaded && !fontError)) return <SafeAreaView style={styles.page}><Loading /></SafeAreaView>;
  const date = (value: string) => new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  return <SafeAreaView style={styles.page}><StatusBar style="dark" /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><BrandMark /><Text style={styles.title}>Liefer<Text style={{ color: colors.coral }}>Dank</Text></Text></View>
      {token && <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" onPress={() => setScreen("settings")} style={{ padding: 12 }}><Ionicons name="settings-outline" size={25} color={colors.navy} /></Pressable>}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} refreshControl={token ? <RefreshControl refreshing={busy} onRefresh={() => run(refresh)} tintColor={colors.blue} /> : undefined}>
      {error ? <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text>{token && <Button title="Erneut versuchen" subtle disabled={busy} onPress={() => run(refresh)} />}</View> : null}
      {!token ? <>
        <Text style={styles.heading}>{authMode === "login" ? "Schön, dass du da bist." : authMode === "register" ? "Dein Danke beginnt hier." : authMode === "forgot" ? "Passwort vergessen?" : "Neues Passwort"}</Text><Text style={styles.muted}>Dein Einsatz verdient ein Danke.</Text>
        <Card>{authMode === "register" && <><Field label="Vorname" value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={60} /><Field label="Nachname" value={lastName} onChangeText={setLastName} autoComplete="family-name" maxLength={60} /></>}{authMode !== "reset" && <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />}
          {(authMode === "login" || authMode === "register") && <Field label={authMode === "register" ? "Passwort · mindestens 8 Zeichen" : "Passwort"} value={password} onChangeText={setPassword} secureTextEntry autoComplete={authMode === "register" ? "new-password" : "current-password"} />}
          {authMode === "register" && <View style={{ gap: 8 }}><Text style={styles.muted}>Ich stimme den AGB zu und habe die Datenschutzhinweise gelesen. Die Links findest du unten.</Text><Switch accessibilityLabel="AGB und Datenschutzhinweise bestätigen" value={acceptedTerms} onValueChange={setAcceptedTerms} /></View>}
          {authMode === "reset" && <Field label="Neues Passwort · mindestens 8 Zeichen" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />}
          <Button disabled={busy || (authMode === "register" && !acceptedTerms)} title={busy ? "Einen Moment …" : authMode === "register" ? "Kostenlos registrieren" : authMode === "login" ? "Anmelden" : authMode === "forgot" ? "Reset-Link senden" : "Passwort speichern"} onPress={() => run(async () => {
            if (authMode === "register") await register();
            else if (authMode === "login") await login();
            else if (authMode === "forgot") { await callApi(BASE, "/api/v1/auth/reset", null, { method: "POST", body: JSON.stringify({ email }) }); Alert.alert("Prüfe dein Postfach", "Wenn ein Konto zu dieser Adresse existiert, bekommst du einen Reset-Link."); }
            else { await callApi(BASE, "/api/v1/auth/reset", null, { method: "PATCH", body: JSON.stringify({ token: resetToken, password: newPassword }) }); setNewPassword(""); setResetToken(""); setAuthMode("login"); Alert.alert("Passwort geändert", "Du kannst dich jetzt anmelden."); }
          })} />
          <Button subtle title={authMode === "login" ? "Passwort vergessen" : "Zur Anmeldung"} onPress={() => setAuthMode(authMode === "login" ? "forgot" : "login")} />
          {authMode === "login" && <Button subtle title="Kostenloses Zustellerkonto erstellen" onPress={() => { setError(""); setAuthMode("register"); }} />}
        </Card>
      </> : <>
        {screen === "dashboard" && <>
          <Text style={styles.heading}>Hallo {profile?.firstName || "👋"}</Text>
          {profile && !profile.emailVerified && <Card><Text style={styles.title}>Bitte bestätige deine E-Mail</Text><Text style={styles.muted}>Öffne den Link in deinem Postfach, damit du Trinkgeld aktivieren kannst.</Text><Button title="Bestätigungs-E-Mail erneut senden" subtle disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/verification", { method: "POST" }); Alert.alert("E-Mail gesendet", "Prüfe dein Postfach."); })} /></Card>}
          {lastUpdated && <Text style={styles.muted}>Zuletzt aktualisiert: {lastUpdated}</Text>}
          {!stats ? <Loading /> : <><Card><Text style={styles.title}>Heute</Text><Text style={styles.value}>{euro(stats.today.driverCents)}</Text><Text style={styles.muted}>{stats.today.tipCount} Trinkgelder</Text><Text style={styles.text}>❤️ {stats.today.thanks} Danke</Text></Card>
            <Card><Text style={styles.title}>Seit Beginn</Text><Text style={styles.text}>{stats.total.thanks} Danke · {euro(stats.total.driverCents)}</Text><Text style={styles.muted}>Erstattungen sind berücksichtigt. Stripe zeigt dir deinen tatsächlich auszahlbaren Betrag.</Text></Card>
            <Card><Text style={styles.title}>Deine letzten Trinkgelder</Text>{earnings.filter(e => e.paymentStatus === "succeeded").slice(0,3).map(e => <View key={e.id}><Text style={styles.text}>{euro(e.shareBeforeStripeCents)} Trinkgeld</Text><Text style={styles.muted}>{date(e.createdAt)}</Text></View>)}{!earnings.some(e => e.paymentStatus === "succeeded") && <Text style={styles.muted}>Hier erscheinen deine bestätigten Trinkgelder.</Text>}<Button title="Alle Einnahmen ansehen" subtle onPress={() => setScreen("earnings")} /></Card>
            <Card><Text style={styles.title}>Deine letzten Nachrichten</Text>{thanks.slice(0,3).map(t => <Text key={t.id} style={styles.text}>{t.message || "❤️ Danke für deinen Einsatz"}</Text>)}{!thanks.length && <Text style={styles.muted}>Dein erstes Danke wartet auf dich.</Text>}</Card></>}
          {stripe && !stripe.ready && <Card><Text style={{ ...styles.title, color: "#a42d34" }}>Auszahlung noch nicht eingerichtet</Text><Text style={styles.text}>Richte dein Auszahlungskonto ein, damit du Trinkgelder empfangen kannst. Dein QR-Code und kostenlose Danksagungen funktionieren bereits.</Text><Button title="Auszahlung einrichten" onPress={() => setScreen("stripe")} /></Card>}
        </>}
        {screen === "earnings" && <><Text style={styles.heading}>Deine Einnahmen</Text><Text style={styles.muted}>Trinkgeld nach LieferDank-Gebühr. Stripe zieht seine Kosten separat ab und zeigt dir den auszahlbaren Betrag.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[["all","Alle"],["succeeded","Erhalten"], ...(earnings.some(e => e.refundedCents > 0) ? [["refunded","Erstattet"]] : []), ...(earnings.some(e => e.paymentStatus === "review_required") ? [["review_required","In Prüfung"]] : [])].map(([v,l]) => <FilterChip key={v} title={l} selected={filter === v} onPress={() => setFilter(v)} />)}</ScrollView>
          {earnings.filter(e => filter === "all" || (filter === "refunded" ? e.refundedCents > 0 : e.paymentStatus === filter)).map(e => <Card key={e.id}><Text style={styles.value}>{euro(e.shareBeforeStripeCents)}</Text><Text style={styles.text}>{e.paymentStatus === "review_required" ? "In Prüfung · nicht verfügbar" : e.paymentStatus === "refunded" ? "Erstattet" : e.paymentStatus === "succeeded" ? "Erhalten" : "Noch nicht bestätigt"}</Text><Text style={styles.muted}>{date(e.createdAt)}{e.refundedCents > 0 ? ` · ${euro(e.refundedCents)} erstattet` : ""}</Text></Card>)}
          {!earnings.length && <Card><Text style={styles.text}>Hier erscheinen deine ersten Trinkgelder.</Text></Card>}
          {nextCursor && <Button disabled={busy} title="Weitere laden" subtle onPress={() => run(async () => { const page = await api<{ items: Earning[]; nextCursor: string | null }>(`/api/v1/me/earnings?before=${encodeURIComponent(nextCursor)}`); setEarnings(previous => [...previous, ...page.items.filter(i => !previous.some(p => p.id === i.id))]); setNextCursor(page.nextCursor); })} />}
        </>}
        {screen === "thanks" && <><Text style={styles.heading}>Deine Danke</Text>{thanks.map(t => <Card key={t.id}><Text style={styles.text}>{t.message || "❤️ Danke für deinen Einsatz"}</Text><Text style={styles.muted}>{date(t.createdAt)}{t.tipId ? " · mit Trinkgeld" : ""}</Text>{t.message && <Button title="Nachricht entfernen" subtle disabled={busy} onPress={() => run(async () => { await api(`/api/v1/me/thanks/${t.id}`, { method: "DELETE" }); await refresh(); })} />}<Button title="Inhalt melden" subtle onPress={() => run(() => openBrowser("https://lieferdank.de/kontakt"))} /></Card>)}{thanksCursor && <Button title="Weitere Danke laden" subtle disabled={busy} onPress={() => run(async () => { const page = await api<{ items: Thank[]; nextCursor: string | null }>(`/api/v1/me/thanks?before=${encodeURIComponent(thanksCursor)}`); setThanks(previous => [...previous, ...page.items.filter(i => !previous.some(p => p.id === i.id))]); setThanksCursor(page.nextCursor); })} />}{!thanks.length && <Card><Text style={styles.text}>Teile deinen Code und gib Kunden die Möglichkeit, Danke zu sagen.</Text><Button title="Meinen QR-Code öffnen" onPress={() => setScreen("qr")} /></Card>}</>}
        {screen === "qr" && <><Text style={styles.heading}>Dein Danke-Code</Text>{!qr ? <Button title="QR-Code laden" disabled={busy} onPress={() => run(async () => setQr(await api<Qr>("/api/v1/me/code")))} /> : <><Card><Text style={styles.title}>{profile?.customName || profile?.firstName}</Text><View style={{ alignItems: "center" }}><SvgXml xml={qr.qrSvg} width="100%" height={260} accessibilityLabel="Dein persönlicher LieferDank-QR-Code" /></View><Text style={{ ...styles.muted, textAlign: "center" }}>{qr.code}
Keine App nötig · Trinkgeld freiwillig</Text></Card><Card><Text style={styles.title}>Deine digitale Karte</Text><SvgXml xml={qr.cardSvg} width="100%" height={200} accessibilityLabel="Vorschau deiner persönlichen LieferDank-Karte" /></Card><Button title="QR-Code als Bild teilen / speichern" disabled={busy} onPress={() => run(shareQr)} /><Button subtle title="Link teilen" onPress={() => run(async () => { await Share.share({ message: driverThankUrl(qr.code) }); })} /><Button subtle title="Danke-Seite ansehen" onPress={() => run(() => openBrowser(driverThankUrl(qr.code)))} /></> }</>}
        {screen === "profile" && <><View style={{ ...styles.row, alignItems: "center", justifyContent: "space-between" }}><Text style={styles.heading}>Dein Profil</Text><Pressable accessibilityRole="button" accessibilityLabel="Informationen zum öffentlichen Profil" onPress={() => Alert.alert("Dein öffentliches Profil", "Dein Anzeigename und dein persönlicher Text erscheinen auf deiner Danke-Seite. Dein Foto wird nur angezeigt, wenn du es freigibst. Deine E-Mail bleibt privat.")} style={{ padding: 12 }}><Ionicons name="information-circle-outline" size={26} color={colors.blue} /></Pressable></View>{!profile ? <Loading /> : <Card>
          {profile.hasPhoto && token && <Image source={{ uri: `${BASE}/api/v1/me/photo`, headers: { authorization: `Bearer ${token}` } }} style={{ width: 90, height: 90, borderRadius: 45 }} accessibilityLabel="Dein Profilfoto" />}
          <Field label="Vorname" value={profile.firstName} onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, firstName: v }); }} maxLength={60} /><Field label="Nachname" value={profile.lastName} onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, lastName: v }); }} maxLength={60} />
          <Field label="Öffentlicher Anzeigename" value={profile.customName ?? profile.firstName} onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, nameDisplay: "custom", customName: v }); }} maxLength={30} />
          <Field label="Kurzer Satz über dich" value={profile.tagline ?? ""} onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, tagline: v }); }} maxLength={80} />
          <Field label="Persönlicher Text" value={profile.bio ?? ""} onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, bio: v }); }} maxLength={280} multiline />
          <View style={styles.row}><Text style={styles.text}>Foto öffentlich anzeigen</Text><Switch accessibilityLabel="Foto öffentlich anzeigen" value={profile.photoPublic} onValueChange={v => { profileDirty.current = true; setProfile({ ...profile, photoPublic: v }); }} /></View>
          <View style={styles.row}><Text style={styles.text}>Öffentliches Profil aktiv</Text><Switch accessibilityLabel="Öffentliches Profil aktiv" value={profile.active} onValueChange={v => { profileDirty.current = true; setProfile({ ...profile, active: v }); }} /></View>
          <Button title="Profil speichern" disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/profile", { method: "PATCH", body: JSON.stringify(profile) }); profileDirty.current = false; setQr(null); await refresh(); Alert.alert("Gespeichert", "Dein Profil ist aktualisiert."); })} />
          <Button subtle title="Profilfoto wählen" disabled={busy} onPress={() => run(savePhoto)} />{profile.hasPhoto && <Button subtle title="Profilfoto entfernen" disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/photo", { method: "DELETE" }); await refresh(); })} />}
        </Card>}</>}
        {screen === "stripe" && <><Text style={styles.heading}>Stripe & Auszahlung</Text>{!stripe ? <Loading /> : <Card><Text style={styles.title}>{!stripe.verifiedNow ? "Status gerade nicht prüfbar" : stripe.ready ? "Dein Auszahlungskonto ist bereit" : stripe.connected ? "Einrichtung noch nicht abgeschlossen" : "Auszahlung einrichten"}</Text>
          <Text style={styles.text}>Stripe ist unser Zahlungs- und Auszahlungspartner. Du brauchst noch kein Stripe-Konto. Die Einrichtung erfolgt im nächsten Schritt direkt bei Stripe.</Text>
          {stripe.manualPayouts && <Text style={styles.error}>Dein Auszahlungsplan ist manuell. Prüfe ihn in deinem Stripe-Konto.</Text>}
          {!stripe.emailVerified && <><Text style={styles.error}>Bestätige zuerst deine E-Mail-Adresse.</Text><Button title="Bestätigungs-E-Mail erneut senden" disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/verification", { method: "POST" }); Alert.alert("E-Mail gesendet", "Prüfe dein Postfach."); })} /></>}
          {stripe.ready ? <Button title="Bei Stripe anmelden" onPress={() => run(() => openBrowser("https://dashboard.stripe.com/login"))} /> : <>
            {!stripe.connected && <><Text style={styles.muted}>Kunden zahlen direkt auf dein Stripe-Konto. LieferDank behält je Trinkgeld {Object.entries(stripe.applicationFees).map(([amount, fee]) => `${euro(fee)} bei ${euro(Number(amount))}`).join(", ")}. Stripe-Kosten kommen separat hinzu. Unbefristet, jederzeit kündbar; 14-tägiges Widerrufsrecht gemäß AGB.</Text>
            <Text style={styles.muted}>Ich verlange ausdrücklich, dass Lieferdank vor Ablauf der Widerrufsfrist mit der Trinkgeld-Funktion beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen anteiligen Betrag für die bis dahin erbrachten Leistungen zahle.</Text><Switch accessibilityLabel="Sofortigen Leistungsbeginn ausdrücklich verlangen" value={consent} onValueChange={setConsent} /></>}
            <Button title={stripe.connected ? "Einrichtung fortsetzen" : "Trinkgeld zahlungspflichtig aktivieren"} disabled={busy || !stripe.emailVerified || (!stripe.connected && !consent)} onPress={() => run(async () => { const value = await api<{ url: string }>("/api/v1/me/stripe", { method: "POST", body: JSON.stringify({ immediateStart: consent }) }); await openBrowser(value.url); })} />
          </>}
          <Button title="Status aktualisieren" subtle disabled={busy} onPress={() => run(refresh)} />
        </Card>}</>}
        {screen === "settings" && <><Text style={styles.heading}>Einstellungen</Text><Card><Text style={styles.text}>{profile?.email}</Text><Text style={styles.muted}>Benachrichtigungen auf diesem Gerät</Text><Switch accessibilityLabel="Push-Benachrichtigungen aktivieren" value={pushEnabled} onValueChange={v => run(() => enablePush(v))} disabled={busy} /><Button title="Stripe & Auszahlung" subtle onPress={() => setScreen("stripe")} /><Button title="Datenexport teilen" subtle disabled={busy} onPress={() => run(async () => { const data = await api("/api/v1/me/export"); const file = new File(Paths.cache, "lieferdank-datenexport.json"); file.write(JSON.stringify(data, null, 2)); await Sharing.shareAsync(file.uri, { mimeType: "application/json" }); file.delete(); })} /></Card>
          <Card><Text style={styles.title}>Passwort ändern</Text><Field label="Aktuelles Passwort" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /><Field label="Neues Passwort · mindestens 8 Zeichen" value={newPassword} onChangeText={setNewPassword} secureTextEntry /><Button title="Passwort ändern und abmelden" disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }); await clearSession(); })} /></Card>
          <Button title="Abmelden" disabled={busy} onPress={() => run(logout)} /><Button title="Konto löschen" danger disabled={busy} onPress={() => Alert.alert("Konto löschen?", "Dein Profil wird deaktiviert. Gesetzlich aufzubewahrende Zahlungsdaten bleiben erhalten. Gib zur Bestätigung oben dein aktuelles Passwort ein.", [{ text: "Abbrechen", style: "cancel" }, { text: "Konto löschen", style: "destructive", onPress: () => run(async () => { await api("/api/v1/me/delete", { method: "POST", body: JSON.stringify({ password: currentPassword }) }); await clearSession(); }) }])} />
        </>}
      </>}
      {(screen === "settings" || screen === "stripe" || !token) && <View style={{ gap: 10 }}>{[["Datenschutz","/legal/datenschutz"],["AGB","/legal/agb"],["Impressum","/legal/impressum"],["Kontakt / Support","/kontakt"]].map(([label,path]) => <Button key={path} title={label} subtle onPress={() => run(() => openBrowser(`https://lieferdank.de${path}`))} />)}</View>}
    </ScrollView>
    {token && <View style={{ flexDirection: "row", backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.line }}>{tabs.map(t => <View key={t.screen} collapsable={false} style={{flex:1}}><Pressable accessible accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: screen === t.screen }} onPress={() => { setScreen(t.screen); setError(""); }} style={({pressed}) => ({flex:1,minHeight:64,alignItems:"center",justifyContent:"center",gap:4,paddingVertical:8,paddingHorizontal:2,opacity:pressed?0.7:1,backgroundColor:screen===t.screen?"#edf3f9":"white"})}><Ionicons name={t.icon} size={22} color={screen === t.screen ? colors.blue : colors.muted} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /><Text style={{fontSize:12,fontWeight:"600",color:screen===t.screen?colors.blue:colors.muted,textAlign:"center"}}>{t.label}</Text></Pressable></View>)}</View>}
  </KeyboardAvoidingView></SafeAreaView>;
}
