YOU ARE USING THE SKILL "i18n-localization" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# i18n Localization

> **Portability:** 3 stdlib Python scripts. No network, no translation service.
> They check and generate files; they never translate text or call an API.

A release with a new language usually breaks in the same places: keys added in
English and never synced, a placeholder renamed by a translator, Russian or
Arabic files that copied English's two plural forms, UI text that never went
through `t()`, and dates formatted in the server's locale. This skill makes each
of those a check that fails before the release, not a bug report after it.

## Workflow

**Step 1** reads JSON/ARB (i18next or ICU), `.properties`, Apple `.strings`,
Android `strings.xml` and gettext `.po`, pairs each target with the source file of
the same namespace, and blocks on missing or empty keys, changed placeholders,
ICU syntax errors, plural/select without `other`, a `zero` branch that can never
match, and plural categories the target locale needs (ru `few`/`many`, ar six
forms), using the embedded CLDR 49 table. Untranslated values, orphan keys,
fuzzy entries and markup drift are warnings.

**Step 2** blocks on literal text between tags and literal user-facing
attributes (`placeholder`, `alt`, `aria-label`, `title`...), and warns on
literals rendered from `{cond ? 'Saving...' : ...}`, `t('a') + x` concatenation,
`toLocaleString()` with no locale, `'$' + amount` and hardcoded date patterns.
It is a text heuristic: read each finding. Use `--warn-only` to adopt it on a
legacy codebase, `i18n-ignore` on a line, and `.i18n-allow` for brand names.

**Step 3** accents, pads (by translation-growth rates) and brackets every string
while keeping placeholders and ICU syntax intact. Plain English on screen is a
hardcoded string; a cut-off `[ [...` is truncation; `[ [a] ] [ [b] ]` is concatenation.

## Hard rules

- **Never concatenate translated fragments.** One message per sentence, with named placeholders and a plural branch.
- **Plural forms follow CLDR for the target locale**, not English. Never copy `_one`/`_other` into ru, pl, uk, cs, ar, he files and call them done.
- **`=0`, not `zero`,** for an empty-count message in ICU.
- **Pass the locale to every formatter.** Currency comes from the data, not the UI locale.
- **Placeholders are code.** A translator may move them, never rename or drop them; use positional `%1$s` where order can change.
- **Do not machine-translate to make the checker pass.** A missing translation falls back to the source language; a wrong one ships silently. Mark gaps for a translator instead.
