export type SavedView = "cards" | "list";

export const viewPreferences = {
  projects: { storageKey: "home-dashboard:freelancehunt-project-view", cookieName: "home_dashboard_project_view" },
  containers: { storageKey: "home-dashboard:docker-container-view", cookieName: "home_dashboard_container_view" },
} as const;

export const parseSavedView = (value: string | undefined): SavedView => value === "list" ? "list" : "cards";
