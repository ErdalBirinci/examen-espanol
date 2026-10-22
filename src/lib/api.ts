import {
  MAX_AUDIO_BYTES,
  MEDIA_BUCKET,
  RECORDINGS_BUCKET,
  publicMediaUrl,
  supabase,
} from "./supabase";
import type {
  Attempt,
  AttemptResult,
  Candidate,
  ContentStats,
  ExamBundle,
  ExamSettings,
  Level,
  ListeningItem,
  QuestionAdmin,
  QuestionPublic,
  SpeakingPrompt,
  WritingPrompt,
} from "./types";

const ADMIN_EMAIL_DOMAIN = "examen.local";

function fail(message: string): never {
  throw new Error(message);
}

/* ------------------------------------------------------------------ */
/*  Aday tarafı (anon)                                                */
/* ------------------------------------------------------------------ */

export async function loadExamBundle(level: Level): Promise<ExamBundle> {
  const [questionsRes, listeningRes, writingRes, speakingRes, settingsRes] = await Promise.all([
    supabase
      .from("questions_public")
      .select("id, level, prompt, options, position")
      .eq("level", level)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("listening_items")
      .select("*")
      .eq("level", level)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("writing_prompts")
      .select("id, level, prompt, min_words, position")
      .eq("level", level)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("speaking_prompts")
      .select("id, level, prompt, guidance, prep_seconds, max_seconds, position")
      .eq("level", level)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("exam_settings")
      .select("level, duration_minutes")
      .eq("level", level)
      .maybeSingle(),
  ]);

  if (questionsRes.error) fail(`Sorular yüklenemedi: ${questionsRes.error.message}`);
  if (listeningRes.error) fail(`Dinleme bölümü yüklenemedi: ${listeningRes.error.message}`);
  if (writingRes.error) fail(`Yazma bölümü yüklenemedi: ${writingRes.error.message}`);
  if (speakingRes.error) fail(`Konuşma bölümü yüklenemedi: ${speakingRes.error.message}`);

  return {
    questions: (questionsRes.data ?? []) as unknown as QuestionPublic[],
    listening: (listeningRes.data ?? []) as unknown as ListeningItem[],
    writing: (writingRes.data as unknown as WritingPrompt | null) ?? null,
    speaking: (speakingRes.data as unknown as SpeakingPrompt | null) ?? null,
    settings:
      (settingsRes.data as unknown as ExamSettings | null) ?? { level, duration_minutes: 60 },
  };
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
  listeningAnswers: Record<string, string>;
  writingText: string;
  speakingPath: string | null;
  speakingDuration: number | null;
  assignmentId: string;
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
    p_speaking_path: input.speakingPath,
    p_speaking_duration: input.speakingDuration,
    p_assignment_id: input.assignmentId,
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
  listening_answers: Record<string, string>;
  writing_text: string;
}

export async function startExamDraft(
  candidate: Candidate,
  level: Level,
): Promise<{ token: string; code: string; startedAt: string }> {
  const { data, error } = await supabase.rpc("start_exam_draft", {
    p_level: level,
    p_full_name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    p_email: candidate.email.trim().toLowerCase(),
  });
  if (error) fail(`Sınav taslağı başlatılamadı: ${error.message}`);
  const row = data as { token: string; code: string; started_at: string };
  return { token: row.token, code: row.code, startedAt: row.started_at };
}

export async function saveExamDraft(
  token: string,
  mcAnswers: Record<string, number>,
  listeningAnswers: Record<string, string>,
  writing: string,
): Promise<void> {
  const { error } = await supabase.rpc("save_exam_draft", {
    p_token: token,
    p_mc_answers: mcAnswers,
    p_listening_answers: listeningAnswers,
    p_writing_text: writing,
  });
  if (error) fail(`Taslak kaydedilemedi: ${error.message}`);
}

export async function getExamDraft(token: string): Promise<ExamDraftSnapshot | null> {
  const { data, error } = await supabase.rpc("get_exam_draft", { p_token: token });
  if (error) fail(`Taslak yüklenemedi: ${error.message}`);
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

export async function checkCandidateEmail(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_candidate_email", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) fail(`E-posta kontrol edilemedi: ${error.message}`);
  return Boolean(data);
}

export async function registerCandidate(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ needsConfirmation: boolean }> {
  const email = input.email.trim().toLowerCase();
  const registered = await checkCandidateEmail(email);
  if (!registered) {
    fail(
      "Bu e-posta ile daha önce bir sınav kaydı bulunamadı. Önce ad soyad ve e-posta ile sınava girmiş olman gerekiyor.",
    );
  }

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

export async function saveAssignment(input: {
  email: string;
  level: Level;
  title: string;
  note: string;
  dueAt: string | null;
  durationMinutes: number | null;
  resultsVisible: boolean;
}): Promise<void> {
  const { error } = await supabase.from("exam_assignments").insert({
    email: input.email.trim().toLowerCase(),
    level: input.level,
    title: input.title.trim() || null,
    note: input.note.trim() || null,
    due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
    duration_minutes: input.durationMinutes,
    results_visible: input.resultsVisible,
    created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  if (error) fail(`Sınav atanamadı: ${error.message}`);
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

export async function listAttemptsPage(query: AttemptQuery): Promise<AttemptPage> {
  let request = supabase.from("attempts").select("*", { count: "exact" });

  if (query.level !== "all") request = request.eq("level", query.level);
  if (query.status !== "all") request = request.eq("status", query.status);

  // Commas and parentheses would break PostgREST's or() filter syntax.
  const needle = query.search.trim().slice(0, 80).replace(/[,()\\]/g, " ");
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

export interface GradeInput {
  id: string;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
  admin_note: string | null;
  status: "graded" | "submitted";
}

export async function gradeAttempt(input: GradeInput): Promise<void> {
  const { error } = await supabase
    .from("attempts")
    .update({
      listening_score: input.listening_score,
      writing_score: input.writing_score,
      speaking_score: input.speaking_score,
      admin_note: input.admin_note,
      status: input.status,
    })
    .eq("id", input.id);
  if (error) fail(`Değerlendirme kaydedilemedi: ${error.message}`);
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

/* ------------------------------ Yazma ------------------------------ */

export async function listWriting(level: Level): Promise<WritingPrompt[]> {
  const { data, error } = await supabase
    .from("writing_prompts")
    .select("id, level, prompt, min_words, position")
    .eq("level", level)
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
}

export async function saveWriting(input: WritingInput): Promise<void> {
  const payload = {
    level: input.level,
    prompt: input.prompt.trim(),
    min_words: input.min_words,
    position: input.position,
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
}

export async function saveSpeaking(input: SpeakingInput): Promise<void> {
  const payload = {
    level: input.level,
    prompt: input.prompt.trim(),
    guidance: input.guidance?.trim() || null,
    prep_seconds: input.prep_seconds,
    max_seconds: input.max_seconds,
    position: input.position,
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
