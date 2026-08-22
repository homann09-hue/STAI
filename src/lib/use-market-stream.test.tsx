// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNormalizedQuote } from "@/lib/canonical-quote";
import { useMarketStream } from "@/lib/use-market-stream";

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Listener[]>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = listener as unknown as Listener;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const canonicalId = "stock:xnas:aapl:usd";
const quote = buildNormalizedQuote({
  canonicalId,
  instrumentId: canonicalId,
  symbol: "AAPL",
  assetType: "stock",
  providerId: "test",
  providerSymbol: "AAPL",
  venue: "XNAS",
  currency: "USD",
  price: 200,
  provider: "Test Provider",
  quality: "delayed",
  marketStatus: "closed",
  timestamp: "2026-08-22T10:00:00.000Z",
});

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useMarketStream canonical identity", () => {
  it("uses canonical IDs for SSE and indexes quotes by listing", async () => {
    const { result } = renderHook(() => useMarketStream({ canonicalIds: [canonicalId] }));
    const source = FakeEventSource.instances[0];
    expect(source.url).toBe("/api/market/stream?canonicalIds=stock%3Axnas%3Aaapl%3Ausd");

    act(() => {
      source.emit("status", { provider: "Test Provider", identityMode: "canonical" });
      source.emit("quotes", { provider: "Test Provider", identityMode: "canonical", quotes: [quote] });
    });
    await waitFor(() => expect(result.current.quotes[canonicalId]).toBeDefined());

    expect(result.current.provider).toBe("Test Provider");
    expect(result.current.quotes[canonicalId]).toMatchObject({ canonicalId, symbol: "AAPL" });
    expect(result.current.quotes.AAPL).toBeUndefined();
  });

  it("rejects an SSE identity downgrade and polls with the same canonical selector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      provider: "Test Provider",
      identityMode: "canonical",
      quotes: [quote],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMarketStream({ canonicalIds: [canonicalId] }));
    const source = FakeEventSource.instances[0];

    await act(async () => {
      source.emit("status", { provider: "Wrong Mode", identityMode: "legacy_symbol" });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.quotes[canonicalId]).toBeDefined());

    expect(source.closed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/quotes?canonicalIds=stock%3Axnas%3Aaapl%3Ausd",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.current.refreshMode).toBe("polling");
    expect(result.current.quotes[canonicalId]).toMatchObject({ canonicalId });
  });
});
