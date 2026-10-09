import type { ReactNode } from "react";

/**
 * Shared frame for the admin pages: same campus photo, crests and glass
 * styling as the student payment pages, so the whole site looks like one app.
 */
export function AdminShell({ eyebrow, title, subtitle, actions, children }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className="portal-shell px-4 py-8">
      <div className="portal-content mx-auto max-w-6xl space-y-6">
        <header className="portal-card-glass flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="portal-logos !gap-2">
              <div className="portal-crest !h-14 !w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/school-crest.png" alt="University of Mines and Technology crest" />
              </div>
              <div className="portal-crest !h-14 !w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/src-logo.png" alt="SRC logo" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-portal-accentDark">{eyebrow}</p>
              <h1 className="text-2xl font-bold text-portal-text">{title}</h1>
              {subtitle && <p className="text-sm text-portal-muted">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}
