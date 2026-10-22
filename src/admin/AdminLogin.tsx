import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { Button, Notice } from "../components/ui";
import { fetchMyProfile, signInAdmin } from "../lib/api";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/utils";

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(90%_60%_at_50%_-10%,#e8f1ff_0%,#fbfbfd_58%)] px-5 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#cfe0f7] to-transparent" />

      <div className="anim-rise w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe7f8] bg-white/70 px-3 py-1 text-[10.5px] font-semibold tracking-[0.1em] text-accent-ink uppercase">
            <ShieldCheck className="size-3" />
            Yönetim Paneli
          </span>
          <h1 className="mt-4 text-[27px] font-semibold tracking-[-0.03em]">
            Examen <span className="font-display text-[1.1em] font-normal italic text-accent-ink">de Español</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">Devam etmek için yönetici bilgilerinle giriş yap.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6 sm:p-7">
          <div>
            <label htmlFor="admin-user" className="mb-1.5 block text-[12.5px] font-medium text-muted">
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
            <label htmlFor="admin-pass" className="mb-1.5 block text-[12.5px] font-medium text-muted">
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
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
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

          <p className="text-center text-[11px] leading-relaxed text-faint">
            Bu alan yalnızca yetkili yöneticiler içindir. Tüm girişler kayıt altına alınabilir.
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-faint">
          © 2026 Examen de Español · Aday girişi için ana sayfayı kullan.
        </p>
      </div>
    </div>
  );
}
