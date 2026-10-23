/**
 * The two Node globals the server modules touch.
 *
 * The demo runs the real route handlers and engines in the browser, so the
 * handful of Node primitives they reach for have to exist before those modules
 * are evaluated. Nothing here is used by the server build.
 */

const scope = globalThis as unknown as {
  process?: { env: Record<string, string | undefined>; argv: string[] };
  Buffer?: {
    from(input: string, encoding?: string): Uint8Array;
    isBuffer(value: unknown): boolean;
  };
};

if (!scope.process) {
  scope.process = { env: {}, argv: [] };
}

if (!scope.Buffer) {
  scope.Buffer = {
    from(input: string, encoding?: string) {
      if (encoding === "hex") {
        const clean = input.length % 2 === 0 ? input : `0${input}`;
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
        }
        return bytes;
      }
      if (encoding === "base64") {
        const binary = atob(input);
        return Uint8Array.from(binary, (letter) => letter.charCodeAt(0));
      }
      return new TextEncoder().encode(input);
    },
    isBuffer(value: unknown) {
      return value instanceof Uint8Array;
    },
  };
}
