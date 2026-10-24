import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log("FAIL env");
  process.exit(1);
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function rpc(name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function rest(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

function message(body) {
  return typeof body === "object" && body ? body.message ?? body.hint ?? "" : String(body ?? "");
}

async function main() {
  // Practice mode
  const bundle = await rpc("practice_bundle", { p_level: "B1", p_count: 5 });
  const questions = bundle.body?.questions ?? [];
  record(
    "practice_bundle",
    bundle.status === 200 && Array.isArray(questions) && questions.length > 0,
    `HTTP ${bundle.status}, ${questions.length} soru`,
  );
  record(
    "practice_bundle cevap anahtarını gizliyor",
    questions.length > 0 &&
      questions.every(
        (question) => !("correct_index" in question) && Array.isArray(question.options),
      ),
    "",
  );

  const session = typeof bundle.body?.session === "string" ? bundle.body.session : "";
  record("practice_bundle oturum üretiyor", session.length > 0, session ? "oturum var" : "oturum yok");

  if (questions.length >= 2 && session) {
    const answers = Object.fromEntries(questions.map((question, index) => [question.id, index % 4]));
    const check = await rpc("practice_check", { p_session: session, p_answers: answers });
    record(
      "practice_check puanlıyor",
      check.status === 200 &&
        check.body?.total === questions.length &&
        typeof check.body?.correct === "number",
      `HTTP ${check.status}, ${check.body?.correct}/${check.body?.total}`,
    );
    record(
      "practice_check cevap anahtarı sızdırmıyor",
      check.status === 200 && !JSON.stringify(check.body ?? {}).includes("correct_index"),
      "",
    );

    const replay = await rpc("practice_check", { p_session: session, p_answers: answers });
    record("practice_check oturumu tek kullanımlık", replay.status !== 200, `HTTP ${replay.status}`);

    const legacy = await rpc("practice_check", { p_answers: answers });
    record("eski practice_check imzası kapalı", legacy.status !== 200, `HTTP ${legacy.status}`);

    const fresh = await rpc("practice_bundle", { p_level: "B1", p_count: 3 });
    const spoofed = await rpc("practice_check", {
      p_session: fresh.body?.session ?? "00000000-0000-0000-0000-000000000000",
      p_answers: { "00000000-0000-0000-0000-000000000000": 1, bad: "x" },
    });
    record(
      "practice_check oturum dışı kimlikleri yok sayıyor",
      spoofed.status === 200 && spoofed.body?.correct === 0,
      `HTTP ${spoofed.status}, doğru ${spoofed.body?.correct}`,
    );
  }

  const migrated = session.length > 0;
  const denied = (status, body) =>
    status === 401 ||
    status === 403 ||
    (status >= 400 && /FORBIDDEN|UNAUTHORIZED|permission denied/i.test(message(body)));

  // Candidate writes must go through the draft RPCs, not anonymous table access.
  if (migrated) {
    const anonAttempt = await fetch(`${url}/rest/v1/attempts`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({ full_name: "Selftest", email: "selftest@example.com", level: "B1" }),
    });
    record(
      "anonim deneme ekleme kapalı",
      denied(anonAttempt.status),
      `HTTP ${anonAttempt.status}`,
    );
    await anonAttempt.body?.cancel();
  } else {
    record("anonim deneme ekleme kapalı", false, "migration 20261105 uygulanmadı");
  }

  const protectedCalls = [
    [
      "anonim taslak başlatma kapalı",
      "start_exam_draft",
      { p_level: "B1", p_full_name: "Selftest", p_email: "selftest@example.com", p_assignment_id: null },
    ],
    ["anonim taslak okuma kapalı", "get_exam_draft", { p_token: "00000000-0000-0000-0000-000000000000" }],
    [
      "anonim taslak yeniden açma kapalı",
      "resume_exam_draft",
      { p_code: "AAAAAAAA", p_email: "selftest@example.com", p_level: "B1" },
    ],
    [
      "anonim taslak silme kapalı",
      "delete_exam_draft",
      { p_code: "AAAAAAAA", p_email: "selftest@example.com" },
    ],
    [
      "anonim bütünlük kaydı kapalı",
      "record_attempt_integrity",
      { p_attempt_id: "00000000-0000-0000-0000-000000000000", p_integrity: { focus_losses: 1 } },
    ],
    ["anonim aday atamaları kapalı", "candidate_assignments", {}],
  ];

  for (const [name, fn, body] of protectedCalls) {
    const response = await rpc(fn, body);
    record(
      name,
      denied(response.status, response.body),
      `HTTP ${response.status} ${message(response.body)}`,
    );
  }

  // The exam bundle is token-gated on purpose; an unknown token must return no content.
  const bundleProbe = await rpc("exam_bundle", {
    p_token: "00000000-0000-0000-0000-000000000000",
  });
  record(
    "anonim sınav paketi yalnızca geçerli taslakla açılıyor",
    bundleProbe.status >= 400 &&
      /DRAFT_NOT_FOUND/.test(message(bundleProbe.body)) &&
      !("questions" in (bundleProbe.body ?? {})),
    `HTTP ${bundleProbe.status} ${message(bundleProbe.body)}`,
  );

  // Registration is open. The legacy RPC survives only as a constant stub:
  // it must not reveal whether an e-mail has an account or assignment.
  const emailStubA = await rpc("check_candidate_email", { p_email: "selftest-probe@example.com" });
  const emailStubB = await rpc("check_candidate_email", { p_email: "ui.test@example.com" });
  record(
    "eski e-posta sorgusu sabit yanıt veriyor",
    emailStubA.status === 200 &&
      emailStubA.body === true &&
      emailStubB.status === 200 &&
      emailStubB.body === true,
    `HTTP ${emailStubA.status}, ${emailStubA.body} / ${emailStubB.body}`,
  );

  const lookup = await rpc("lookup_attempt_result", { p_code: "zzzz", p_email: "selftest@example.com" });
  record(
    "lookup_attempt_result geçersiz kodu reddediyor",
    lookup.status >= 400 && String(message(lookup.body)).includes("INVALID_CODE"),
    `HTTP ${lookup.status} ${message(lookup.body)}`,
  );

  // Rubric helper
  const rubric = await rpc("rubric_total", {
    p_rubric: { task: 4, language: 3 },
    p_keys: ["task", "language"],
  });
  record("rubric_total topluyor", rubric.status === 200 && Number(rubric.body) === 7, `değer ${rubric.body}`);

  const clamped = await rpc("rubric_total", {
    p_rubric: { task: 9, language: -2 },
    p_keys: ["task", "language"],
  });
  record(
    "rubric_total 0–5 aralığına kırpıyor",
    clamped.status === 200 && Number(clamped.body) === 5,
    `değer ${clamped.body}`,
  );

  // Admin-only RPCs must reject the anon key, not merely exist.
  const adminCalls = [
    ["admin_dashboard_summary", {}],
    ["admin_list_candidates", {}],
    ["admin_candidate_detail", { p_email: "selftest@example.com" }],
    [
      "admin_grade_attempt",
      {
        p_attempt_id: "00000000-0000-0000-0000-000000000000",
        p_writing_part1: 6,
        p_writing_part2: 6,
        p_speaking_part1: 6,
        p_speaking_part2: 6,
        p_note: null,
        p_writing_rubric: null,
        p_speaking_rubric: null,
      },
    ],
    ["content_stats", {}],
  ];

  for (const [fn, body] of adminCalls) {
    const response = await rpc(fn, body);
    record(
      `anonim ${fn} kapalı`,
      denied(response.status, response.body),
      `HTTP ${response.status} ${message(response.body)}`,
    );
  }

  // Row level security: no candidate or anon may read these tables directly.
  const protectedTables = [
    "attempts",
    "exam_drafts",
    "exam_assignments",
    "profiles",
    "questions",
    "listening_questions",
    "grading_audit",
    "client_errors",
    "question_revisions",
    "practice_sessions",
    "access_throttle",
  ];

  for (const table of protectedTables) {
    const response = await rest(`${table}?select=*&limit=1`);
    const rows = Array.isArray(response.body) ? response.body.length : 0;
    record(
      `RLS: ${table} anon okumasına kapalı`,
      denied(response.status) || (response.status === 200 && rows === 0),
      `HTTP ${response.status}, ${rows} satır`,
    );
  }

  const publicView = await rest("questions_public?select=*&limit=1");
  record(
    "questions_public anon okumasına açık ve cevapsız",
    publicView.status === 200 &&
      Array.isArray(publicView.body) &&
      (publicView.body.length === 0 || !("correct_index" in publicView.body[0])),
    `HTTP ${publicView.status}`,
  );

  // Storage: private recordings bucket must not be listable or writable by anon.
  const listRecordings = await fetch(`${url}/storage/v1/object/list/exam-recordings`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 1 }),
  });
  const listed = await listRecordings.text();
  record(
    "storage: kayıt kovası anon listelenemiyor",
    listRecordings.status !== 200 || listed.trim() === "[]",
    `HTTP ${listRecordings.status}`,
  );

  if (migrated) {
    const uploadPath = `recordings/2000-01-01/${crypto.randomUUID()}.wav`;
    const upload = await fetch(`${url}/storage/v1/object/exam-recordings/${uploadPath}`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "audio/wav",
        "x-upsert": "false",
      },
      body: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]),
    });
    const uploadBody = await upload.text();
    record(
      "storage: anonim kayıt yüklemesi kapalı",
      denied(upload.status, uploadBody) ||
        (upload.status >= 400 && /AccessDenied|row-level security|Unauthorized/i.test(uploadBody)),
      `HTTP ${upload.status} ${uploadBody.slice(0, 120)}`,
    );
  } else {
    record("storage: anonim kayıt yüklemesi kapalı", false, "migration 20261105 uygulanmadı");
  }

  const columns = await rest(
    "attempts?select=writing_rubric,speaking_rubric,graded_by,graded_at,integrity," +
      "writing_part1_score,writing_part2_score,speaking_part1_score,speaking_part2_score&limit=1",
  );
  record(
    "attempts rubrik, bütünlük ve bölüm puanı kolonları var",
    columns.status !== 400,
    `HTTP ${columns.status} ${message(columns.body)}`,
  );

  for (const row of results) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
  }
  const failed = results.filter((row) => !row.ok).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti`);
  process.exit(failed > 0 ? 1 : 0);
}

await main();
