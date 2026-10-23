import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  EyeOff,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button, Notice } from "../components/ui";
import { Brand } from "../components/Brand";
import { fetchMyProfile, signInAdmin } from "../lib/api";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/utils";

const HIGHLIGHTS = [
  {
    icon: CalendarClock,
    title: "Sınav atamaları",
    text: "Adaylara seviye, süre ve notla birlikte sınav tanımlayın.",
  },
  {
    icon: FileText,
    title: "İçerik yönetimi",
    text: "Soruları, dinleme kayıtlarını ve konuları tek yerden düzenleyin.",
  },
  {
    icon: ShieldCheck,
    title: "Değerlendirme akışı",
    text: "Sonuçları yayınlayın, sertifikaları güvenle üretin.",
  },
];

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const profile = await fetchMyProfile();
      if (active && profile?.role === "admin") navigate("/adminpanel/panel", { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInAdmin(username, password);
      const profile = await fetchMyProfile();
      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        setError("Bu hesabın yönetici yetkisi yok. profiles tablosundaki kaydı kontrol et.");
        return;
      }
      navigate("/adminpanel/panel", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-page min-h-dvh px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="focus-ring rounded-full p-1">
          <Brand compact />
        </Link>
        <Link
          to="/"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/55 px-3 py-2 text-[11.5px] font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md transition hover:bg-white/80 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Aday girişi
        </Link>
      </div>

      <main className="mx-auto grid max-w-6xl items-center gap-10 py-10 sm:py-14 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[1fr_0.82fr] lg:gap-16 lg:py-6">
        <section className="anim-rise hidden lg:block">
          <span className="premium-kicker">
            <ShieldCheck className="size-3 text-gold" />
            Yönetim paneli · 2026
          </span>
          <h1 className="mt-6 max-w-xl text-[clamp(2.8rem,4.6vw,4rem)] leading-[0.98] font-semibold tracking-[-0.05em]">
            Her sınavın{" "}
            <span className="font-display block font-normal italic text-gradient-blue">
              kontrolü sizde.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-muted">
            Adayları, sınav içeriklerini ve değerlendirmeyi tek bir sade panelden yönetin. Her işlem
            kayıt altında, her sonuç tek bir yerde.
          </p>

          <div className="mt-9 space-y-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }, index) => (
              <div
                key={title}
                className="flex items-center gap-3.5 rounded-2xl border border-white/80 bg-white/50 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_38px_-34px_rgba(24,41,74,0.5)] backdrop-blur-xl"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/90 bg-white/75 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 flex items-center gap-2 text-[11px] text-faint">
            <Sparkles className="size-3.5 text-gold" />
            Adaylar bu adrese erişemez.
          </p>
        </section>

        <section className="anim-rise mx-auto w-full max-w-[420px]" style={{ animationDelay: "90ms" }}>
          <div className="premium-panel rounded-[1.9rem] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">
                  Yetkili erişimi
                </p>
                <h2 className="mt-2 text-[25px] leading-tight font-semibold tracking-[-0.035em]">
                  Yönetici girişi
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  Devam etmek için yönetici bilgilerinle giriş yap.
                </p>
              </div>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/85 bg-white/70 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_26px_-20px_rgba(47,107,255,0.7)]">
                <ShieldCheck className="size-5" strokeWidth={1.8} />
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="admin-user" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Kullanıcı adı
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                  <input
                    id="admin-user"
                    className="field pl-10"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="kullanıcı adın"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-pass" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                  <input
                    id="admin-pass"
                    type={showPassword ? "text" : "password"}
                    className="field pr-10 pl-10"
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Şifreyi sakla" : "Şifreyi göster"}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-faint transition hover:bg-white/70 hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && <Notice tone="danger">{error}</Notice>}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={!username.trim() || !password}
              >
                Giriş yap
              </Button>

              <p className="text-center text-[10.5px] leading-relaxed text-faint">
                Bu alan yalnızca yetkili yöneticiler içindir. Tüm girişler kayıt altına alınabilir.
              </p>
            </form>
          </div>

          <p className="mt-5 text-center text-[10.5px] text-faint">
            © 2026 Examen de Español · Yönetim erişimi
          </p>
        </section>
      </main>
    </div>
  );
}
