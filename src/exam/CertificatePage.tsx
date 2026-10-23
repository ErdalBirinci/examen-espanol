import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Button, Notice, Spinner } from "../components/ui";
import { BackLink, SiteFooter, SiteHeader } from "../components/SiteHeader";
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
    <div className="app-page">
      <SiteHeader width="4xl" right={<BackLink label="Inicio" />} />

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="anim-rise mb-6">
          <span className="premium-kicker">
            <span className="size-1.5 rounded-full bg-gold" />
            Verificación pública
          </span>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,3rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
            Certificado de{" "}
            <span className="font-display font-normal italic text-gradient-blue">español.</span>
          </h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-muted">
            <Spinner className="size-6" />
            <p className="text-[13px]">Verificando el certificado…</p>
          </div>
        ) : certificate ? (
          <div className="anim-rise">
            <div className="flex items-start gap-3 rounded-2xl border border-[#d6ecdf] bg-[#f2faf5]/85 px-4 py-3.5 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md">
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
      <SiteFooter note="Certificado verificable" />
    </div>
  );
}
