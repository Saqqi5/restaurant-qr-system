import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App as CapApp } from "@capacitor/app";

/**
 * CapacitorNav — native-app only (renders nothing on the website).
 * The menu, drawer and About now live in the website itself (SiteDrawer),
 * so the app has NO floating buttons: the header's ☰ button is the one menu.
 * This component only does what the website cannot:
 * 1. Status bar: app content below the status bar (overlay off + dark bg +
 *    light icons). The CSS safe-area rules in index.css are the fallback —
 *    env(safe-area-inset-top) is the bar height when the WebView overlays
 *    it, and 0 when it is already inset, so it never double-offsets.
 * 2. Hardware back button: close About, then close the drawer, then go
 *    back in history, or exit the app from Home.
 * 3. `capacitor-app` class on <html>: app-only zoom (web unaffected).
 */
export default function CapacitorNav() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    document.documentElement.classList.add("capacitor-app");
    let backListener = null;
    (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: "#070C0C" });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (e) {
        // Status-bar plugin unavailable — the CSS safe-area padding is the fallback.
      }
      try {
        backListener = await CapApp.addListener("backButton", () => {
          // The drawer / About live in the website (SiteDrawer) — close them first.
          if (document.querySelector(".cap-about")) {
            window.dispatchEvent(new CustomEvent("saqlyn:close-about"));
            return;
          }
          if (document.querySelector(".cap-drawer.open")) {
            window.dispatchEvent(new CustomEvent("saqlyn:close-menu"));
            return;
          }
          if (window.location.pathname !== "/") {
            if (window.history.length > 1) navigate(-1);
            else navigate("/");
          } else {
            CapApp.exitApp();
          }
        });
      } catch (e) {
        // Back-button plugin unavailable.
      }
    })();
    return () => {
      if (backListener) backListener.remove();
    };
    // navigate is stable; register once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
