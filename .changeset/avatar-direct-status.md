---
"@rebase-ui/solid": patch
---

AvatarImage writes its loading status straight into the Avatar root signal instead of relaying it through an effect. The root and fallback now see each status change in the same flush, removing the one-flush lag that Solid reports as `EFFECT_RELAY_TEAR`.
