"use client";

import { useId } from "react";
import { initialScoringProfiles, type ScoringProfile, type ScoringRule } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fields: { value: ScoringRule["field"]; label: string }[] = [{ value: "technology", label: "Technology" }, { value: "keyword", label: "Title and description" }, { value: "title", label: "Title" }, { value: "description", label: "Description" }, { value: "category", label: "Category" }, { value: "budget", label: "Budget" }];
export function FreelancehuntScoringEditor({ value, onChange, disabled }: { value: ScoringProfile; onChange: (profile: ScoringProfile) => void; disabled?: boolean }) {
  const prefix = useId();
  function update(index: number, patch: Partial<ScoringRule>) { onChange({ ...value, rules: value.rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) }); }
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <legend className="mb-2 font-medium">Relevance rules</legend>
    <p className="text-xs text-muted-foreground">Base score plus matching rule weights, capped at 0–100. Negative weights lower the score, including for unwanted technologies. Each rule matches once. Technologies respect word boundaries; keywords can match within text.</p>
    <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm">Base<Input className="w-20" type="number" min={0} max={100} required value={value.base} onChange={(e) => onChange({ ...value, base: Number(e.target.value) })} /></label>{initialScoringProfiles.map((preset) => <Button key={preset.name} type="button" variant="outline" size="sm" onClick={() => onChange(structuredClone(preset.profile))}>{preset.name}</Button>)}</div>
    <div className="space-y-2">{value.rules.map((rule, index) => <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
      <div className="min-w-32 flex-1 text-xs"><label htmlFor={`${prefix}-field-${index}`}>Field</label><Select items={fields} value={rule.field} disabled={disabled} onValueChange={(field) => { if (field !== null) update(index, { field, ...(field === "budget" ? { term: "", currency: "UAH" } : {}) }); }}>
        <SelectTrigger id={`${prefix}-field-${index}`} className="mt-1 w-full min-w-0 gap-3 px-3 font-normal data-[size=default]:h-9"><SelectValue className="min-w-0 truncate" /></SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} sideOffset={8} className="dark dashboard-dialog max-w-[calc(100vw-2rem)] rounded-xl border p-1 shadow-xl">{fields.map((field) => <SelectItem key={field.value} value={field.value} className="cursor-pointer rounded-lg px-3 py-2.5 pr-9 data-highlighted:bg-muted data-highlighted:text-foreground">{field.label}</SelectItem>)}</SelectContent>
      </Select></div>
      {rule.field === "budget" ? <><label className="w-24 text-xs">Currency<Input required maxLength={3} pattern="[A-Z]{3}" value={rule.currency ?? "UAH"} onChange={(e) => update(index, { currency: e.target.value.toUpperCase() })} /></label><label className="w-28 text-xs">From<Input type="number" min={0} value={rule.minimum ?? ""} onChange={(e) => update(index, { minimum: e.target.value === "" ? undefined : Number(e.target.value) })} /></label><label className="w-28 text-xs">To<Input type="number" min={0} value={rule.maximum ?? ""} onChange={(e) => update(index, { maximum: e.target.value === "" ? undefined : Number(e.target.value) })} /></label></> : <label className="min-w-32 flex-[2] text-xs">Text / category name<Input required maxLength={100} value={rule.term} onChange={(e) => update(index, { term: e.target.value })} /></label>}
      <label className="w-20 text-xs">Weight<Input type="number" min={-100} max={100} required value={rule.weight} onChange={(e) => update(index, { weight: Number(e.target.value) })} /></label><Button aria-label={`Delete rule ${index + 1}`} size="sm" type="button" variant="ghost" onClick={() => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })}>×</Button>
    </div>)}</div>
    <Button type="button" size="sm" variant="outline" disabled={value.rules.length >= 40} onClick={() => onChange({ ...value, rules: [...value.rules, { field: "keyword", term: "", weight: 10 }] })}>Add rule</Button>
  </fieldset>;
}
