"use client";

import { useEffect, useRef, useState } from "react";

export function FadeValue({ value, className }: { value: string; className?: string }) {
  const [displayedValue, setDisplayedValue] = useState(value);
  const [nextValue, setNextValue] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;
    setNextValue(value);
    setTransitioning(false);

    const animationFrame = requestAnimationFrame(() => setTransitioning(true));
    const finishTimer = setTimeout(() => {
      setDisplayedValue(value);
      setNextValue(null);
      setTransitioning(false);
    }, 200);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(finishTimer);
    };
  }, [value]);

  if (!nextValue) {
    return <span aria-live="polite" className={className}>{displayedValue}</span>;
  }

  return (
    <span aria-live="polite" className={`${className ?? ""} inline-grid overflow-hidden align-baseline`}>
      <span
        className={`col-start-1 row-start-1 transition-all duration-200 ease-out ${
          transitioning ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {displayedValue}
      </span>
      <span
        className={`col-start-1 row-start-1 transition-all duration-200 ease-out ${
          transitioning ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        {nextValue}
      </span>
    </span>
  );
}
