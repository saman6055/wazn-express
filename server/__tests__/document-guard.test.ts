import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import {
  currentDocumentNames,
  documentGuard,
  documentNamesFrom,
  forgetDocumentNames,
  resetDocumentGuard,
  uploadNameOf,
  type DocumentGuardDeps,
} from "./_core/documentGuard";

/**
 * The owner's decision (2026-09-11): a customer's passport, national ID and
 * contract are seen by signed-in staff and nobody else — not by a stranger
 * holding the link, and not by another customer.
 */

describe("the name a request or a stored link points at", () => {
  it("is compared in one form", () => {
    expect(uploadNameOf("/Pass1.JPG")).toBe("pass1.jpg");
    expect(uploadNameOf("/%50ass1.jpg")).toBe("pass1.jpg");
  });

  it("cannot be dressed up as another file", () => {
    expect(uploadNameOf("/./pass1.jpg")).toBe("pass1.jpg");
    expect(uploadNameOf("//pass1.jpg")).toBe("pass1.jpg");
    expect(uploadNameOf("/x/../pass1.jpg")).toBe("pass1.jpg");
    expect(uploadNameOf("/%2e/pass1.jpg")).toBe("pass1.jpg");
    expect(uploadNameOf("\\pass1.jpg")).toBe("pass1.jpg");
  });

  it("is nothing when it cannot be read", () => {
    expect(uploadNameOf("/%E0%A4%A")).toBeNull();
    expect(uploadNameOf("/")).toBeNull();
    expect(uploadNameOf("/a%00b.jpg")).toBeNull();
  });

  it("is taken from stored links that point into our folder, and only those", () => {
    const names = documentNamesFrom([
      "/uploads/Pass1.jpg",
      "https://wazn.example/uploads/id2.png?v=3",
      "https://storage.example/v1/documents/customer-5/passport-a1.jpg",
      null,
      "",
      42,
    ]);
    expect(Array.from(names).sort()).toEqual(["id2.png", "pass1.jpg"]);
  });
});

function fakeRequest(pathname: string, method = "GET"): Request {
  return { method, path: pathname } as unknown as Request;
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    ended: false,
    locals: {} as Record<string, unknown>,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return { res, headers };
}

async function ask(pathname: string, deps: DocumentGuardDeps, method = "GET") {
  const { res, headers } = fakeResponse();
  const next = vi.fn();
  await documentGuard(deps)(fakeRequest(pathname, method), res as unknown as Response, next as unknown as NextFunction);
  return { res, headers, next };
}

const DOCUMENTS = new Set(["pass1.jpg"]);

function as(viewer: { role: string; isCustomer?: boolean } | "nobody", names: Set<string> | null = DOCUMENTS) {
  const authenticate = vi.fn(async () => {
    if (viewer === "nobody") throw new Error("Invalid session");
    return viewer;
  });
  return { documentNames: async () => names, authenticate } satisfies DocumentGuardDeps;
}

describe("the uploads folder", () => {
  it("serves an ordinary photo to anybody, without asking who they are", async () => {
    const deps = as("nobody");
    const { next, res } = await ask("/parcel-photo.jpg", deps);
    expect(next).toHaveBeenCalledOnce();
    expect(res.ended).toBe(false);
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("answers a stranger asking for a passport as if the file did not exist", async () => {
    const { next, res, headers } = await ask("/pass1.jpg", as("nobody"));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(headers["cache-control"]).toBe("no-store");
  });

  it("refuses a signed-in customer too", async () => {
    const { next, res } = await ask("/PASS1.jpg", as({ role: "customer", isCustomer: true }));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it.each(["employee", "accountant", "admin", "super_admin", "auditor"])(
    "shows it to %s, and tells every cache not to keep it",
    async (role) => {
      const { next, res, headers } = await ask("/pass1.jpg", as({ role }));
      expect(next).toHaveBeenCalledOnce();
      expect(headers["cache-control"]).toBe("private, no-store");
      expect(res.locals.customerDocument).toBe(true);
    },
  );

  it("treats every file as a document while the database has never answered", async () => {
    expect((await ask("/parcel-photo.jpg", as("nobody", null))).res.statusCode).toBe(404);
    expect((await ask("/parcel-photo.jpg", as({ role: "employee" }, null))).next).toHaveBeenCalledOnce();
  });

  it("leaves other methods to whatever handles them", async () => {
    const deps = as("nobody");
    const { next } = await ask("/pass1.jpg", deps, "POST");
    expect(next).toHaveBeenCalledOnce();
    expect(deps.authenticate).not.toHaveBeenCalled();
  });
});

describe("the list of document names", () => {
  let dir: string;
  const previous = process.env.UPLOADS_DIR;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "wazn-docs-"));
    process.env.UPLOADS_DIR = dir;
    resetDocumentGuard();
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
    resetDocumentGuard();
  });

  it("is read once a minute, and again as soon as a document changes", async () => {
    const load = vi.fn(async () => ["/uploads/pass1.jpg"]);
    await currentDocumentNames(load);
    await currentDocumentNames(load);
    expect(load).toHaveBeenCalledTimes(1);

    forgetDocumentNames();
    await currentDocumentNames(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps protecting a document removed from its customer, across a restart", async () => {
    await currentDocumentNames(async () => ["/uploads/pass1.jpg"]);

    // The office removes the passport; the file stays on the disk. Then the
    // server restarts and forgets everything it held in memory.
    resetDocumentGuard();
    const names = await currentDocumentNames(async () => []);

    expect(names?.has("pass1.jpg")).toBe(true);
    expect(fs.existsSync(path.join(dir, ".document-names.json"))).toBe(true);
  });

  it("keeps the last list it had when the database stops answering", async () => {
    await currentDocumentNames(async () => ["/uploads/pass1.jpg"]);
    forgetDocumentNames();
    const names = await currentDocumentNames(async () => {
      throw new Error("connection lost");
    });
    expect(names?.has("pass1.jpg")).toBe(true);
  });
});
