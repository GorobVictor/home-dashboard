"use client";

import { initialScoringProfiles, type ScoringProfile, type ScoringRule } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fields: { value: ScoringRule["field"]; label: string }[] = [{ value: "technology", label: "Технологія" }, { value: "keyword", label: "Назва й опис" }, { value: "title", label: "Назва" }, { value: "description", label: "Опис" }, { value: "category", label: "Категорія" }, { value: "budget", label: "Бюджет" }];
export function FreelancehuntScoringEditor({ value, onChange, disabled }: { value: ScoringProfile; onChange: (profile: ScoringProfile) => void; disabled?: boolean }) {
  function update(index: number, patch: Partial<ScoringRule>) { onChange({ ...value, rules: value.rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) }); }
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <legend className="mb-2 font-medium">Правила релевантності</legend>
    <p className="text-xs text-muted-foreground">База + ваги правил, що збіглися; результат обмежено 0–100. Від’ємна вага знижує оцінку, зокрема для небажаних технологій. Кожне правило спрацьовує один раз. Технології враховують межі слів; ключові слова шукаються як частина тексту.</p>
    <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm">База<Input className="w-20" type="number" min={0} max={100} required value={value.base} onChange={(e) => onChange({ ...value, base: Number(e.target.value) })} /></label>{initialScoringProfiles.map((preset) => <Button key={preset.name} type="button" variant="outline" size="sm" onClick={() => onChange(structuredClone(preset.profile))}>{preset.name}</Button>)}</div>
    <div className="space-y-2">{value.rules.map((rule, index) => <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
      <label className="min-w-32 flex-1 text-xs">Поле<select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={rule.field} onChange={(e) => update(index, { field: e.target.value as ScoringRule["field"], ...(e.target.value === "budget" ? { term: "", currency: "UAH" } : {}) })}>{fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select></label>
      {rule.field === "budget" ? <><label className="w-24 text-xs">Валюта<Input required maxLength={3} pattern="[A-Z]{3}" value={rule.currency ?? "UAH"} onChange={(e) => update(index, { currency: e.target.value.toUpperCase() })} /></label><label className="w-28 text-xs">Від<Input type="number" min={0} value={rule.minimum ?? ""} onChange={(e) => update(index, { minimum: e.target.value === "" ? undefined : Number(e.target.value) })} /></label><label className="w-28 text-xs">До<Input type="number" min={0} value={rule.maximum ?? ""} onChange={(e) => update(index, { maximum: e.target.value === "" ? undefined : Number(e.target.value) })} /></label></> : <label className="min-w-32 flex-[2] text-xs">Текст / назва категорії<Input required maxLength={100} value={rule.term} onChange={(e) => update(index, { term: e.target.value })} /></label>}
      <label className="w-20 text-xs">Вага<Input type="number" min={-100} max={100} required value={rule.weight} onChange={(e) => update(index, { weight: Number(e.target.value) })} /></label><Button aria-label={`Видалити правило ${index + 1}`} size="sm" type="button" variant="ghost" onClick={() => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })}>×</Button>
    </div>)}</div>
    <Button type="button" size="sm" variant="outline" disabled={value.rules.length >= 40} onClick={() => onChange({ ...value, rules: [...value.rules, { field: "keyword", term: "", weight: 10 }] })}>Додати правило</Button>
  </fieldset>;
}
