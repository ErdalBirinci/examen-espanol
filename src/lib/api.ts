import {
  MAX_AUDIO_BYTES,
  MEDIA_BUCKET,
  RECORDINGS_BUCKET,
  publicMediaUrl,
  supabase,
} from "./supabase";
import type {
  Attempt,
  AttemptIntegrity,
  AttemptResult,
  Candidate,
  CertificateRecord,
  ContentStats,
  DashboardSummary,
  ExamBundle,
  ExamSettings,
  GradingAuditEntry,
  Level,
  ListeningItem,
  ListeningQuestionAdmin,
  PracticeBundle,
  PracticeResult,
  QuestionAdmin,
  QuestionRevision,
  QuestionStat,
  SpeakingPrompt,
  SpeakingRubric,
  WritingPrompt,
  WritingRubric,
} from "./types";

const ADMIN_EMAIL_DOMAIN = "examen.local";

function fail(message: string): never {
  throw new Error(message);
}

/* ------------------------------------------------------------------ */
/*  Aday tarafı (anon)                                                */
/* ------------------------------------------------------------------ */

/**
 * Content for one attempt. The server has already picked the random question
 * set, so the browser only receives the questions this candidate will answer.
 */
export async function getExamBundle(token: string): Promise<ExamBundle> {
  const { data, error } = await supabase.rpc("exam_bundle", { p_token: token });
  if (error) {
    if ((error.message ?? "").includes("DRAFT_NOT_FOUND")) {
      fail("Sınav oturumu bulunamadı. Sayfayı yenileyip sınava yeniden başla.");
    }
    fail(`Sınav içeriği yüklenemedi: ${error.message}`);
  }
  if (!data) fail("Sınav içeriği boş döndü. Sayfayı yenileyip yeniden dene.");
  return data as unknown as ExamBundle;
}

export async function uploadSpeakingRecording(blob: Blob, extension: string): Promise<string> {
  if (blob.size > MAX_AUDIO_BYTES) {
    fail("Kayıt 50 MB sınırını aşıyor. Daha kısa bir kayıt dene.");
  }
  const path = `recordings/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(RECORDINGS_BUCKET).upload(path, blob, {
    contentType: blob.type || "audio/webm",
    upsert: false,
  });
  if (error) fail(`Ses kaydı yüklenemedi: ${error.message}`);
  return path;
}

export interface SubmitAttemptInput {
  candidate: Candidate;
  level: Level;
  mcAnswers: Record<string, number>;
  listeningAnswers: Record<string, number>;
  writingText: string;
  writingText2: string;
  speakingPath: string | null;
  speakingDuration: number | null;
  assignmentId: string;
  draftToken: string;
}

export async function submitAttempt(input: SubmitAttemptInput): Promise<string> {
  // Validation, rate limiting and scoring all happen inside Postgres; the
  // browser no longer writes to attempts directly.
  const { data, error } = await supabase.rpc("submit_attempt", {
    p_level: input.level,
    p_full_name: `${input.candidate.firstName} ${input.candidate.lastName}`.trim(),
    p_email: input.candidate.email.trim().toLowerCase(),
    p_mc_answers: input.mcAnswers,
    p_listening_answers: input.listeningAnswers,
    p_writing_text: input.writingText,
    p_writing_text_2: input.writingText2,
    p_speaking_path: input.speakingPath,
    p_speaking_duration: input.speakingDuration,
    p_assignment_id: input.assignmentId,
    p_draft_token: input.draftToken,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("RATE_LIMIT")) {
      fail("Bu e-posta ile 2 dakika içinde yalnızca bir sınav gönderilebilir. Lütfen biraz bekle.");
    }
    if (message.includes("ASSIGNMENT_REQUIRED") || message.includes("ASSIGNMENT_NOT_FOUND")) {
      fail("Bu sınav ataması bulunamadı. Panelinden sınavı yeniden aç.");
    }
    if (message.includes("ASSIGNMENT_MISMATCH")) {
      fail("Bu sınav bu e-posta adresine atanmamış.");
    }
    if (message.includes("ALREADY_SUBMITTED")) {
      fail("Bu sınav daha önce gönderilmiş.");
    }
    if (message.includes("DUE_DATE_PASSED")) {
      fail("Bu sınavın son gönderim tarihi geçmiş.");
    }
    if (message.includes("LEVEL_MISMATCH")) {
      fail("Sınav seviyesi atamayla uyuşmuyor.");
    }
    if (message.includes("DRAFT_REQUIRED") || message.includes("DRAFT_NOT_FOUND")) {
      fail("Sınav oturumu bulunamadı. Sayfayı yenileyip sınava yeniden başla.");
    }
    if (message.includes("DRAFT_MISMATCH")) {
      fail("Sınav oturumu bu atamayla eşleşmiyor. Sayfayı yenileyip yeniden başla.");
    }
    if (message.includes("INVALID_EMAIL")) fail("E-posta adresi geçersiz görünüyor.");
    if (message.includes("INVALID_NAME")) fail("Ad ve soyad geçersiz görünüyor.");
    if (message.includes("WRITING_TOO_LONG")) fail("Yazma cevabı izin verilen uzunluğu aşıyor.");
    if (message.includes("INVALID_RECORDING") || message.includes("INVALID_DURATION")) {
      fail("Ses kaydı bilgileri geçersiz. Kaydı kaldırıp yeniden dene.");
    }
    fail(`Sınav gönderilemedi: ${message}`);
  }

  return data as string;
}

export interface ExamDraftSnapshot {
  token: string;
  code: string;
  level: Level;
  started_at: string;
  updated_at: string;
  mc_answers: Record<string, number>;
  listening_answers: Record<string, number>;
  writing_text: string;
  writing_text_2: string;
}

export async function startExamDraft(
  candidate: Candidate,
  level: Level,
  assignmentId: string,
): Promise<{
  token: string;
  code: string;
  startedAt: string;
  testQuestions: number;
  listeningQuestions: number;
}> {
  const { data, error } = await supabase.rpc("start_exam_draft", {
    p_level: level,
    p_full_name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    p_email: candidate.email.trim().toLowerCase(),
    p_assignment_id: assignmentId,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_SUBMITTED")) fail("Bu sınav daha önce gönderilmiş.");
    if (message.includes("ASSIGNMENT_NOT_FOUND")) fail("Bu sınav ataması bulunamadı.");
    if (message.includes("ASSIGNMENT_MISMATCH")) fail("Bu sınav bu e-posta adresine atanmamış.");
    fail(`Sınav taslağı başlatılamadı: ${message}`);
  }
  const row = data as {
    token: string;
    code: string;
    started_at: string;
    test_questions?: number;
    listening_questions?: number;
  };
  return {
    token: row.token,
    code: row.code,
    startedAt: row.started_at,
    testQuestions: row.test_questions ?? 0,
    listeningQuestions: row.listening_questions ?? 0,
  };
}

export async function saveExamDraft(
  token: string,
  mcAnswers: Record<string, number>,
  listeningAnswers: Record<string, number>,
  writing: string,
  writing2: string,
): Promise<void> {
  const { error } = await supabase.rpc("save_exam_draft", {
    p_token: token,
    p_mc_answers: mcAnswers,
    p_listening_answers: listeningAnswers,
    p_writing_text: writing,
    p_writing_text_2: writing2,
  });
  if (error) fail(`Taslak kaydedilemedi: ${error.message}`);
}

export async function getExamDraft(token: string): Promise<ExamDraftSnapshot | null> {
  const { data, error } = await supabase.rpc("get_exam_draft", { p_token: token });
  if (error) {
    const message = error.message ?? "";
    // The draft belongs to another account or the session expired.
    if (message.includes("AUTH_REQUIRED")) {
      fail("Oturumun sona ermiş. Yeniden giriş yapıp sınava devam et.");
    }
    fail(`Taslak yüklenemedi: ${message}`);
  }
  return (data as unknown as ExamDraftSnapshot | null) ?? null;
}

export async function resumeExamDraft(
  code: string,
  email: string,
  level: Level,
): Promise<ExamDraftSnapshot | null> {
  const { data, error } = await supabase.rpc("resume_exam_draft", {
    p_code: code.trim().toUpperCase(),
    p_email: email.trim().toLowerCase(),
    p_level: level,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("AUTH_REQUIRED")) {
      fail("Oturumun sona ermiş. Yeniden giriş yapıp sınava devam et.");
    }
    if (message.includes("EMAIL_MISMATCH")) {
      fail("Bu taslak oturum açtığın hesaba ait değil.");
    }
    if (message.includes("INVALID_CODE")) fail("Kod 8 karakter olmalı (ör. 4F2A9C1B).");
    if (message.includes("INVALID_EMAIL")) fail("E-posta adresi geçersiz görünüyor.");
    fail(`Taslak sorgulanamadı: ${message}`);
  }
  return (data as unknown as ExamDraftSnapshot | null) ?? null;
}

export async function deleteExamDraft(code: string, email: string): Promise<void> {
  await supabase.rpc("delete_exam_draft", {
    p_code: code.trim().toUpperCase(),
    p_email: email.trim().toLowerCase(),
  });
}

export async function issueCertificate(
  reference: string,
  email: string,
): Promise<CertificateRecord> {
  const { data, error } = await supabase.rpc("issue_certificate", {
    p_code: reference.trim().toLowerCase(),
    p_email: email.trim().toLowerCase(),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("CERTIFICATE_NOT_FOUND")) fail("Katılım belgesi için sınav kaydı bulunamadı.");
    if (message.includes("CERTIFICATE_HIDDEN")) fail("Sonuçlar henüz yayınlanmadı.");
    if (message.includes("CERTIFICATE_NOT_READY")) fail("Katılım belgesi için değerlendirme tamamlanmadı.");
    if (message.includes("CERTIFICATE_NOT_ELIGIBLE")) fail("Katılım belgesi için koşullar sağlanmadı.");
    fail(`Katılım belgesi oluşturulamadı: ${message}`);
  }
  return data as CertificateRecord;
}

export async function getCertificate(code: string): Promise<CertificateRecord | null> {
  const { data, error } = await supabase.rpc("get_certificate", {
    p_certificate: code.trim().toLowerCase(),
  });
  if (error) fail(`Katılım belgesi doğrulanamadı: ${error.message}`);
  return (data as CertificateRecord | null) ?? null;
}

export async function lookupAttemptResult(code: string, email: string): Promise<AttemptResult | null> {
  const { data, error } = await supabase.rpc("lookup_attempt_result", {
    p_code: code.trim().toLowerCase(),
    p_email: email.trim().toLowerCase(),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("INVALID_CODE")) fail("Referans kodu 8 karakterlik olmalı (ör. 4F2A9C1B).");
    if (message.includes("INVALID_EMAIL")) fail("E-posta adresi geçersiz görünüyor.");
    fail(`Sonuç sorgulanamadı: ${message}`);
  }
  return (data as unknown as AttemptResult | null) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Aday hesapları ve atamalar                                        */
/* ------------------------------------------------------------------ */

export interface CandidateAccount {
  id: string;
  email: string;
  fullName: string;
}

export interface Assignment {
  id: string;
  level: Level;
  title: string | null;
  note: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  results_visible: boolean;
  created_at: string;
  attempt_id: string | null;
  attempt_status: "submitted" | "graded" | null;
  submitted_at: string | null;
}

export async function getCandidateAccount(): Promise<CandidateAccount | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const metadata = (user.user_metadata ?? {}) as { full_name?: string };
  return {
    id: user.id,
    email: user.email,
    fullName: metadata.full_name?.trim() || user.email.split("@")[0],
  };
}

/**
 * Open registration: anyone can create an account. The admin assigns exams to
 * the account's e-mail afterwards, so no assignment is required up front.
 */
export async function registerCandidate(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ needsConfirmation: boolean }> {
  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: input.fullName.trim() } },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      fail("Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.");
    }
    fail(`Kayıt tamamlanamadı: ${error.message}`);
  }
  return { needsConfirmation: !data.session };
}

export async function signInCandidate(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) fail("E-posta veya şifre hatalı.");
}

export async function signOutCandidate(): Promise<void> {
  await supabase.auth.signOut();
}

const RECOVERY_FLAG = "examen-espanol:recovery";

function passwordResetRedirectUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${window.location.origin}${base.endsWith("/") ? base : `${base}/`}cuenta/restablecer`;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: passwordResetRedirectUrl(),
  });
  if (error) {
    if (/rate limit|too many/i.test(error.message)) {
      fail("Çok fazla e-posta isteği gönderildi. Birkaç dakika sonra tekrar dene.");
    }
    fail(`Şifre sıfırlama e-postası gönderilemedi: ${error.message}`);
  }
}

/**
 * Recovery links land with either hash tokens (implicit flow) or a PKCE code.
 * The app uses detectSessionInUrl: false, so the reset screen restores the
 * temporary session explicitly here.
 */
export async function restoreRecoverySession(): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const authError = hash.get("error_description") || query.get("error_description");
  if (authError) fail(`Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş: ${authError}`);

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (hash.get("type") === "recovery" && accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) fail("Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
    markRecoverySession();
    clearRecoveryParams();
    return true;
  }

  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) fail("Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
    markRecoverySession();
    clearRecoveryParams();
    return true;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session) && hasRecoverySession();
}

function markRecoverySession() {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    /* storage can be unavailable */
  }
}

function hasRecoverySession(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearRecoverySession() {
  try {
    sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* storage can be unavailable */
  }
}

function clearRecoveryParams() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export async function updateCandidatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/weak|at least|password/i.test(error.message)) {
      fail("Şifre güncellenemedi. En az 8 karakterlik daha güçlü bir şifre dene.");
    }
    fail(`Şifre güncellenemedi: ${error.message}`);
  }
}

export async function listMyAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase.rpc("candidate_assignments");
  if (error) fail(`Sınavlar yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as Assignment[];
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const { data, error } = await supabase.rpc("candidate_assignments");
  if (error) fail(`Sınav bilgisi yüklenemedi: ${error.message}`);
  const rows = (data ?? []) as unknown as Assignment[];
  return rows.find((row) => row.id === id) ?? null;
}

export interface AdminAssignment extends Assignment {
  email: string;
  attempts?: { id: string; status: string; full_name: string }[];
}

export async function listAllAssignments(): Promise<AdminAssignment[]> {
  const { data, error } = await supabase
    .from("exam_assignments")
    .select("*, attempts(id, status, full_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) fail(`Atamalar yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as AdminAssignment[];
}

export interface BulkAssignmentInput {
  emails: string[];
  level: Level;
  title: string;
  note: string;
  resultsVisible: boolean;
}

function isMissingFunction(error: { code?: string | null; message?: string | null } | null): boolean {
  return (
    error?.code === "PGRST202" ||
    /could not find the function/i.test(error?.message ?? "")
  );
}

function dbDetail(error: { code?: string | null; message?: string | null; details?: string | null }) {
  return [error.message, error.details].filter(Boolean).join(" · ") || "bilinmeyen hata";
}

/**
 * Aynı ayarlarla birden çok adaya sınav atar.
 *
 * Önce sunucudaki atama fonksiyonu denenir (yetkiyi kendi içinde doğrular).
 * Fonksiyon veritabanında yoksa, yönetici oturumunun tablo politikasıyla
 * doğrudan yazmasına düşülür; böylece atama akışı ek SQL kurulumuna
 * bağlı kalmadan da çalışır.
 */
export async function bulkAssignExam(input: BulkAssignmentInput): Promise<number> {
  const emails = Array.from(
    new Set(
      input.emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  );
  if (emails.length === 0) fail("Geçerli bir e-posta adresi bulunamadı.");

  // Yazma isteği oturumsuz gitmesin: tablo politikaları yöneticiyi oturumdan okur.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    fail("Oturumun sona ermiş. Yeniden giriş yapıp sınavı tekrar ata.");
  }
  const { data: userData } = await supabase.auth.getUser();
  const adminId = userData.user?.id ?? null;

  const title = input.title.trim() || null;
  const note = input.note.trim() || null;

  const { data, error } = await supabase.rpc("admin_assign_exams", {
    p_emails: emails,
    p_level: input.level,
    p_title: title,
    p_note: note,
    p_results_visible: input.resultsVisible,
  });
  if (!error) return Number(data ?? emails.length);

  if (!isMissingFunction(error)) {
    const raw = dbDetail(error);
    if (raw.includes("UNAUTHORIZED")) {
      fail(
        "Sınav atamak için yönetici yetkisi gerekiyor. Oturumu kapatıp yönetici hesabıyla yeniden giriş yap.",
      );
    }
    if (raw.includes("NO_EMAILS") || raw.includes("INVALID_LEVEL")) {
      fail("Geçerli bir e-posta adresi ve seviye gir.");
    }
    fail(`Toplu atama yapılamadı: ${raw}`);
  }

  const rows = emails.map((email) => ({
    email,
    level: input.level,
    title,
    note,
    due_at: null,
    duration_minutes: null,
    results_visible: input.resultsVisible,
    created_by: adminId,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("exam_assignments")
    .insert(rows)
    .select("id");
  if (insertError) {
    const raw = dbDetail(insertError);
    if (/row-level security|permission denied/i.test(raw)) {
      fail(
        "Atama yazılamadı: veritabanı yönetici yazma iznini reddetti (RLS). Yönetici oturumuyla giriş yaptığından emin ol; sorun sürerse 20261112_assign_without_schedule.sql dosyasını Supabase SQL Editor'de çalıştır. Ayrıntı: " +
          raw,
      );
    }
    fail(`Toplu atama yapılamadı: ${raw}`);
  }
  return inserted?.length ?? emails.length;
}

/** Seçili atamaların sonuç görünürlüğünü tek işlemde değiştirir. */
export async function setAssignmentsResultsVisible(
  ids: string[],
  visible: boolean,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("exam_assignments")
    .update({ results_visible: visible })
    .in("id", ids);
  if (error) fail(`Toplu yayınlama başarısız: ${error.message}`);
}

export async function setAssignmentResultsVisible(id: string, visible: boolean): Promise<void> {
  const { error } = await supabase
    .from("exam_assignments")
    .update({ results_visible: visible })
    .eq("id", id);
  if (error) fail(`Sonuç görünürlüğü güncellenemedi: ${error.message}`);
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("exam_assignments").delete().eq("id", id);
  if (error) fail(`Atama silinemedi: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/*  Admin                                                             */
/* ------------------------------------------------------------------ */

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  if (clean.includes("@")) return clean;
  return `${clean}@${ADMIN_EMAIL_DOMAIN}`;
}

export async function signInAdmin(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) fail("Kullanıcı adı veya şifre hatalı.");
  return data.session;
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
}

export async function fetchMyProfile(): Promise<AdminProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) return null;
  return (data as AdminProfile | null) ?? null;
}

export interface ManagedCandidateSummary {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  assignments_count: number;
  attempts_count: number;
  pending_count: number;
  certificates_count: number;
  latest_activity: string | null;
  last_assignment_at: string | null;
  last_draft_at: string | null;
  last_attempt_at: string | null;
  last_certificate_at: string | null;
}

export interface ManagedCandidateAccount {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  sessions: number;
}

export interface ManagedAssignment {
  id: string;
  level: Level;
  title: string | null;
  note: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  results_visible: boolean;
  created_at: string;
  attempt_id: string | null;
  attempt_status: "submitted" | "graded" | null;
  submitted_at: string | null;
}

export interface ManagedAttempt {
  id: string;
  level: Level;
  status: "submitted" | "graded";
  scoring_version: number;
  created_at: string;
  submitted_at: string;
  mc_correct: number | null;
  mc_total: number | null;
  mc_score: number | null;
  listening_correct: number | null;
  listening_total: number | null;
  listening_score: number | null;
  writing_score: number | null;
  writing_part1_score: number | null;
  writing_part2_score: number | null;
  speaking_score: number | null;
  total_score: number | null;
  certificate_code: string | null;
  certificate_issued_at: string | null;
  result_notified_at: string | null;
  speaking_path: string | null;
}

export interface ManagedDraft {
  code: string;
  level: Level;
  started_at: string;
  updated_at: string;
  answered: number;
  listening_answered: number;
  writing_chars: number;
}

export interface ManagedCandidateDetail {
  account: ManagedCandidateAccount;
  assignments: ManagedAssignment[];
  attempts: ManagedAttempt[];
  drafts: ManagedDraft[];
}

function failManaged(error: { message?: string } | null, fallback: string): never {
  const message = error?.message ?? "";
  if (message.includes("UNAUTHORIZED")) {
    fail("Bu işlem için yönetici yetkisi gerekiyor.");
  }
  if (message.includes("CANDIDATE_NOT_FOUND")) {
    fail("Kullanıcı bulunamadı veya artık mevcut değil.");
  }
  fail(`${fallback}: ${message}`);
}

export async function listManagedCandidates(): Promise<ManagedCandidateSummary[]> {
  const { data, error } = await supabase.rpc("admin_list_candidates");
  if (error) failManaged(error, "Kullanıcılar yüklenemedi");
  return (data ?? []) as unknown as ManagedCandidateSummary[];
}

export async function getManagedCandidateDetail(email: string): Promise<ManagedCandidateDetail> {
  const { data, error } = await supabase.rpc("admin_candidate_detail", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) failManaged(error, "Kullanıcı detayı yüklenemedi");
  return data as unknown as ManagedCandidateDetail;
}

export async function setManagedCandidateDisabled(
  email: string,
  disabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("admin_set_candidate_disabled", {
    p_email: email.trim().toLowerCase(),
    p_disabled: disabled,
  });
  if (error) failManaged(error, "Hesap durumu güncellenemedi");
}

export async function revokeManagedCandidateSessions(email: string): Promise<void> {
  const { error } = await supabase.rpc("admin_revoke_candidate_sessions", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) failManaged(error, "Oturumlar sonlandırılamadı");
}

export async function deleteManagedCandidate(email: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_candidate", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) failManaged(error, "Kullanıcı silinemedi");
}

export async function sendManagedCandidatePasswordReset(email: string): Promise<void> {
  await requestPasswordReset(email);
}

export async function deleteCandidateRecordings(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter((path) => path.trim().length > 0))];
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(RECORDINGS_BUCKET).remove(unique);
  if (error) fail(`Ses kayıtları silinemedi: ${error.message}`);
}

export async function listAttempts(): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) fail(`Sınavlar yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as Attempt[];
}

export interface AttemptQuery {
  level: Level | "all";
  status: "all" | "submitted" | "graded";
  search: string;
  page: number;
  pageSize: number;
}

export interface AttemptPage {
  rows: Attempt[];
  total: number;
}

/** Commas and parentheses would break PostgREST's or() filter syntax. */
function attemptSearchNeedle(search: string): string {
  return search.trim().slice(0, 80).replace(/[,()\\]/g, " ");
}

export async function listAttemptsPage(query: AttemptQuery): Promise<AttemptPage> {
  let request = supabase.from("attempts").select("*", { count: "exact" });
  if (query.level !== "all") request = request.eq("level", query.level);
  if (query.status !== "all") request = request.eq("status", query.status);
  const needle = attemptSearchNeedle(query.search);
  if (needle) {
    request = request.or(`full_name.ilike.%${needle}%,email.ilike.%${needle}%`);
  }

  const from = Math.max(0, (query.page - 1) * query.pageSize);
  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, from + query.pageSize - 1);

  if (error) fail(`Sınavlar yüklenemedi: ${error.message}`);
  return { rows: (data ?? []) as unknown as Attempt[], total: count ?? 0 };
}

const EXPORT_COLUMNS =
  "id,full_name,email,level,status,scoring_version,mc_correct,mc_total,mc_score,listening_score,listening_correct,listening_total,writing_score,writing_part1_score,writing_part2_score,speaking_part1_score,speaking_part2_score,speaking_score,total_score,certificate_code,submitted_at,created_at";

/**
 * Every row matching the current filters, in batches, for a CSV export.
 * Deliberately omits the large answer/writing payloads.
 */
export async function listAttemptsForExport(
  query: Omit<AttemptQuery, "page" | "pageSize">,
  cap = 5000,
): Promise<Attempt[]> {
  const batchSize = 500;
  const rows: Attempt[] = [];

  for (let from = 0; from < cap; from += batchSize) {
    let request = supabase.from("attempts").select(EXPORT_COLUMNS);
    if (query.level !== "all") request = request.eq("level", query.level);
    if (query.status !== "all") request = request.eq("status", query.status);
    const needle = attemptSearchNeedle(query.search);
    if (needle) {
      request = request.or(`full_name.ilike.%${needle}%,email.ilike.%${needle}%`);
    }

    const { data, error } = await request
      .order("created_at", { ascending: false })
      .range(from, Math.min(from + batchSize, cap) - 1);

    if (error) fail(`Sonuçlar dışa aktarılamadı: ${error.message}`);
    const batch = (data ?? []) as unknown as Attempt[];
    rows.push(...batch);
    if (batch.length < batchSize) break;
  }

  return rows;
}

export interface GradeInput {
  id: string;
  scoring_version: number;
  writing_part1_score: number | null;
  writing_part2_score: number | null;
  speaking_part1_score: number | null;
  speaking_part2_score: number | null;
  speaking_score?: number | null;
  admin_note: string | null;
  writing_rubric?: WritingRubric | null;
  speaking_rubric?: SpeakingRubric | null;
  // Legacy (scoring_version = 1) attempts keep the old manual fields.
  writing_score?: number | null;
  listening_score?: number | null;
}

export async function gradeAttempt(input: GradeInput): Promise<void> {
  if (input.scoring_version >= 2) {
    const { error } = await supabase.rpc("admin_grade_attempt", {
      p_attempt_id: input.id,
      p_writing_part1: input.writing_part1_score,
      p_writing_part2: input.writing_part2_score,
      p_speaking_part1: input.speaking_part1_score,
      p_speaking_part2: input.speaking_part2_score,
      p_note: input.admin_note,
      p_writing_rubric: input.writing_rubric ?? null,
      p_speaking_rubric: input.speaking_rubric ?? null,
    });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("INCOMPLETE_GRADING")) {
        fail("Yazma ve konuşma bölümlerinin tümü girilmeden değerlendirme tamamlanamaz.");
      }
      if (message.includes("INVALID_WRITING_SCORE")) fail("Yazma puanları 0–10 arasında olmalı.");
      if (message.includes("INVALID_SPEAKING_SCORE")) fail("Konuşma bölüm puanları 0–10 arasında olmalı.");
      if (message.includes("RUBRIC_MISMATCH")) {
        fail("Rubrik puanları bölüm puanlarıyla eşleşmiyor. Rubriği sıfırlayıp yeniden puanla.");
      }
      fail(`Değerlendirme kaydedilemedi: ${message}`);
    }
    return;
  }

  const { error } = await supabase
    .from("attempts")
    .update({
      listening_score: input.listening_score,
      writing_score: input.writing_score,
      speaking_score: input.speaking_score,
      admin_note: input.admin_note,
      status: input.writing_score !== null && input.speaking_score !== null ? "graded" : "submitted",
    })
    .eq("id", input.id);
  if (error) fail(`Değerlendirme kaydedilemedi: ${error.message}`);
}

/* ------------------------ Değerlendirme akışı ----------------------- */

/** Denetim izi: bir sınavın puanlama geçmişi. */
export async function listAttemptAudit(attemptId: string): Promise<GradingAuditEntry[]> {
  const { data, error } = await supabase
    .from("grading_audit")
    .select("id,action,actor_email,before,after,created_at")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail(`Değerlendirme geçmişi yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as GradingAuditEntry[];
}

/** Değerlendirme kuyruğundaki en eski bekleyen kayıt. */
export async function nextPendingAttempt(excludeId?: string): Promise<Attempt | null> {
  let request = supabase
    .from("attempts")
    .select("*")
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(1);
  if (excludeId) request = request.neq("id", excludeId);

  const { data, error } = await request;
  if (error) fail(`Sıradaki kayıt yüklenemedi: ${error.message}`);
  return ((data ?? [])[0] as unknown as Attempt) ?? null;
}

/** Sınav bütünlüğü sayaçlarını gönderime bağlar (kısa süreli pencere). */
export async function recordAttemptIntegrity(
  attemptId: string,
  integrity: AttemptIntegrity,
): Promise<void> {
  const { error } = await supabase.rpc("record_attempt_integrity", {
    p_attempt_id: attemptId,
    p_integrity: integrity,
  });
  // Bütünlük kaydı gönderimi engellemez; sessizce yutulur.
  if (error) return;
}

/** Panelde tek çağrıda sayaçlar + seviye ortalamaları. */
export async function adminDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("admin_dashboard_summary");
  if (error) fail(`Panel özeti yüklenemedi: ${error.message}`);
  return data as DashboardSummary;
}

/** Bir test sorusunun sürüm geçmişi. */
export async function listQuestionRevisions(questionId: string): Promise<QuestionRevision[]> {
  const { data, error } = await supabase
    .from("question_revisions")
    .select("*")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) fail(`Sürüm geçmişi yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as QuestionRevision[];
}

/* --------------------------- Deneme modu ---------------------------- */

/** Rastgele kısa test: cevap anahtarı gönderilmez. */
export async function practiceBundle(level: Level, count = 10): Promise<PracticeBundle> {
  const { data, error } = await supabase.rpc("practice_bundle", {
    p_level: level,
    p_count: count,
  });
  if (error) fail(`Deneme testi yüklenemedi: ${error.message}`);
  return data as PracticeBundle;
}

export async function practiceCheck(
  session: string,
  answers: Record<string, number>,
): Promise<PracticeResult> {
  const { data, error } = await supabase.rpc("practice_check", {
    p_session: session,
    p_answers: answers,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_CHECKED")) {
      fail("Bu deneme zaten değerlendirildi. Yeni bir deneme başlat.");
    }
    if (message.includes("SESSION_EXPIRED")) {
      fail("Deneme süresi doldu. Yeni bir deneme başlat.");
    }
    if (message.includes("SESSION_NOT_FOUND")) {
      fail("Deneme oturumu bulunamadı. Yeni bir deneme başlat.");
    }
    if (message.includes("RATE_LIMIT")) {
      fail("Çok sık deneme başlatıldı. Bir süre sonra tekrar dene.");
    }
    fail(`Deneme testi değerlendirilemedi: ${message}`);
  }
  return data as PracticeResult;
}

export interface NotifyResult {
  sent: boolean;
  reason?: string;
}

export async function notifyAttemptResult(attemptId: string): Promise<NotifyResult> {
  const { data, error } = await supabase.functions.invoke("notify-result", {
    body: { attemptId },
  });

  if (error) {
    let reason = "";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as { error?: string };
        reason = body?.error ?? "";
      } catch {
        /* non-json error body */
      }
    }
    return { sent: false, reason: reason || error.message };
  }

  return (data as NotifyResult | null) ?? { sent: false, reason: "empty_response" };
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await supabase.from("attempts").delete().eq("id", id);
  if (error) fail(`Kayıt silinemedi: ${error.message}`);
}

export async function signedRecordingUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/* --------------------------- Test soruları -------------------------- */

export async function listQuestions(level: Level): Promise<QuestionAdmin[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("level", level)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail(`Sorular yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as QuestionAdmin[];
}

export interface QuestionInput {
  id?: string;
  level: Level;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
}

export async function saveQuestion(input: QuestionInput): Promise<void> {
  const payload = {
    level: input.level,
    prompt: input.prompt.trim(),
    options: input.options.map((option) => option.trim()),
    correct_index: input.correct_index,
    explanation: input.explanation?.trim() || null,
    position: input.position,
  };
  const query = input.id
    ? supabase.from("questions").update(payload).eq("id", input.id)
    : supabase.from("questions").insert(payload);
  const { error } = await query;
  if (error) fail(`Soru kaydedilemedi: ${error.message}`);
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) fail(`Soru silinemedi: ${error.message}`);
}

export interface ImportedQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
}

export async function importQuestions(level: Level, rows: ImportedQuestion[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("questions").insert(
    rows.map((row) => ({
      level,
      prompt: row.prompt,
      options: row.options,
      correct_index: row.correct_index,
      explanation: row.explanation,
      position: row.position,
    })),
  );
  if (error) fail(`Sorular içe aktarılamadı: ${error.message}`);
}

/* ----------------------------- Dinleme ----------------------------- */

export async function listListening(level: Level): Promise<ListeningItem[]> {
  const { data, error } = await supabase
    .from("listening_items")
    .select("*")
    .eq("level", level)
    .order("position", { ascending: true });
  if (error) fail(`Dinleme kayıtları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as ListeningItem[];
}

export interface ListeningInput {
  id?: string;
  level: Level;
  title: string;
  audio_path: string;
  max_plays: number;
  position: number;
  transcript: string | null;
}

export async function saveListening(input: ListeningInput): Promise<void> {
  const payload = {
    level: input.level,
    title: input.title.trim(),
    audio_path: input.audio_path,
    max_plays: input.max_plays,
    position: input.position,
    transcript: input.transcript?.trim() || null,
  };
  const query = input.id
    ? supabase.from("listening_items").update(payload).eq("id", input.id)
    : supabase.from("listening_items").insert(payload);
  const { error } = await query;
  if (error) fail(`Dinleme kaydı kaydedilemedi: ${error.message}`);
}

export async function deleteListening(item: ListeningItem): Promise<void> {
  const { error } = await supabase.from("listening_items").delete().eq("id", item.id);
  if (error) fail(`Dinleme kaydı silinemedi: ${error.message}`);
  await supabase.storage.from(MEDIA_BUCKET).remove([item.audio_path]);
}

export async function listAllListeningQuestions(): Promise<ListeningQuestionAdmin[]> {
  const { data, error } = await supabase
    .from("listening_questions")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail(`Dinleme soruları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as ListeningQuestionAdmin[];
}

export async function listListeningQuestions(itemId: string): Promise<ListeningQuestionAdmin[]> {
  const { data, error } = await supabase
    .from("listening_questions")
    .select("*")
    .eq("item_id", itemId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail(`Dinleme soruları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as ListeningQuestionAdmin[];
}

export interface ListeningQuestionInput {
  id?: string;
  item_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  position: number;
}

export async function saveListeningQuestion(input: ListeningQuestionInput): Promise<void> {
  const payload = {
    item_id: input.item_id,
    prompt: input.prompt.trim(),
    options: input.options.map((option) => option.trim()),
    correct_index: input.correct_index,
    position: input.position,
  };
  const query = input.id
    ? supabase.from("listening_questions").update(payload).eq("id", input.id)
    : supabase.from("listening_questions").insert(payload);
  const { error } = await query;
  if (error) fail(`Dinleme sorusu kaydedilemedi: ${error.message}`);
}

export async function deleteListeningQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("listening_questions").delete().eq("id", id);
  if (error) fail(`Dinleme sorusu silinemedi: ${error.message}`);
}

export async function uploadListeningAudio(file: File): Promise<string> {
  if (file.size > MAX_AUDIO_BYTES) fail("Ses dosyası 50 MB sınırını aşıyor.");
  const path = `listening/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || "audio/mpeg",
    upsert: false,
  });
  if (error) fail(`Ses dosyası yüklenemedi: ${error.message}`);
  return path;
}

export function listeningAudioUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return publicMediaUrl(path);
}

/** Public URL for a task image stored in the exam-media bucket. */
export function promptImageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return publicMediaUrl(path);
}

/* ------------------------------ Yazma ------------------------------ */

export async function listWriting(level: Level): Promise<WritingPrompt[]> {
  const { data, error } = await supabase
    .from("writing_prompts")
    .select("id, level, prompt, min_words, position, part, image_path")
    .eq("level", level)
    .order("part", { ascending: true })
    .order("position", { ascending: true });
  if (error) fail(`Yazma konuları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as WritingPrompt[];
}

export interface WritingInput {
  id?: string;
  level: Level;
  prompt: string;
  min_words: number;
  position: number;
  part: 1 | 2;
  image_path?: string | null;
}

export async function saveWriting(input: WritingInput): Promise<void> {
  const payload = {
    level: input.level,
    prompt: input.prompt.trim(),
    min_words: input.min_words,
    position: input.position,
    part: input.part,
    image_path: input.image_path?.trim() || null,
  };
  const query = input.id
    ? supabase.from("writing_prompts").update(payload).eq("id", input.id)
    : supabase.from("writing_prompts").insert(payload);
  const { error } = await query;
  if (error) fail(`Yazma konusu kaydedilemedi: ${error.message}`);
}

export async function deleteWriting(id: string): Promise<void> {
  const { error } = await supabase.from("writing_prompts").delete().eq("id", id);
  if (error) fail(`Yazma konusu silinemedi: ${error.message}`);
}

/* ---------------------------- Konuşma ------------------------------ */

export async function listSpeaking(level: Level): Promise<SpeakingPrompt[]> {
  const { data, error } = await supabase
    .from("speaking_prompts")
    .select("*")
    .eq("level", level)
    .order("position", { ascending: true });
  if (error) fail(`Konuşma konuları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as SpeakingPrompt[];
}

export interface SpeakingInput {
  id?: string;
  level: Level;
  prompt: string;
  guidance: string | null;
  prep_seconds: number;
  max_seconds: number;
  position: number;
  part: 1 | 2;
  image_path?: string | null;
}

export async function saveSpeaking(input: SpeakingInput): Promise<void> {
  const payload = {
    level: input.level,
    prompt: input.prompt.trim(),
    guidance: input.guidance?.trim() || null,
    prep_seconds: input.prep_seconds,
    max_seconds: input.max_seconds,
    position: input.position,
    part: input.part,
    image_path: input.image_path?.trim() || null,
  };
  const query = input.id
    ? supabase.from("speaking_prompts").update(payload).eq("id", input.id)
    : supabase.from("speaking_prompts").insert(payload);
  const { error } = await query;
  if (error) fail(`Konuşma konusu kaydedilemedi: ${error.message}`);
}

export async function deleteSpeaking(id: string): Promise<void> {
  const { error } = await supabase.from("speaking_prompts").delete().eq("id", id);
  if (error) fail(`Konuşma konusu silinemedi: ${error.message}`);
}

/* --------------------------- Sınav ayarları ------------------------- */

export async function listExamSettings(): Promise<ExamSettings[]> {
  const { data, error } = await supabase
    .from("exam_settings")
    .select("level, duration_minutes")
    .order("level");
  if (error) fail(`Sınav ayarları yüklenemedi: ${error.message}`);
  return (data ?? []) as unknown as ExamSettings[];
}

export async function saveExamSettings(rows: ExamSettings[]): Promise<void> {
  const { error } = await supabase.from("exam_settings").upsert(
    rows.map((row) => ({
      level: row.level,
      duration_minutes: Math.min(240, Math.max(10, Math.round(row.duration_minutes))),
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) fail(`Sınav ayarları kaydedilemedi: ${error.message}`);
}

export async function exportBackup(): Promise<string> {
  const tables = [
    "questions",
    "listening_items",
    "listening_questions",
    "writing_prompts",
    "speaking_prompts",
    "attempts",
    "exam_settings",
  ] as const;

  const results = await Promise.all(
    tables.map((table) =>
      table === "exam_settings"
        ? supabase.from(table).select("*").order("level", { ascending: true })
        : supabase.from(table).select("*").order("created_at", { ascending: true }),
    ),
  );

  const data: Record<string, unknown> = {};
  results.forEach((result, index) => {
    if (result.error) fail(`${tables[index]} yedeği alınamadı: ${result.error.message}`);
    data[tables[index]] = result.data ?? [];
  });

  return JSON.stringify(
    {
      app: "examen-espanol",
      version: 1,
      exported_at: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

export async function contentStats(): Promise<ContentStats[]> {
  const { data, error } = await supabase.rpc("content_stats");
  if (error) fail(`İçerik istatistikleri yüklenemedi: ${error.message}`);
  return (data ?? []) as ContentStats[];
}

/** Per-question difficulty and discrimination for a level. */
export async function questionStats(level: Level): Promise<QuestionStat[]> {
  const { data, error } = await supabase.rpc("question_stats", { p_level: level });
  if (error) fail(`Madde analizi yüklenemedi: ${error.message}`);
  return (data ?? []) as QuestionStat[];
}
