import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Welcome from "./exam/Welcome";
import ExamPage from "./exam/ExamPage";
import ResultPage from "./exam/ResultPage";
import CandidatePortal from "./exam/CandidatePortal";
import CertificatePage from "./exam/CertificatePage";
import { RequestPasswordReset, ResetPassword } from "./exam/PasswordRecovery";
import AdminLogin from "./admin/AdminLogin";
import AdminGate from "./admin/AdminGate";
import Overview from "./admin/Overview";
import Users from "./admin/Users";
import Attempts from "./admin/Attempts";
import Questions from "./admin/Questions";
import Listening from "./admin/Listening";
import Writing from "./admin/Writing";
import Speaking from "./admin/Speaking";
import Assignments from "./admin/Assignments";
import AnswerKey from "./admin/AnswerKey";
import Scene3D from "./components/Scene3D";
import { isSupabaseConfigured } from "./lib/config";

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
      <Scene3D />
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/cuenta" element={<CandidatePortal />} />
          <Route path="/cuenta/recuperar" element={<RequestPasswordReset />} />
          <Route path="/cuenta/restablecer" element={<ResetPassword />} />
          <Route path="/examen/:assignmentId" element={<ExamPage />} />
          <Route path="/resultado" element={<ResultPage />} />
          <Route path="/certificado/:code" element={<CertificatePage />} />

          <Route path="/adminpanel">
            <Route index element={<AdminLogin />} />
            <Route element={<AdminGate />}>
              <Route path="panel" element={<Overview />} />
              <Route path="kullanicilar" element={<Users />} />
              <Route path="sonuclar" element={<Attempts />} />
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
