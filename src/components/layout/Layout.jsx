import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar, { navItems } from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(true);
  const title = navItems.flatMap((s) => s.links).find((link) => link.to === pathname)?.label || "Dashboard";

  return (
    <div className="h-dvh overflow-hidden bg-[#f1f5f9]">
      <Sidebar 
        mobileOpen={mobileOpen} 
        onMobileClose={() => setMobileOpen(false)} 
        collapsed={desktopCollapsed}
        onToggleCollapse={() => setDesktopCollapsed(c => !c)}
      />
      <div className={`flex h-dvh min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${desktopCollapsed ? "lg:ml-[88px]" : "lg:ml-[240px]"}`}>
        <TopBar title={title} navOpen={mobileOpen} onMenuClick={() => setMobileOpen((open) => !open)} />
        <main className="app-scroll flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
