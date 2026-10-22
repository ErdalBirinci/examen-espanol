import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import {
  deleteAssignment,
  listAllAssignments,
  saveAssignment,
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
  const [form, setForm] = useState({
    email: "",
    level: "A1" as Level,
    title: "",
    note: "",
    dueAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAllAssignments());
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      setError("Aday e-postası geçerli değil.");
      return;
    }
    setSaving(true);
    try {
      await saveAssignment({
        email: form.email,
        level: form.level,
        title: form.title,
        note: form.note,
        dueAt: form.dueAt || null,
      });
      setForm({ email: "", level: form.level, title: "", note: "", dueAt: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
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

      <Panel className="mb-5 p-4 sm:p-5">
        <h2 className="text-[13.5px] font-semibold">Yeni sınav ata</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Aday e-postası">
            <input
              type="email"
              className="field"
              placeholder="lucia@correo.com"
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
          <Field label="Son tarih (opsiyonel)">
            <input
              type="datetime-local"
              className="field"
              value={form.dueAt}
              onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
            />
          </Field>
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
          <div className="hidden grid-cols-[1.5fr_0.5fr_1fr_0.8fr_0.8fr_auto] gap-3 border-b border-line bg-[#fcfcfe] px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase md:grid">
            <span>E-posta</span>
            <span>Seviye</span>
            <span>Başlık</span>
            <span>Son tarih</span>
            <span>Durum</span>
            <span />
          </div>
          <ul className="divide-y divide-[#f1f1f4]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1.5fr_0.5fr_1fr_0.8fr_0.8fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{row.email}</p>
                  <p className="text-[11px] text-faint">
                    {new Date(row.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div>
                  <LevelBadge level={row.level} />
                </div>
                <p className="truncate text-[12.5px] text-muted">
                  {row.title || `Examen ${row.level}`}
                </p>
                <p className="text-[11.5px] text-muted">
                  {row.due_at ? new Date(row.due_at).toLocaleString("tr-TR") : "—"}
                </p>
                <div>
                  <Badge tone={row.attempts?.length ? "success" : "warning"}>
                    {row.attempts?.length
                      ? row.attempts[0].status === "graded"
                        ? "Değerlendirildi"
                        : "Gönderildi"
                      : "Bekliyor"}
                  </Badge>
                </div>
                <div className="flex justify-end">
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

      {rows.some((row) => row.due_at) && (
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-faint">
          <CalendarClock className="size-3.5" />
          Son tarihi geçen atamalar aday tarafından gönderilemez.
        </p>
      )}

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
