---
name: upload-preview
description: Publish or replace this repository's static review HTML over SSH/SCP and verify its public HTTPS copy. Use for preview publication and approved marker removal after review.
---

# Upload a review preview

Use [ADR 0003](../../../docs/adr/0003-previews-are-public-and-short-lived.md) for the preview lifecycle and [README](../../../README.md#capture-the-review-page) for capture commands.

## Destination and approval

Read the operator's local hosting notes or the current conversation for the SSH target, absolute remote HTML filename, and public HTTPS URL. Do not infer a destination from DNS alone. Keep machine addresses, SSH configuration and credentials in local notes outside the public repository. Ask only for missing values.

Before either first publication or marker-removal replacement, obtain approval for that action: identify the file, URL, public contents and rollback option. Earlier approval for creating a repo, preparing nginx, or publishing the marked preview does not approve marker removal. Honor approval already given for the same operation.

Use the existing web server and document directory. Changing nginx, DNS, certificates or services is a separate task, not part of this upload.

## Prepare the file

1. Run the local service and capture the requested digest with the repository's capture command. Keep generated HTML outside Git. Check its sample data, banner and absence of unexpected scripts or external resources.
2. For cleanup, first confirm the reviewer has looked and responded. Stop the old local process before starting it with an empty `LANE_MARKER` environment value, which overrides `.env`. Capture again; confirm the issued marker is absent and the banner says `no marker set`. Compare with the reviewed copy: only the banner should change unless additional changes were approved. Do not remove the banner by editing the HTML directly.
3. If replacing an existing file, keep the last verified copy locally outside Git for recovery. Restoring a marked copy after cleanup would republish the marker and needs its own approval.

## Upload and verify

Populate these shell variables from the approved destination and private local files:

- `preview_file`: absolute path to the prepared HTML.
- `preview_ssh`: SSH alias or `user@host`, using existing trusted SSH configuration.
- `preview_remote_file`: absolute path to the site's HTML file, including its filename.
- `preview_url`: exact public HTTPS URL used for review; keep it unchanged for cleanup.
- `preview_check_dir`: local directory outside Git for verification output.

The SCP destination below assumes an SSH alias/user/host and an absolute remote path without whitespace or shell metacharacters. Inspect the values; stop for a different transfer method if that assumption does not hold. Never disable host-key or HTTPS certificate checks.

Run after approval, in a shell that stops on errors:

```bash
set -e
: "${preview_file:?}" "${preview_ssh:?}" "${preview_remote_file:?}"
: "${preview_url:?}" "${preview_check_dir:?}"
test -f "$preview_file"
mkdir -p "$preview_check_dir"
scp -o BatchMode=yes -o StrictHostKeyChecking=yes   "$preview_file" "${preview_ssh}:${preview_remote_file}"
curl --fail --silent --show-error --connect-timeout 10 --max-time 30   --dump-header "$preview_check_dir/headers.txt"   --output "$preview_check_dir/public.html" "$preview_url"
cmp "$preview_file" "$preview_check_dir/public.html"
sha256sum "$preview_file" "$preview_check_dir/public.html"
```

Require HTTP 200, HTML content type, and identical bytes. A redirect or different page is not success. On cleanup, also check the fetched public copy for absence of the actual marker, without printing it. Check access from outside the home network when possible; an SSH session on another operator-owned host can make a read-only HTTPS request. No nginx reload is needed to replace a static file.

If transfer or verification fails, report the observed state and inspect it before another write. Do not submit an unverified URL or close its issue. Keep exact upload/check results in local logs, not alongside public marker-bearing content.

## Completion

After first publication, send the verified URL to the reviewer and leave the review issue open. Wait as instructed; cleanup remains blocked until an explicit review response. After approved cleanup and verification, archive the plan with its issue links, record the worker completion, and submit the same URL when the course requests it. Course acceptance, not upload success, decides whether the challenge is solved.
