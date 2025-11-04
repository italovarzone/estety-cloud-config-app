import webpush from "web-push";
import { getDb } from "./mongo";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@estety.cloud";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys missing; push disabled.");
    configured = true; // avoid repeating warn
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export async function saveSubscription(sub: any) {
  const db = await getDb();
  await db.collection("subscriptions").createIndexes([
    { key: { endpoint: 1 }, unique: true, name: "uniq_endpoint" },
    { key: { createdAt: 1 }, name: "idx_createdAt" },
  ]);
  await db.collection("subscriptions").updateOne(
    { endpoint: sub?.endpoint },
    { $setOnInsert: { ...sub, createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getAllSubscriptions() {
  const db = await getDb();
  return db.collection("subscriptions").find({}).toArray();
}

export async function sendPushToAll(title: string, body: string, data?: any) {
  ensureConfigured();
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const subs = await getAllSubscriptions();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          s,
          JSON.stringify({ title, body, data })
        );
        sent++;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/410|404/.test(msg)) {
          // gone - remove
          try {
            const db = await getDb();
            await db.collection("subscriptions").deleteOne({ endpoint: s.endpoint });
          } catch {}
        } else {
          console.warn("[push] send error:", msg);
        }
      }
    })
  );
  return sent;
}
