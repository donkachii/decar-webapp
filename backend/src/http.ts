// HTTP plumbing shared by the routers: errors, request validation and query
// parameters. Error bodies keep the shape the clients already read:
// { "detail": "message" }, and 422 for anything that fails validation.

import type { ErrorRequestHandler, Request } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
    this.name = "HttpError";
  }
}

type Where = "body" | "query" | "path";

interface ValidationIssue {
  type: string;
  loc: (string | number)[];
  msg: string;
}

function invalid(issues: ValidationIssue[]): HttpError {
  return new HttpError(422, issues);
}

/** Parses a request part with a zod schema. A failure is a 422 listing what was wrong. */
export function parse<S extends z.ZodType>(schema: S, value: unknown, where: Where): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw invalid(
    result.error.issues.map((issue) => ({
      type: issue.code,
      loc: [where, ...issue.path.map((p) => (typeof p === "symbol" ? String(p) : p))],
      msg: issue.message,
    })),
  );
}

/** A string of at most `max` characters (counted as characters, not UTF-16 units). */
export function text(max: number) {
  return z.string().refine((value) => [...value].length <= max, `String should have at most ${max} characters`);
}

const TRUE = new Set(["1", "on", "t", "true", "y", "yes"]);
const FALSE = new Set(["0", "off", "f", "false", "n", "no"]);

/** A query flag: true/false, 1/0, yes/no, on/off. */
export const queryBool = z.string().transform((value, ctx) => {
  const lowered = value.toLowerCase();
  if (TRUE.has(lowered)) return true;
  if (FALSE.has(lowered)) return false;
  ctx.addIssue({ code: "custom", message: "Input should be a valid boolean" });
  return z.NEVER;
});

/** Every value of a repeated query parameter (?type=a&type=b), or undefined if absent. */
export function queryValues(req: Request, name: string): string[] | undefined {
  const raw = req.query[name];
  if (raw === undefined) return undefined;
  return (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === "string");
}

/** A single query parameter. Given twice, the last one wins. */
export function queryValue(req: Request, name: string): string | undefined {
  return queryValues(req, name)?.at(-1);
}

/** Canonical lowercase UUID from the usual spellings (hyphens or not, braces, urn:uuid:). */
export function parseUuid(raw: string): string | null {
  let value = raw;
  if (value.toLowerCase().startsWith("urn:uuid:")) value = value.slice(9);
  else if (value.startsWith("{") && value.endsWith("}")) value = value.slice(1, -1);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    value = value.replaceAll("-", "");
  }
  if (!/^[0-9a-f]{32}$/i.test(value)) return null;
  const h = value.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A UUID path parameter. Anything else is a 422, which the clients treat as "not found". */
export function pathUuid(req: Request, name: string): string {
  const raw = req.params[name];
  const id = typeof raw === "string" ? parseUuid(raw) : null;
  if (id === null) {
    throw invalid([{ type: "uuid_parsing", loc: ["path", name], msg: "Input should be a valid UUID" }]);
  }
  return id;
}

/** A path parameter as given (Express has already URL-decoded it). */
export function pathParam(req: Request, name: string): string {
  const raw = req.params[name];
  return typeof raw === "string" ? raw : "";
}

interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    "status" in error &&
    typeof error.status === "number"
  );
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ detail: error.detail });
    return;
  }
  if (isBodyParserError(error)) {
    if (error.type === "entity.parse.failed") {
      res.status(422).json({ detail: [{ type: "json_invalid", loc: ["body"], msg: "JSON decode error" }] });
    } else {
      res.status(error.status).json({ detail: error instanceof Error ? error.message : "Bad request" });
    }
    return;
  }
  console.error(error);
  res.status(500).json({ detail: "Internal Server Error" });
};
