import type { AttemptResult, CertificateRecord } from "./types";

/** A certificate is issued only for a fully graded exam with this score or more. */
export const CERTIFICATE_MIN_SCORE = 60;

export function isCertificateEligible(result: AttemptResult): boolean {
  return (
    result.results_visible !== false &&
    result.status === "graded" &&
    result.total_score !== null &&
    result.total_score >= CERTIFICATE_MIN_SCORE
  );
}

export function certificateGrade(score: number): string {
  if (score >= 90) return "Sobresaliente";
  if (score >= 80) return "Notable";
  if (score >= 70) return "Bien";
  return "Apto";
}

export function formatCertificateDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function appBasePath(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function certificateVerificationUrl(code: string): string {
  return `${window.location.origin}${appBasePath()}certificado/${code}`;
}

export function certificateShareText(certificate: CertificateRecord): string {
  return `He obtenido el certificado de nivel ${certificate.level} del Examen de Español con ${certificate.total_score}/100 (${certificateGrade(
    certificate.total_score,
  )}). 🎓`;
}

export function certificateFileName(certificate: CertificateRecord): string {
  const slug = certificate.full_name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `certificado-${certificate.level.toLowerCase()}-${slug || "examen-espanol"}`;
}
