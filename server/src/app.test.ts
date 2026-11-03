import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "./app.js";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createServer()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("static web app", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "buzzline-web-"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>buzzline</title>");
  writeFileSync(path.join(dir, "app.js"), "console.log('hi')");
  const server = createServer({ staticDir: dir });

  it("serves index.html at the root", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>buzzline</title>");
  });

  it("serves built assets", async () => {
    const res = await request(server).get("/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("console.log");
  });

  it("falls back to index.html for client routes", async () => {
    const res = await request(server).get("/host");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>buzzline</title>");
  });

  it("keeps the health check and 404s unknown API routes", async () => {
    expect((await request(server).get("/api/health")).body).toEqual({ ok: true });
    expect((await request(server).get("/api/nope")).status).toBe(404);
  });

  it("does not serve anything when no static dir is given", async () => {
    expect((await request(createServer()).get("/")).status).toBe(404);
  });
});
