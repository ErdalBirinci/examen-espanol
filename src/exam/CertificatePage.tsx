import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ShieldAlert } from "lucide-react";
import { Button, Notice, Spinner } from "../components/ui";
import { CertificatePanel } from "./Certificate";
import { getCertificate } from "../lib/api";
import type { CertificateRecord } from "../lib/types";
import { errorMessage } from "../lib/utils";

export default function CertificatePage() {
  const { code } = useParams();
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) {
        setLoading(false);
        return;
      }
      try {
        const found = await getCertificate(code);
        if (active) setCertificate(found);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_50%_-15%,#e9f2ff_0%,#f7f9fd_38%,#fbfbfd_70%)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(29,29,31,0.06)] glass-bar">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Examen</span>
            <span className="font-display text-[19px] italic text-accent-ink">de Español</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-muted">
            <Spinner className="size-6" />
            <p className="text-[13px]">Verificando el certificado…</p>
          </div>
        ) : certificate ? (
          <div className="anim-rise">
            <div className="flex items-start gap-3 rounded-2xl border border-[#d6ecdf] bg-[#f2faf5] px-4 py-3.5 text-success">
              <BadgeCheck className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold">Certificado válido</p>
                <p className="mt-0.5 text-[12px] leading-relaxed">
                  Emitido por Examen de Español y verificado con el código{" "}
                  <span className="font-mono font-semibold">
                    {certificate.code.toUpperCase()}
                  </span>
                  .
                </p>
              </div>
            </div>

            <CertificatePanel certificate={certificate} publicView />
          </div>
        ) : (
          <div className="anim-rise card mx-auto max-w-xl p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fdf4f4] text-danger">
              <ShieldAlert className="size-7" strokeWidth={1.8} />
            </div>
            <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em]">
              Certificado no encontrado
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              El enlace no corresponde a un certificado válido, o el resultado todavía no está
              publicado. Revisa el código que aparece en el documento.
            </p>
            {error && (
              <div className="mt-4 text-left">
                <Notice tone="danger">{error}</Notice>
              </div>
            )}
            <Link to="/resultado" className="mt-5 inline-block">
              <Button variant="secondary">Consultar un resultado</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
