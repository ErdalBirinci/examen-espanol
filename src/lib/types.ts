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

export interface WritingPrompt {
  id: string;
  level: Level;
  prompt: string;
  min_words: number;
  position: number;
}

export interface SpeakingPrompt {
  id: string;
  level: Level;
  prompt: string;
  guidance: string | null;
  prep_seconds: number;
  max_seconds: number;
  position: number;
}

export type AttemptStatus = "submitted" | "graded";

export interface Attempt {
  id: string;
  full_name: string;
  email: string;
  level: Level;
  status: AttemptStatus;
  mc_answers: Record<string, number>;
  mc_correct: number | null;
  mc_total: number | null;
  listening_answers: Record<string, string>;
  writing_text: string | null;
  speaking_path: string | null;
  speaking_duration: number | null;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
  admin_note: string | null;
  created_at: string;
  submitted_at: string;
}

export interface ExamSettings {
  level: Level;
  duration_minutes: number;
}

export interface ExamBundle {
  questions: QuestionPublic[];
  listening: ListeningItem[];
  writing: WritingPrompt | null;
  speaking: SpeakingPrompt | null;
  settings: ExamSettings;
}

export interface ContentStats {
  level: Level;
  questions: number;
  listening: number;
  writing: number;
  speaking: number;
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
  mc_correct: number | null;
  mc_total: number | null;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
  total_score: number | null;
}
