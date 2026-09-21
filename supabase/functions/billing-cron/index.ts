import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Daily billing run (called by pg_cron at 6am AEST):
//  1) billing_daily(): trial reminders/expiry, pro-rata, monthly invoices, late fees
//  2) charge every auto invoice due today (or overdue) against the saved payment method
const SECRET = "nalo-billing-9c4f7e2ab8d1";
const SK = () => Deno.env.get("STRIPE_SECRET_KEY") || "";
// Today in Brisbane. The edge runtime is UTC and this runs at 06:00 AEST (20:00 UTC the
// previous day), so new Date().toISOString() gave yesterday and every charge ran a day late.
const brisbaneToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const stripe = async (path: string, params: Record<string, string>) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SK()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ? j.error.message : "Stripe error");
  return j;
};

Deno.serve(async (req: Request) => {
  if (new URL(req.url).searchParams.get("secret") !== SECRET) return new Response("forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out: any = { engine: null, charges: [] };

  const { data: acted, error } = await db.rpc("billing_daily");
  if (error) out.engine_error = error.message; else out.engine = acted;

  if (SK()) {
    const today = brisbaneToday();
    const { data: due } = await db.from("invoices")
      .select("id, number, total, building_id, due_date, status, stripe_payment_intent")
      .in("status", ["sent", "overdue"]).eq("auto", true).lte("due_date", today).gt("total", 0).is("stripe_payment_intent", null);
    for (const inv of due || []) {
      const { data: bb } = await db.from("building_billing").select("stripe_customer_id, stripe_payment_method_id").eq("building_id", inv.building_id).single();
      if (!bb || !bb.stripe_customer_id || !bb.stripe_payment_method_id) continue;
      try {
        const pi = await stripe("payment_intents", {
          amount: String(Math.round(Number(inv.total) * 100)),
          currency: "aud",
          customer: bb.stripe_customer_id,
          payment_method: bb.stripe_payment_method_id,
          confirm: "true",
          off_session: "true",
          description: `NaloHub ${inv.number}`,
          "metadata[invoice_id]": inv.id,
          "metadata[building_id]": inv.building_id,
        });
        // record the attempt; cards settle instantly, BECS settles via webhook in ~2-3 business days
        await db.from("invoices").update({
          stripe_payment_intent: pi.id,
          ...(pi.status === "succeeded" ? { status: "paid", paid_at: new Date().toISOString() } : {}),
        }).eq("id", inv.id);
        out.charges.push({ invoice: inv.number, status: pi.status });
      } catch (e) {
        out.charges.push({ invoice: inv.number, error: String((e as Error).message || e) });
        await db.from("app_notifications").insert({
          building_id: inv.building_id, recipient_role: "bcc", kind: "payment_failed", ref_table: "invoices", ref_id: inv.id,
          title: `Payment could not be taken — ${inv.number}`,
          body: "Please check your payment method in Billing; we'll retry tomorrow.",
        });
      }
    }
  } else { out.stripe = "not configured — invoices generated, charging skipped"; }

  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
