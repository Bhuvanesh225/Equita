/**
 * A stand-in for `node:crypto` inside the browser demo.
 *
 * The demo database never leaves this browser, so the password hash only has to
 * be deterministic and consistent between the seed and the sign-in form. It is
 * deliberately not presented as a production password scheme.
 */

function mix(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomBytes(size: number) {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    let state = mix(String(Date.now()));
    for (let i = 0; i < size; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      bytes[i] = state & 0xff;
    }
  }
  return {
    toString(encoding: string) {
      if (encoding === "hex") return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return String.fromCharCode(...bytes);
    },
  };
}

export function scryptSync(password: string, salt: string, length: number) {
  const output = new Uint8Array(length);
  let state = mix(`${salt}\u0000${password}`);
  let carry = mix(`${password}\u0000${salt}`);
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + (carry ^ 1013904223)) >>> 0;
    carry = (carry ^ (state >>> 11)) >>> 0;
    output[i] = (state >>> 16) & 0xff;
  }
  Object.defineProperty(output, "toString", {
    value(encoding?: string) {
      if (encoding === "hex") return [...output].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      return [...output].join(",");
    },
  });
  return output;
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export default { randomBytes, scryptSync, timingSafeEqual };

