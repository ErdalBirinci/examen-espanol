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
import { Brand } from "../components/Brand";

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
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "focus-ring group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition",
              isActive
                ? "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_12px_26px_-18px_rgba(18,35,62,0.9),inset_0_1px_0_rgba(255,255,255,0.15)]"
                : "text-muted hover:bg-white/65 hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition",
                  isActive
                    ? "bg-white/12 text-white"
                    : "bg-white/55 text-faint shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:text-ink",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
              </span>
              {label}
              {isActive && <span className="ml-auto size-1.5 rounded-full bg-gold" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const accountCard = (
    <div className="rounded-2xl border border-white/85 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_16px_36px_-32px_rgba(24,41,74,0.5)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(145deg,#1b2f4f,#33557f)] text-[11px] font-semibold text-white shadow-[0_8px_18px_-12px_rgba(15,28,50,0.9)]">
          {initials(displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold">{displayName}</p>
          <p className="truncate text-[10.5px] text-faint">@{profile?.username ?? "admin"}</p>
        </div>
      </div>
      <button
        onClick={() => void handleSignOut()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/80 bg-white/45 py-1.5 text-[11.5px] font-medium text-muted transition hover:bg-white/80 hover:text-ink"
      >
        <LogOut className="size-3.5" />
        Çıkış yap
      </button>
    </div>
  );

  return (
    <div className="app-page min-h-dvh">
      <div className="sticky top-0 z-40 px-3 pt-3 lg:hidden">
        <div className="premium-nav flex h-14 items-center justify-between px-3">
          <Link to="/adminpanel/panel" className="focus-ring rounded-full p-1">
            <Brand compact />
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="focus-ring rounded-full p-2 text-muted transition hover:bg-white/70 hover:text-ink"
            aria-label="Menüyü aç"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="anim-fade absolute inset-0 bg-[#0d1a2e]/30 backdrop-blur-[3px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="anim-rise absolute inset-y-0 left-0 w-[292px] p-3">
            <div className="flex h-full flex-col rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(252,253,255,0.985)_0%,rgba(243,248,255,0.96)_100%)] p-3.5 shadow-[0_30px_80px_-30px_rgba(16,28,48,0.55)] backdrop-blur-2xl">
              <div className="mb-6 flex items-center justify-between">
                <Link to="/adminpanel/panel" onClick={() => setMobileOpen(false)}>
                  <Brand compact />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-muted"
                  aria-label="Menüyü kapat"
                >
                  <X className="size-4.5" />
                </button>
              </div>
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
                Yönetim
              </p>
              {navigation}
              <div className="mt-auto pt-4">{accountCard}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1480px]">
        <aside className="sticky top-0 hidden h-dvh w-[276px] shrink-0 p-3 lg:block">
          <div className="admin-surface flex h-[calc(100dvh-1.5rem)] flex-col rounded-[1.75rem] p-4">
            <Link to="/adminpanel/panel" className="mb-7 block px-2 pt-1">
              <Brand />
            </Link>

            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
              Yönetim
            </p>
            {navigation}

            <div className="mt-auto space-y-3 pt-4">
              {accountCard}
              <p className="px-2 text-[10px] leading-relaxed text-faint">
                Adaylar bu adrese erişemez. Tüm işlemler yönetici oturumu ile yapılır.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
