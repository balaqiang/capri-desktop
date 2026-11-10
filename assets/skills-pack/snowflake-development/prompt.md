YOU ARE USING THE SKILL "snowflake-development" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Snowflake Development

Snowflake SQL, data pipelines, Cortex AI, and Snowpark Python development. Covers the colon-prefix rule, semi-structured data, MERGE upserts, Dynamic Tables, Streams+Tasks, Cortex AI functions, agent specs, performance tuning, and security hardening.

> Originally contributed by [James Cha-Earley](https://github.com/jamescha-earley) — enhanced and integrated by the claude-skills team.

## SQL Best Practices

### Naming and Style

- Use `snake_case` for all identifiers. Avoid double-quoted identifiers -- they force case-sensitive names that require constant quoting.
- Use CTEs (`WITH` clauses) over nested subqueries.
- Use `CREATE OR REPLACE` for idempotent DDL.
- Use explicit column lists -- never `SELECT *` in production. Snowflake's columnar storage scans only referenced columns, so explicit lists reduce I/O.

### Stored Procedures -- Colon Prefix Rule

In SQL stored procedures (BEGIN...END blocks), variables and parameters **must** use the colon `:` prefix inside SQL statements. Without it, Snowflake treats them as column identifiers and raises "invalid identifier" errors.

```sql
-- WRONG: missing colon prefix
SELECT name INTO result FROM users WHERE id = p_id;

-- CORRECT: colon prefix on both variable and parameter
SELECT name INTO :result FROM users WHERE id = :p_id;

This applies to DECLARE variables, LET variables, and procedure parameters when used inside SELECT, INSERT, UPDATE, DELETE, or MERGE.

### Semi-Structured Data

- VARIANT, OBJECT, ARRAY for JSON/Avro/Parquet/ORC.
- Access nested fields: `src:customer.name::STRING`. Always cast with `::TYPE`.
- VARIANT null vs SQL NULL: JSON `null` is stored as the string `"null"`. Use `STRIP_NULL_VALUE = TRUE` on load.
- Flatten arrays: `SELECT f.value:name::STRING FROM my_table, LATERAL FLATTEN(input => src:items) f;`

### MERGE for Upserts

```sql
MERGE INTO target t USING source s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET t.name = s.name, t.updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (id, name, updated_at) VALUES (s.id, s.name, CURRENT_TIMESTAMP());

---

## Data Pipelines

### Choosing Your Approach

| Approach | When to Use |
|----------|-------------|
| Dynamic Tables | Declarative transformations. **Default choice.** Define the query, Snowflake handles refresh. |
| Streams + Tasks | Imperative CDC. Use for procedural logic, stored procedure calls, complex branching. |
| Snowpipe | Continuous file loading from cloud storage (S3, GCS, Azure). |

### Dynamic Tables

```sql
CREATE OR REPLACE DYNAMIC TABLE cleaned_events
    TARGET_LAG = '5 minutes'
    WAREHOUSE = transform_wh
    AS
    SELECT event_id, event_type, user_id, event_timestamp
    FROM raw_events
    WHERE event_type IS NOT NULL;

Key rules:
- Set `TARGET_LAG` progressively: tighter at the top of the DAG, looser downstream.
- Incremental DTs cannot depend on Full-refresh DTs.
- `SELECT *` breaks on upstream schema changes -- use explicit column lists.
- Views cannot sit between two Dynamic Tables in the DAG.

### Streams and Tasks

```sql
CREATE OR REPLACE STREAM raw_stream ON TABLE raw_events;

CREATE OR REPLACE TASK process_events
    WAREHOUSE = transform_wh
    SCHEDULE = 'USING CRON 0 */1 * * * America/Los_Angeles'
    WHEN SYSTEM$STREAM_HAS_DATA('raw_stream')
    AS INSERT INTO cleaned_events SELECT ... FROM raw_stream;

-- Tasks start SUSPENDED. You MUST resume them.
ALTER TASK process_events RESUME;

---

## Cortex AI

### Function Reference

| Function | Purpose |
|----------|---------|
| `AI_COMPLETE` | LLM completion (text, images, documents) |
| `AI_CLASSIFY` | Classify text into categories (up to 500 labels) |
| `AI_FILTER` | Boolean filter on text or images |
| `AI_EXTRACT` | Structured extraction from text/images/documents |
| `AI_SENTIMENT` | Sentiment score (-1 to 1) |
| `AI_PARSE_DOCUMENT` | OCR or layout extraction from documents |
| `AI_REDACT` | PII removal from text |

**Deprecated names (do NOT use):** `COMPLETE`, `CLASSIFY_TEXT`, `EXTRACT_ANSWER`, `PARSE_DOCUMENT`, `SUMMARIZE`, `TRANSLATE`, `SENTIMENT`, `EMBED_TEXT_768`.

### TO_FILE -- Common Pitfall

Stage path and filename are **separate** arguments:

```sql
-- WRONG: single combined argument
TO_FILE('@stage/file.pdf')

-- CORRECT: two arguments
TO_FILE('@db.schema.mystage', 'invoice.pdf')

### Cortex Agents

Agent specs use a JSON structure with top-level keys: `models`, `instructions`, `tools`, `tool_resources`.

- Use `$spec$` delimiter (not `$$`).
- `models` must be an object, not an array.
- `tool_resources` is a separate top-level key, not nested inside `tools`.
- Tool descriptions are the single biggest factor in agent quality.

---

## Snowpark Python

- Never hardcode credentials. Use environment variables or key pair auth.
- DataFrames are lazy -- executed on `collect()` / `show()`.
- Do NOT call `collect()` on large DataFrames. Process server-side with DataFrame operations.
- Use **vectorized UDFs** (10-100x faster) for batch and ML workloads.

## dbt on Snowflake

```sql
-- Dynamic table materialization (streaming/near-real-time marts):
{{ config(materialized='dynamic_table', snowflake_warehouse='transforming', target_lag='1 hour') }}

-- Incremental materialization (large fact tables):
{{ config(materialized='incremental', unique_key='event_id') }}

-- Snowflake-specific configs (combine with any materialization):
{{ config(transient=true, copy_grants=true, query_tag='team_daily') }}

- Do NOT use `{{ this }}` without `{% if is_incremental() %}` guard.
- Use `dynamic_table` materialization for streaming or near-real-time marts.
