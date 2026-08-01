"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type VisualScoreWorkflowStatus = "draft" | "approved" | "locked";

interface WorkflowSnapshot {
  projectId: string;
  projectRevision: number;
  visualScoreStatus: VisualScoreWorkflowStatus;
}

interface WorkflowContextValue extends WorkflowSnapshot {
  updateSnapshot: (
    update: Pick<WorkflowSnapshot, "projectRevision"> &
      Partial<Pick<WorkflowSnapshot, "visualScoreStatus">>,
  ) => void;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

interface WorkflowProviderProps {
  children: ReactNode;
  projectId: string;
  initialProjectRevision: number;
  initialVisualScoreStatus: VisualScoreWorkflowStatus;
}

export function WorkflowProvider({
  children,
  projectId,
  initialProjectRevision,
  initialVisualScoreStatus,
}: WorkflowProviderProps) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>({
    projectId,
    projectRevision: initialProjectRevision,
    visualScoreStatus: initialVisualScoreStatus,
  });

  const value = useMemo<WorkflowContextValue>(
    () => ({
      ...snapshot,
      updateSnapshot(update) {
        setSnapshot((current) =>
          update.projectRevision < current.projectRevision
            ? current
            : { ...current, ...update },
        );
      },
    }),
    [snapshot],
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowSnapshot() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("Score Room workflow components require WorkflowProvider.");
  }
  return context;
}
