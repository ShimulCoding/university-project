"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserProfile } from "@/types";
import { AppLogo } from "@/components/shell/app-logo";

type WorkspaceLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};
export function WorkspaceSidebar({
  user,
  label,
  title,
  subtitle,
  links,
  backHref,
  backLabel,
  publicHref,
}: {
  user: UserProfile;
  label: string;
  title: string;
  subtitle: string;
  links: WorkspaceLink[];
  backHref?: string;
  backLabel?: string;
  publicHref: string;
}) {
  const pathname = usePathname();
  const navigation = (
    <nav aria-label={`${label} navigation`} className="space-y-1">
      {links.map(({ href, label: name, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          title={description}
          aria-current={pathname === href ? "page" : undefined}
          className="focus-ring workspace-link"
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          <span>{name}</span>
        </Link>
      ))}
    </nav>
  );
  return (
    <aside className="workspace-nav">
      <div className="hidden lg:block">
        <AppLogo inverse />
        <div className="my-6 border-y border-white/10 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/60">
            {label}
          </div>
          <div className="mt-2 break-words text-base font-semibold leading-snug text-white">
            {title}
          </div>
          <div className="mt-2 text-xs leading-5 text-white/60">{subtitle}</div>
        </div>
        {navigation}
      </div>
      <details key={pathname} className="group lg:hidden">
        <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg [&::-webkit-details-marker]:hidden">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/60">
              {label}
            </span>
            <div className="mt-1 text-sm font-semibold text-white">{title}</div>
          </div>
          <ChevronDown
            className="h-5 w-5 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-4 border-t border-white/10 pt-3">{navigation}</div>
      </details>
      <div className="mt-6 hidden space-y-1 border-t border-white/10 pt-4 lg:block">
        {backHref ? (
          <Link className="focus-ring workspace-link" href={backHref}>
            {backLabel}
            <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link className="focus-ring workspace-link" href={publicHref}>
          View public site
          <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="mt-5 flex min-w-0 items-center gap-3 px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {user.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((name) => name[0])
              .join("")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-white">
              {user.fullName}
            </div>
            <div
              className="mt-1 truncate text-[11px] text-white/60"
              title={user.email}
            >
              {user.email}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
