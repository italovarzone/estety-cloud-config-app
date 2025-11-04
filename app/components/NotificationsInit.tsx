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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    // iOS PWA requer app instalado em tela inicial para permitir push
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone;
    if (!isStandalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setShouldAsk(true);
      setError('No iPhone, instale o app na Tela de Início para ativar notificações.');
      return;
    }

    if (Notification.permission === "granted") {
      subscribe();
      return;
    }
    const asked = localStorage.getItem("notifAsked");
    if (Notification.permission === "default" && asked !== "yes") {
      setShouldAsk(true);
    }
  }, []);

  function timeout<T>(p: Promise<T>, ms: number) {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("sw_ready_timeout")), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
    // tenta obter prontamente; se não houver, espera o ready com timeout
    let existing = await navigator.serviceWorker.getRegistration();
    if (!existing) {
      try {
        // fallback: tenta registrar explicitamente (em alguns cenários o auto-register pode falhar)
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        existing = reg;
      } catch (e) {
        // ignora, vai tentar o ready com timeout
      }
    }
    if (existing) return existing;
    return await timeout(navigator.serviceWorker.ready, 8000);
  }

  async function subscribe() {
    try {
      setBusy(true);
      setError(null);
      const reg = await getReadyRegistration();
      if (!('pushManager' in reg)) {
        throw new Error('push_unsupported');
      }
      const res = await fetch("/api/notifications/vapid-public-key");
      if (!res.ok) throw new Error('missing_vapid_key');
      const { key } = await res.json();
      if (!key) throw new Error('missing_vapid_key');
      const sub = await reg.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(key),
        userVisibleOnly: true,
      });
      const save = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!save.ok) {
        let detail = '';
        try { detail = await save.text(); } catch {}
        const err = new Error('save_failed' + (detail ? `:${detail}` : ''));
        throw err;
      }
      setShouldAsk(false);
    } catch (e) {
      console.warn("push subscribe failed", e);
      const msg = (e as any)?.message || String(e);
      if (msg === 'sw_ready_timeout') setError('Service Worker não ficou pronto. Recarregue o app e tente novamente.');
      else if (msg === 'push_unsupported') setError('Seu dispositivo/navegador não suporta Push Notifications.');
      else if (msg === 'missing_vapid_key') setError('Chave de push não configurada.');
      else if (/save_failed/i.test(msg)) setError('Falha ao salvar inscrição no servidor.');
      else setError('Falha ao ativar notificações.');
      // permite tentar novamente no banner caso falhe
      localStorage.removeItem('notifAsked');
      setShouldAsk(true);
    } finally {
      setBusy(false);
    }
  }

  async function onEnable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        await subscribe();
        // marca como perguntado só após uma tentativa válida
        localStorage.setItem("notifAsked", "yes");
      } else {
        // usuário recusou: mantém possibilidade de perguntar novamente no futuro
        setShouldAsk(true);
      }
    } catch {}
  }

  if (!shouldAsk) return null;

  return (
    <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#bca49d",color:"white",padding:"10px 14px",borderRadius:8,boxShadow:"0 6px 16px rgba(0,0,0,.2)",zIndex:9999}}>
      <span>Ative notificações para receber alertas de saúde dos tenants.</span>
      <button onClick={onEnable} disabled={busy} style={{marginLeft:12,padding:"6px 10px",background:"white",color:"#1D1411",borderRadius:6,border:"none"}}>
        {busy ? "Aguarde..." : "Ativar"}
      </button>
      {error && <div style={{marginTop:8,fontSize:12,opacity:.9}}>{error}</div>}
    </div>
  );
}
