import type { KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type HttpMethod,
  useRequestStore,
} from "@/store/requestStore";
import { sendRequest } from "@/lib/http";
import { cn } from "@/lib/utils";

const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

const methodColor: Record<HttpMethod, string> = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PUT: "text-sky-400",
  DELETE: "text-red-400",
  PATCH: "text-violet-400",
  HEAD: "text-zinc-300",
  OPTIONS: "text-zinc-300",
};

export function RequestBar() {
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const headers = useRequestStore((s) => s.headers);
  const body = useRequestStore((s) => s.body);
  const loading = useRequestStore((s) => s.loading);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const setLoading = useRequestStore((s) => s.setLoading);
  const setResponse = useRequestStore((s) => s.setResponse);

  const onSend = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await sendRequest({ method, url, headers, body });
      setResponse(result);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-zinc-800 bg-zinc-950">
      <div className="relative">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={cn(
            "h-10 appearance-none rounded-md border border-zinc-700 bg-zinc-900 pl-3 pr-8 text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            methodColor[method]
          )}
          aria-label="HTTP method"
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="bg-zinc-900 text-white">
              {m}
            </option>
          ))}
        </select>
      </div>

      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="https://api.example.com/endpoint"
        className="h-10 flex-1 font-mono text-[13px]"
        spellCheck={false}
      />

      <Button
        variant="send"
        size="lg"
        onClick={() => void onSend()}
        disabled={loading || !url.trim()}
        className="min-w-[110px]"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send
          </>
        )}
      </Button>
    </div>
  );
}
