import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { navItems } from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const title = navItems.flatMap((s) => s.links).find((link) => link.to === pathname)?.label || "Dashboard";
  return (
    // The content column is offset to match the fixed 220px sidebar width.
    <div className="h-screen overflow-hidden bg-[#f1f5f9]">
      <Sidebar />
      <div className="ml-[220px] flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="app-scroll flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
