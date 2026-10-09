import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  owner: "attaafsari-code", name: "LieferDank", slug: "lieferdank-driver", version: "1.0.0", scheme: "lieferdank", orientation: "portrait",
  userInterfaceStyle: "light", icon: "./assets/app-icon.png",
  ios: { bundleIdentifier: "de.lieferdank.driver", supportsTablet: false, associatedDomains: ["applinks:lieferdank.de"],
    config: { usesNonExemptEncryption: false }, infoPlist: { NSFaceIDUsageDescription: false, NSPhotoLibraryUsageDescription: "Wähle ein Foto für dein LieferDank-Profil." } },
  android: { package: "de.lieferdank.driver", adaptiveIcon: { foregroundImage: "./assets/brand-mark.png", backgroundColor: "#ffffff" },
    blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.RECORD_AUDIO", "android.permission.READ_CONTACTS", "android.permission.ACCESS_FINE_LOCATION"],
    intentFilters: [{ action: "VIEW", autoVerify: true, category: ["BROWSABLE", "DEFAULT"], data: [{ scheme: "https", host: "lieferdank.de", pathPrefix: "/app/" }, { scheme: "https", host: "lieferdank.de", path: "/passwort-neu" }, { scheme: "https", host: "lieferdank.de", path: "/email-bestaetigen" }] }] },
  plugins: [["expo-secure-store", { faceIDPermission: false }], "expo-notifications", "expo-web-browser", "expo-font", ["expo-image-picker", { photosPermission: "Wähle ein Foto für dein LieferDank-Profil.", cameraPermission: false, microphonePermission: false }], ["expo-splash-screen", { image: "./assets/brand-mark.png", imageWidth: 160, backgroundColor: "#ffffff" }]],
  extra: { eas: { projectId: "85ed233e-4c12-47c0-8510-d550c8f8a467" } }
};
export default config;
