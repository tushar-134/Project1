import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar, { navItems } from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const title = navItems.flatMap((s) => s.links).find((link) => link.to === pathname)?.label || "Dashboard";

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="h-dvh overflow-hidden bg-[#f1f5f9]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <button className="fixed inset-0 z-40 bg-slate-950/45" onClick={() => setNavOpen(false)} aria-label="Close navigation overlay" />}
      <div className={`flex h-dvh min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-200 ${navOpen ? "lg:ml-[220px]" : "lg:ml-0"}`}>
        <TopBar title={title} navOpen={navOpen} onMenuClick={() => setNavOpen((open) => !open)} />
        <main className="app-scroll flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
