interface GroupableContainer { name: string; composeProject: string | null; state: string; health: string }

export function groupContainers<T extends GroupableContainer>(containers: T[]) {
  const groups = new Map<string | null, T[]>();
  for (const container of containers) {
    const project = container.composeProject?.trim() || null;
    const items = groups.get(project) ?? [];
    items.push(container);
    groups.set(project, items);
  }
  return [...groups].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a.localeCompare(b)).map(([project, items]) => ({
    project,
    items: items.toSorted((a, b) => a.name.localeCompare(b.name)),
    running: items.filter((item) => item.state === "running").length,
    unhealthy: items.filter((item) => item.health === "unhealthy").length,
  }));
}
