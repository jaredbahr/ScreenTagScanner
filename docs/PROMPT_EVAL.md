# Guarded prompt-test entry point (draft)

The deployed version 21 / 0.13.34 contains private `runPromptEval_`, which the
editor's Run menu did not offer. No paid evaluation ran. The existing approval
property remains set; no final counts summary or cleanup is confirmed. PR #48
records that deployment independently of this proposed fix.

This draft proposes public `runPromptEval` and the additional
`https://www.googleapis.com/auth/userinfo.email` scope. Jared approved preparing
the identity-scope design for review on October 31, not granting live permissions
or deploying it. No Google source, property or permission is changed by this PR.

## Caller boundary

Public Apps Script functions can also be called through `google.script.run`;
putting no button on the scanner does not make them editor-only. The wrapper
therefore checks both active and effective user identities before accessing the
approval property, lock, workbook, Drive or API. Both must be nonblank strings
and equal after trimming and case normalization. Blank, mismatched, malformed or
unavailable identities fail closed with a generic error; emails are never logged
or returned. Identity authorization failures also deny access.

For an anonymous execute-as-deployer web app, effective user alone identifies the
deployer and is **not** caller authentication. Another signed-in caller must not
pass merely because the script executes as the owner. A project editor manually
running as themselves, or the authenticated deployer calling the web app, may
pass this guard. It is an authorized-caller entry point, not strictly editor-only.

See Google's [server-function visibility documentation](https://developers.google.com/apps-script/guides/html/communication)
and [Session identity and scope documentation](https://developers.google.com/apps-script/reference/base/session).
Offline stubs test the decisions and ordering; they do not certify Google's live
identity availability or consent behavior.

## Evaluator behavior retained

After caller authorization, the unchanged private evaluator still requires
`PROMPT_EVAL_APPROVED=yes`, takes its existing user lock, and refuses inconsistent
resume state or existing finished results. Its 60-photo cap, batch/time limits,
saved case list, results persistence, counts summary and automatic cleanup are
unchanged. The wrapper neither catches evaluator errors nor retries work.
Production prompts, scanner admission limits and sheet-write rules are unchanged.

## Review and later operation

The existing release gate deliberately rejects this new scope with:
`OAuth scopes, access, runtime or manifest settings changed; explicit review is required.`
It is not bypassed or relaxed in this draft. Full offline regression results are
reported separately. Claude/user security and release review, approved permission
handling and a passing release gate remain required before any deployment.

Only after a separately approved deployment and identity/permission verification
should the operator select `runPromptEval` in the editor. Do not run it during
scanning. Follow the approved issue's paid-test instructions and budget, resume
only as instructed, and stop on errors or unexpected permission prompts. Never
delete state or results to force a retry. Do not put raw results, photos, real
identities, private identifiers or credentials in GitHub. No paid invocation or
live identity test is authorized by this draft, and phone QA remains unverified.
