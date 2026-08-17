import { Clock, FileJson, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestStore } from "@/store/requestStore";
import { prettyJson, statusVariant } from "@/lib/http";
import { formatBytes, formatDuration } from "@/lib/utils";

export function ResponsePanel() {
  const response = useRequestStore((s) => s.response);
  const loading = useRequestStore((s) => s.loading);
  const responseTab = useRequestStore((s) => s.responseTab);
  const setResponseTab = useRequestStore((s) => s.setResponseTab);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 border-t border-zinc-800">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-white border-t-transparent animate-spin" />
          <p className="text-sm text-white">Waiting for response…</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 border-t border-zinc-800">
        <div className="text-center space-y-1 px-6">
          <FileJson className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-white font-medium">No response yet</p>
          <p className="text-sm text-zinc-400">
            Enter a URL and hit Send to see status, timing, and body here.
          </p>
        </div>
      </div>
    );
  }

  const formattedBody = response.body ? prettyJson(response.body) : "";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border-t border-zinc-800">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 mr-1">
          Response
        </span>

        {response.error ? (
          <Badge variant="error">Error</Badge>
        ) : (
          <Badge variant={statusVariant(response.status)}>
            {response.status} {response.statusText}
          </Badge>
        )}

        <Badge variant="outline" className="gap-1.5">
          <Clock className="h-3 w-3" />
          {formatDuration(response.timeMs)}
        </Badge>

        {!response.error && (
          <Badge variant="outline" className="gap-1.5">
            <HardDrive className="h-3 w-3" />
            {formatBytes(response.sizeBytes)}
          </Badge>
        )}
      </div>

      {response.error ? (
        <div className="flex-1 p-4 overflow-auto">
          <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap break-words">
            {response.error}
          </pre>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-3">
          <Tabs
            value={responseTab}
            onValueChange={(v) => setResponseTab(v as "body" | "headers")}
            className="flex-1 min-h-0"
          >
            <TabsList>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="flex-1 min-h-0 overflow-auto">
              <pre className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-[13px] leading-relaxed text-white font-mono whitespace-pre-wrap break-words min-h-[120px]">
                {formattedBody || (
                  <span className="text-zinc-500">Empty body</span>
                )}
              </pre>
            </TabsContent>

            <TabsContent
              value="headers"
              className="flex-1 min-h-0 overflow-auto"
            >
              <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2 font-medium">Key</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(response.headers).length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-4 text-zinc-500 text-center"
                        >
                          No response headers
                        </td>
                      </tr>
                    ) : (
                      Object.entries(response.headers).map(([key, value]) => (
                        <tr
                          key={key}
                          className="border-b border-zinc-800/80 last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-300 align-top whitespace-nowrap">
                            {key}
                          </td>
                          <td className="px-3 py-2 font-mono text-white break-all">
                            {value}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
