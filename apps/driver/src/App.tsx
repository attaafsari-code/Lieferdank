import fontAsset from "../assets/jakarta.ttf";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Linking, LogBox, Platform, Pressable, RefreshControl, ScrollView, Share, Switch, Text, View } from "react-native";
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
import * as Print from "expo-print";
import { cardDocument, CARD_PAPER, printWasCancelled } from "./card-document";
import { CardEditor } from "./CardEditor";
import { CardArtwork } from "./CardArtwork";
import { RankSummary, RanksScreen } from "./Ranks";
import { useFonts } from "expo-font";
import { SvgXml } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ApiError, callApi, deepLink, driverThankUrl, euro, legalPages, trustedBrowserUrl, validateApiBase, type Screen } from "./api";
import type { Earning, Favorite, History, Me, Profile, Qr, Role, Stats, StripeStatus, Thank } from "./types";
import { Avatar, BrandMark, BrandWordmark, Button, Card, FilterChip, colors, Field, Loading, Segmented, styles, TextLink } from "./ui";

const BASE = validateApiBase(process.env.EXPO_PUBLIC_API_URL ?? "https://lieferdank.de", __DEV__);
const SESSION_KEY = "lieferdank.driver.session";
// Simulator runs against a local test API only: keep developer warning toasts out of screenshots.
if (__DEV__ && BASE !== "https://lieferdank.de") LogBox.ignoreAllLogs(true);
const REVOKE_KEY = "lieferdank.driver.pending-revocation";
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
type Tab = { screen: Screen; label: string; icon: keyof typeof Ionicons.glyphMap };
const tabsFor: Record<Role, Tab[]> = {
  driver: [{ screen: "dashboard", label: "Übersicht", icon: "grid-outline" }, { screen: "earnings", label: "Einnahmen", icon: "wallet-outline" },
    { screen: "qr", label: "QR-Code", icon: "qr-code-outline" }, { screen: "thanks", label: "Danke", icon: "heart-outline" }, { screen: "profile", label: "Profil", icon: "person-outline" }],
  customer: [{ screen: "saved", label: "Gespeichert", icon: "bookmark-outline" }, { screen: "history", label: "Verlauf", icon: "time-outline" }, { screen: "settings", label: "Konto", icon: "person-circle-outline" }],
  admin: [{ screen: "admin", label: "Übersicht", icon: "shield-checkmark-outline" }, { screen: "settings", label: "Konto", icon: "person-circle-outline" }],
};
const homeFor: Record<Role, Screen> = { driver: "dashboard", customer: "saved", admin: "admin" };
const roleLabel: Record<Role, string> = { driver: "Zusteller:in", customer: "Kund:in", admin: "Administrator:in" };
type AuthMode = "login" | "register" | "forgot" | "reset";

export default function App() { return <SafeAreaProvider><LieferDankApp /></SafeAreaProvider>; }

function LieferDankApp() {
  const [fontLoaded, fontError] = useFonts({ Jakarta: fontAsset });
  const [token, setToken] = useState<string | null>(null); const tokenRef = useRef<string | null>(null);
  const [me, setMe] = useState<Me["user"] | null>(null);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [activationOpen, setActivationOpen] = useState(false);
  const [newsletter, setNewsletter] = useState<{ available: boolean; status: string } | null>(null);
  const [newsletterOpen, setNewsletterOpen] = useState(false); const [newsletterConsent, setNewsletterConsent] = useState(false);
  const profileDirty = useRef(false); const scrollRef = useRef<ScrollView>(null);
  const [booted, setBooted] = useState(false); const [screen, setScreen] = useState<Screen>("dashboard");
  const [error, setError] = useState(""); const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [stats, setStats] = useState<Stats | null>(null); const [profile, setProfile] = useState<Profile | null>(null);
  const [stripe, setStripe] = useState<StripeStatus | null>(null); const [qr, setQr] = useState<Qr | null>(null);
  const [editingCard, setEditingCard] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]); const [thanks, setThanks] = useState<Thank[]>([]);
  const [favorites, setFavorites] = useState<Favorite[] | null>(null); const [history, setHistory] = useState<History | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [registerRole, setRegisterRole] = useState<"driver" | "customer">("driver");
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [resetToken, setResetToken] = useState(""); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState(""); const [newCode, setNewCode] = useState("");
  const [consent, setConsent] = useState(false); const [pushEnabled, setPushEnabled] = useState(false); const [pushAvailable, setPushAvailable] = useState(false); const [filter, setFilter] = useState("all");
  const [thanksCursor, setThanksCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [lastUpdated, setLastUpdated] = useState("");
  const role: Role | null = me && viewRole && (me.roles ?? [me.role]).includes(viewRole) ? viewRole : me?.role ?? null;

  const clearSession = useCallback(async () => {
    profileDirty.current = false; tokenRef.current = null; setToken(null); setMe(null); setViewRole(null); setNewsletter(null); setStats(null); setProfile(null); setStripe(null); setQr(null);
    setEarnings([]); setThanks([]); setFavorites(null); setHistory(null); setPassword(""); setCurrentPassword(""); setNewPassword(""); setDeletePassword(""); setPushEnabled(false);
    setNewsletterConsent(false); setNewsletterOpen(false); setAcceptedTerms(false); setActivationOpen(false);
    setEditingCard(false);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);
  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    try { return await callApi<T>(BASE, path, tokenRef.current, init); }
    catch (e) { if (e instanceof ApiError && e.status === 401 && tokenRef.current) await clearSession(); throw e; }
  }, [clearSession]);
  const refresh = useCallback(async () => {
    const active = tokenRef.current; if (!active) return;
    const account = (await api<Me>("/api/v1/me")).user;
    if (active !== tokenRef.current) return;
    setMe(account);
    if ((account.roles ?? [account.role]).includes("driver")) {
      const values = await Promise.all([api<Stats>("/api/v1/me/stats"), api<Profile>("/api/v1/me/profile"), api<StripeStatus>("/api/v1/me/stripe"), api<{ items: Earning[]; nextCursor: string | null }>("/api/v1/me/earnings"), api<{ items: Thank[]; nextCursor: string | null }>("/api/v1/me/thanks"), api<{ enabled: boolean; available?: boolean }>("/api/v1/me/push")]);
      if (active !== tokenRef.current) return;
      setStats(values[0]); if (!profileDirty.current) setProfile(values[1]); setStripe(values[2]); setEarnings(values[3].items); setNextCursor(values[3].nextCursor); setThanks(values[4].items); setThanksCursor(values[4].nextCursor); setPushEnabled(values[5].enabled); setPushAvailable(values[5].available === true);
    }
    if ((account.roles ?? [account.role]).includes("customer")) {
      const [saved, given] = await Promise.all([api<{ favorites: Favorite[] }>("/api/v1/me/favorites"), api<History>("/api/v1/me/history")]);
      if (active !== tokenRef.current) return;
      setFavorites(saved.favorites); setHistory(given);
    }
    setLastUpdated(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    const preference = await api<{ available: boolean; status: string }>("/api/v1/me/newsletter");
    if (active === tokenRef.current) setNewsletter(preference);
  }, [api]);
  useEffect(() => {
    if (!me?.id) return;
    const id = me.id;
    SecureStore.getItemAsync(`lieferdank.view.${id}`).then(value => { if (value === "driver" || value === "customer") setViewRole(value); }).catch(() => undefined);
  }, [me?.id]);
  async function switchRole(value: Role) {
    if (!me || !(me.roles ?? [me.role]).includes(value)) return;
    await SecureStore.setItemAsync(`lieferdank.view.${me.id}`, value, secureOptions);
    setViewRole(value); setScreen(homeFor[value]); setInfo(""); setError("");
  }
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(""); setInfo("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Bitte versuche es erneut."); } finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    SecureStore.getItemAsync(REVOKE_KEY).then(async pending => {
      if (!pending) return;
      try { await callApi(BASE, "/api/v1/me/logout", pending, { method: "POST" }); await SecureStore.deleteItemAsync(REVOKE_KEY); }
      catch (e) { if (e instanceof ApiError && e.status === 401) await SecureStore.deleteItemAsync(REVOKE_KEY); }
    }).catch(() => setError("Eine frühere Abmeldung konnte noch nicht synchronisiert werden. Sie wird beim nächsten Start erneut versucht."));
    SecureStore.getItemAsync(SESSION_KEY).then(t => { tokenRef.current = t; setToken(t); }).catch(() => setError("Die sichere Sitzung konnte nicht geladen werden. Bitte melde dich erneut an.")).finally(() => setBooted(true));
  }, []);
  useEffect(() => {
    if (!token) return;
    refresh().catch(e => setError(e.message));
    const timer = setInterval(() => { if (AppState.currentState === "active") refresh().catch(e => setError(e.message)); }, 60000);
    return () => clearInterval(timer);
  }, [token, refresh]);
  // Every screen starts at the top, like a native tab switch.
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen, editingCard]);
  useEffect(() => {
    if (screen !== "qr" || role !== "driver") return;
    let active = true;
    const reload = () => { const owner = tokenRef.current; if (owner) api<Qr>("/api/v1/me/code").then(value => { if (active && owner === tokenRef.current) setQr(value); }).catch(e => { if (active) setError(e.message); }); };
    reload(); const subscription = AppState.addEventListener("change", state => { if (state === "active") reload(); });
    return () => { active = false; subscription.remove(); };
  }, [screen, role, api, editingCard]);
  useEffect(() => { if (role && !tabsFor[role].some(t => t.screen === screen) && !(role === "driver" && ["stripe", "settings", "milestones"].includes(screen)) && screen !== "settings") setScreen(homeFor[role]); }, [role, screen]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => { if (state === "active" && tokenRef.current) refresh().catch(e => setError(e.message)); });
    const onLink = async (value: string) => {
      // Simulator-only test hooks against a local API; __DEV__ is false (and this branch removed) in release builds.
      if (__DEV__ && BASE !== "https://lieferdank.de" && value.startsWith("lieferdank://dev-")) {
        const u = new URL(value); const t = u.searchParams.get("token"); const s = u.searchParams.get("screen");
        if (t) { await SecureStore.setItemAsync(SESSION_KEY, t, secureOptions); tokenRef.current = t; setToken(t); }
        if (s) setScreen(s as Screen);
        const m = u.searchParams.get("auth"); if (m) { await clearSession(); setAuthMode(m as AuthMode); setRegisterRole(u.searchParams.get("as") === "customer" ? "customer" : "driver"); }
        if (u.searchParams.get("scroll") === "end") setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 1500);
        return;
      }
      const parsed = deepLink(value); if (!parsed) return;
      if (parsed.resetToken) { await clearSession(); setResetToken(parsed.resetToken); setAuthMode("reset"); }
      if (parsed.verificationToken) { await callApi(BASE, "/api/v1/auth/verification", null, { method: "POST", body: JSON.stringify({ token: parsed.verificationToken }) }); Alert.alert("E-Mail bestätigt", "Danke! Deine E-Mail-Adresse ist jetzt bestätigt."); }
      if (parsed.screen) setScreen(parsed.screen);
      if (tokenRef.current) await refresh();
    };
    Linking.getInitialURL().then(url => { if (url) return onLink(url); }).catch(e => setError(e.message));
    const links = Linking.addEventListener("url", ({ url }) => { onLink(url).catch(e => setError(e.message)); });
    const handleNotification = (response: Notifications.NotificationResponse) => {
      const target = response.notification.request.content.data?.screen;
      if (["earnings", "thanks", "stripe"].includes(String(target))) setScreen(target as Screen);
    };
    const notifications = Notifications.addNotificationResponseReceivedListener(handleNotification);
    Notifications.getLastNotificationResponseAsync().then(r => { if (r) handleNotification(r); }).catch(() => undefined);
    return () => { sub.remove(); links.remove(); notifications.remove(); };
  }, [refresh, clearSession]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!token && authMode !== "login") { setAuthMode("login"); return true; }
      if (role && screen !== homeFor[role]) { setScreen(homeFor[role]); return true; }
      return false;
    });
    return () => back.remove();
  }, [screen, token, authMode, role]);

  async function openBrowser(url: string) {
    if (!trustedBrowserUrl(url)) throw new Error("Diese Seite kann in der App nicht geöffnet werden.");
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: colors.blue, dismissButtonStyle: "close", enableBarCollapsing: true });
  }
  /** Legal texts and help open in an in-app sheet, never in external Safari. */
  const openLegal = (path: string) => run(() => openBrowser(`https://lieferdank.de${path}`));
  async function saveSession(session: { token: string; role?: Role }) {
    await SecureStore.setItemAsync(SESSION_KEY, session.token, secureOptions);
    tokenRef.current = session.token; setToken(session.token); setPassword(""); setScreen(homeFor[session.role ?? "driver"]);
  }
  async function register() {
    const body = registerRole === "customer" ? { role: "customer", firstName, email, password, acceptedTerms } : { role: "driver", firstName, lastName, email, password, acceptedTerms };
    const session = await callApi<{ token: string; role: Role; mailSent?: boolean }>(BASE, "/api/v1/auth/mobile/register", null, { method: "POST", body: JSON.stringify(body) });
    await saveSession(session); setAcceptedTerms(false); if (session.role === "driver") setScreen("profile");
    const address = email.trim().toLowerCase();
    Alert.alert("Willkommen bei LieferDank", (session.mailSent === false
      ? `Die Bestätigungs-E-Mail an ${address} konnte gerade nicht verschickt werden. Du kannst sie später in der App erneut anfordern.`
      : `Wir haben dir eine E-Mail an ${address} geschickt. Bitte bestätige darin deine Adresse.`) + (session.role === "driver" ? " Dein Danke-Code ist bereits bereit." : ""));
  }
  async function login() {
    const session = await callApi<{ token: string; role: Role }>(BASE, "/api/v1/auth/mobile/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
    await saveSession(session);
  }
  async function logout() {
    const current = tokenRef.current; if (!current) return;
    // Local logout always succeeds offline. Revocation is retried on the next start.
    await SecureStore.setItemAsync(REVOKE_KEY, current, secureOptions);
    try { await api("/api/v1/me/logout", { method: "POST" }); await SecureStore.deleteItemAsync(REVOKE_KEY); }
    catch (e) { if (e instanceof ApiError && e.status === 401) await SecureStore.deleteItemAsync(REVOKE_KEY); }
    await clearSession(); setAuthMode("login");
  }
  async function resendVerification() {
    await api("/api/v1/me/verification", { method: "POST" });
    setInfo(`Wir haben die Bestätigungs-E-Mail an ${me?.email ?? "deine Adresse"} verschickt. Prüfe bitte auch den Spam-Ordner.`);
  }
  async function enablePush(value: boolean) {
    if (!value) { await api("/api/v1/me/push", { method: "DELETE" }); setPushEnabled(false); return; }
    if (!Device.isDevice) throw new Error("Benachrichtigungen funktionieren nur auf einem echten iPhone.");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Benachrichtigungen sind in dieser Version noch nicht verfügbar.");
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "LieferDank", importance: Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.requestPermissionsAsync(); if (permission.status !== "granted") throw new Error("Benachrichtigungen sind nicht erlaubt. Du kannst das in den iPhone-Einstellungen ändern.");
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/v1/me/push", { method: "POST", body: JSON.stringify({ token: pushToken, enabled: true }) }); setPushEnabled(true);
  }
  async function savePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (result.canceled) return false;
    const file = new File(result.assets[0].uri); const bytes = await file.bytes();
    await api("/api/v1/me/photo", { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }); await refresh();
    setQr(await api<Qr>("/api/v1/me/code")); return true;
  }
  async function shareQr() {
    if (!qr) return; const file = new File(Paths.cache, "lieferdank-qr.png"); file.write(qr.qrPng.split(",")[1], { encoding: "base64" });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: "Dein LieferDank-Code", UTI: "public.png" }); else await Share.share({ message: driverThankUrl(qr.code) });
  }
  async function exportCard(print: boolean) {
    if (!qr) return;
    const result = await Print.printToFileAsync({ html: cardDocument(qr.cardSvg), ...CARD_PAPER, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
    if (result.numberOfPages !== 1) throw new Error("Das Kartenformat konnte nicht erstellt werden. Bitte versuche es erneut.");
    if (print) {
      try { await Print.printAsync({ uri: result.uri }); }
      catch (error) { if (!printWasCancelled(error)) throw new Error("Die Karte konnte nicht gedruckt werden. Bitte prüfe deinen Drucker und versuche es erneut."); }
    }
    else {
      const file = new File(Paths.cache, `LieferDank-Karte-${qr.code}-${Date.now()}.pdf`); new File(result.uri).copy(file);
      if (!await Sharing.isAvailableAsync()) throw new Error("Das Teilen-Menü ist gerade nicht verfügbar.");
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Karte speichern oder teilen" });
    }
  }
  async function exportData() {
    const data = await api("/api/v1/me/export"); const file = new File(Paths.cache, "lieferdank-datenexport.json");
    file.write(JSON.stringify(data, null, 2)); await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json" }); file.delete();
  }
  function confirmDelete() {
    if (!deletePassword) { setError("Bitte gib zur Bestätigung dein Passwort ein."); return; }
    Alert.alert("Konto endgültig löschen?", role === "driver"
      ? "Dein öffentliches Profil und dein QR-Code werden deaktiviert. Gesetzlich aufzubewahrende Zahlungsdaten bleiben erhalten."
      : "Dein Konto und deine gespeicherten Zusteller werden gelöscht. Gesetzlich aufzubewahrende Zahlungsdaten bleiben erhalten.",
    [{ text: "Abbrechen", style: "cancel" }, { text: "Konto löschen", style: "destructive", onPress: () => run(async () => {
      await api("/api/v1/me/delete", { method: "POST", body: JSON.stringify({ password: deletePassword }) }); await clearSession();
      Alert.alert("Konto gelöscht", "Dein Konto wurde gelöscht. Danke, dass du LieferDank genutzt hast.");
    }) }]);
  }

  if (!booted || (!fontLoaded && !fontError)) return <SafeAreaView style={styles.page}><Loading /></SafeAreaView>;
  const date = (value: string) => new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const tabs = role ? tabsFor[role] : [];
  const verifiedBanner = me && !me.emailVerified && <Card><Text style={styles.title}>Bitte bestätige deine E-Mail</Text>
    <Text style={styles.muted}>Wir haben dir einen Link an {me.email} geschickt.{role === "driver" ? " Erst danach kannst du Trinkgeld aktivieren." : ""}</Text>
    <Button title="E-Mail erneut senden" subtle disabled={busy} onPress={() => run(resendVerification)} /></Card>;

  const authScreen = <>
    <View style={{ gap: 6 }}>
      <Text style={styles.heading}>{authMode === "login" ? "Willkommen zurück" : authMode === "register" ? "Konto erstellen" : authMode === "forgot" ? "Passwort vergessen?" : "Neues Passwort"}</Text>
      <Text style={styles.muted}>{authMode === "login" ? "Melde dich mit deinem LieferDank-Konto an. Es ist dasselbe wie auf lieferdank.de." : authMode === "register" ? "Kostenlos und in einer Minute fertig." : authMode === "forgot" ? "Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst." : "Wähle ein neues Passwort mit mindestens 8 Zeichen."}</Text>
    </View>
    <Card>
      {authMode === "register" && <Segmented label="Ich bin" value={registerRole} onChange={setRegisterRole} options={[["driver", "Zusteller:in"], ["customer", "Kund:in"]]} />}
      {authMode === "register" && <Text style={styles.muted}>{registerRole === "driver" ? "Du bekommst deinen persönlichen QR-Code für Danke und Trinkgeld." : "Speichere deine Zusteller und sieh, wem du schon Danke gesagt hast."}</Text>}
      {authMode === "register" && <Field label={registerRole === "customer" ? "Vorname (optional)" : "Vorname"} value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" maxLength={60} />}
      {authMode === "register" && registerRole === "driver" && <Field label="Nachname" value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" autoCapitalize="words" maxLength={60} />}
      {authMode !== "reset" && <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" textContentType={authMode === "login" ? "username" : "emailAddress"} keyboardType="email-address" inputMode="email" returnKeyType="next" maxLength={200} />}
      {(authMode === "login" || authMode === "register") && <Field label={authMode === "register" ? "Passwort (mindestens 8 Zeichen)" : "Passwort"} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={authMode === "register" ? "new-password" : "current-password"} textContentType={authMode === "register" ? "newPassword" : "password"} maxLength={200} />}
      {authMode === "register" && <View style={styles.switchRow}>
        <Text style={[styles.muted, { flex: 1 }]}>Ich bin mindestens 18 Jahre alt und habe die AGB und die Datenschutzhinweise gelesen.{registerRole === "driver" ? " Die Regeln meines Arbeit- bzw. Auftraggebers beachte ich selbst." : ""}</Text>
        <Switch accessibilityLabel="AGB und Datenschutzhinweise bestätigen" value={acceptedTerms} onValueChange={setAcceptedTerms} trackColor={{ true: colors.blue }} />
      </View>}
      {authMode === "register" && <View style={{ flexDirection: "row", gap: 4 }}><TextLink title="AGB lesen" align="flex-start" onPress={() => openLegal("/legal/agb")} /><TextLink title="Datenschutz lesen" align="flex-start" onPress={() => openLegal("/legal/datenschutz")} /></View>}
      {authMode === "reset" && <Field label="Neues Passwort (mindestens 8 Zeichen)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={200} />}
      <Button disabled={busy || (authMode === "register" && !acceptedTerms)} title={busy ? "Einen Moment …" : authMode === "register" ? "Kostenlos registrieren" : authMode === "login" ? "Anmelden" : authMode === "forgot" ? "Link anfordern" : "Passwort speichern"} onPress={() => run(async () => {
        if (authMode === "register") await register();
        else if (authMode === "login") await login();
        else if (authMode === "forgot") {
          await callApi(BASE, "/api/v1/auth/reset", null, { method: "POST", body: JSON.stringify({ email }) });
          setAuthMode("login");
          setInfo("Wenn es zu dieser Adresse ein Konto gibt, ist ein Link unterwegs. Er gilt 60 Minuten. Kommt nichts an, prüfe bitte den Spam-Ordner.");
        } else {
          await callApi(BASE, "/api/v1/auth/reset", null, { method: "PATCH", body: JSON.stringify({ token: resetToken, password: newPassword }) });
          setNewPassword(""); setResetToken(""); setAuthMode("login"); setInfo("Dein Passwort ist geändert. Du kannst dich jetzt anmelden.");
        }
      })} />
      {authMode === "login" && <TextLink title="Passwort vergessen?" onPress={() => { setError(""); setInfo(""); setAuthMode("forgot"); }} />}
      {authMode !== "login" && <TextLink title="Zurück zur Anmeldung" onPress={() => { setError(""); setAuthMode("login"); }} />}
    </Card>
    {authMode === "login" && <View style={{ alignItems: "center", gap: 2 }}><Text style={styles.muted}>Noch kein Konto?</Text><TextLink title="Kostenlos registrieren" onPress={() => { setError(""); setInfo(""); setAuthMode("register"); }} /></View>}
  </>;

  const driverScreens = <>
    {screen === "dashboard" && <>
      <Text style={styles.heading}>Hallo {profile?.firstName || me?.firstName || ""}</Text>
      {stripe && !stripe.ready && <View style={{ borderRadius: 16, backgroundColor: colors.soft, padding: 16, gap: 8 }}><Text style={styles.title}>Auszahlungskonto einrichten</Text><Text style={styles.muted}>Verbinde dein Bankkonto, damit du Trinkgeld empfangen kannst.</Text><Button title="Jetzt einrichten" onPress={() => setScreen("stripe")} /></View>}
      {verifiedBanner}
      {!stats ? <Loading /> : <>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[styles.card, { flex: 1 }]}><Text style={styles.muted}>Heute</Text><Text style={styles.value}>{euro(stats.today.driverCents)}</Text><Text style={styles.muted}>{stats.today.tipCount} Trinkgeld{stats.today.tipCount === 1 ? "" : "er"}{"\n"}{stats.today.thanks} Danke</Text></View>
          <View style={[styles.card, { flex: 1 }]}><Text style={styles.muted}>Seit Beginn</Text><Text style={styles.value}>{euro(stats.total.driverCents)}</Text><Text style={styles.muted}>{stats.total.thanks} Danke</Text></View>
        </View>
        <Card><Text style={styles.title}>Dein Rang</Text>{stats.rank && <RankSummary progress={stats.rank} />}<Button title="Rang & Meilensteine ansehen" subtle onPress={() => setScreen("milestones")} /></Card>
        <Card><Text style={styles.title}>Letzte Trinkgelder</Text>
          {earnings.filter(e => e.paymentStatus === "succeeded").slice(0, 3).map(e => <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={styles.text}>{euro(e.shareBeforeStripeCents)}</Text><Text style={styles.muted}>{date(e.createdAt)}</Text></View>)}
          {!earnings.some(e => e.paymentStatus === "succeeded") && <Text style={styles.muted}>Hier erscheinen deine bestätigten Trinkgelder.</Text>}
          <TextLink title="Alle Einnahmen ansehen" align="flex-start" onPress={() => setScreen("earnings")} /></Card>
        <Card><Text style={styles.title}>Letzte Nachrichten</Text>{thanks.slice(0, 3).map(t => <Text key={t.id} style={styles.text}>{t.message || "❤️ Danke für deinen Einsatz"}</Text>)}{!thanks.length && <Text style={styles.muted}>Dein erstes Danke wartet auf dich.</Text>}</Card>
      </>}
      {lastUpdated ? <Text style={[styles.muted, { textAlign: "center" }]}>Aktualisiert um {lastUpdated} Uhr</Text> : null}
    </>}
    {screen === "milestones" && <RanksScreen api={api} achievements={stats?.milestones} onBack={() => setScreen("dashboard")} onColors={() => { setScreen("qr"); setEditingCard(true); }} onShare={() => run(async () => { const data = await api<Qr>("/api/v1/me/code"); await Share.share({ message: `${driverThankUrl(data.code)}/profil` }); })} />}
    {screen === "earnings" && <><Text style={styles.heading}>Einnahmen</Text><Text style={styles.muted}>Dein Trinkgeld nach der LieferDank-Gebühr. Den tatsächlich ausgezahlten Betrag siehst du in deinem Stripe-Konto.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[["all", "Alle"], ["succeeded", "Erhalten"], ...(earnings.some(e => e.refundedCents > 0) ? [["refunded", "Erstattet"]] : []), ...(earnings.some(e => e.paymentStatus === "review_required") ? [["review_required", "In Prüfung"]] : [])].map(([v, l]) => <FilterChip key={v} title={l} selected={filter === v} onPress={() => setFilter(v)} />)}</ScrollView>
      {earnings.filter(e => filter === "all" || (filter === "refunded" ? e.refundedCents > 0 : e.paymentStatus === filter)).map(e => <Card key={e.id}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}><Text style={styles.value}>{euro(e.shareBeforeStripeCents)}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: e.paymentStatus === "succeeded" && !e.refundedCents ? colors.success : colors.muted }} numberOfLines={1}>{e.paymentStatus === "review_required" ? "In Prüfung" : e.paymentStatus === "refunded" ? "Erstattet" : e.paymentStatus === "succeeded" ? "Erhalten" : "Ausstehend"}</Text></View>
        <Text style={styles.muted}>{date(e.createdAt)}{e.refundedCents > 0 ? ` · ${euro(e.refundedCents)} erstattet` : ""}</Text></Card>)}
      {!earnings.length && <Card><Text style={styles.text}>Hier erscheinen deine ersten Trinkgelder.</Text></Card>}
      {nextCursor && <Button disabled={busy} title="Weitere laden" subtle onPress={() => run(async () => { const page = await api<{ items: Earning[]; nextCursor: string | null }>(`/api/v1/me/earnings?before=${encodeURIComponent(nextCursor)}`); setEarnings(previous => [...previous, ...page.items.filter(i => !previous.some(p => p.id === i.id))]); setNextCursor(page.nextCursor); })} />}
    </>}
    {screen === "thanks" && <><Text style={styles.heading}>Deine Danke</Text><TextLink title="Rang & Meilensteine ansehen" onPress={() => setScreen("milestones")} />
      {thanks.map(t => <Card key={t.id}><Text style={styles.text}>{t.message || "❤️ Danke für deinen Einsatz"}</Text><Text style={styles.muted}>{date(t.createdAt)}{t.tipId ? " · mit Trinkgeld" : ""}</Text>
        {t.message && <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8 }}>
          <TextLink title="Entfernen" align="flex-start" onPress={() => run(async () => { await api(`/api/v1/me/thanks/${t.id}`, { method: "DELETE" }); await refresh(); })} />
          <TextLink title="Melden" align="flex-start" onPress={() => Alert.alert("Nachricht melden?", "Die Nachricht wird sofort ausgeblendet und von uns geprüft.", [{ text: "Abbrechen", style: "cancel" }, { text: "Melden", style: "destructive", onPress: () => run(async () => { await api(`/api/v1/me/thanks/${t.id}/report`, { method: "POST" }); await refresh(); setInfo("Danke für deine Meldung. Die Nachricht ist ausgeblendet und wird von uns geprüft."); }) }])} />
          {t.canBlock && <TextLink title="Absender blockieren" align="flex-start" onPress={() => Alert.alert("Absender blockieren?", "Weitere Nachrichten dieses Absenders erreichen dich nicht mehr. Wer es ist, bleibt auch für uns anonym.", [{ text: "Abbrechen", style: "cancel" }, { text: "Blockieren", style: "destructive", onPress: () => run(async () => { await api(`/api/v1/me/thanks/${t.id}/block`, { method: "POST" }); await refresh(); setInfo("Absender blockiert. Seine Nachrichten erreichen dich nicht mehr."); }) }])} />}
        </View>}</Card>)}
      {thanksCursor && <Button title="Weitere laden" subtle disabled={busy} onPress={() => run(async () => { const page = await api<{ items: Thank[]; nextCursor: string | null }>(`/api/v1/me/thanks?before=${encodeURIComponent(thanksCursor)}`); setThanks(previous => [...previous, ...page.items.filter(i => !previous.some(p => p.id === i.id))]); setThanksCursor(page.nextCursor); })} />}
      {!thanks.length && <Card><Text style={styles.text}>Teile deinen QR-Code, damit Kunden Danke sagen können.</Text><Button title="Meinen QR-Code öffnen" onPress={() => setScreen("qr")} /></Card>}</>}
    {screen === "qr" && editingCard && <CardEditor api={api} onClose={() => { setQr(null); setEditingCard(false); }} onSaved={async () => setQr(await api<Qr>("/api/v1/me/code"))} onPhoto={savePhoto} onRemovePhoto={async () => { await api("/api/v1/me/photo", { method: "DELETE" }); await refresh(); setQr(await api<Qr>("/api/v1/me/code")); }} />}
    {screen === "qr" && !editingCard && <><Text style={styles.heading}>Dein Danke-Code</Text>
      {!qr ? <Loading label="Dein QR-Code wird geladen …" /> : <>
        <Card><Text style={[styles.title, { textAlign: "center" }]}>{profile?.customName || profile?.firstName}</Text><View style={{ alignItems: "center" }}><SvgXml xml={qr.qrSvg} width="100%" height={260} accessibilityLabel="Dein persönlicher LieferDank-QR-Code" /></View>
          <Text style={[styles.title, { textAlign: "center", letterSpacing: 1 }]}>{qr.code}</Text><Text style={[styles.muted, { textAlign: "center" }]}>Keine App nötig · Trinkgeld freiwillig</Text></Card>
        <Text style={styles.muted}>Kunden scannen den Code und landen auf deiner Danke-Seite.</Text>
        <Card><Text style={styles.title}>So sieht deine Karte aus</Text><View accessible accessibilityLabel="Deine gespeicherte QR-Karte" style={{ width: "100%", aspectRatio: 85.6 / 54 }}><CardArtwork xml={qr.cardSvg} /></View><Text style={styles.muted}>Kostenlose digitale Druckvorlage: Karte in Originalgröße auf einer A4-Seite.</Text><Button title="Karte bearbeiten" onPress={() => setEditingCard(true)} /></Card>
        <Button title="Karte als PDF speichern / teilen" disabled={busy} onPress={() => run(() => exportCard(false))} />
        <Button title="Karte drucken (AirPrint)" subtle disabled={busy} onPress={() => run(() => exportCard(true))} />
        <Button title="QR-Code teilen oder speichern" disabled={busy} onPress={() => run(shareQr)} />
        <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button subtle title="Link teilen" onPress={() => run(async () => { await Share.share({ message: driverThankUrl(qr.code) }); })} /></View><View style={{ flex: 1 }}><Button subtle title="Seite ansehen" onPress={() => run(() => openBrowser(`${driverThankUrl(qr.code)}?vorschau=1`))} /></View></View>
      </>}</>}
    {screen === "profile" && <><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={styles.heading}>Dein Profil</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Informationen zum öffentlichen Profil" onPress={() => Alert.alert("Dein öffentliches Profil", "Anzeigename, kurzer Satz und persönlicher Text erscheinen auf deiner Danke-Seite. Dein Foto nur, wenn du es freigibst. Nachname, E-Mail und Telefonnummer bleiben privat.")} style={{ padding: 10 }}><Ionicons name="information-circle-outline" size={26} color={colors.blue} /></Pressable></View>
      {!profile ? <Loading /> : <>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {profile.hasPhoto && token ? <Image source={{ uri: `${BASE}/api/v1/me/photo`, headers: { authorization: `Bearer ${token}` } }} style={{ width: 72, height: 72, borderRadius: 36 }} accessibilityLabel="Dein Profilfoto" /> : <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Ionicons name="person" size={32} color={colors.blue} /></View>}
            <View style={{ flex: 1 }}><TextLink title={profile.hasPhoto ? "Foto ändern" : "Foto hinzufügen"} align="flex-start" onPress={() => run(async () => { await savePhoto(); })} />{profile.hasPhoto && <TextLink small title="Foto entfernen" align="flex-start" onPress={() => run(async () => { await api("/api/v1/me/photo", { method: "DELETE" }); await refresh(); setQr(await api<Qr>("/api/v1/me/code")); })} />}</View>
          </View>
          {profile.hasPhoto && <View style={styles.switchRow}><Text style={[styles.text, { flex: 1 }]}>Foto öffentlich zeigen</Text><Switch accessibilityLabel="Foto öffentlich anzeigen" value={profile.photoPublic} trackColor={{ true: colors.blue }} onValueChange={v => { profileDirty.current = true; setProfile({ ...profile, photoPublic: v }); }} /></View>}
        </Card>
        <Card><Text style={styles.title}>Privat</Text>
          <Field label="Vorname" value={profile.firstName} autoCapitalize="words" onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, firstName: v }); }} maxLength={60} />
          <Field label="Nachname" value={profile.lastName} autoCapitalize="words" onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, lastName: v }); }} maxLength={60} />
        </Card>
        <Card><Text style={styles.title}>Auf deiner Danke-Seite</Text>
          <Field label="Anzeigename" value={profile.customName ?? profile.firstName} autoCapitalize="words" onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, nameDisplay: "custom", customName: v }); }} maxLength={30} />
          <Field label="Kurzer Satz über dich" value={profile.tagline ?? ""} autoCapitalize="sentences" autoCorrect onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, tagline: v }); }} maxLength={80} placeholder="z. B. Seit 5 Jahren für euch unterwegs" />
          <Field label="Persönlicher Text" value={profile.bio ?? ""} autoCapitalize="sentences" autoCorrect onChangeText={v => { profileDirty.current = true; setProfile({ ...profile, bio: v }); }} maxLength={280} multiline />
          <View style={styles.switchRow}><Text style={[styles.text, { flex: 1 }]}>Danke-Seite aktiv</Text><Switch accessibilityLabel="Öffentliches Profil aktiv" value={profile.active} trackColor={{ true: colors.blue }} onValueChange={v => { profileDirty.current = true; setProfile({ ...profile, active: v }); }} /></View>
        </Card>
        <Button title="Profil speichern" disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/profile", { method: "PATCH", body: JSON.stringify(profile) }); profileDirty.current = false; setQr(null); await refresh(); setInfo("Dein Profil ist gespeichert."); })} />
      </>}</>}
    {screen === "stripe" && <><Text style={styles.heading}>Auszahlung</Text>{!stripe ? <Loading /> : <Card>
      <Text style={styles.title}>{!stripe.verifiedNow ? "Status gerade nicht abrufbar" : stripe.ready ? "Dein Auszahlungskonto ist bereit" : stripe.connected ? "Einrichtung noch nicht abgeschlossen" : "Auszahlung einrichten"}</Text>
      <Text style={styles.text}>Trinkgeld geht direkt auf dein eigenes Konto bei Stripe, unserem Zahlungspartner. Die Einrichtung erfolgt sicher bei Stripe.</Text>
      {stripe.manualPayouts && <Text style={styles.notice}>Deine Auszahlungen sind auf „manuell“ gestellt. Du kannst das in deinem Stripe-Konto ändern.</Text>}
      {!stripe.emailVerified && <><Text style={styles.notice}>Bitte bestätige zuerst deine E-Mail-Adresse.</Text><Button title="Bestätigungs-E-Mail senden" subtle disabled={busy} onPress={() => run(resendVerification)} /></>}
      {stripe.ready ? <Button title="Stripe-Konto öffnen" onPress={() => run(() => openBrowser("https://dashboard.stripe.com/login"))} /> : <>
        {!stripe.connected && <><Text style={styles.muted}>LieferDank behält je Trinkgeld {Object.entries(stripe.applicationFees).map(([amount, fee]) => `${euro(fee)} bei ${euro(Number(amount))}`).join(", ")}. Die Kosten von Stripe kommen separat hinzu. Unbefristet und jederzeit kündbar; 14 Tage Widerrufsrecht laut AGB.</Text>
          <View style={styles.switchRow}><Text style={[styles.muted, { flex: 1 }]}>Ich verlange ausdrücklich, dass LieferDank vor Ablauf der Widerrufsfrist mit der Trinkgeld-Funktion beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen anteiligen Betrag für die bis dahin erbrachten Leistungen zahle.</Text><Switch accessibilityLabel="Sofortigen Leistungsbeginn ausdrücklich verlangen" value={consent} trackColor={{ true: colors.blue }} onValueChange={setConsent} /></View></>}
        <Button title={stripe.connected ? "Einrichtung fortsetzen" : "Jetzt einrichten"} disabled={busy || !stripe.emailVerified || (!stripe.connected && !consent)} onPress={() => run(async () => { const value = await api<{ url: string }>("/api/v1/me/stripe", { method: "POST", body: JSON.stringify({ immediateStart: consent }) }); await openBrowser(value.url); })} />
      </>}
      <TextLink title="Status aktualisieren" onPress={() => run(refresh)} />
    </Card>}</>}
  </>;

  const customerScreens = <>
    {screen === "saved" && <><Text style={styles.heading}>Hallo{me?.firstName ? ` ${me.firstName}` : ""}</Text>{verifiedBanner}
      <Card><Text style={styles.title}>Zusteller speichern</Text><Text style={styles.muted}>Den Code findest du unter dem QR-Code auf der Karte deines Zustellers, z. B. LD-ABCDE.</Text>
        <Field label="Danke-Code" value={newCode} onChangeText={v => setNewCode(v.toUpperCase())} autoCapitalize="characters" maxLength={20} placeholder="LD-…" />
        <Button title="Speichern" disabled={busy || newCode.trim().length < 3} onPress={() => run(async () => { await api("/api/v1/me/favorites", { method: "POST", body: JSON.stringify({ code: newCode.trim() }) }); setNewCode(""); await refresh(); setInfo("Zusteller gespeichert."); })} /></Card>
      {!favorites ? <Loading /> : favorites.length === 0 ? <Card><Text style={styles.text}>Du hast noch keine Zusteller gespeichert.</Text><Text style={styles.muted}>Nach einem Danke auf lieferdank.de kannst du deinen Zusteller auch dort speichern.</Text></Card> :
        favorites.map(f => <Card key={f.favoriteId}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Avatar initials={f.driver.initials} /><View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={1}>{f.nickname || f.driver.name}</Text><Text style={styles.muted} numberOfLines={2}>{f.active ? f.driver.tagline || f.driver.code : "Derzeit nicht erreichbar"}</Text></View></View>
          <View style={{ flexDirection: "row", gap: 10 }}>{f.active && <View style={{ flex: 1 }}><Button title="Danke sagen" onPress={() => run(() => openBrowser(driverThankUrl(f.driver.code)))} /></View>}<View style={{ flex: 1 }}><Button subtle title="Entfernen" onPress={() => run(async () => { await api(`/api/v1/me/favorites/${f.favoriteId}`, { method: "DELETE" }); await refresh(); })} /></View></View></Card>)}
    </>}
    {screen === "history" && <><Text style={styles.heading}>Dein Verlauf</Text>
      {!history ? <Loading /> : <>
        <Card><Text style={styles.muted}>Während du angemeldet warst</Text><Text style={styles.value}>{history.thankYous.length} Danke</Text><Text style={styles.muted}>{history.tipCount} Trinkgeld{history.tipCount === 1 ? "" : "er"} · {euro(history.totalTipCents)}</Text></Card>
        {history.thankYous.map(t => <Card key={t.id}><Text style={styles.title} numberOfLines={1}>{t.driver?.name ?? "Zusteller"}</Text><Text style={styles.text}>{t.message || "❤️ Danke"}</Text><Text style={styles.muted}>{date(t.createdAt)}{t.withTip ? " · mit Trinkgeld" : ""}</Text></Card>)}
        {!history.thankYous.length && <Card><Text style={styles.text}>Hier erscheinen deine Danke, sobald du angemeldet einem Zusteller dankst.</Text></Card>}
      </>}</>}
  </>;

  const adminScreen = screen === "admin" && <><Text style={styles.heading}>Hallo{me?.firstName ? ` ${me.firstName}` : ""}</Text>
    <Card><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="shield-checkmark" size={24} color={colors.blue} /><Text style={styles.title}>Administratorkonto</Text></View>
      <Text style={styles.text}>Du bist mit deinem Administratorkonto angemeldet. Nutzer, Zahlungen, Auszahlungen und Systemmeldungen verwaltest du aus Sicherheitsgründen ausschließlich im Browser.</Text>
      <Button title="Administration öffnen" onPress={() => run(() => openBrowser("https://lieferdank.de/admin"))} />
      <Text style={styles.muted}>Dort meldest du dich separat an. Die App erhält keine Administratorrechte.</Text></Card></>;

  const settingsScreen = screen === "settings" && <><Text style={styles.heading}>{role === "driver" ? "Einstellungen" : "Dein Konto"}</Text>
    <Card><Text style={styles.muted}>Angemeldet als</Text><Text style={styles.title} numberOfLines={1}>{me?.email}</Text>{role && <Text style={styles.muted}>{roleLabel[role]}</Text>}</Card>
    {me && (me.roles?.length ?? 0) > 1 && <Card><Text style={styles.title}>Ansicht wechseln</Text>{me.roles?.filter(r => r !== role).map(r => <Button key={r} subtle title={r === "customer" ? "Gespeicherte Zusteller" : "Zusteller-Dashboard"} onPress={() => run(() => switchRole(r))} />)}</Card>}
    {role === "customer" && !me?.roles?.includes("driver") && <Card><TextLink title="Als Zusteller starten" align="flex-start" onPress={() => { setActivationOpen(!activationOpen); setFirstName(me?.firstName ?? ""); setLastName(me?.lastName ?? ""); setAcceptedTerms(false); }} />{activationOpen && <>
      <Text style={styles.muted}>Dein Konto und deine gespeicherten Zusteller bleiben erhalten. Dazu bekommst du deinen eigenen Danke-Code.</Text>
      <Field label="Vorname" value={firstName} onChangeText={setFirstName} maxLength={60} /><Field label="Nachname" value={lastName} onChangeText={setLastName} maxLength={60} />
      <View style={styles.switchRow}><Text style={[styles.muted, { flex: 1 }]}>Ich habe AGB und Datenschutzhinweise gelesen und beachte die Regeln meines Arbeitgebers selbst.</Text><Switch accessibilityLabel="Hinweise als Zusteller bestätigen" value={acceptedTerms} onValueChange={setAcceptedTerms} /></View>
      <Button title="Danke-Code erstellen" disabled={busy || !acceptedTerms || !firstName.trim() || !lastName.trim()} onPress={() => run(async () => { await api("/api/v1/me/driver", { method: "POST", body: JSON.stringify({ firstName, lastName, acceptedTerms }) }); await refresh(); if (me) await SecureStore.setItemAsync(`lieferdank.view.${me.id}`, "driver", secureOptions); setActivationOpen(false); setViewRole("driver"); setScreen("dashboard"); })} />
    </>}</Card>}
    {newsletter && (newsletter.available || newsletter.status === "confirmed") && <Card><TextLink title="Newsletter (freiwillig)" align="flex-start" onPress={() => setNewsletterOpen(!newsletterOpen)} />{newsletterOpen && <>
      <Text style={styles.muted}>Neuigkeiten von LieferDank per E-Mail. Erst nach Bestätigung des E-Mail-Links angemeldet. Jederzeit hier abmelden.</Text>
      {newsletter.status === "confirmed" ? <Button title="Newsletter abbestellen" subtle disabled={busy} onPress={() => run(async () => { await api("/api/v1/me/newsletter", { method: "DELETE" }); await refresh(); setInfo("Du bist vom Newsletter abgemeldet."); })} /> : <>
        {newsletter.status === "pending" && <Text style={styles.muted}>Bestätigungslink noch nicht eingelöst. Bitte prüfe dein Postfach.</Text>}
        <View style={styles.switchRow}><Text style={[styles.text, { flex: 1 }]}>Ich möchte den Newsletter erhalten.</Text><Switch accessibilityLabel="Freiwillig zum Newsletter anmelden" value={newsletterConsent} onValueChange={setNewsletterConsent} /></View>
        <Button title="Bestätigungs-E-Mail anfordern" disabled={busy || !newsletterConsent} onPress={() => run(async () => { const result = await api<{ mailSent: boolean; status: string }>("/api/v1/me/newsletter", { method: "POST", body: JSON.stringify({ consent: true }) }); await refresh(); setNewsletterConsent(false); if (!result.mailSent && result.status !== "confirmed") throw new Error("Die Bestätigungs-E-Mail konnte nicht versendet werden. Bitte versuche es später erneut."); setInfo("Bitte bestätige deine Anmeldung über den Link in deinem Postfach."); })} />
      </>}
    </>}</Card>}
    {role === "driver" && <Card>
      {pushAvailable && <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.text}>Mitteilungen</Text><Text style={styles.muted}>Bei neuem Trinkgeld, Danke, Meilensteinen und Auszahlungen</Text></View><Switch accessibilityLabel="Mitteilungen aktivieren" value={pushEnabled} trackColor={{ true: colors.blue }} onValueChange={v => run(() => enablePush(v))} disabled={busy} /></View>}
      <TextLink title="Auszahlung verwalten" align="flex-start" onPress={() => setScreen("stripe")} />
    </Card>}
    <Card><Text style={styles.title}>Passwort ändern</Text>
      <Field label="Aktuelles Passwort" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" textContentType="password" autoComplete="current-password" />
      <Field label="Neues Passwort (mindestens 8 Zeichen)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" textContentType="newPassword" autoComplete="new-password" />
      <Button title="Passwort ändern" disabled={busy || !currentPassword || newPassword.length < 8} onPress={() => run(async () => { await api("/api/v1/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }); await clearSession(); setInfo("Dein Passwort ist geändert. Bitte melde dich mit dem neuen Passwort an. Alle Geräte wurden abgemeldet."); })} />
    </Card>
    <Card><Text style={styles.title}>Deine Daten</Text><Text style={styles.muted}>Lade eine Kopie deiner bei LieferDank gespeicherten Daten herunter.</Text><Button title="Datenexport erstellen" subtle disabled={busy} onPress={() => run(exportData)} /></Card>
    <Button title="Abmelden" subtle disabled={busy} onPress={() => run(logout)} />
    {role !== "admin" && <Card><Text style={styles.title}>Konto löschen</Text><Text style={styles.muted}>Gib zur Bestätigung dein Passwort ein. Das Löschen lässt sich nicht rückgängig machen.</Text>
      <Field label="Passwort" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoCapitalize="none" textContentType="password" autoComplete="current-password" />
      <Button title="Konto löschen" danger disabled={busy} onPress={confirmDelete} /></Card>}
  </>;

  return <SafeAreaView style={styles.page} edges={["top", "left", "right"]}><StatusBar style="dark" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityRole="header" accessibilityLabel="LieferDank"><BrandMark size={34} /><BrandWordmark height={21} /></View>
        {token && role === "driver" && <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" onPress={() => setScreen("settings")} style={{ padding: 10 }}><Ionicons name="settings-outline" size={24} color={colors.navy} /></Pressable>}
      </View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} refreshControl={token ? <RefreshControl refreshing={busy} onRefresh={() => run(refresh)} tintColor={colors.blue} /> : undefined}>
        {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ gap: 8 }}><Text style={styles.error}>{error}</Text>{token && <Button title="Erneut versuchen" subtle disabled={busy} onPress={() => run(refresh)} />}</View> : null}
        {info ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{info}</Text> : null}
        {!token ? authScreen : !role ? <Loading label="Dein Konto wird geladen …" /> : <>
          {role === "driver" && driverScreens}
          {role === "customer" && customerScreens}
          {role === "admin" && adminScreen}
          {settingsScreen}
        </>}
        {(!token || screen === "settings") && <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 4, marginTop: 4 }}>
          {legalPages.map(([label, path]) => <TextLink key={path} small title={label} onPress={() => openLegal(path)} />)}
        </View>}
      </ScrollView>
      {token && role && <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.line }}><View style={{ flexDirection: "row" }}>
        {tabs.map(t => { const active = screen === t.screen || (t.screen === "settings" && screen === "settings"); return <Pressable key={t.screen} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: active }} onPress={() => { setScreen(t.screen); setError(""); setInfo(""); }} style={({ pressed }) => ({ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name={active ? (t.icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap) : t.icon} size={23} color={active ? colors.blue : colors.muted} accessible={false} importantForAccessibility="no-hide-descendants" />
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: active ? colors.blue : colors.muted }}>{t.label}</Text></Pressable>; })}
      </View></SafeAreaView>}
    </KeyboardAvoidingView></SafeAreaView>;
}
