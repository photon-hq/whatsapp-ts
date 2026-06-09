import { describe, expect, test } from "bun:test";
import type { Metadata } from "nice-grpc-common";
import { authMiddleware } from "../../src/transport/metadata.ts";

describe("auth middleware", () => {
  test("injects bearer authorization metadata", async () => {
    const middleware = authMiddleware("secret-token");
    const calls: Array<Metadata | undefined> = [];

    const call = {
      method: {
        path: "/photon.whatsapp.v1.MessageService/SendTextMessage",
      },
      request: { hello: "world" },
      async *next(_request: unknown, options: { metadata?: Metadata }) {
        calls.push(options.metadata);
        yield undefined;
      },
    };

    for await (const _ of middleware(call as never, {} as never)) {
      // no-op
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]?.get("authorization")).toBe("Bearer secret-token");
  });
});
