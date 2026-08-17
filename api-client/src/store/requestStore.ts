import { create } from "zustand";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export interface HeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  sizeBytes: number;
  error?: string;
}

interface RequestState {
  method: HttpMethod;
  url: string;
  headers: HeaderRow[];
  body: string;
  activeTab: "headers" | "body";
  responseTab: "body" | "headers";
  loading: boolean;
  response: ResponseData | null;

  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setBody: (body: string) => void;
  setActiveTab: (tab: "headers" | "body") => void;
  setResponseTab: (tab: "body" | "headers") => void;
  addHeader: () => void;
  updateHeader: (id: string, patch: Partial<Omit<HeaderRow, "id">>) => void;
  removeHeader: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setResponse: (response: ResponseData | null) => void;
  clearResponse: () => void;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useRequestStore = create<RequestState>((set) => ({
  method: "GET",
  url: "https://jsonplaceholder.typicode.com/posts/1",
  headers: [
    {
      id: uid(),
      key: "Content-Type",
      value: "application/json",
      enabled: true,
    },
    {
      id: uid(),
      key: "Accept",
      value: "application/json",
      enabled: true,
    },
  ],
  body: '{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1\n}',
  activeTab: "headers",
  responseTab: "body",
  loading: false,
  response: null,

  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),
  setBody: (body) => set({ body }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  addHeader: () =>
    set((s) => ({
      headers: [...s.headers, { id: uid(), key: "", value: "", enabled: true }],
    })),

  updateHeader: (id, patch) =>
    set((s) => ({
      headers: s.headers.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    })),

  removeHeader: (id) =>
    set((s) => ({
      headers: s.headers.filter((h) => h.id !== id),
    })),

  setLoading: (loading) => set({ loading }),
  setResponse: (response) => set({ response }),
  clearResponse: () => set({ response: null }),
}));
