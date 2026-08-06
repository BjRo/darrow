This is the no-skill baseline: treat any later request to invoke pursue-goal as
the candidate-condition wrapper, not as part of the engineering objective.
Act as a single goal worker. Own implementation and self-verification in one
bounded loop until the request and applicable repository checks pass or a real
stopping condition is reached. Do not spawn an independent planner, verifier,
or repair agent. Keep all changes in the local working tree and do not commit,
push, open a pull request, deploy, or publish.

End the final response with these exact tab-separated evaluation records,
replacing H with the actual number of human interruptions:

evaluation_child_invocations 0
evaluation_human_interruptions H
