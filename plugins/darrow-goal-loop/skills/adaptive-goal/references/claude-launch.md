# Claude native-goal launch

Use a same-thread boundary only when the current Claude surface exposes it.

## Same thread

When the current Claude surface exposes native goal control to the agent, read
its concrete active route and require `confirm-route` to accept the selected and
effective routes before setting the compiled contract as the current thread's
goal. Record `same_thread`, `current-thread`, verified true, and zero children.

Do not treat a `claude` executable on `PATH` as evidence of same-thread control.

**Complete when:** the current thread reports the contract as its active native
goal and the selected route is effective.

## Enclosing launcher

An external client that performed preflight before starting Claude may invoke
one native `/goal` session with:

```sh
bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider "$provider" \
  --model "$model" --effort "$effort" --allow-nested
```

This boundary is not available to a skill already running inside Claude:
recursive Claude processes may not inherit the active session's authentication
or control state. `--allow-nested` must reflect explicit user authorization; it
is never inferred from route mismatch. An enclosing launcher records
`nested_session` and one child, waits for the result, and removes the temporary
contract.

**Complete when:** the external launcher—not an active Claude agent—owns the one
session and its authentication is proven before product work begins.

## Unavailable launch

When the active Claude surface exposes no same-thread goal control, preserve the
compiled contract, record `launch_required`, name that missing capability, and
stop without editing product files. Do not probe a recursive `claude` process
with a paid model call.

**Complete when:** the user has one exact external launch action rather than a
simulated or unauthenticated goal run.
