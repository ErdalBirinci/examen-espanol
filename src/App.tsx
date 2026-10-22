import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Welcome from "./exam/Welcome";
import ExamPage from "./exam/ExamPage";
import ResultPage from "./exam/ResultPage";
import AdminLogin from "./admin/AdminLogin";
import AdminGate from "./admin/AdminGate";
import Overview from "./admin/Overview";
import Attempts from "./admin/Attempts";
import Questions from "./admin/Questions";
import Listening from "./admin/Listening";
import Writing from "./admin/Writing";
import Speaking from "./admin/Speaking";
import { isSupabaseConfigured } from "./lib/config";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/examen/:level" element={<ExamPage />} />
        <Route path="/resultado" element={<ResultPage />} />

        <Route path="/adminpanel">
          <Route index element={<AdminLogin />} />
          <Route element={<AdminGate />}>
            <Route path="panel" element={<Overview />} />
            <Route path="sonuclar" element={<Attempts />} />
            <Route path="test" element={<Questions />} />
            <Route path="dinleme" element={<Listening />} />
            <Route path="yazma" element={<Writing />} />
            <Route path="konusma" element={<Speaking />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
