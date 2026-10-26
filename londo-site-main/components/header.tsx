"use client";
import {Icon} from "@/components/promotions/ui";
import {isNavigationCurrent,navigationForAccess,userMenuForAccess} from "@/lib/permissions/features";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DiscordLoginButton } from "@/components/discord-login-button";
import { Logo } from "@/components/logo";
import { DISCORD_SIGN_OUT_PATH } from "@/lib/auth/paths";
import type { SessionUser } from "@/lib/auth/session";

type NavItem = { href: string; label: string };
type HeaderProps = { user?: SessionUser | null };

function navigationFor(user: SessionUser | null): NavItem[] {
 return user ? navigationForAccess(user.effectiveAccess) : [{href:"/about",label:"О LONDO"}];
}

function formatBalance(value: string) {
  const [integer, fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

function CoinBalance() {
  const [balance, setBalance] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadBalance = async () => {
      try {
        const response = await fetch("/api/economy/balance", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Не удалось загрузить баланс монет.");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("balance" in data) || typeof data.balance !== "string") {
          throw new Error("Сервер вернул некорректный баланс монет.");
        }
        setBalance(data.balance);
        setFailed(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      }
    };
    void loadBalance();
    window.addEventListener("londo:coins-changed", loadBalance);
    window.addEventListener("focus", loadBalance);
    return () => {
      controller.abort();
      window.removeEventListener("londo:coins-changed", loadBalance);
      window.removeEventListener("focus", loadBalance);
    };
  }, []);

  const label = failed ? "Баланс монет не загрузился" : balance === null ? "Загрузка баланса монет" : `Баланс: ${balance} монет`;
  return <span className="londo-header-balance" role="status" aria-live="polite" aria-label={label} title={label}>
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <ellipse cx="14" cy="20" rx="9" ry="4.5" fill="#9d622d" />
      <path d="M5 16v4c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-4" fill="#d99b45" stroke="#f1c477" strokeWidth="1" />
      <ellipse cx="14" cy="16" rx="9" ry="4.5" fill="#f1bc59" stroke="#ffe09a" strokeWidth="1" />
      <circle cx="14" cy="16" r="3" fill="none" stroke="#bd792d" strokeWidth="1" />
    </svg>
    <span>{failed ? "—" : balance === null ? "…" : formatBalance(balance)}</span>
    <span className="sr-only">монет</span>
  </span>;
}

export function Header({ user = null }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = searchParams.size ? `${pathname}?${searchParams.toString()}` : pathname;
  const navItems = navigationFor(user);
  const userMenuItems = user ? userMenuForAccess(user.effectiveAccess) : [];

  const renderNav = (mobile = false) => navItems.map((item) => <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined} className={`${mobile ? "min-h-12 rounded-xl px-3 py-3 text-base text-muted hover:bg-white/5 hover:text-white" : `rounded-full px-3 py-2.5 text-muted transition hover:bg-white/5 hover:text-white ${user ? "text-xs" : "text-sm"}`}`} onClick={mobile ? () => setOpen(false) : undefined}><span className="inline-flex items-center gap-1.5">{item.href === "/family-settings" && <Icon name="settings" size={16}/>}<span>{item.label}</span></span></Link>);
  const isCurrent = (href: string) => isNavigationCurrent(href,currentPath);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  return <><a href="#main-content" className="londo-skip-link" onClick={(event) => {
    const main = document.querySelector<HTMLElement>(".londo-site-content main");
    if (!main) return;
    event.preventDefault();
    main.id = "main-content";
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }}>Перейти к содержимому</a><header className="londo-site-header sticky top-0 z-50 border-b border-white/[.07] bg-[#08080a]/85 backdrop-blur-xl" data-authenticated={user ? "true" : undefined}>
    <div className={`mx-auto flex h-[68px] items-center justify-between gap-4 px-4 sm:px-6 ${user ? "max-w-[1440px]" : "max-w-6xl"}`}>
      <Logo />
      <nav className="hidden items-center gap-1 xl:flex" aria-label="Основная навигация">
        {renderNav()}
      </nav>
      <div className="flex items-center gap-2">
        {user ? <div ref={profileMenuRef} className="relative">
          <button type="button" onClick={() => setProfileMenuOpen((value) => !value)} aria-expanded={profileMenuOpen} aria-controls="profile-menu" aria-label={`Меню ${user.displayName || user.username}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[.04] py-1 pl-1 pr-3 text-sm text-white transition hover:border-accent/40 hover:bg-white/[.08]">
            {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /> : <span className="londo-header-avatar inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-black">{user.displayName.slice(0, 1).toUpperCase()}</span>}
            <span className="hidden max-w-32 truncate sm:inline">{user.displayName || user.username}</span>
          </button>
          {profileMenuOpen ? <div id="profile-menu" className="absolute right-0 top-12 w-60 rounded-2xl border border-white/10 bg-[#111116] p-1.5 shadow-2xl">
            {userMenuItems.map(item=><Link key={item.href} href={item.href} onClick={()=>setProfileMenuOpen(false)} aria-current={isCurrent(item.href) ? "page" : undefined} className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white">{item.href === "/family-settings" && <Icon name="settings" size={16}/>}<span>{item.label}</span></Link>)}
            <form action={DISCORD_SIGN_OUT_PATH} method="post" className="mt-1 border-t border-white/10 pt-1"><button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-400/10">Выйти</button></form>
          </div> : null}
        </div> : <DiscordLoginButton className="inline-flex" />}
        {user && <CoinBalance />}
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white xl:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Закрыть меню" : "Открыть меню"} onClick={() => setOpen((value) => !value)}>
          <span className="sr-only">{open ? "Закрыть меню" : "Открыть меню"}</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
    {open ? <nav id="mobile-nav" className="border-t border-white/[.07] px-4 py-3 xl:hidden" aria-label="Мобильная навигация"><div className="mx-auto flex max-w-6xl flex-col gap-1">{renderNav(true)}</div></nav> : null}
  </header></>;
}
