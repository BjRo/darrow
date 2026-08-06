# Repair protocol

Use this branch only after a validated verifier result contains actionable,
structured findings. A finding includes severity, location or command,
violated criterion, and concrete evidence.

1. Create one repair packet with `packet-create`. Supply the original executor
   packet through `--original-packet`, the verifier's absolute final diff
   through `--diff`, and every structured finding through repeated
   `--finding` arguments. Preserve the original objective, criteria, scope,
   non-goals, authority, gates, and repair limit.
2. Give the fresh repair executor only that packet, the repair role instruction
   from `child-protocol.md`, and the result format. Do not pass the verifier's
   hidden reasoning, transcript, or broader context.
3. Start the repair only after the initial executor and verifier have ended; it
   is now the sole writer. Normalize and validate its result.
4. Capture a new unique snapshot and final diff, rerun or confirm every
   applicable gate on that tree, and invoke a fresh verifier. Audit the
   verifier's read-only boundary with another matching snapshot.
5. Treat the prior verdict as invalid. Only the re-verifier can establish the
   final verification state.

If re-verification fails, end as `failed`, `blocked`, or `needs_human` from the
evidence. Never start a second repair.

**Complete when:** `repair_count` is exactly one, the repaired tree has fresh
gate and verifier evidence, and the run either passes or stops without another
writer.
