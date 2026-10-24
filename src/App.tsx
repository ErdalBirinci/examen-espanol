import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Welcome from "./exam/Welcome";
import { isSupabaseConfigured } from "./lib/config";

// Aday akışı ve yönetim paneli ilk yüklemede indirilmez; ziyaret edilen
// ekranın kodu ayrı bir parça olarak gelir.
const ExamPage = lazy(() => import("./exam/ExamPage"));
const ResultPage = lazy(() => import("./exam/ResultPage"));
const CandidatePortal = lazy(() => import("./exam/CandidatePortal"));
const CertificatePage = lazy(() => import("./exam/CertificatePage"));
const Practice = lazy(() => import("./exam/Practice"));
const RequestPasswordReset = lazy(() =>
  import("./exam/PasswordRecovery").then((module) => ({ default: module.RequestPasswordReset })),
);
const ResetPassword = lazy(() =>
  import("./exam/PasswordRecovery").then((module) => ({ default: module.ResetPassword })),
);

const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const AdminGate = lazy(() => import("./admin/AdminGate"));
const Overview = lazy(() => import("./admin/Overview"));
const Users = lazy(() => import("./admin/Users"));
const Attempts = lazy(() => import("./admin/Attempts"));
const Questions = lazy(() => import("./admin/Questions"));
const Listening = lazy(() => import("./admin/Listening"));
const Writing = lazy(() => import("./admin/Writing"));
const Speaking = lazy(() => import("./admin/Speaking"));
const Assignments = lazy(() => import("./admin/Assignments"));
const AnswerKey = lazy(() => import("./admin/AnswerKey"));
const Analysis = lazy(() => import("./admin/Analysis"));
const Scene3D = lazy(() => import("./components/Scene3D"));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent-ink" />
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // A recovery link may fall back to the Site URL instead of the configured
  // redirect. Move those hash tokens to the reset screen before they are lost.
  useEffect(() => {
    if (location.pathname === "/cuenta/restablecer") return;
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (hash.get("type") === "recovery" || hash.get("error_description")) {
      navigate(
        { pathname: "/cuenta/restablecer", hash: location.hash },
        { replace: true },
      );
    }
  }, [location.pathname, location.hash, navigate]);

  return (
    <>
      <Suspense fallback={null}>
        <Scene3D />
      </Suspense>
      <div className="relative z-10">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/cuenta" element={<CandidatePortal />} />
            <Route path="/cuenta/recuperar" element={<RequestPasswordReset />} />
            <Route path="/cuenta/restablecer" element={<ResetPassword />} />
            <Route path="/examen/:assignmentId" element={<ExamPage />} />
            <Route path="/deneme" element={<Practice />} />
            <Route path="/resultado" element={<ResultPage />} />
            <Route path="/certificado/:code" element={<CertificatePage />} />

            <Route path="/adminpanel">
              <Route index element={<AdminLogin />} />
              <Route element={<AdminGate />}>
                <Route path="panel" element={<Overview />} />
                <Route path="kullanicilar" element={<Users />} />
                <Route path="sonuclar" element={<Attempts />} />
                <Route path="analiz" element={<Analysis />} />
                <Route path="test" element={<Questions />} />
                <Route path="cevap-anahtari" element={<AnswerKey />} />
                <Route path="dinleme" element={<Listening />} />
                <Route path="yazma" element={<Writing />} />
                <Route path="konusma" element={<Speaking />} />
                <Route path="atamalar" element={<Assignments />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

      {!isSupabaseConfigured && (
        <div className="fixed bottom-4 left-4 z-50 max-w-xs rounded-xl border border-[#f3e2c8] bg-[#fdf8ef] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-warning shadow-lg">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" />
            Supabase bağlantısı yok
          </div>
          <p className="mt-1">
            Veritabanı anahtarları eklenmeden sınav çalışmaz. Kurulum için README dosyasına bak.
          </p>
        </div>
      )}
    </>
  );
}
