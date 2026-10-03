import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Lightbox } from "../components/Lightbox";
import { SyncDock } from "../components/SyncDock";

export function Layout() {
  return (
    <div className="page">
      <Header />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
      {/* 灯箱挂在布局层：五页共用一个实例，不作为独立路由 */}
      <Lightbox />
      <SyncDock />
    </div>
  );
}
