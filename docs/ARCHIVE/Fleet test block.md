---
source:
status: pending
para:
context:
description:
Topics:
Concepts:
Meeting notes:
Permanent: false
type: note
word_count: 1
language: en
updated:
modified: 2026-10-30T08:57:24+00:00
---
---

```fish
set -l fleet csuite f01 f02 f03 f05a f08 f09 f11 f11-deepening f12 f13 f14 f15 props
set -l failed
for f in $fleet
    echo "=== $f ==="
    if not node src/fixtures/$f.ts
        set -a failed $f
    end
end
if test (count $failed) -eq 0
    echo "FLEET GREEN: all"(count $fleet)" suites"
else
    echo "FLEET RED: $failed"
end
```