import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Mic,
  PenLine,
  X,
} from "lucide-react";
import { signOutAdmin, type AdminProfile } from "../lib/api";
import { cn, initials } from "../lib/utils";

const NAV = [
  { to: "/adminpanel/panel", label: "Genel Bakış", icon: LayoutDashboard },
  { to: "/adminpanel/atamalar", label: "Aday Sınavları", icon: CalendarClock },
  { to: "/adminpanel/sonuclar", label: "Sınav Sonuçları", icon: ClipboardList },
  { to: "/adminpanel/test", label: "Test Soruları", icon: ListChecks },
  { to: "/adminpanel/dinleme", label: "Dinleme", icon: Headphones },
  { to: "/adminpanel/yazma", label: "Yazma", icon: PenLine },
  { to: "/adminpanel/konusma", label: "Konuşma", icon: Mic },
];

export default function AdminLayout({
  profile,
  children,
}: {
  profile: AdminProfile | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = profile?.display_name || profile?.username || "Yönetici";

  async function handleSignOut() {
    await signOutAdmin();
    navigate("/adminpanel", { replace: true });
  }

  const navigation = (
    <nav className="space-y-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
              isActive
                ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                : "text-muted hover:bg-white/60 hover:text-ink",
            )
          }
        >
          <Icon className="size-4" strokeWidth={1.9} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[#f6f6f9]">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold">Examen</span>
          <span className="font-display text-[16px] italic text-accent-ink">de Español</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="focus-ring rounded-lg p-2 text-muted"
          aria-label="Menüyü aç"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileOpen(false)} />
          <div className="anim-rise absolute inset-y-0 left-0 w-72 bg-[#f6f6f9] p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-semibold">Examen</span>
                <span className="font-display text-[16px] italic text-accent-ink">de Español</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-muted"
                aria-label="Menüyü kapat"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {navigation}
            <button
              onClick={() => void handleSignOut()}
              className="mt-6 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted"
            >
              <LogOut className="size-4" />
              Çıkış yap
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-[258px] shrink-0 flex-col border-r border-line bg-[#f6f6f9] px-4 py-5 lg:flex">
          <Link to="/adminpanel/panel" className="mb-8 flex items-baseline gap-1.5 px-2">
            <span className="text-[14px] font-semibold tracking-[-0.02em]">Examen</span>
            <span className="font-display text-[18px] italic text-accent-ink">de Español</span>
          </Link>

          <p className="mb-2 px-3 text-[10.5px] font-semibold tracking-[0.12em] text-faint uppercase">
            Yönetim
          </p>
          {navigation}

          <div className="mt-auto space-y-3">
            <div className="rounded-2xl border border-line bg-white p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">
                  {initials(displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{displayName}</p>
                  <p className="truncate text-[11px] text-faint">@{profile?.username ?? "admin"}</p>
                </div>
              </div>
              <button
                onClick={() => void handleSignOut()}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-[12px] font-medium text-muted transition hover:bg-[#fafafc] hover:text-ink"
              >
                <LogOut className="size-3.5" />
                Çıkış yap
              </button>
            </div>
            <p className="px-2 text-[10.5px] leading-relaxed text-faint">
              Adaylar bu adrese erişemez.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
