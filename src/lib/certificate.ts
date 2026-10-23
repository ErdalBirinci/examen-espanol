import type { AttemptResult, CertificateRecord } from "./types";

/**
 * The centre issues a participation document, not a competence certificate.
 * It records that the candidate sat the exam, so it is available for every
 * graded attempt whose result has been published — no score threshold.
 */
export function isCertificateEligible(result: AttemptResult): boolean {
  return result.results_visible !== false && result.status === "graded";
}

/** Score bands used by the result report, not by the participation document. */
export function certificateGrade(score: number): string {
  if (score >= 90) return "Sobresaliente";
  if (score >= 80) return "Notable";
  if (score >= 70) return "Bien";
  if (score >= 60) return "Apto";
  return "No apto";
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
  return `He participado en el Examen de Español de nivel ${certificate.level} y ya tengo mi constancia de participación. 🎓`;
}

export function certificateFileName(certificate: CertificateRecord): string {
  const slug = certificate.full_name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `constancia-participacion-${certificate.level.toLowerCase()}-${slug || "examen-espanol"}`;
}
