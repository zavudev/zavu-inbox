import { db } from "./index";
import * as schema from "./schema";

/**
 * Demo data, so the inbox can be opened and clicked through without a Zavu
 * account. Run with `npm run db:seed`.
 *
 * Everything is inserted with onConflictDoNothing and fixed ids, so running it
 * twice changes nothing and it can never overwrite real rows.
 */
async function seed() {
  const now = Date.now();
  const minutes = (n: number) => new Date(now - n * 60_000);

  await db
    .insert(schema.inboxes)
    .values({
      id: "ibx_demo",
      zavuSenderId: "sender_demo",
      name: "Support",
      phoneNumber: "+13125551212",
      channels: ["sms", "whatsapp", "email"],
      timezone: "America/Santiago",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.conversations)
    .values([
      {
        zavuId: "conv_demo_1",
        inboxId: "ibx_demo",
        zavuSenderId: "sender_demo",
        contactIdentifier: "+56912345678",
        contactName: "Maria Silva",
        channels: ["whatsapp"],
        lastMessageText: "Hola, no me llego el pedido ORD-4471. Pueden revisar?",
        lastMessageChannel: "whatsapp",
        lastMessageDirection: "inbound",
        lastMessageAt: minutes(4),
        messageCount: 6,
        unreadCount: 2,
        lastActivityAt: minutes(4),
      },
      {
        zavuId: "conv_demo_2",
        inboxId: "ibx_demo",
        zavuSenderId: "sender_demo",
        contactIdentifier: "jorge@empresa.cl",
        contactName: "Jorge Rojas",
        email: "jorge@empresa.cl",
        channels: ["email"],
        lastMessageText: "Adjunto la orden de compra firmada.",
        lastMessageChannel: "email",
        lastMessageDirection: "inbound",
        lastMessageAt: minutes(95),
        messageCount: 3,
        unreadCount: 0,
        lastActivityAt: minutes(95),
      },
      {
        zavuId: "conv_demo_3",
        inboxId: "ibx_demo",
        zavuSenderId: "sender_demo",
        contactIdentifier: "+14155550199",
        channels: ["sms"],
        lastMessageText: "Confirmado, gracias.",
        lastMessageChannel: "sms",
        lastMessageDirection: "outbound",
        lastMessageAt: minutes(1440),
        messageCount: 8,
        unreadCount: 0,
        status: "done",
        lastActivityAt: minutes(1440),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.snippets)
    .values([
      {
        id: "snp_demo_hours",
        shortcut: "hours",
        body: "We are open Monday to Friday, 9am to 6pm.",
        shared: true,
      },
      {
        id: "snp_demo_track",
        shortcut: "track",
        body: "You can track your order here: https://example.com/track",
        shared: true,
      },
    ])
    .onConflictDoNothing();

  console.log("Demo data inserted. Sign in and open /inbox.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
