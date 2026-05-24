# Triage Labels

The skills speak in terms of five canonical triage roles. This repo follows the
label conventions established in the sibling repo `../nitimini` — a GitHub Project
label kanban (`status: *` flow) with an orthogonal `afk-ready` flag.

The kanban flow in nitimini is: `status: triage` → `status: ready` → `status: wip`
→ `status: staged` → Released. `afk-ready` is orthogonal to `status:*` and marks an
issue tight enough for autonomous-agent pickup.

| Canonical role     | Label(s) in this repo            | Meaning                                         |
| ------------------ | -------------------------------- | ----------------------------------------------- |
| `needs-triage`     | `status: triage`                 | New, needs scoping / maintainer must evaluate   |
| `needs-info`       | `status: blocked`                | Waiting on a dependency or decision (nearest fit — nitimini has no reporter-specific "needs info" label) |
| `ready-for-agent`  | `status: ready` + `afk-ready`    | Spec'd, awaiting pickup AND tight enough for an AFK agent |
| `ready-for-human`  | `status: ready` (no `afk-ready`) | Spec'd, awaiting pickup; requires human implementation |
| `wontfix`          | `wontfix`                        | Will not be actioned                            |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), apply the
corresponding label(s) from this table.

## Notes

- `ready-for-agent` vs `ready-for-human` differ only by the presence of `afk-ready`.
  Both carry `status: ready`. To promote a human-ready issue to agent-ready, add
  `afk-ready`; to demote, remove it.
- `needs-info` maps to `status: blocked` as the closest available state. nitimini has
  no label dedicated to "waiting on the reporter" — adjust this row if you add one.
- These labels must exist in the GitHub repo before they can be applied. None exist
  yet (the repo has no remote). Mirror nitimini's label set when you create it.
