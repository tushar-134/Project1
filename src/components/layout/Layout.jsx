import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar, { navItems } from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const title = navItems.flatMap((s) => s.links).find((link) => link.to === pathname)?.label || "Dashboard";

  return (
    <div className="h-dvh overflow-hidden bg-[#f1f5f9]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setNavOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}
      <div className={`flex h-dvh min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${navOpen ? "lg:ml-[240px]" : "lg:ml-0"}`}>
        <TopBar title={title} navOpen={navOpen} onMenuClick={() => setNavOpen((open) => !open)} />
        <main className="app-scroll flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
