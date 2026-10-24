"use client";

import { HelpText } from "@/components/help-text";
import { useId, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingState, OptionListSkeleton } from "@/components/loading-state";
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
  const available: Option[] = [...options, ...selected.filter((value) => !labels.has(value)).map((value) => ({ value, label: name === "skillIds" ? `Навичка #${value}` : value }))];
  const groups = new Map<string, Option[]>();
  for (const option of available) {
    if ((onlySelected && !selected.includes(option.value)) || (search && !`${option.label} ${option.group ?? ""}`.toLocaleLowerCase("uk").includes(search))) continue;
    const group = option.group ?? "";
    groups.set(group, [...(groups.get(group) ?? []), option]);
  }
  function toggle(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : current.length < limit ? [...current, value] : current);
  }
  return <div className="form-field">
    <div className="flex min-h-6 items-start text-sm font-medium leading-6"><span id={labelId} className="sr-only">{label}</span><HelpText>{label}</HelpText></div>
    {selected.map((value) => <input key={value} type="hidden" name={name} value={value} />)}
    <Popover onOpenChange={(open) => { if (!open) { setQuery(""); setOnlySelected(false); } }}>
      <PopoverTrigger disabled={disabled} aria-labelledby={`${labelId} ${labelId}-selection`} render={<Button type="button" variant="outline" className="h-11 w-full min-w-0 justify-between gap-3 border-input bg-input/30 px-3.5 font-normal" />}>
        <span id={`${labelId}-selection`} className={`min-w-0 truncate ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>{selected.length ? `Вибрано: ${selected.length}` : placeholder}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="dark dashboard-dialog space-y-3 p-3">
        <div className="flex items-center justify-between gap-2"><PopoverTitle className="text-sm font-medium">{label}</PopoverTitle><span className="text-xs tabular-nums text-muted-foreground">{selected.length} / {limit}</span></div>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={`Пошук: ${label.toLocaleLowerCase("uk-UA")}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Шукати за назвою…" className="h-11 pl-9" /></div>
        <div className="flex items-center justify-between gap-2"><Button type="button" size="sm" variant={onlySelected ? "secondary" : "ghost"} aria-pressed={onlySelected} onClick={() => setOnlySelected((value) => !value)}>Лише вибрані</Button><Button type="button" size="sm" variant="ghost" disabled={disabled || !selected.length} onClick={() => setSelected([])}>Очистити</Button></div>
        <div className="max-h-[min(18rem,40dvh)] space-y-3 overflow-y-auto overscroll-contain [scrollbar-color:var(--muted)_transparent]">
          {loading ? <LoadingState label="Завантажуємо каталог"><OptionListSkeleton /></LoadingState> : [...groups].map(([group, items]) => <fieldset key={group} disabled={disabled} className="min-w-0 space-y-1">{group && <legend className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group}</legend>}{items.map((option) => {
            const checked = selected.includes(option.value);
            return <label key={option.value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted ${checked ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}><Checkbox checked={checked} disabled={!checked && selected.length >= limit} onChange={() => toggle(option.value)} className="mt-0.5" /><span className="min-w-0 break-words">{option.label}</span></label>;
          })}</fieldset>)}
          {!loading && !groups.size && <p role="status" className="py-6 text-center text-sm text-muted-foreground">{onlySelected && !selected.length ? "Нічого не вибрано." : "Нічого не знайдено."}</p>}
        </div>
        <p className="border-t pt-2 text-xs text-muted-foreground">{name === "categories" && "Групи навичок Freelancehunt. "}{selected.length >= limit ? "Досягнуто ліміту вибору." : "Порожній вибір не обмежує результати."}</p>
      </PopoverContent>
    </Popover>
    {!!selected.length && <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{selected.map((value) => <button key={value} type="button" disabled={disabled} onClick={() => toggle(value)} aria-label={`Прибрати: ${labels.get(value) ?? value}`} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:min-h-0"><span className="truncate">{labels.get(value) ?? (name === "skillIds" ? `Навичка #${value}` : value)}</span><X aria-hidden="true" className="size-3 shrink-0" /></button>)}</div>}
  </div>;
}
