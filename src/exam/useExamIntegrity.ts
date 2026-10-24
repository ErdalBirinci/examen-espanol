import { useCallback, useEffect, useRef, useState } from "react";
import type { AttemptIntegrity } from "../lib/types";

/**
 * Sınav sırasında bütünlük sinyallerini sayar: sekme değişimleri ve
 * yazma alanlarına yapıştırma/kopyalama denemeleri. Cevapları engellemez,
 * yalnızca gönderimle birlikte kaydedilir.
 */
export function useExamIntegrity(active: boolean) {
  const counts = useRef<Required<AttemptIntegrity>>({
    focus_losses: 0,
    paste_attempts: 0,
    copy_attempts: 0,
    fullscreen_exits: 0,
    duration_seconds: 0,
  });
  const [focusLosses, setFocusLosses] = useState(0);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();

    function onVisibilityChange() {
      if (!document.hidden) return;
      counts.current.focus_losses += 1;
      setFocusLosses(counts.current.focus_losses);
    }

    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName !== "TEXTAREA" && target?.tagName !== "INPUT") return;
      // Hazır metin yapıştırmayı engelle; sayıyı yine de kaydet.
      event.preventDefault();
      counts.current.paste_attempts += 1;
    }

    function onCopy(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") {
        counts.current.copy_attempts += 1;
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("copy", onCopy, true);

    return () => {
      counts.current.duration_seconds = Math.round((Date.now() - startedAt) / 1000);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("copy", onCopy, true);
    };
  }, [active]);

  const snapshot = useCallback((): AttemptIntegrity => ({ ...counts.current }), []);

  return { focusLosses, snapshot };
}
