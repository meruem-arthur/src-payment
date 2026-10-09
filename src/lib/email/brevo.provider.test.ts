import { afterEach, describe, expect, it, vi } from "vitest";
import { BrevoEmailProvider } from "./brevo.provider";

const input = { to: "ama@example.com", subject: "Receipt", body: "Hello", from: { email: "receipts@school.edu", name: "UMaT SRC" } };
const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => vi.unstubAllGlobals());

describe("BrevoEmailProvider", () => {
  it("posts the sender, recipient, text and a base64 PDF attachment with the api-key header", async () => {
    const fetchMock = respond(201, { messageId: "<1@x>" });
    vi.stubGlobal("fetch", fetchMock);
    const out = await new BrevoEmailProvider().send({ ...input, attachments: [{ filename: "REC-1.pdf", content: Buffer.from("%PDF-1") }] }, { apiKey: "k" });
    expect(out).toEqual({ success: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("k");
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: "UMaT SRC", email: "receipts@school.edu" }, to: [{ email: "ama@example.com" }], subject: "Receipt", textContent: "Hello",
      attachment: [{ name: "REC-1.pdf", content: Buffer.from("%PDF-1").toString("base64") }],
    });
  });
  it("omits the attachment field when there is none", async () => {
    const fetchMock = respond(201, {});
    vi.stubGlobal("fetch", fetchMock);
    await new BrevoEmailProvider().send(input, { apiKey: "k" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("attachment");
  });
  it("fails without calling Brevo when the key or sender is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await new BrevoEmailProvider().send(input, { apiKey: null })).error).toMatch(/API key/);
    expect((await new BrevoEmailProvider().send({ ...input, from: { email: "", name: "x" } }, { apiKey: "k" })).error).toMatch(/sender email/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports Brevo's error message", async () => {
    vi.stubGlobal("fetch", respond(400, { code: "invalid_parameter", message: "Sender is not valid" }));
    const out = await new BrevoEmailProvider().send(input, { apiKey: "k" });
    expect(out.success).toBe(false);
    expect(out.error).toContain("invalid_parameter: Sender is not valid");
  });
  it("explains the Authorised IPs rejection", async () => {
    vi.stubGlobal("fetch", respond(401, { code: "unauthorized", message: "We have detected you are using an unrecognised IP address 1.2.3.4." }));
    expect((await new BrevoEmailProvider().send(input, { apiKey: "k" })).error).toContain("Authorised IPs");
  });
  it("falls back to the HTTP status when the body isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 502 })));
    expect((await new BrevoEmailProvider().send(input, { apiKey: "k" })).error).toContain("HTTP 502");
  });
  it("turns a network failure into a failed result instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await new BrevoEmailProvider().send(input, { apiKey: "k" })).toEqual({ success: false, error: "Could not reach Brevo: boom" });
  });
});
