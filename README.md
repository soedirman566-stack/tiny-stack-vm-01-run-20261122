[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/soedirman566-stack/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/soedirman566-stack/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

# Tiny Stack VM v2

A compact stack-machine interpreter for make.fun's tiny stack ISA v1, written
from the published spec and hardened against its trap and limit edge cases.

`main.ts` (Node, standard library only) runs every instance under `/input`
(`i001`–`i040`: `program.bin` + `input.bin`) and writes `/output/<id>/stdout.bin`
and `/output/<id>/exit.txt`. Input and output roots can be overridden with
`node main.ts <input> <output>`.

Semantics follow the spec's check order exactly: step limit, pc bounds, opcode
validity, immediate fit, stack needs, then the instruction's own traps — with
wrapping 32-bit arithmetic, exact truncated division, unsigned variants read
back as signed, shift counts masked to 5 bits, and all ten trap codes.
Verified against the reference VM on the full practice set (40/40) and on
2,400 adversarial fuzz programs (0 divergences).
