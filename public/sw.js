/* v8 — reset stale push subscriptions */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function syncSubscriptionToServer(subscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
}

async function resubscribePush(registration) {
  const res = await fetch("/api/push/vapid-public-key");
  if (!res.ok) return null;

  const { publicKey } = await res.json();
  if (!publicKey) return null;

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await syncSubscriptionToServer(sub);
  return sub;
}

self.addEventListener("pushsubscriptionchange", (event) => {
  const registration = event.target;
  event.waitUntil(
    (async () => {
      let sub = event.newSubscription;
      if (!sub) {
        sub = await resubscribePush(registration);
      }
      if (sub) await syncSubscriptionToServer(sub);
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "MNF HOLDEM",
    body: "",
    url: "/guest/points",
    tag: "",
    txnType: "",
    amountWon: 0,
    note: "",
    txnId: "",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore */
  }

  const tag = payload.tag || `mnf-point-${Date.now()}`;
  const targetUrl = new URL(payload.url || "/guest/points", self.location.origin).href;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: true,
        data: { url: targetUrl },
        vibrate: [200, 100, 200],
      });

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({
          type: "mnf-point-push",
          payload: {
            txnType: payload.txnType,
            amountWon: String(payload.amountWon ?? 0),
            note: payload.note,
            txnId: payload.txnId || tag,
          },
        });
      }
    })().catch((err) => {
      console.error("[sw] push handler failed", err);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url ?? "/guest/points";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl);
          if (clientUrl.pathname === target.pathname && "focus" in client) {
            return client.focus();
          }
        } catch {
          /* ignore */
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
