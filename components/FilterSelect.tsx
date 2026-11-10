import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import HeroIcon from "@/components/HeroIcon";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  id: string;
  /** What the filter chooses, for screen readers: "Client" */
  label: string;
  value: string;
  /** The first option is the one that shows everything, with value "". */
  options: FilterOption[];
  onChange: (value: string) => void;
}

// How long the typed letters add up, as in a native select: typing "ol"
// quickly goes to "Olympus".
const TYPE_AHEAD_MS = 700;

/**
 * A select whose list looks like the navbar menus: a white box with a light
 * border and a shadow, gray entries that turn blue on hover, the chosen one
 * in blue. A native select draws its list with the browser's own look.
 *
 * It follows the listbox pattern: the arrows, Home and End move, Enter or
 * Space choose, Escape closes, and typing goes to the first entry that starts
 * with the typed letters.
 */
export default function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", time: 0 });
  const listId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const optionId = (index: number) => `${listId}-option-${index}`;

  // A pointer outside closes the list, as in the navbar.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // The open list takes the keyboard, and keeps the active entry in view.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    close();
  };

  // Returns true when the key was a letter of a typed name. "now" is the
  // key event's timeStamp.
  const typeAhead = (key: string, now: number): boolean => {
    const recent = now - typed.current.time < TYPE_AHEAD_MS;
    // Space chooses, unless it is part of a name being typed ("Rage Trade").
    if (key === " " && !(recent && typed.current.text)) return false;
    if (key.length !== 1) return false;

    typed.current = { text: (recent ? typed.current.text : "") + key.toLowerCase(), time: now };
    const match = options.findIndex((option) =>
      option.label.toLowerCase().startsWith(typed.current.text)
    );
    if (match >= 0) setActive(match);
    return true;
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(last);
        return;
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (typeAhead(event.key, event.timeStamp)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${options[selectedIndex].label}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleButtonKeyDown}
        className={`flex h-12 w-full items-center justify-between gap-2 border bg-white px-3 text-left text-sm text-zinc-950 outline-none transition focus-visible:border-[#0657F9] ${
          open ? "border-[#0657F9]" : "border-zinc-300"
        }`}
      >
        <span className="truncate">{options[selectedIndex].label}</span>
        <HeroIcon
          name="chevron-down"
          className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={optionId(active)}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 top-full z-30 mt-1 max-h-80 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto border border-zinc-950/10 bg-white py-2 text-sm shadow-lg outline-none"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            const highlighted = index === active;
            return (
              <li
                key={option.value || "all"}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`cursor-pointer whitespace-nowrap px-5 py-2.5 transition ${
                  highlighted ? "bg-deepblue/5" : ""
                } ${selected || highlighted ? "text-deepblue" : "text-zinc-500"}`}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
