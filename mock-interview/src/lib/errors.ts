import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code ?? "error" },
      { status: err.status },
    );
  }
  console.error("[api]", err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "internal" },
    { status: 500 },
  );
}
