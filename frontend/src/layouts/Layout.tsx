import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased">
      <Header />
      <Sidebar />
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 lg:px-5 py-2">
        <main className="min-w-0 pb-1.5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
