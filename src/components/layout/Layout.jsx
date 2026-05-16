import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar, { navItems } from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = navItems.flatMap((s) => s.links).find((link) => link.to === pathname)?.label || "Dashboard";

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="h-dvh overflow-hidden bg-[#f1f5f9]">
      <Sidebar />
      <Sidebar mobile open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && <button className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}
      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden lg:ml-[220px]">
        <TopBar title={title} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="app-scroll flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
