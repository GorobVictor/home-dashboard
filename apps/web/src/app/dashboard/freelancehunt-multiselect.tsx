"use client";

import { useId, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

interface Option { value: string; label: string; group?: string }
interface Props {
  name: string;
  label: string;
  placeholder: string;
  options: Option[];
  defaultValue: string[];
  limit: number;
  disabled?: boolean;
  loading?: boolean;
}

export function FreelancehuntMultiselect({ name, label, placeholder, options, defaultValue, limit, disabled, loading }: Props) {
  const labelId = useId();
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const search = query.trim().toLocaleLowerCase("uk");
  const labels = new Map(options.map((option) => [option.value, option.label]));
  const available: Option[] = [...options, ...selected.filter((value) => !labels.has(value)).map((value) => ({ value, label: name === "skillIds" ? `Skill #${value}` : value }))];
  const groups = new Map<string, Option[]>();
  for (const option of available) {
    if ((onlySelected && !selected.includes(option.value)) || (search && !`${option.label} ${option.group ?? ""}`.toLocaleLowerCase("uk").includes(search))) continue;
    const group = option.group ?? "";
    groups.set(group, [...(groups.get(group) ?? []), option]);
  }
  function toggle(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : current.length < limit ? [...current, value] : current);
  }
  return <div className="col-span-2 flex min-w-0 flex-col gap-2">
    <p id={labelId} className="text-sm font-medium">{label}</p>
    {selected.map((value) => <input key={value} type="hidden" name={name} value={value} />)}
    <Popover onOpenChange={(open) => { if (!open) { setQuery(""); setOnlySelected(false); } }}>
      <PopoverTrigger disabled={disabled} aria-labelledby={`${labelId} ${labelId}-selection`} render={<Button type="button" variant="outline" className="h-10 w-full justify-between gap-3 px-3 font-normal" />}>
        <span id={`${labelId}-selection`} className={`min-w-0 truncate ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>{selected.length ? `Selected: ${selected.length}` : placeholder}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="dark dashboard-dialog space-y-3 p-3">
        <div className="flex items-center justify-between gap-2"><PopoverTitle className="text-sm font-medium">{label}</PopoverTitle><span className="text-xs tabular-nums text-muted-foreground">{selected.length} / {limit}</span></div>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={`Search: ${label.toLocaleLowerCase("en-US")}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Search by name…" className="h-10 pl-9" /></div>
        <div className="flex items-center justify-between gap-2"><Button type="button" size="sm" variant={onlySelected ? "secondary" : "ghost"} aria-pressed={onlySelected} onClick={() => setOnlySelected((value) => !value)}>Selected only</Button><Button type="button" size="sm" variant="ghost" disabled={disabled || !selected.length} onClick={() => setSelected([])}>Clear</Button></div>
        <div className="max-h-[min(18rem,40dvh)] space-y-3 overflow-y-auto overscroll-contain [scrollbar-color:var(--muted)_transparent]">
          {[...groups].map(([group, items]) => <fieldset key={group} disabled={disabled} className="min-w-0 space-y-1">{group && <legend className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group}</legend>}{items.map((option) => {
            const checked = selected.includes(option.value);
            return <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted ${checked ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}><Checkbox checked={checked} disabled={!checked && selected.length >= limit} onChange={() => toggle(option.value)} className="mt-0.5" /><span className="min-w-0 break-words">{option.label}</span></label>;
          })}</fieldset>)}
          {!groups.size && <p role="status" className="py-6 text-center text-sm text-muted-foreground">{loading ? "Loading catalogue…" : onlySelected && !selected.length ? "Nothing selected yet." : "No matches found."}</p>}
        </div>
        <p className="border-t pt-2 text-xs text-muted-foreground">{name === "categories" && "Freelancehunt skill groups. "}{selected.length >= limit ? "Selection limit reached." : "An empty selection means no limit."}</p>
      </PopoverContent>
    </Popover>
    {!!selected.length && <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{selected.map((value) => <button key={value} type="button" disabled={disabled} onClick={() => toggle(value)} aria-label={`Remove: ${labels.get(value) ?? value}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"><span className="truncate">{labels.get(value) ?? (name === "skillIds" ? `Skill #${value}` : value)}</span><X aria-hidden="true" className="size-3 shrink-0" /></button>)}</div>}
  </div>;
}
