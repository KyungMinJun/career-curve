import {
  LayoutGrid,
  Briefcase,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "board" | "career" | "settings";

interface TabItem {
  id: TabId;
  label: string;
  icon: typeof LayoutGrid;
}

export const tabs: TabItem[] = [
  { id: "board", label: "커리어 보드", icon: LayoutGrid },
  { id: "career", label: "경력", icon: Briefcase },
  { id: "settings", label: "설정", icon: Settings },
];

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive && "font-semibold"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
