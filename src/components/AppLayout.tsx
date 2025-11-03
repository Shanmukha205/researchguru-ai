import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { UserProfileDropdown } from "./UserProfileDropdown";

export const AppLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-6 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Market Research
            </h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserProfileDropdown />
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};
