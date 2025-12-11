import { TrendingUp, Users, Target, Menu, LineChart, BarChart3, MessageSquare, Lightbulb, FileSpreadsheet } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Product Research", url: "/research", icon: LineChart },
  { title: "Comparison", url: "/comparison", icon: BarChart3 },
  { title: "AI Insights Center", url: "/ai-insights", icon: Lightbulb },
  { title: "AI Assistant", url: "/ai-assistant", icon: MessageSquare },
  { title: "Cross-Market Correlation", url: "/cross-market", icon: TrendingUp },
  { title: "Consumer Persona Predictor", url: "/consumer-persona", icon: Users },
  { title: "Scenario Simulator", url: "/scenario-simulator", icon: Target },
  { title: "Dataset Studio", url: "/dataset-studio", icon: FileSpreadsheet },
];

export function Sidebar() {
  const { open } = useSidebar();

  return (
    <SidebarUI className={open ? "w-60" : "w-14"} collapsible="icon">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {open && (
          <h2 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
            Menu
          </h2>
        )}
        <SidebarTrigger className="ml-auto">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
      </div>

      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className={!open ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarUI>
  );
}