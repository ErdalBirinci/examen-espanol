import { useEffect, useState } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fetchMyProfile, signOutAdmin, type AdminProfile } from "../lib/api";
import AdminLayout from "./AdminLayout";
import { Button, Spinner } from "../components/ui";

export default function AdminGate() {
  const [state, setState] = useState<"loading" | "anonymous" | "forbidden" | "ready">("loading");
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setState("anonymous");
        return;
      }
      const admin = await fetchMyProfile();
      if (!active) return;
      if (!admin || admin.role !== "admin") {
        await signOutAdmin();
        if (active) setState("forbidden");
        return;
      }
      setProfile(admin);
      setState("ready");
    }

    void check();
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
        <Spinner className="size-6" />
        <p className="text-[13px]">Yetki kontrol ediliyor…</p>
      </div>
    );
  }

  if (state === "anonymous") return <Navigate to="/adminpanel" replace />;

  if (state === "forbidden") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#fdf0f0] text-danger">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-[20px] font-semibold">Bu hesap yönetici değil</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Oturum kapatıldı. Yönetici hesabıyla giriş yapman gerekiyor.
          </p>
          <Link to="/adminpanel" className="mt-5 inline-block">
            <Button variant="secondary">Giriş ekranına dön</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout profile={profile}>
      <Outlet />
    </AdminLayout>
  );
}
