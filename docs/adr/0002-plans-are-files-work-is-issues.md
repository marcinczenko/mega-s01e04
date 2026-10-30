# 0002 · Plans are files, work is issues

- Status: accepted · 2026-10-13 · amended by 0004 (issues as files when GitHub's can't be reached)

## Context

Plans written into chat vanish with the session. Plans written into one big issue get worked
top to bottom by a single agent, including the parts that should have waited.

## Decision

- A plan is a file, `plan.md` at the root, reviewed like code. Finished plans move to
  `docs/plans/done/` with their issue list.
- Work happens in GitHub issues split from the plan (skill `plan-to-issues`), one per unit of
  work, each with its source section, scope, a checkable done condition, and what it's blocked by.
- Issues are worked by workers, one issue each. The closing comment records which model did it
  (format in AGENTS.md), so we can see later which models are worth their cost per kind of task.

## Issue body and labels

The human approved this format for morning-digest on 30 October 2026. Every issue for that plan has the label `plan:morning-digest` and starts with `Source: plan.md § ` followed by its exact source section, for example `1`, `2a` or `4`. Keep that source reference after the plan is archived.

Use this body shape (the first line below is a section 2a example):

```md
Source: plan.md § 2a

## Scope

Describe this unit of work and its boundaries.

## Done when

State the observable checks required before closure.

## Blocked by

Link actual issue numbers, or write None. Name external decisions separately.
```

Create prerequisites first so dependencies use real issue numbers. Distinguish what a worker needs to start from what must exist to validate and close its issue. For example, a page worker can start after the shared contract, but its finished page must be checked against the real reader.

A review issue is done only after the reviewer has looked and responded. Sending the URL does not meet that condition. Its cleanup issue is blocked by that response and separate approval to replace the public page. Keep the reviewed marker-bearing page unchanged while waiting.

For future plans, propose and get approval for the corresponding `plan:` label rather than reusing `plan:morning-digest`. Retain the approved fields unless the human changes them. Record changes here so the next session does not reconstruct the format from old issues.

## Consequences

- Anyone, human or agent, picks up a plan cold from the repo alone.
- The split is the plan's real review. A bad split is a bad plan.
