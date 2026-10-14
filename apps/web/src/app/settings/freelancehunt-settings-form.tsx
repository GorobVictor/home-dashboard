"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Settings {
  enabled: boolean;
  projectPollingEnabled: boolean;
  messagePollingEnabled: boolean;
  telegramEnabled: boolean;
  pollIntervalSeconds: number;
  skillIds: number[];
}

interface Skill { id: number; name: string; groupName: string }

export function FreelancehuntSettingsForm({ settings }: { settings: Settings }) {
  const [value, setValue] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillQuery, setSkillQuery] = useState("");
  const selectedSkills = useMemo(() => new Set(value.skillIds), [value.skillIds]);
  const visibleSkills = useMemo(() => {
    const query = skillQuery.trim().toLocaleLowerCase();
    return query ? skills.filter((skill) => skill.name.toLocaleLowerCase().includes(query)) : skills;
  }, [skillQuery, skills]);
  const groupedSkills = useMemo(() => {
    return visibleSkills.reduce<Map<string, Skill[]>>((groups, skill) => {
      const group = groups.get(skill.groupName) ?? [];
      group.push(skill);
      groups.set(skill.groupName, group);
      return groups;
    }, new Map());
  }, [visibleSkills]);
  const toggle = (key: keyof Omit<Settings, "pollIntervalSeconds" | "skillIds">) => (checked: boolean) => setValue((current) => ({ ...current, [key]: checked }));

  useEffect(() => {
    let active = true;
    fetch("/api/freelancehunt/skills", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Skill[] : Promise.reject(new Error(String(response.status))))
      .then((items) => { if (active && Array.isArray(items)) setSkills(items); })
      .catch(() => { if (active) setSkillsError("Could not load the Freelancehunt skill list. Check FREELANCEHUNT_API_TOKEN and try again."); });
    return () => { active = false; };
  }, []);

  function toggleSkill(id: number, checked: boolean) {
    setValue((current) => ({ ...current, skillIds: checked ? [...new Set([...current.skillIds, id])] : current.skillIds.filter((skillId) => skillId !== id) }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/freelancehunt/settings", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error("save_failed");
      const saved = await response.json() as Settings;
      setValue(saved);
      toast.success("Freelancehunt settings saved.");
    } catch {
      toast.error("Could not save Freelancehunt settings.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <Setting label="Enable Freelancehunt monitoring" description="The worker starts polling only when an API token is configured." checked={value.enabled} onCheckedChange={toggle("enabled")} />
    <Setting label="Watch matching projects" description="Checks the public project list using the skill IDs below." checked={value.projectPollingEnabled} onCheckedChange={toggle("projectPollingEnabled")} />
    <Setting label="Watch unread messages" description="Checks your Freelancehunt conversations for new unread messages." checked={value.messagePollingEnabled} onCheckedChange={toggle("messagePollingEnabled")} />
    <Setting label="Telegram notifications" description="Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the worker environment." checked={value.telegramEnabled} onCheckedChange={toggle("telegramEnabled")} />
    <section className="space-y-3"><div><p className="text-sm font-medium">Project skills</p><p className="mt-1 text-sm text-muted-foreground">{selectedSkills.size} selected. This up-to-date list is loaded from Freelancehunt when this page opens.</p></div>
      <Input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search skills" />
      {skillsError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{skillsError}</p> : skills.length === 0 ? <p className="text-sm text-muted-foreground">Loading skills…</p> : <div className="max-h-[32rem] space-y-5 overflow-y-auto rounded-lg border p-3">
        {[...groupedSkills].map(([groupName, groupSkills]) => <section key={groupName}><h3 className="mb-2 text-sm font-semibold">{groupName}</h3><div className="grid gap-1 sm:grid-cols-2">{groupSkills.map((skill) => <label key={skill.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"><input type="checkbox" className="size-4 accent-primary" checked={selectedSkills.has(skill.id)} onChange={(event) => toggleSkill(skill.id, event.target.checked)} /><span>{skill.name}</span></label>)}</div></section>)}
        {visibleSkills.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No matching skills.</p>}
      </div>}
    </section>
    <label className="grid max-w-xs gap-2 text-sm font-medium">Polling interval, seconds
      <Input type="number" min={10} max={3600} value={value.pollIntervalSeconds} onChange={(event) => setValue((current) => ({ ...current, pollIntervalSeconds: Number(event.target.value) }))} />
      <span className="text-xs font-normal text-muted-foreground">Between 10 and 3,600 seconds. 60 seconds is a sensible default for the API limit.</span>
    </label>
    <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
  </div>;
}

function Setting({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <label className="flex items-start justify-between gap-5 rounded-lg border p-4"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span><Switch checked={checked} onCheckedChange={onCheckedChange} /></label>;
}
