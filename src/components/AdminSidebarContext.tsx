"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AdminSidebarContextType {
  collapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const AdminSidebarContext = createContext<AdminSidebarContextType>({
  collapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
});

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("klickpro_admin_sidebar_collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("klickpro_admin_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <AdminSidebarContext.Provider value={{ collapsed, toggleSidebar, setCollapsed }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  return useContext(AdminSidebarContext);
}

