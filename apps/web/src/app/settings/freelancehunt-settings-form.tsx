"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, BriefcaseBusiness, Clock3, LoaderCircle, MessageSquare, Radio, Save, Search, Send, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState, OptionListSkeleton } from "@/components/loading-state";

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
  const [skillsLoading, setSkillsLoading] = useState(true);
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
      .catch(() => { if (active) setSkillsError("Could not load the Freelancehunt skill list. Check FREELANCEHUNT_API_TOKEN and try again."); })
      .finally(() => { if (active) setSkillsLoading(false); });
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

  return <div className="grid items-start gap-4 lg:grid-cols-2">
    <div className="space-y-4">
      <Card className="rounded-2xl gap-3 py-3 [--card-spacing:--spacing(3)] sm:gap-6 sm:py-6 sm:[--card-spacing:--spacing(6)]">
        <CardHeader><div className="flex items-center gap-2 text-emerald-300"><Radio aria-hidden="true" className="size-4" /><p className="text-[10px] font-medium uppercase tracking-[0.18em]">Freelancehunt</p></div><h3 className="mt-2 text-lg font-semibold">Monitoring</h3><CardDescription className="mt-1">Keep up with the work that matters to you.</CardDescription></CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          <Setting label="Enable monitoring" description="Start checking for new activity. Requires your Freelancehunt API token to be configured." icon={<Radio className="size-4" />} checked={value.enabled} onCheckedChange={toggle("enabled")} prominent />
          <Setting label="Matching projects" description="Find new projects using your selected skills." icon={<BriefcaseBusiness className="size-4" />} checked={value.projectPollingEnabled} onCheckedChange={toggle("projectPollingEnabled")} />
          <Setting label="Unread messages" description="Watch your conversations for new messages." icon={<MessageSquare className="size-4" />} checked={value.messagePollingEnabled} onCheckedChange={toggle("messagePollingEnabled")} />
          <div className="mt-3 border-t border-border/70 pt-3 sm:mt-5 sm:pt-5">
            <label htmlFor="poll-interval" className="flex items-center gap-2 text-sm font-medium"><Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />Check every</label>
            <div className="mt-3 flex items-center gap-3"><Input id="poll-interval" aria-describedby="poll-interval-help" className="h-10 w-28 rounded-xl px-3" type="number" min={10} max={3600} value={value.pollIntervalSeconds} onChange={(event) => setValue((current) => ({ ...current, pollIntervalSeconds: Number(event.target.value) }))} /><span className="text-sm text-muted-foreground">seconds</span></div>
            <p id="poll-interval-help" className="mt-2 text-xs leading-5 text-muted-foreground">10–3,600 seconds. We recommend 60 seconds to stay within API limits.</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl gap-3 py-3 [--card-spacing:--spacing(3)] sm:gap-6 sm:py-6 sm:[--card-spacing:--spacing(6)]">
        <CardHeader><div className="flex items-center gap-2"><Bell aria-hidden="true" className="size-4 text-muted-foreground" /><h3 className="text-lg font-semibold">Notifications</h3></div><CardDescription className="mt-1">Updates, wherever you are.</CardDescription></CardHeader>
        <CardContent><Setting label="Telegram notifications" description="Send new projects and messages to Telegram. Your bot and chat must be configured on the server." icon={<Send className="size-4" />} checked={value.telegramEnabled} onCheckedChange={toggle("telegramEnabled")} /></CardContent>
      </Card>
    </div>
    <Card className="min-w-0 rounded-2xl gap-3 py-3 [--card-spacing:--spacing(3)] sm:gap-6 sm:py-6 sm:[--card-spacing:--spacing(6)]">
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" /><h3 className="text-lg font-semibold">Project skills</h3></div><span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-xs tabular-nums text-emerald-300">{selectedSkills.size} selected</span></div><CardDescription className="mt-1">Choose the skills used to find relevant projects.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative"><label htmlFor="skill-search" className="sr-only">Search skills</label><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="skill-search" className="h-10 rounded-xl pl-10 pr-3" value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search skills…" /></div>
        <div className="h-[min(24rem,55dvh)] sm:h-[36rem]">{skillsError ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm leading-6 text-destructive">{skillsError}</p> : skillsLoading ? <LoadingState label="Loading skills" className="h-full overflow-hidden rounded-xl border bg-background/30 p-3"><OptionListSkeleton rows={10} /></LoadingState> : <div className="h-full space-y-3 overflow-y-auto overscroll-contain rounded-xl border bg-background/30 p-3 [scrollbar-color:var(--muted)_transparent]">
          {[...groupedSkills].map(([groupName, groupSkills]) => <section key={groupName}><h4 className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{groupName}</h4><div className="grid grid-cols-2 gap-1 sm:block sm:space-y-1">{groupSkills.map((skill) => <label key={skill.id} className={`flex cursor-pointer items-start min-h-11 gap-2 rounded-lg px-2 py-2 text-xs sm:gap-3 sm:px-2.5 sm:py-2.5 sm:text-sm transition-colors ${selectedSkills.has(skill.id) ? "bg-emerald-400/[0.07] text-emerald-100" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Checkbox className="mt-0.5" checked={selectedSkills.has(skill.id)} onChange={(event) => toggleSkill(skill.id, event.target.checked)} /><span className="min-w-0 break-words">{skill.name}</span></label>)}</div></section>)}
          {visibleSkills.length === 0 && <p role="status" className="px-2 py-8 text-center text-sm text-muted-foreground">No matching skills.</p>}
        </div>}</div>
        <p className="text-xs leading-5 text-muted-foreground">The skill catalogue is loaded directly from Freelancehunt.</p>
      </CardContent>
    </Card>
    <div className="sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-2 backdrop-blur-md sm:bottom-4 sm:rounded-2xl sm:p-4 lg:col-span-2">
      <p className="hidden text-xs text-muted-foreground sm:block">Save your preferences to apply changes.</p>
      <Button onClick={save} disabled={saving} className="h-10 w-full gap-2 rounded-xl bg-emerald-400 px-5 text-emerald-950 hover:bg-emerald-300 sm:w-auto">{saving ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Save aria-hidden="true" className="size-4" />}{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  </div>;
}

function Setting({ label, description, icon, checked, onCheckedChange, prominent = false }: { label: string; description: string; icon: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void; prominent?: boolean }) {
  return <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-2.5 transition-colors sm:p-3.5 ${prominent && checked ? "border-emerald-400/20 bg-emerald-400/[0.07]" : "border-border/70 bg-foreground/[0.02] hover:bg-foreground/[0.04]"}`}><span className="flex min-w-0 items-start gap-2.5"><span aria-hidden="true" className={`mt-0.5 shrink-0 ${prominent && checked ? "text-emerald-300" : "text-muted-foreground"}`}>{icon}</span><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-4 sm:leading-5 text-muted-foreground">{description}</span></span></span><Switch aria-label={label} className="mt-0.5 data-checked:bg-emerald-400" checked={checked} onCheckedChange={onCheckedChange} /></label>;
}
