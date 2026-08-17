import { RequestBar } from "@/components/RequestBar";
import { HeadersEditor } from "@/components/HeadersEditor";
import { BodyEditor } from "@/components/BodyEditor";
import { ResponsePanel } from "@/components/ResponsePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestStore } from "@/store/requestStore";

function App() {
  const activeTab = useRequestStore((s) => s.activeTab);
  const setActiveTab = useRequestStore((s) => s.setActiveTab);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Title bar area */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center">
            <span className="text-zinc-900 font-bold text-xs">AC</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">
              API Client
            </h1>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Postman-style desktop client · Tauri + React
            </p>
          </div>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">
          Ctrl/⌘ + Enter to send
        </div>
      </header>

      <RequestBar />

      {/* Request details + Response split */}
      <div className="flex-1 flex flex-col min-h-0">
        <section className="h-[42%] min-h-[200px] flex flex-col border-b border-zinc-800 bg-zinc-950">
          <div className="flex-1 min-h-0 p-3">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "headers" | "body")}
              className="h-full"
            >
              <TabsList>
                <TabsTrigger value="headers">Headers</TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
              </TabsList>
              <TabsContent value="headers" className="h-[calc(100%-2.5rem)]">
                <HeadersEditor />
              </TabsContent>
              <TabsContent value="body" className="h-[calc(100%-2.5rem)]">
                <BodyEditor />
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <ResponsePanel />
      </div>
    </div>
  );
}

export default App;
