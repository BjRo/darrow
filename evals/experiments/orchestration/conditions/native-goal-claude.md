/goal Complete the engineering task below using Claude Code's native goal mode. Let the native goal mechanism manage persistence and completion, but do not invoke Darrow orchestration skills or manually spawn child/subagents. Do not commit or publish changes. Require implemented behavior, focused tests, and a final-diff self-review before declaring the goal complete.

At the very end of the final response, after the normal implementation summary, emit these two tab-separated records exactly, using integer counts. Count any model invocation performed by native goal mode beyond this top-level invocation as a child invocation. A human intervention means the run stopped to obtain a decision or missing authority from a person.

evaluation_child_invocations <integer>
evaluation_human_interruptions <integer>
