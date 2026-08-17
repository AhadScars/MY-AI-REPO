import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequestStore } from "@/store/requestStore";

export function HeadersEditor() {
  const headers = useRequestStore((s) => s.headers);
  const addHeader = useRequestStore((s) => s.addHeader);
  const updateHeader = useRequestStore((s) => s.updateHeader);
  const removeHeader = useRequestStore((s) => s.removeHeader);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Request Headers
        </p>
        <Button variant="outline" size="sm" onClick={addHeader}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-2 pr-1">
        <div className="grid grid-cols-[28px_1fr_1fr_36px] gap-2 text-[11px] uppercase tracking-wide text-zinc-500 px-1">
          <span />
          <span>Key</span>
          <span>Value</span>
          <span />
        </div>

        {headers.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[28px_1fr_1fr_36px] gap-2 items-center"
          >
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) =>
                updateHeader(row.id, { enabled: e.target.checked })
              }
              className="h-4 w-4 accent-white cursor-pointer justify-self-center"
              title="Include header"
            />
            <Input
              value={row.key}
              onChange={(e) => updateHeader(row.id, { key: e.target.value })}
              placeholder="Header name"
              className="h-8 font-mono text-xs"
              spellCheck={false}
            />
            <Input
              value={row.value}
              onChange={(e) => updateHeader(row.id, { value: e.target.value })}
              placeholder="Header value"
              className="h-8 font-mono text-xs"
              spellCheck={false}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-400"
              onClick={() => removeHeader(row.id)}
              title="Remove header"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {headers.length === 0 && (
          <p className="text-sm text-zinc-500 py-6 text-center">
            No headers. Click Add to create one.
          </p>
        )}
      </div>
    </div>
  );
}
