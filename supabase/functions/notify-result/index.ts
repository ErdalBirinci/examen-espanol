// Supabase Edge Function: notify-result
// Yönetici bir sınavı puanladıktan sonra adaya sonuç e-postası gönderir.
//
// Gerekli secret'lar:
//   RESEND_API_KEY     — Resend API anahtarı
//   RESULT_FROM_EMAIL  — doğrulanmış gönderici (ör. "Examen <sonuc@alanadin.com>")
//   APP_PUBLIC_URL     — site adresi (ör. https://erdalbirinci.github.io/examen-espanol)
//
// RESEND_API_KEY yoksa fonksiyon 501 { error: "email_not_configured" } döner.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server_not_configured" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return json({ error: "forbidden" }, 403);

  let attemptId = "";
  try {
    const body = await req.json();
    attemptId = String(body?.attemptId ?? "");
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return json({ error: "invalid_attempt" }, 400);

  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select(
      "id, full_name, email, level, status, scoring_version, mc_correct, mc_total, mc_score, listening_score, listening_correct, listening_total, writing_score, writing_part1_score, writing_part2_score, speaking_score, total_score, result_notified_at",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) return json({ error: "lookup_failed", detail: attemptError.message }, 500);
  if (!attempt) return json({ error: "not_found" }, 404);
  if (attempt.status !== "graded") return json({ error: "not_graded" }, 409);
  if (attempt.result_notified_at) return json({ sent: false, reason: "already_sent" });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESULT_FROM_EMAIL");
  if (!resendKey || !from) return json({ error: "email_not_configured" }, 501);

  const isNewScale = Number(attempt.scoring_version ?? 1) >= 2;
  const weightsReady =
    attempt.mc_total &&
    attempt.mc_total > 0 &&
    attempt.listening_score !== null &&
    attempt.writing_score !== null &&
    attempt.speaking_score !== null;

  const total = isNewScale
    ? attempt.total_score !== null
      ? Math.round(Number(attempt.total_score))
      : null
    : weightsReady
      ? Math.round(
          ((attempt.mc_correct ?? 0) / attempt.mc_total!) * 40 +
            Number(attempt.listening_score) * 0.2 +
            Number(attempt.writing_score) * 0.2 +
            Number(attempt.speaking_score) * 0.2,
        )
      : null;

  const appUrl = (Deno.env.get("APP_PUBLIC_URL") ?? "").replace(/\/$/, "");
  const resultUrl = appUrl ? `${appUrl}/resultado` : "";

  const sectionRows: Array<[string, number | null, number]> = isNewScale
    ? [
        ["Vocabulario y Gramática", attempt.mc_score, 50],
        ["Comprensión Auditiva", attempt.listening_score, 10],
        ["Expresión Escrita", attempt.writing_score, 20],
        ["Expresión Oral", attempt.speaking_score, 20],
      ]
    : [
        [
          "Vocabulario y Gramática",
          attempt.mc_total && attempt.mc_total > 0
            ? Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * 100)
            : null,
          100,
        ],
        ["Comprensión Auditiva", attempt.listening_score, 100],
        ["Expresión Escrita", attempt.writing_score, 100],
        ["Expresión Oral", attempt.speaking_score, 100],
      ];

  const rows = sectionRows
    .map(
      ([label, value, max]) =>
        `<tr><td style="padding:6px 0;color:#5c5c66">${escapeHtml(String(label))}</td>
         <td style="padding:6px 0;text-align:right;font-weight:600">${
           value === null ? "—" : `${Math.round(Number(value))} / ${max}`
         }</td></tr>`,
    )
    .join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1d1d1f">
    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a93;margin:0">Examen de Español</p>
    <h1 style="font-size:24px;margin:12px 0 8px">Tu resultado está listo</h1>
    <p style="font-size:14px;line-height:1.6;color:#5c5c66;margin:0 0 20px">
      Hola ${escapeHtml(attempt.full_name)}, hemos evaluado tu examen de nivel ${escapeHtml(attempt.level)}.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #ececf1">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;border-top:1px solid #ececf1;font-weight:600">Puntuación global</td>
        <td style="padding:12px 0 0;border-top:1px solid #ececf1;text-align:right;font-weight:700;font-size:18px">
          ${total === null ? "—" : `${total} / 100`}
        </td>
      </tr>
    </table>
    ${
      resultUrl
        ? `<p style="margin:24px 0"><a href="${resultUrl}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px">Ver mi resultado</a></p>
           <p style="font-size:12px;color:#8a8a93;line-height:1.6">Necesitarás tu código de referencia y este correo electrónico.</p>`
        : ""
    }
    <p style="font-size:12px;color:#8a8a93;margin-top:24px">Este mensaje se envió automáticamente; no respondas a este correo.</p>
  </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [attempt.email],
      subject: `Tu resultado del examen de español (${attempt.level})`,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return json({ error: "send_failed", detail: detail.slice(0, 500) }, 502);
  }

  await admin
    .from("attempts")
    .update({ result_notified_at: new Date().toISOString() })
    .eq("id", attempt.id);

  return json({ sent: true, total });
});
