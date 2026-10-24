import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Send, Trash2 } from "lucide-react";
import {
  bulkAssignExam,
  deleteAssignment,
  listAllAssignments,
  setAssignmentResultsVisible,
  setAssignmentsResultsVisible,
  type AdminAssignment,
} from "../lib/api";
import { LEVELS, type Level } from "../lib/types";
import { errorMessage } from "../lib/utils";
import { Badge, Button, EmptyState, Field, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelBadge, PageHeader, Panel } from "./shared";

export default function Assignments() {
  const [rows, setRows] = useState<AdminAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminAssignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    level: "A1" as Level,
    title: "",
    note: "",
    resultsVisible: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAllAssignments());
      setSelected([]);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setError(null);
    setNotice(null);

    const emails = Array.from(
      new Set(
        form.email
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const invalid = emails.filter(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email),
    );
    if (emails.length === 0) {
      setError("En az bir aday e-postası gir.");
      return;
    }
    if (invalid.length > 0) {
      setError(`Geçersiz e-posta: ${invalid.join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const count = await bulkAssignExam({
        emails,
        level: form.level,
        title: form.title,
        note: form.note,
        resultsVisible: form.resultsVisible,
      });
      setForm({
        email: "",
        level: form.level,
        title: "",
        note: "",
        resultsVisible: form.resultsVisible,
      });
      await load();
      setNotice(`${count} adaya sınav atandı.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)));
  }

  async function publishSelected(visible: boolean) {
    if (selected.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setAssignmentsResultsVisible(selected, visible);
      setRows((prev) =>
        prev.map((row) =>
          selected.includes(row.id) ? { ...row, results_visible: visible } : row,
        ),
      );
      setNotice(
        `${selected.length} atamada sonuçlar ${visible ? "yayınlandı" : "gizlendi"}.`,
      );
      setSelected([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleResults(row: AdminAssignment) {
    const next = !row.results_visible;
    setVisibilityBusy(row.id);
    setError(null);
    try {
      await setAssignmentResultsVisible(row.id, next);
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, results_visible: next } : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVisibilityBusy(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAssignment(toDelete.id);
      setRows((prev) => prev.filter((row) => row.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Aday Sınavları"
        description="Bir aday e-postasına seviye sınavı ata. Aday yalnızca kendisine atanan sınavları görür."
        action={
          <span className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12px] text-muted">
            {rows.length} atama
          </span>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}

      <Panel className="mb-5 p-4 sm:p-5">
        <h2 className="text-[13.5px] font-semibold">Yeni sınav ata</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Aday e-postaları"
            hint="Birden çok aday için satır veya virgülle ayır."
          >
            <textarea
              className="field min-h-[76px] resize-y"
              placeholder={"lucia@correo.com\nmarcos@correo.com"}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label="Seviye">
            <select
              className="field"
              value={form.level}
              onChange={(event) => setForm({ ...form, level: event.target.value as Level })}
            >
              {LEVELS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Başlık (opsiyonel)">
            <input
              className="field"
              placeholder="A1 seviye tespit sınavı"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr]">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[12.5px] font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[#1d1d1f]"
              checked={form.resultsVisible}
              onChange={(event) => setForm({ ...form, resultsVisible: event.target.checked })}
            />
            Sonuçları adaya göster
            <span className="text-[11px] font-normal text-faint">
              Kapalıysa puanlar sonuç sayfasında gizlenir.
            </span>
          </label>
        </div>
        <div className="mt-3">
          <Field label="Adaya not (opsiyonel)" hint="Aday panelinde görünür.">
            <input
              className="field"
              placeholder="Sınavı 30 dakika içinde tamamlamanız bekleniyor."
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={() => void submit()}
          loading={saving}
          icon={<Plus className="size-4" />}
        >
          Sınav ata
        </Button>
        <p className="mt-2 text-[11px] text-faint">
          Aynı ayarlarla birden çok adaya tek seferde atanır; yinelenen adresler birleştirilir.
        </p>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Henüz atama yok"
          description="Bir aday e-postası girerek ilk sınavı ata."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                className="size-3.5"
                checked={rows.length > 0 && selected.length === rows.length}
                onChange={toggleAll}
              />
              Tümünü seç
            </label>
            <span className="text-[11.5px] text-faint">{selected.length} seçili</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={selected.length === 0}
                loading={bulkBusy}
                onClick={() => void publishSelected(true)}
                icon={<Send className="size-3.5" />}
              >
                Sonuçları yayınla
              </Button>
              <Button
                variant="secondary"
                disabled={selected.length === 0}
                loading={bulkBusy}
                onClick={() => void publishSelected(false)}
                icon={<EyeOff className="size-3.5" />}
              >
                Gizle
              </Button>
            </div>
          </div>
          <div className="hidden grid-cols-[auto_1.5fr_0.5fr_1fr_0.8fr_auto] gap-3 border-b border-line bg-[#fcfcfe] px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase md:grid">
            <span />
            <span>E-posta</span>
            <span>Seviye</span>
            <span>Başlık</span>
            <span>Durum</span>
            <span />
          </div>
          <ul className="divide-y divide-[#f1f1f4]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[auto_1.5fr_0.5fr_1fr_0.8fr_auto] md:items-center"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={selected.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    aria-label={`${row.email} atamasını seç`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{row.email}</p>
                  <p className="text-[11px] text-faint">
                    {new Date(row.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div>
                  <LevelBadge level={row.level} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-muted">
                    {row.title || `Examen ${row.level}`}
                  </p>
                  <p className="text-[11px] text-faint">
                    {row.results_visible ? "Sonuçlar görünür" : "Sonuçlar gizli"}
                  </p>
                </div>
                <div>
                  <Badge tone={row.attempts?.length ? "success" : "warning"}>
                    {row.attempts?.length
                      ? row.attempts[0].status === "graded"
                        ? "Değerlendirildi"
                        : "Gönderildi"
                      : "Bekliyor"}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleResults(row)}
                    disabled={visibilityBusy === row.id}
                    className="rounded-lg p-1.5 text-faint transition hover:bg-[#eef4fd] hover:text-accent-ink disabled:opacity-40"
                    aria-label={
                      row.results_visible ? "Sonuçları adaya gizle" : "Sonuçları adaya göster"
                    }
                    title={
                      row.results_visible ? "Sonuçları adaya gizle" : "Sonuçları adaya göster"
                    }
                  >
                    {row.results_visible ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <EyeOff className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(row)}
                    className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-3 text-[11.5px] text-faint">
        Sınavlarda son tarih veya süre sınırı yoktur; aday sınavı istediği zaman tamamlayabilir.
        Göz simgesiyle sonuçların adaya görünürlüğünü sonradan açıp kapatabilirsin.
      </p>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Atamayı sil"
        description={toDelete ? `${toDelete.email} · ${toDelete.level}` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
