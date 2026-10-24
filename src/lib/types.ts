export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export interface LevelInfo {
  code: Level;
  name: string;
  blurb: string;
  tint: string;
}

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  A1: {
    code: "A1",
    name: "Principiante",
    blurb: "Primeras palabras, saludos y frases cotidianas.",
    tint: "from-[#e9f3ff] to-[#fbfdff]",
  },
  A2: {
    code: "A2",
    name: "Elemental",
    blurb: "Situaciones sencillas: familia, compras, rutinas.",
    tint: "from-[#eaf6f1] to-[#fbfefc]",
  },
  B1: {
    code: "B1",
    name: "Intermedio",
    blurb: "Experiencias, planes y opiniones con soltura.",
    tint: "from-[#fdf2e6] to-[#fffdfa]",
  },
  B2: {
    code: "B2",
    name: "Intermedio alto",
    blurb: "Debates, textos complejos y matices.",
    tint: "from-[#f1edff] to-[#fdfcff]",
  },
  C1: {
    code: "C1",
    name: "Avanzado",
    blurb: "Discurso fluido, académico y profesional.",
    tint: "from-[#ffeef2] to-[#fffbfc]",
  },
  C2: {
    code: "C2",
    name: "Maestría",
    blurb: "Dominio pleno, estilo y precisión nativa.",
    tint: "from-[#eaedf2] to-[#fcfdfe]",
  },
};

export interface QuestionPublic {
  id: string;
  level: Level;
  prompt: string;
  options: string[];
  position: number;
}

export interface QuestionAdmin extends QuestionPublic {
  correct_index: number;
  explanation: string | null;
  created_at: string;
}

export interface ListeningItem {
  id: string;
  level: Level;
  title: string;
  audio_path: string;
  max_plays: number;
  position: number;
  transcript: string | null;
  created_at?: string;
}

export interface ListeningQuestion {
  id: string;
  item_id: string;
  prompt: string;
  options: string[];
  position: number;
}

export interface ListeningQuestionAdmin extends ListeningQuestion {
  correct_index: number;
  created_at: string;
}

/** The audio track and its questions for one attempt. */
export interface ListeningExam {
  item: Pick<ListeningItem, "id" | "level" | "title" | "audio_path" | "max_plays" | "position">;
  questions: ListeningQuestion[];
}

export interface WritingPrompt {
  id: string;
  level: Level;
  prompt: string;
  min_words: number;
  position: number;
  part: 1 | 2;
  /** Public storage path of the task image (email, advert…), when present. */
  image_path: string | null;
}

export interface SpeakingPrompt {
  id: string;
  level: Level;
  prompt: string;
  guidance: string | null;
  prep_seconds: number;
  max_seconds: number;
  position: number;
  /** 1: recorded and scored out of 10; 2: examiner-scored out of 10, no recording. */
  part: 1 | 2;
  image_path: string | null;
}

export type AttemptStatus = "submitted" | "graded";

/** Her ölçüt 0–5 arası; iki ölçütün toplamı bölüm puanını (0–10) verir. */
export interface WritingRubricPart {
  task: number;
  language: number;
}

export interface WritingRubric {
  part1: WritingRubricPart;
  part2: WritingRubricPart;
}

/** Her ölçüt 0–5 arası; iki ölçütün toplamı bölüm puanını (0–10) verir. */
export interface SpeakingRubricPart {
  content: number;
  language: number;
}

export interface SpeakingRubric {
  part1: SpeakingRubricPart;
  part2: SpeakingRubricPart;
}

export interface AttemptIntegrity {
  focus_losses?: number;
  paste_attempts?: number;
  copy_attempts?: number;
  fullscreen_exits?: number;
  duration_seconds?: number;
}

export interface Attempt {
  id: string;
  full_name: string;
  email: string;
  level: Level;
  status: AttemptStatus;
  scoring_version: number;
  mc_answers: Record<string, number>;
  mc_correct: number | null;
  mc_total: number | null;
  mc_score: number | null;
  test_question_ids: string[] | null;
  listening_answers: Record<string, number>;
  listening_question_ids: string[] | null;
  listening_correct: number | null;
  listening_total: number | null;
  writing_text: string | null;
  writing_text_2: string | null;
  speaking_path: string | null;
  speaking_duration: number | null;
  listening_score: number | null;
  writing_part1_score: number | null;
  writing_part2_score: number | null;
  writing_score: number | null;
  speaking_part1_score: number | null;
  speaking_part2_score: number | null;
  speaking_score: number | null;
  total_score: number | null;
  admin_note: string | null;
  certificate_code?: string | null;
  writing_rubric?: WritingRubric | null;
  speaking_rubric?: SpeakingRubric | null;
  graded_at?: string | null;
  integrity?: AttemptIntegrity | null;
  result_notified_at?: string | null;
  created_at: string;
  submitted_at: string;
}

export interface ExamSettings {
  level: Level;
  duration_minutes: number;
}

export interface ExamBundle {
  questions: QuestionPublic[];
  listening: ListeningExam | null;
  writing: WritingPrompt[];
  /** One entry per speaking part, ordered by part. */
  speaking: SpeakingPrompt[];
  settings: ExamSettings;
}

export interface ContentStats {
  level: Level;
  questions: number;
  listening: number;
  listening_questions: number;
  writing: number;
  speaking: number;
}

/** Per-question statistics used by the admin item analysis screen. */
export interface QuestionStat {
  question_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  position: number;
  appearances: number;
  correct_count: number;
  p_value: number | null;
  discrimination: number;
}

export interface Candidate {
  firstName: string;
  lastName: string;
  email: string;
}

export interface AttemptResult {
  reference: string;
  full_name: string;
  level: Level;
  status: AttemptStatus;
  submitted_at: string;
  scoring_version: number;
  mc_correct: number | null;
  mc_total: number | null;
  mc_score: number | null;
  listening_score: number | null;
  listening_correct: number | null;
  listening_total: number | null;
  writing_score: number | null;
  writing_part1_score: number | null;
  writing_part2_score: number | null;
  speaking_part1_score: number | null;
  speaking_part2_score: number | null;
  speaking_score: number | null;
  total_score: number | null;
  results_visible?: boolean;
}

export interface GradingAuditEntry {
  id: number;
  action: string;
  actor_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardSummary {
  attempts: {
    total: number;
    pending: number;
    graded: number;
    last7: number;
    avg_total: number | null;
    passed: number;
    awaiting_email: number;
  };
  levels: { level: Level; attempts: number; pending: number; avg_total: number | null }[];
  content: { questions: number; listening: number; writing: number; speaking: number };
}

export interface QuestionRevision {
  id: number;
  question_id: string;
  level: Level | null;
  prompt: string | null;
  options: string[] | null;
  correct_index: number | null;
  explanation: string | null;
  position: number | null;
  action: "created" | "updated" | "deleted" | string;
  actor_email: string | null;
  created_at: string;
}

export interface PracticeBundle {
  /** Sunucudaki deneme oturumu; skor kontrolü bu kimlikle yapılır. */
  session: string | null;
  level: Level;
  questions: QuestionPublic[];
}

/**
 * Deneme sonucu yalnızca toplam skoru içerir; soru bazlı doğru/yanlış veya
 * doğru şık dönmez. Böylece gerçek sınavın cevap anahtarı dışarı sızmaz.
 */
export interface PracticeResult {
  correct: number;
  total: number;
}

export interface CertificateRecord {
  code: string;
  full_name: string;
  level: Level;
  total_score: number;
  submitted_at: string;
  reference: string;
  issued_at: string;
}
