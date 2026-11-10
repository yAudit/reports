/* eslint-disable @next/next/no-img-element */

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { RefObject, useEffect, useId, useRef, useState } from "react";
import { spaceGrotesk } from "@/lib/fonts";

// The same navbar as yaudit.dev, so that moving between the yAudit sites
// feels like one site. All links open in the same tab.

interface NavItem {
  label: string;
  href: string;
  // A page of this site, linked through the router. The others are full URLs.
  internal?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

// This site's own section: always the active entry, and named next to the logo.
const ACTIVE_ITEM: NavItem = { label: "Reports", href: "/", internal: true };

const NAV: NavEntry[] = [
  { label: "Services", href: "https://yaudit.dev/services" },
  { label: "yAgent", href: "https://yaudit.dev/yagent" },
  {
    label: "Programs",
    items: [
      { label: "Fellowships", href: "https://yaudit.dev/fellowships" },
      { label: "yBorg", href: "https://yaudit.dev/yborg" },
    ],
  },
  {
    label: "Resources",
    items: [
      ACTIVE_ITEM,
      { label: "Blog", href: "https://blog.yaudit.dev/" },
      { label: "Research", href: "https://research.yaudit.dev/" },
    ],
  },
  { label: "Team", href: "https://yaudit.dev/team" },
];

const HOME_HREF = "https://yaudit.dev/";
const CONTACT_HREF = "https://yaudit.dev/contact-us";

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

function NavLink({
  item,
  className,
  onClick,
}: {
  item: NavItem;
  className: string;
  onClick?: () => void;
}) {
  return item.internal ? (
    <Link href={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} className={className} onClick={onClick}>
      {item.label}
    </a>
  );
}

// A menu entry that opens a list of links. It opens on hover and on click;
// a keyboard click toggles it, and Escape or a click outside closes it.
function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = group.items.includes(ACTIVE_ITEM);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        // A pointer click keeps the list open after hover opened it.
        onClick={(event) => setOpen(event.detail === 0 ? !open : true)}
        className={`flex items-center gap-1 px-5 py-3 decoration-deepblue decoration-2 underline-offset-8 transition hover:text-deepblue hover:underline ${
          active || open ? "text-deepblue" : "text-zinc-400"
        }`}
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        // The padding lines the list up with the bottom of the header and
        // keeps the pointer inside the entry on its way down.
        <div id={listId} className="absolute left-0 top-full pt-2.5">
          <div className="min-w-[12rem] border border-zinc-950/10 bg-white py-2 shadow-lg">
            {group.items.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                onClick={() => setOpen(false)}
                className={`block whitespace-nowrap px-5 py-2.5 transition hover:bg-deepblue/5 hover:text-deepblue ${
                  item === ACTIVE_ITEM ? "text-deepblue" : "text-zinc-500"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuProps {
  setMenuOpen: (menuOpen: boolean) => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}

// The site defines sm, md and lg as ranges (tailwind.config.ts), the same as
// yaudit.dev, so a class that applies from 768px up needs both "md:" and
// "lg:". Tailwind has no "min-[...]:" variants with range screens.
//
// The side margins are the ones of yaudit.dev, so the logo and Contact sit in
// the same place on every yAudit site: 20vw on wide screens, shrinking to
// what the menu needs (about 1000px) on narrower ones, and never below 2rem.
//
// The text color is set because the site's body color is a light gray.
function DesktopNavbar({
  menuOpen,
  setMenuOpen,
  menuButtonRef,
}: MenuProps & { menuOpen: boolean }) {
  return (
    <header
      className={`${spaceGrotesk.className} sticky top-0 z-40 w-full border-b border-zinc-950/10 bg-white/95 text-neutral-950 backdrop-blur`}
    >
      <div className="flex h-16 items-center justify-between px-6 lg:px-[max(2rem,min(20vw,calc((100vw_-_1000px)/2)))]">
        <div className="flex items-center gap-3">
          <a href={HOME_HREF} className="block">
            <img src="/logo.svg" className="h-9 w-auto" alt="yAudit" />
          </a>
          <Link
            href={ACTIVE_ITEM.href}
            className="hidden border-l border-zinc-300 pl-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 md:inline lg:inline"
          >
            {ACTIVE_ITEM.label}
          </Link>
        </div>

        <div className="flex items-center">
          <nav className="hidden items-center text-sm font-medium lg:flex">
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <NavDropdown key={entry.label} group={entry} />
              ) : (
                <NavLink
                  key={entry.label}
                  item={entry}
                  className={`px-5 py-3 decoration-deepblue decoration-2 underline-offset-8 transition hover:text-deepblue hover:underline ${
                    entry === ACTIVE_ITEM ? "text-deepblue" : "text-zinc-400"
                  }`}
                />
              )
            )}
          </nav>

          <a
            href={CONTACT_HREF}
            className="inline-flex items-center border border-deepblue bg-deepblue px-8 py-3 text-sm font-semibold text-white transition duration-700 hover:bg-white hover:text-deepblue lg:ml-3"
          >
            Contact
          </a>

          <button
            ref={menuButtonRef}
            type="button"
            className="ml-2 px-3 py-3 lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileNavbar({ setMenuOpen, menuButtonRef }: MenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      } else if (event.key === "Tab") {
        const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])"
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      // Back to the menu button, also where a click does not focus it. The
      // header is sticky, so the button is in view.
      menuButton?.focus({ preventScroll: true });
    };
  }, [setMenuOpen, menuButtonRef]);

  const linkClass = (item: NavItem) =>
    `block px-6 py-4 w-full text-center text-xl hover:text-deepblue hover:bg-deepblue hover:bg-opacity-5 duration-700 ${
      item === ACTIVE_ITEM ? "text-deepblue" : "text-zinc-400"
    }`;

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className={`${spaceGrotesk.className} fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-white text-neutral-950`}
    >
      <div className="pt-8 mx-auto flex flex-col p-8 gap-2">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="text-deepblue"
        >
          <X style={{ fontSize: "2rem" }} size={32} />
        </button>

        {/* On phones the groups are flattened into one plain list. */}
        {NAV.flatMap((entry) => (isGroup(entry) ? entry.items : [entry])).map((item) => (
          <NavLink
            key={item.label}
            item={item}
            onClick={() => setMenuOpen(false)}
            className={linkClass(item)}
          />
        ))}

        <a
          href={CONTACT_HREF}
          onClick={() => setMenuOpen(false)}
          className="block p-6 w-full text-center text-xl text-white bg-deepblue hover:bg-white hover:text-deepblue hover:border hover:border-deepblue duration-700"
        >
          Contact
        </a>
      </div>
    </div>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DesktopNavbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuButtonRef={menuButtonRef}
      />
      {menuOpen && (
        <MobileNavbar setMenuOpen={setMenuOpen} menuButtonRef={menuButtonRef} />
      )}
    </>
  );
}
