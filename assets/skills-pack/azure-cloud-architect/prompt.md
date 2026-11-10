YOU ARE USING THE SKILL "azure-cloud-architect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Azure Cloud Architect

Design scalable, cost-effective Azure architectures for startups and enterprises with Bicep infrastructure-as-code templates.

---

## Workflow

### Step 1: Gather Requirements

Collect application specifications:

```
- Application type (web app, mobile backend, data pipeline, SaaS, microservices)
- Expected users and requests per second
- Budget constraints (monthly spend limit)
- Team size and Azure experience level
- Compliance requirements (GDPR, HIPAA, SOC 2, ISO 27001)
- Availability requirements (SLA, RPO/RTO)
- Region preferences (data residency, latency)

### Step 2: Design Architecture

Run the architecture designer to get pattern recommendations:

**Example output:**

```json
{
  "recommended_pattern": "app_service_web",
  "service_stack": ["App Service", "Azure SQL", "Front Door", "Key Vault", "Entra ID"],
  "estimated_monthly_cost_usd": 280,
  "pros": ["Managed platform", "Built-in autoscale", "Deployment slots"],
  "cons": ["Less control than VMs", "Platform constraints", "Cold start on consumption plans"]
}

Select from recommended patterns:
- **App Service Web**: Front Door + App Service + Azure SQL + Redis Cache
- **Microservices on AKS**: AKS + Service Bus + Cosmos DB + API Management
- **Serverless Event-Driven**: Functions + Event Grid + Service Bus + Cosmos DB
- **Data Pipeline**: Data Factory + Synapse Analytics + Data Lake Storage + Event Hubs

**Validation checkpoint:** Confirm the recommended pattern matches the team's operational maturity and compliance requirements before proceeding to Step 3.

### Step 3: Generate IaC Templates

Create infrastructure-as-code for the selected pattern:

**Example Bicep output (core web app resources):**

```bicep
@description('The environment name')
param environment string = 'dev'

@description('The Azure region for resources')
param location string = resourceGroup().location

@description('The application name')
param appName string = 'myapp'

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${environment}-${appName}-plan'
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: 1
  }
  properties: {
    reserved: true // Linux
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: '${environment}-${appName}-web'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Azure SQL Database
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: '${environment}-${appName}-sql'
  location: location
  properties: {
    administrators: {
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: '${appName}-db'
  location: location
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}

**Bicep is the recommended IaC language for Azure.** Prefer Bicep over ARM JSON templates: Bicep compiles to ARM JSON, has cleaner syntax, supports modules, and is first-party supported by Microsoft.

### Step 4: Review Costs

Analyze estimated costs and optimization opportunities:

**Example output:**

```json
{
  "current_monthly_usd": 2000,
  "recommendations": [
    { "action": "Right-size SQL Database GP_S_Gen5_8 to GP_S_Gen5_2", "savings_usd": 380, "priority": "high" },
    { "action": "Purchase 1-year Reserved Instances for AKS node pools", "savings_usd": 290, "priority": "high" },
    { "action": "Move Blob Storage to Cool tier for objects >30 days old", "savings_usd": 65, "priority": "medium" }
  ],
  "total_potential_savings_usd": 735
}

Output includes:
- Monthly cost breakdown by service
- Right-sizing recommendations
- Reserved Instance and Savings Plan opportunities
- Potential monthly savings

### Step 5: Configure CI/CD

Set up Azure DevOps Pipelines or GitHub Actions with Azure:

```yaml
# GitHub Actions — deploy Bicep to Azure
name: Deploy Infrastructure
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/arm-deploy@v2
        with:
          resourceGroupName: rg-myapp-dev
          template: ./infra/main.bicep
          parameters: environment=dev

```yaml
# Azure DevOps Pipeline
trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: 'MyServiceConnection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        az deployment group create \
          --resource-group rg-myapp-dev \
          --template-file infra/main.bicep \
          --parameters environment=dev

### Step 6: Security Review

Validate security posture before production:
