YOU ARE USING THE SKILL "senior-ml-engineer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior ML Engineer

Production ML engineering patterns for model deployment, MLOps infrastructure, and LLM integration.

---

## Table of Contents

- [Model Deployment Workflow](#model-deployment-workflow)
- [MLOps Pipeline Setup](#mlops-pipeline-setup)
- [LLM Integration Workflow](#llm-integration-workflow)
- [RAG System Implementation](#rag-system-implementation)
- [Model Monitoring](#model-monitoring)
- [Reference Documentation](#reference-documentation)
- [Tools](#tools)

---

## Model Deployment Workflow

Deploy a trained model to production with monitoring:

1. Export model to standardized format (ONNX, TorchScript, SavedModel)
2. Package model with dependencies in Docker container
3. Deploy to staging environment
4. Run integration tests against staging
5. Deploy canary (5% traffic) to production
6. Monitor latency and error rates for 1 hour
7. Promote to full production if metrics pass
8. **Validation:** p95 latency < 100ms, error rate < 0.1%

### Container Template

```dockerfile
FROM python:3.11-slim

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY model/ /app/model/
COPY src/ /app/src/

HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8080"]

### Serving Options

| Option | Latency | Throughput | Use Case |
|--------|---------|------------|----------|
| FastAPI + Uvicorn | Low | Medium | REST APIs, small models |
| Triton Inference Server | Very Low | Very High | GPU inference, batching |
| TensorFlow Serving | Low | High | TensorFlow models |
| TorchServe | Low | High | PyTorch models |
| Ray Serve | Medium | High | Complex pipelines, multi-model |

---

## MLOps Pipeline Setup

Establish automated training and deployment:

1. Configure feature store (Feast, Tecton) for training data
2. Set up experiment tracking (MLflow, Weights & Biases)
3. Create training pipeline with hyperparameter logging
4. Register model in model registry with version metadata
5. Configure staging deployment triggered by registry events
6. Set up A/B testing infrastructure for model comparison
7. Enable drift monitoring with alerting
8. **Validation:** New models automatically evaluated against baseline

### Feature Store Pattern

### Retraining Triggers

| Trigger | Detection | Action |
|---------|-----------|--------|
| Scheduled | Cron (weekly/monthly) | Full retrain |
| Performance drop | Accuracy < threshold | Immediate retrain |
| Data drift | PSI > 0.2 | Evaluate, then retrain |
| New data volume | X new samples | Incremental update |

---

## LLM Integration Workflow

Integrate LLM APIs into production applications:

1. Create provider abstraction layer for vendor flexibility
2. Implement retry logic with exponential backoff
3. Configure fallback to secondary provider
4. Set up token counting and context truncation
5. Add response caching for repeated queries
6. Implement cost tracking per request
7. Add structured output validation with Pydantic
8. **Validation:** Response parses correctly, cost within budget

### Provider Abstraction

### Cost Management

Do not hardcode prices, and do not trust a price table you find in a document
(including this one). Providers reprice several times a year, and a stale
figure produces a confidently wrong business case.

Work in tiers and look the current numbers up at request time:

| Tier | Typical use | Relative cost |
|------|-------------|---------------|
| Small | Classification, extraction, routing, short output | 1x baseline |
| Mid | Summarisation, structured output, moderate reasoning | ~10-25x small |
| Large | Multi-step reasoning, code generation, long context | ~50-100x small |

Read the live rate from your provider's pricing page and pass it in, the way
takes `--price-per-mtok`.
The ratios between tiers are far more stable than the absolute prices, so
build the model-routing decision on the ratio.

---

## RAG System Implementation

Build retrieval-augmented generation pipeline:

1. Choose vector database (Pinecone, Qdrant, Weaviate)
2. Select embedding model based on quality/cost tradeoff
3. Implement document chunking strategy
4. Create ingestion pipeline with metadata extraction
5. Build retrieval with query embedding
6. Add reranking for relevance improvement
7. Format context and send to LLM
8. **Validation:** Response references retrieved context, no hallucinations

### Vector Database Selection

| Database | Hosting | Scale | Latency | Best For |
|----------|---------|-------|---------|----------|
| Pinecone | Managed | High | Low | Production, managed |
| Qdrant | Both | High | Very Low | Performance-critical |
| Weaviate | Both | High | Low | Hybrid search |
| Chroma | Self-hosted | Medium | Low | Prototyping |
| pgvector | Self-hosted | Medium | Medium | Existing Postgres |

### Chunking Strategies

| Strategy | Chunk Size | Overlap | Best For |
|----------|------------|---------|----------|
| Fixed | 500-1000 tokens | 50-100 | General text |
| Sentence | 3-5 sentences | 1 sentence | Structured text |
| Semantic | Variable | Based on meaning | Research papers |
| Recursive | Hierarchical | Parent-child | Long documents |

---

## Model Monitoring

Monitor production models for drift and degradation:
