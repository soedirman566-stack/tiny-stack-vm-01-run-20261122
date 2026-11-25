// Tiny stack VM for make.fun's tiny stack ISA v1, written from the spec.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function run(P: Uint8Array, I: Uint8Array): { o: Uint8Array; e: number } {
  const S = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const O = new Uint8Array(65536);
  const n = P.length;
  let sp = 0, cp = 0, pc = 0, ol = 0, ip = 0, st = 0;
  const done = (e: number) => ({ o: O.subarray(0, ol), e });
  for (;;) {
    if (st >= 1_000_000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = P[pc];
    st++;
    switch (op) {
      case 0x00: return done(0);
      case 0x01:
        if (pc + 2 > n) return done(9);
        if (sp >= 256) return done(3);
        S[sp++] = (P[pc + 1] << 24) >> 24; pc += 2; break;
      case 0x02:
        if (pc + 5 > n) return done(9);
        if (sp >= 256) return done(3);
        S[sp++] = P[pc + 1] | (P[pc + 2] << 8) | (P[pc + 3] << 16) | (P[pc + 4] << 24);
        pc += 5; break;
      case 0x03:
        if (sp < 1) return done(2);
        sp--; pc++; break;
      case 0x04:
        if (sp < 1) return done(2);
        if (sp >= 256) return done(3);
        S[sp] = S[sp - 1]; sp++; pc++; break;
      case 0x05: {
        if (sp < 2) return done(2);
        const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; pc++; break;
      }
      case 0x06:
        if (sp < 2) return done(2);
        if (sp >= 256) return done(3);
        S[sp] = S[sp - 2]; sp++; pc++; break;
      case 0x07: {
        if (sp < 3) return done(2);
        const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a;
        pc++; break;
      }
      case 0x17:
        if (sp < 1) return done(2);
        S[sp - 1] = -S[sp - 1]; pc++; break;
      case 0x1b:
        if (sp < 1) return done(2);
        S[sp - 1] = ~S[sp - 1]; pc++; break;
      case 0x30: case 0x31: case 0x32: {
        if (pc + 3 > n) return done(9);
        const off = ((P[pc + 1] | (P[pc + 2] << 8)) << 16) >> 16;
        if (op === 0x30) { pc = pc + 3 + off; break; }
        if (sp < 1) return done(2);
        const v = S[--sp];
        pc = (op === 0x31 ? v === 0 : v !== 0) ? pc + 3 + off : pc + 3; break;
      }
      case 0x33: {
        if (pc + 3 > n) return done(9);
        if (cp >= 64) return done(7);
        const t = P[pc + 1] | (P[pc + 2] << 8);
        C[cp++] = pc + 3; pc = t; break;
      }
      case 0x34:
        if (cp === 0) return done(8);
        pc = C[--cp]; break;
      case 0x40: {
        if (sp < 1) return done(2);
        const a = S[sp - 1];
        if (a < 0 || a > 255) return done(6);
        S[sp - 1] = M[a]; pc++; break;
      }
      case 0x41: {
        if (sp < 2) return done(2);
        const a = S[sp - 1];
        if (a < 0 || a > 255) return done(6);
        M[a] = S[sp - 2]; sp -= 2; pc++; break;
      }
      case 0x50: {
        if (sp < 1) return done(2);
        const s = String(S[--sp]);
        if (ol + s.length > 65536) return done(11);
        for (let i = 0; i < s.length; i++) O[ol++] = s.charCodeAt(i);
        pc++; break;
      }
      case 0x51:
        if (sp < 1) return done(2);
        if (ol >= 65536) return done(11);
        O[ol++] = S[--sp] & 255; pc++; break;
      case 0x52:
        if (sp >= 256) return done(3);
        S[sp++] = ip < I.length ? I[ip++] : -1; pc++; break;
      case 0x53:
        if (sp < 1) return done(2);
        return done(S[--sp] & 255);
      default: {
        if (!((op >= 0x10 && op <= 0x1e) || (op >= 0x20 && op <= 0x22))) return done(5);
        if (sp < 2) return done(2);
        const b = S[--sp], a = S[sp - 1];
        let r: number;
        switch (op) {
          case 0x10: r = a + b; break;
          case 0x11: r = a - b; break;
          case 0x12: r = Math.imul(a, b); break;
          case 0x13: if (b === 0) return done(4); r = (a - (a % b)) / b; break;
          case 0x14: if (b === 0) return done(4); r = a % b; break;
          case 0x15: {
            if (b === 0) return done(4);
            const u = a >>> 0, v = b >>> 0;
            r = (u - (u % v)) / v; break;
          }
          case 0x16: if (b === 0) return done(4); r = (a >>> 0) % (b >>> 0); break;
          case 0x18: r = a & b; break;
          case 0x19: r = a | b; break;
          case 0x1a: r = a ^ b; break;
          case 0x1c: r = a << (b & 31); break;
          case 0x1d: r = a >> (b & 31); break;
          case 0x1e: r = a >>> (b & 31); break;
          case 0x20: r = a === b ? 1 : 0; break;
          case 0x21: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
        }
        S[sp - 1] = r; pc++; break;
      }
    }
  }
}

const IN = process.argv[2] ?? "/input";
const OUT = process.argv[3] ?? "/output";
for (const id of readdirSync(IN).filter((x) => /^i\d{3}$/.test(x)).sort()) {
  const P = readFileSync(join(IN, id, "program.bin"));
  let I: Uint8Array = new Uint8Array(0);
  try { I = readFileSync(join(IN, id, "input.bin")); } catch {}
  const r = run(P, I);
  const d = join(OUT, id);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "stdout.bin"), r.o);
  writeFileSync(join(d, "exit.txt"), r.e + "\n");
}
