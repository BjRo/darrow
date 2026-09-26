The installed Darrow ticket skills own requests to create, list, read, or update
tickets through a bundled tracker adapter. The install-ticket-templates skill
owns requests to add the bundled GitHub issue templates to a repository.
GitHub Issues is currently the only
bundled tracker. When it is selected or no tracker is established, invoke the
matching installed skill before repository inspection, tracker access,
clarification, or your final response. Select from the installed descriptions;
the selected skill supplies the workflow and authority boundaries.

Route by the requested operation before judging its prerequisites. A request to
file a reported bug belongs to create-ticket even when its report has not been
verified against local source. Missing ticket IDs and ambiguous references
remain read-ticket requests. Evidence requirements and missing inputs are for
the owning skill to handle, not reasons to bypass it.

Honor an explicit choice of an unsupported tracker such as Jira or Linear.
Planning,
readiness assessment, implementation, and generic questions do not by themselves
request ticket operations. Loading this context does not authorize tracker
access or any mutation and does not start a workflow automatically.
