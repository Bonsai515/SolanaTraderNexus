import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark text-foreground">
      {/* Mobile sidebar */}
      <div className={`md:hidden fixed inset-0 z-40 ${isSidebarOpen ? "block" : "hidden"}`}>
        <div className="absolute inset-0 bg-black opacity-50" onClick={toggleSidebar}></div>
        <div className="absolute inset-y-0 left-0 w-64">
          <Sidebar />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
