import { Textarea } from "@/components/ui/textarea";
import { useRequestStore } from "@/store/requestStore";

export function BodyEditor() {
  const method = useRequestStore((s) => s.method);
  const body = useRequestStore((s) => s.body);
  const setBody = useRequestStore((s) => s.setBody);

  const noBody = method === "GET" || method === "HEAD";

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Request Body (JSON)
        </p>
        {noBody && (
          <span className="text-xs text-amber-400">
            Body is typically unused for {method}
          </span>
        )}
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder='{"key": "value"}'
        className="flex-1 min-h-[180px] text-[13px] leading-relaxed"
        spellCheck={false}
        disabled={noBody}
      />
    </div>
  );
}
