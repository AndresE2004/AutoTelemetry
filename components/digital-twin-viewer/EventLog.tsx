"use client"

import { ScrollArea } from "@/components/ui/scroll-area"

export function EventLog({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card/60">
      <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        Eventos (pipeline / UI)
      </p>
      <ScrollArea className="h-[160px] px-3 py-2">
        <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
          {lines.length === 0 ? (
            <li className="text-muted-foreground/70">Sin eventos todavía.</li>
          ) : (
            lines.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`} className="break-all text-foreground/90">
                {line}
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
    </div>
  )
}
