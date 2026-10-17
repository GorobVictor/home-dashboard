"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChannelInput } from "@home-dashboard/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FreelancehuntScoringEditor } from "@/components/freelancehunt-scoring-editor";
import { initialScoringProfiles } from "@home-dashboard/integrations/freelancehunt-rules";
import { FreelancehuntSelect } from "../../dashboard/freelancehunt-select";

const emptyChannel: ChannelInput = { name: "", chatId: "", enabled: true, minSeverity: "info", sources: [] };
const newChannel = (): ChannelInput => ({ ...emptyChannel, projectMinScore: 0, projectScoring: initialScoringProfiles[0].profile });

export function ChannelForm({ channel }: { channel?: ChannelInput & { id: string } }) {
  const router = useRouter();
  const [values, setValues] = useState<ChannelInput>(channel ? { name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, sources: channel.sources, projectMinScore: channel.projectMinScore ?? 0, projectScoring: channel.projectScoring ?? initialScoringProfiles[0].profile } : newChannel());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  const prefix = channel?.id ?? "new";

  async function action(kind: "save" | "test" | "disable") {
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/notification-channels${channel ? `/${channel.id}` : ""}${kind === "test" ? "/test" : ""}`, { method: kind === "test" ? "POST" : kind === "disable" ? "DELETE" : channel ? "PUT" : "POST", headers: { "content-type": "application/json" }, ...(kind === "save" ? { body: JSON.stringify(values) } : {}) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error === "test_rate_limited" ? "Wait 30 seconds before sending another test." : data.error === "channel_already_exists" ? "A channel with this chat ID already exists." : data.error === "channel_disabled" ? "Enable and save the channel before testing." : "The action could not be completed. Check the values and try again."); }
      setMessage(kind === "test" ? "The test notification has been queued. Its result will appear in delivery history." : "Saved.");
      if (!channel) setValues(newChannel());
      router.refresh();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => { event.preventDefault(); void action("save"); }} className="min-w-0 space-y-4 rounded-2xl border bg-card p-3 sm:space-y-6 sm:p-6">
    <header><h2 className="break-words text-base font-semibold sm:text-lg">{channel ? channel.name : "Add a Telegram channel"}</h2><p className="mt-1 text-sm text-muted-foreground">This channel receives only selected events at or above the chosen severity.</p></header>
    <section className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-5">
      <label className="grid gap-2 text-sm font-medium">Name<Input className="h-10" required maxLength={100} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
      <label className="grid gap-2 text-sm font-medium">Chat ID<Input className="h-10" required maxLength={100} placeholder="-1001234567890 or @channel" value={values.chatId} onChange={(event) => setValues({ ...values, chatId: event.target.value })} pattern="(-?[0-9]{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})" /></label>
      <FreelancehuntSelect label="Minimum severity" value={values.minSeverity} onValueChange={(minSeverity) => setValues({ ...values, minSeverity: minSeverity as ChannelInput["minSeverity"] })} options={["info", "warning", "error", "critical"].map((value) => ({ value, label: value }))} />
      <div className="flex h-10 items-center gap-3 rounded-lg border bg-input/30 px-3 sm:mt-7"><Switch id={`${prefix}-enabled`} className="data-checked:bg-emerald-400" checked={values.enabled} onCheckedChange={(enabled) => setValues({ ...values, enabled })} /><label htmlFor={`${prefix}-enabled`} className="text-sm font-medium">Notifications enabled</label></div>
    </section>
    <fieldset className="rounded-xl border bg-muted/20 p-3 sm:p-4"><legend className="px-1 text-sm font-medium">Sources</legend><p className="mb-3 text-xs text-muted-foreground">Leave all sources unchecked to receive every source.</p><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{["marstek", "freelancehunt", "system", "docker"].map((source) => <label key={source} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm transition-colors ${values.sources.includes(source) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-input bg-input/30 text-muted-foreground hover:bg-muted"}`}><Checkbox checked={values.sources.includes(source)} onChange={(event) => setValues({ ...values, sources: event.target.checked ? [...values.sources, source] : values.sources.filter((item) => item !== source) })} />{source}</label>)}</div></fieldset>
    <details className="rounded-xl border bg-muted/20 p-3 sm:p-4"><summary className="cursor-pointer text-sm font-medium">Freelancehunt project relevance</summary><div className="mt-4 space-y-4"><label className="grid max-w-xs gap-2 text-sm font-medium">Send projects scored at least<Input className="h-10" type="number" min={0} max={100} required value={values.projectMinScore ?? 0} onChange={(event) => setValues({ ...values, projectMinScore: Number(event.target.value) })} /></label><p className="text-xs text-muted-foreground">This applies to new projects only. Other events and test notifications ignore this score. The channel profile is independent from personal profiles.</p><FreelancehuntScoringEditor value={values.projectScoring ?? initialScoringProfiles[0].profile} onChange={(projectScoring) => setValues({ ...values, projectScoring })} disabled={busy} /></div></details>
    <footer className="flex flex-wrap items-center gap-2 border-t pt-3 sm:pt-5 [&>button]:flex-1 sm:[&>button]:flex-none"><Button type="submit" disabled={busy}>{busy ? "Working…" : "Save"}</Button>{channel && <><Button type="button" variant="outline" disabled={busy || !channel.enabled} onClick={() => void action("test")}>Send test</Button><Button type="button" variant="ghost" disabled={busy || !channel.enabled} onClick={() => void action("disable")}>Disable</Button></>}</footer>
    {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
  </form>;
}
