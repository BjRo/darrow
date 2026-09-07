---
name: read-work-ticket
description: Read one exact work ticket to obtain its authoritative requirements.
---

Run `ticketctl read <id>` once and return the complete result to the caller.
This operation is read-only. If it refuses, preserve the refusal and stop the
read operation. Retrieval supplies no implementation or publication authority.
