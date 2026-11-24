// Tiny stack VM for make.fun's tiny-stack-vm-01-run-20261122 bounty.
// Runs each /input/<id>/program.bin on its input.bin per the kit ISA
// (wrapping 32-bit ints, 256 stack, 256 words, 1e6 steps, 64KiB out,
// traps 2..11 as exit codes) and writes stdout.bin + exit.txt per id.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const P0 = [0, 0, 0, 1, 1, 2, 2, 3]; // pops, opcodes 0..7
const Q0 = [0, 1, 1, 0, 2, 2, 3, 3]; // pushes, opcodes 0..7

function run(p: Uint8Array, inp: Uint8Array) {
  const S = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const buf = new Uint8Array(65536);
  let sp = 0, cp = 0, used = 0, ip = 0, pc = 0, steps = 0;
  const n = p.length;
  const fin = (code: number) => ({ code, bytes: buf.slice(0, used) });
  for (;;) {
    if (steps === 1000000) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const op = p[pc];
    if (!(op < 8 || (op >= 16 && op <= 34) || (op >= 48 && op <= 52) || op === 64 || op === 65 || (op >= 80 && op <= 83))) return fin(5);
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + imm >= n) return fin(9);
    steps++;
    const nx = pc + 1 + imm;
    let pp: number, qq: number;
    if (op < 8) { pp = P0[op]; qq = Q0[op]; }
    else if (op <= 34) { pp = op === 23 || op === 27 ? 1 : 2; qq = 1; }
    else if (op <= 52) { pp = op === 49 || op === 50 ? 1 : 0; qq = 0; }
    else if (op <= 65) { pp = op === 64 ? 1 : 2; qq = op === 64 ? 1 : 0; }
    else { pp = op === 82 ? 0 : 1; qq = op === 82 ? 1 : 0; }
    if (sp < pp) return fin(2);
    if (sp - pp + qq > 256) return fin(3);
    pc = nx;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) { // binary ops
      const b = S[sp - 1], a = S[sp - 2];
      let r: number;
      switch (op) {
        case 16: r = (a + b) | 0; break;
        case 17: r = (a - b) | 0; break;
        case 18: r = Math.imul(a, b); break;
        case 19: if (!b) return fin(4); r = (a / b) | 0; break;
        case 20: if (!b) return fin(4); r = (a % b) | 0; break;
        case 21: if (!b) return fin(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
        case 22: if (!b) return fin(4); r = ((a >>> 0) % (b >>> 0)) | 0; break;
        case 24: r = a & b; break;
        case 25: r = a | b; break;
        case 26: r = a ^ b; break;
        case 28: r = a << (b & 31); break;
        case 29: r = a >> (b & 31); break;
        case 30: r = (a >>> (b & 31)) | 0; break;
        case 32: r = a === b ? 1 : 0; break;
        case 33: r = a < b ? 1 : 0; break;
        default: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
      }
      S[sp - 2] = r; sp--;
      continue;
    }
    switch (op) {
      case 0: return fin(0);
      case 1: S[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: S[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: S[sp] = S[sp - 1]; sp++; break;
      case 5: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; }
      case 6: S[sp] = S[sp - 2]; sp++; break;
      case 7: { const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; break; }
      case 23: S[sp - 1] = (-S[sp - 1]) | 0; break;
      case 27: S[sp - 1] = ~S[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let go = true;
        if (op !== 48) { const v = S[--sp]; go = op === 49 ? v === 0 : v !== 0; }
        if (go) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return fin(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (cp === 0) return fin(8);
        pc = C[--cp];
        break;
      case 64: {
        const a = S[sp - 1];
        if (a < 0 || a > 255) return fin(6);
        S[sp - 1] = M[a];
        break;
      }
      case 65: {
        const a = S[sp - 1];
        if (a < 0 || a > 255) return fin(6);
        M[a] = S[sp - 2]; sp -= 2;
        break;
      }
      case 80: {
        const s = String(S[sp - 1]);
        if (used + s.length > 65536) return fin(11);
        sp--;
        for (let i = 0; i < s.length; i++) buf[used++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (used + 1 > 65536) return fin(11);
        buf[used++] = S[--sp] & 255;
        break;
      case 82: S[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return fin(S[--sp] & 255);
    }
  }
}

for (const id of readdirSync(I).sort()) {
  const p = readFileSync(join(I, id, "program.bin"));
  let inp: Uint8Array = new Uint8Array(0);
  try { inp = readFileSync(join(I, id, "input.bin")); } catch { /* none */ }
  const r = run(p, inp);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "stdout.bin"), r.bytes);
  writeFileSync(join(O, id, "exit.txt"), r.code + "\n");
}
