import {
  MAX_AUDIO_BYTES,
  MEDIA_BUCKET,
  RECORDINGS_BUCKET,
  publicMediaUrl,
  supabase,
} from "./supabase";
import type {
  Attempt,
  Candidate,
  ExamBundle,
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
  const [questionsRes, listeningRes, writingRes, speakingRes] = await Promise.all([
    supabase
      .from("questions_public")
      .select("id, level, prompt, options, position")
      .eq("level", level)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
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
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      full_name: `${input.candidate.firstName} ${input.candidate.lastName}`.trim(),
      email: input.candidate.email.trim().toLowerCase(),
      level: input.level,
      status: "submitted",
      mc_answers: input.mcAnswers,
      listening_answers: input.listeningAnswers,
      writing_text: input.writingText,
      speaking_path: input.speakingPath,
      speaking_duration: input.speakingDuration,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) fail(`Sınav gönderilemedi: ${error.message}`);
  return (data as { id: string }).id;
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
}

export async function saveListening(input: ListeningInput): Promise<void> {
  const payload = {
    level: input.level,
    title: input.title.trim(),
    audio_path: input.audio_path,
    max_plays: input.max_plays,
    position: input.position,
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
