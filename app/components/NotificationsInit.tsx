"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificationsInit() {
  const [shouldAsk, setShouldAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      subscribe();
      return;
    }
    const asked = localStorage.getItem("notifAsked");
    if (Notification.permission === "default" && asked !== "yes") {
      setShouldAsk(true);
    }
  }, []);

  async function subscribe() {
    try {
      setBusy(true);
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch("/api/notifications/vapid-public-key");
      const { key } = await res.json();
      const sub = await reg.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(key),
        userVisibleOnly: true,
      });
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setShouldAsk(false);
    } catch (e) {
      console.warn("push subscribe failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function onEnable() {
    try {
      localStorage.setItem("notifAsked", "yes");
      const perm = await Notification.requestPermission();
      if (perm === "granted") await subscribe();
      else setShouldAsk(false);
    } catch {}
  }

  if (!shouldAsk) return null;

  return (
    <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#bca49d",color:"white",padding:"10px 14px",borderRadius:8,boxShadow:"0 6px 16px rgba(0,0,0,.2)",zIndex:9999}}>
      <span>Ative notificações para receber alertas de saúde dos tenants.</span>
      <button onClick={onEnable} disabled={busy} style={{marginLeft:12,padding:"6px 10px",background:"white",color:"#1D1411",borderRadius:6,border:"none"}}>
        {busy ? "Aguarde..." : "Ativar"}
      </button>
    </div>
  );
}
