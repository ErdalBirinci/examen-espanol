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
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("RATE_LIMIT")) {
      fail("Bu e-posta ile 2 dakika içinde yalnızca bir sınav gönderilebilir. Lütfen biraz bekle.");
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
