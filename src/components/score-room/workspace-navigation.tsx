"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Aperture,
  AudioLines,
  Clapperboard,
  Headphones,
  PanelsTopLeft,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceView =
  | "listen"
  | "direction"
  | "visual-world"
  | "score"
  | "shots"
  | "review";

interface WorkspaceNavigationItem {
  id: WorkspaceView;
  icon: LucideIcon;
  index: string;
  label: string;
  description: string;
  status: string;
}

interface WorkspaceNavigationContextValue {
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;
}

const WorkspaceNavigationContext =
  createContext<WorkspaceNavigationContextValue | null>(null);

export const workspaceNavigationItems: WorkspaceNavigationItem[] = [
  {
    id: "listen",
    icon: Headphones,
    index: "01",
    label: "Listen",
    description: "Measurement + reading",
    status: "ready",
  },
  {
    id: "direction",
    icon: Clapperboard,
    index: "02",
    label: "Direction",
    description: "Treatments + Film Bible",
    status: "locked",
  },
  {
    id: "visual-world",
    icon: Aperture,
    index: "03",
    label: "Visual world",
    description: "Anchor states",
    status: "3 states",
  },
  {
    id: "score",
    icon: AudioLines,
    index: "04",
    label: "Visual Score",
    description: "Relationships + timing",
    status: "active",
  },
  {
    id: "shots",
    icon: PanelsTopLeft,
    index: "05",
    label: "Shots",
    description: "Executable direction",
    status: "6 locked",
  },
  {
    id: "review",
    icon: ScanSearch,
    index: "06",
    label: "Review",
    description: "Evidence + repair",
    status: "decision",
  },
];

interface WorkspaceNavigationProviderProps {
  children: ReactNode;
  initialView?: WorkspaceView;
}

export function WorkspaceNavigationProvider({
  children,
  initialView = "score",
}: WorkspaceNavigationProviderProps) {
  const [activeView, setActiveViewState] = useState<WorkspaceView>(initialView);
  const setActiveView = useCallback((view: WorkspaceView) => {
    setActiveViewState(view);

    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);

    window.requestAnimationFrame(() => {
      const workspace = document.getElementById("score-room-content");
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      workspace?.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
      workspace?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <WorkspaceNavigationContext.Provider
      value={{ activeView, setActiveView }}
    >
      {children}
    </WorkspaceNavigationContext.Provider>
  );
}

function useWorkspaceNavigation() {
  const context = useContext(WorkspaceNavigationContext);
  if (!context) {
    throw new Error(
      "Workspace navigation components require WorkspaceNavigationProvider.",
    );
  }
  return context;
}

export function WorkspaceNavigation() {
  const { activeView, setActiveView } = useWorkspaceNavigation();
  const { visualScoreStatus } = useWorkflowSnapshot();

  return (
    <nav
      className="grid gap-1 p-3 max-[900px]:flex max-[900px]:gap-1.5 max-[900px]:overflow-x-auto max-[900px]:overscroll-x-contain max-[900px]:border-b max-[900px]:border-border max-[900px]:p-2.5"
      aria-label="Creative workflow"
    >
      {workspaceNavigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        const status = item.id === "score" ? visualScoreStatus : item.status;

        return (
          <Button
            variant="ghost"
            type="button"
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group h-auto min-h-16 w-full justify-start rounded-xl px-3 py-2.5 text-left text-muted-foreground hover:bg-accent/70 hover:text-foreground max-[900px]:min-h-[66px] max-[900px]:w-[168px] max-[900px]:flex-none",
              isActive &&
                "bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:bg-accent",
            )}
            key={item.id}
            onClick={() => setActiveView(item.id)}
          >
            <span
              className={cn(
                "grid size-9 flex-none place-items-center rounded-lg border border-border bg-background/50 text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
                isActive && "border-primary/30 bg-primary/12 text-primary",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <strong className="font-display text-[15px] font-normal text-inherit">
                  {item.label}
                </strong>
                <small className="font-mono text-[8px] text-muted-foreground/60 tabular-nums">
                  {item.index}
                </small>
              </span>
              <small className="mt-0.5 block truncate font-mono text-[8px] tracking-[0.04em] text-muted-foreground uppercase max-[680px]:hidden">
                {item.description}
              </small>
            </span>
            <Badge
              variant={isActive ? "default" : "outline"}
              className="max-w-20 truncate px-2 py-1 text-[8px] uppercase max-[1100px]:hidden"
            >
              {status}
            </Badge>
          </Button>
        );
      })}
    </nav>
  );
}

interface WorkspacePanelProps {
  children: ReactNode;
  view: WorkspaceView;
}

export function WorkspacePanel({ children, view }: WorkspacePanelProps) {
  const { activeView } = useWorkspaceNavigation();

  return (
    <div data-active={activeView === view} hidden={activeView !== view}>
      {children}
    </div>
  );
}
