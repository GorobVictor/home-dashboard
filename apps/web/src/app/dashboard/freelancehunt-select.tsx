"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  label: string;
  name?: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FreelancehuntSelect({ label, name, options, value, defaultValue, onValueChange, disabled, className = "" }: Props) {
  const id = useId();
  return <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <Select name={name} items={options} value={value} defaultValue={defaultValue} disabled={disabled} onValueChange={(value) => { if (value !== null) onValueChange?.(value); }}>
      <SelectTrigger id={id} className="w-full min-w-0 gap-3 px-3 font-normal data-[size=default]:h-10"><SelectValue className="min-w-0 truncate" /></SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} sideOffset={8} className="dark dashboard-dialog max-w-[calc(100vw-2rem)] rounded-xl border p-1 shadow-xl">
        {options.map((option) => <SelectItem key={option.value} value={option.value} className="cursor-pointer rounded-lg px-3 py-2.5 pr-9 data-highlighted:bg-muted data-highlighted:text-foreground">{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
