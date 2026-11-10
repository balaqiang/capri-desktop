YOU ARE USING THE SKILL "senior-data-engineer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior Data Engineer

Production-grade data engineering skill for building scalable, reliable data systems.

## Table of Contents

1. [Trigger Phrases](#trigger-phrases)
2. [Quick Start](#quick-start)
3. [Workflows](#workflows)
4. [Architecture Decision Framework](#architecture-decision-framework)
5. [Tech Stack](#tech-stack)
6. [Reference Documentation](#reference-documentation)
7. [Troubleshooting](#troubleshooting)

---

## Trigger Phrases

Activate this skill when you see:

**Pipeline Design:**
- "Design a data pipeline for..."
- "Build an ETL/ELT process..."
- "How should I ingest data from..."
- "Set up data extraction from..."

**Architecture:**
- "Should I use batch or streaming?"
- "Lambda vs Kappa architecture"
- "How to handle late-arriving data"
- "Design a data lakehouse"

**Data Modeling:**
- "Create a dimensional model..."
- "Star schema vs snowflake"
- "Implement slowly changing dimensions"
- "Design a data vault"

**Data Quality:**
- "Add data validation to..."
- "Set up data quality checks"
- "Monitor data freshness"
- "Implement data contracts"

**Performance:**
- "Optimize this Spark job"
- "Query is running slow"
- "Reduce pipeline execution time"
- "Tune Airflow DAG"

---

## Workflows

## Architecture Decision Framework

Use this framework to choose the right approach for your data pipeline.

### Batch vs Streaming

| Criteria | Batch | Streaming |
|----------|-------|-----------|
| **Latency requirement** | Hours to days | Seconds to minutes |
| **Data volume** | Large historical datasets | Continuous event streams |
| **Processing complexity** | Complex transformations, ML | Simple aggregations, filtering |
| **Cost sensitivity** | More cost-effective | Higher infrastructure cost |
| **Error handling** | Easier to reprocess | Requires careful design |

**Decision Tree:**
```
Is real-time insight required?
├── Yes → Use streaming
│   └── Is exactly-once semantics needed?
│       ├── Yes → Kafka + Flink/Spark Structured Streaming
│       └── No → Kafka + consumer groups
└── No → Use batch
    └── Is data volume > 1TB daily?
        ├── Yes → Spark/Databricks
        └── No → dbt + warehouse compute

### Lambda vs Kappa Architecture

| Aspect | Lambda | Kappa |
|--------|--------|-------|
| **Complexity** | Two codebases (batch + stream) | Single codebase |
| **Maintenance** | Higher (sync batch/stream logic) | Lower |
| **Reprocessing** | Native batch layer | Replay from source |
| **Use case** | ML training + real-time serving | Pure event-driven |

**When to choose Lambda:**
- Need to train ML models on historical data
- Complex batch transformations not feasible in streaming
- Existing batch infrastructure

**When to choose Kappa:**
- Event-sourced architecture
- All processing can be expressed as stream operations
- Starting fresh without legacy systems

### Data Warehouse vs Data Lakehouse

| Feature | Warehouse (Snowflake/BigQuery) | Lakehouse (Delta/Iceberg) |
|---------|-------------------------------|---------------------------|
| **Best for** | BI, SQL analytics | ML, unstructured data |
| **Storage cost** | Higher (proprietary format) | Lower (open formats) |
| **Flexibility** | Schema-on-write | Schema-on-read |
| **Performance** | Excellent for SQL | Good, improving |
| **Ecosystem** | Mature BI tools | Growing ML tooling |

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Languages** | Python, SQL, Scala |
| **Orchestration** | Airflow, Prefect, Dagster |
| **Transformation** | dbt, Spark, Flink |
| **Streaming** | Kafka, Kinesis, Pub/Sub |
| **Storage** | S3, GCS, Delta Lake, Iceberg |
| **Warehouses** | Snowflake, BigQuery, Redshift, Databricks |
| **Quality** | Great Expectations, dbt tests, Monte Carlo |
| **Monitoring** | Prometheus, Grafana, Datadog |

---

## Troubleshooting
