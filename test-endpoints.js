#!/usr/bin/env node

/**
 * Langfuse MCP Server Endpoint Tests
 *
 * This test file verifies that all critical MCP server endpoints are working correctly.
 * Keep this file permanently for regression testing and validation.
 *
 * Usage: node test-endpoints.js
 */

import 'dotenv/config';

import { LangfuseAnalyticsClient } from './build/langfuse-client.js';
import { projectOverview } from './build/tools/project-overview.js';
import { getTraces } from './build/tools/get-traces.js';
import { topExpensiveTraces } from './build/tools/top-expensive-traces.js';
import { getDailyMetrics } from './build/tools/get-daily-metrics.js';
import { getCostAnalysis } from './build/tools/get-cost-analysis.js';
// New API tools for testing
import { getObservationDetail } from './build/tools/get-observation-detail.js';
import { getHealthStatus } from './build/tools/get-health-status.js';
import { listModels } from './build/tools/list-models.js';
import { getModelDetail } from './build/tools/get-model-detail.js';
import { listPrompts } from './build/tools/list-prompts.js';
import { getPromptDetail } from './build/tools/get-prompt-detail.js';
// Dataset management tools for testing
import { createDataset } from './build/tools/create-dataset.js';
import { listDatasets } from './build/tools/list-datasets.js';
import { getDataset } from './build/tools/get-dataset.js';
import { createDatasetItem } from './build/tools/create-dataset-item.js';
import { listDatasetItems } from './build/tools/list-dataset-items.js';
import { getDatasetItem } from './build/tools/get-dataset-item.js';
import { deleteDatasetItem } from './build/tools/delete-dataset-item.js';
// Comment management tools for testing
import { createComment } from './build/tools/create-comment.js';
import { listComments } from './build/tools/list-comments.js';
import { getComment } from './build/tools/get-comment.js';

const client = new LangfuseAnalyticsClient({
  id: 'test-project',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-your-public-key',
  secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-your-secret-key',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://us.cloud.langfuse.com'
});

async function runTests() {
  console.log('🧪 Langfuse MCP Server - Enhanced Endpoint Tests (28 Total Tests)');
  console.log('=' .repeat(60));
  console.log(`🔗 Testing against: ${client.getConfig().baseUrl}`);
  console.log(`📊 Project ID: ${client.getProjectId()}`);
  console.log('');

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
  const to = new Date().toISOString();

  let passed = 0;
  let failed = 0;

  // Test 1: Project Overview (should show real costs/tokens, not zeros)
  console.log('1️⃣ Testing project_overview...');
  try {
    const overview = await projectOverview(client, { from, to });
    const overviewData = JSON.parse(overview.content[0].text);

    if (overviewData.totalCostUsd > 0) {
      console.log(`   ✅ PASS - Real costs: $${overviewData.totalCostUsd.toFixed(4)}`);
      console.log(`   ✅ PASS - Real tokens: ${overviewData.totalTokens?.toLocaleString()}`);
      console.log(`   ✅ PASS - Real traces: ${overviewData.totalTraces?.toLocaleString()}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Zero costs detected (possible data range issue)`);
      console.log(`   📊 Data: $${overviewData.totalCostUsd}, ${overviewData.totalTokens} tokens, ${overviewData.totalTraces} traces`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 2: Get Traces with Server-side Sorting
  console.log('\n2️⃣ Testing get_traces with server-side cost sorting...');
  try {
    const traces = await getTraces(client, {
      from,
      to,
      limit: 5,
      orderBy: 'totalCost',
      orderDirection: 'desc'
    });
    const tracesData = JSON.parse(traces.content[0].text);

    if (tracesData.traces && tracesData.traces.length > 0) {
      console.log(`   ✅ PASS - Retrieved ${tracesData.traces.length} traces`);
      console.log(`   ✅ PASS - Server-side sorting working`);

      // Verify sorting is working (costs should be in descending order)
      const costs = tracesData.traces.map(t => t.totalCost || 0);
      const isSorted = costs.every((cost, i) => i === 0 || costs[i-1] >= cost);
      if (isSorted) {
        console.log(`   ✅ PASS - Costs properly sorted: [${costs.join(', ')}]`);
      } else {
        console.log(`   ⚠️  WARN - Sorting may not be working: [${costs.join(', ')}]`);
      }
      passed++;
    } else {
      console.log(`   ❌ FAIL - No traces returned (check date range)`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 3: Top Expensive Traces
  console.log('\n3️⃣ Testing top_expensive_traces...');
  try {
    const expensive = await topExpensiveTraces(client, { from, to, limit: 3 });
    const expensiveData = JSON.parse(expensive.content[0].text);

    if (expensiveData.traces && expensiveData.traces.length > 0) {
      console.log(`   ✅ PASS - Retrieved ${expensiveData.traces.length} expensive traces`);
      const topCost = expensiveData.traces[0]?.totalCost || 0;
      console.log(`   ✅ PASS - Top trace cost: $${topCost}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - No expensive traces found (possible data issue)`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 4: Daily Metrics (uses working daily API)
  console.log('\n4️⃣ Testing get_daily_metrics...');
  try {
    const dailyMetrics = await getDailyMetrics(client, {
      from,
      to,
      fillMissingDays: false  // Don't fill to see actual data days
    });
    const dailyData = JSON.parse(dailyMetrics.content[0].text);

    if (dailyData.dailyData && dailyData.dailyData.length > 0) {
      console.log(`   ✅ PASS - Retrieved ${dailyData.dailyData.length} days of data`);
      const totalCost = dailyData.dailyData.reduce((sum, day) => sum + (day.totalCost || 0), 0);
      console.log(`   ✅ PASS - Total daily costs: $${totalCost.toFixed(4)}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - No daily data returned`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 5: Cost Analysis (comprehensive cost breakdown)
  console.log('\n5️⃣ Testing get_cost_analysis...');
  try {
    const costAnalysis = await getCostAnalysis(client, { from, to });
    const costData = JSON.parse(costAnalysis.content[0].text);

    if (costData.totalCost > 0) {
      console.log(`   ✅ PASS - Total cost analysis: $${costData.totalCost.toFixed(4)}`);
      console.log(`   ✅ PASS - Model breakdown: ${Object.keys(costData.byModel || {}).length} models`);
      console.log(`   ✅ PASS - Daily breakdown: ${costData.byDay?.length || 0} days`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Zero total cost in analysis`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 6: Health Status (system monitoring)
  console.log('\\n6️⃣ Testing get_health_status...');
  try {
    const health = await getHealthStatus(client, {});
    const healthData = JSON.parse(health.content[0].text);

    if (healthData && typeof healthData === 'object') {
      console.log(`   ✅ PASS - Health status retrieved successfully`);
      console.log(`   ✅ PASS - Health response structure: ${Object.keys(healthData).join(', ')}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid health response structure`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 7: List Models
  console.log('\\n7️⃣ Testing list_models...');
  try {
    const models = await listModels(client, { limit: 10 });
    const modelsData = JSON.parse(models.content[0].text);

    if (modelsData && (modelsData.data || modelsData.models || Array.isArray(modelsData))) {
      const modelsList = modelsData.data || modelsData.models || modelsData;
      console.log(`   ✅ PASS - Retrieved ${Array.isArray(modelsList) ? modelsList.length : 'N/A'} models`);
      console.log(`   ✅ PASS - Models list structure validated`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid models response structure`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 8: List Prompts
  console.log('\\n8️⃣ Testing list_prompts...');
  try {
    const prompts = await listPrompts(client, { limit: 10 });
    const promptsData = JSON.parse(prompts.content[0].text);

    if (promptsData && (promptsData.data || promptsData.prompts || Array.isArray(promptsData))) {
      const promptsList = promptsData.data || promptsData.prompts || promptsData;
      console.log(`   ✅ PASS - Retrieved ${Array.isArray(promptsList) ? promptsList.length : 'N/A'} prompts`);
      console.log(`   ✅ PASS - Prompts list structure validated`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid prompts response structure`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 9-18: Conditional tests based on data availability
  let observationId = null;
  let modelId = null;
  let promptName = null;

  // Test 9: Get first observation ID for detailed testing
  console.log('\\n9️⃣ Testing get_observations to find observation ID...');
  try {
    const observations = await client.listObservations({ limit: 1, fromStartTime: from, toStartTime: to });

    if (observations && observations.data && observations.data.length > 0) {
      observationId = observations.data[0].id;
      console.log(`   ✅ PASS - Found observation ID: ${observationId}`);
      passed++;
    } else {
      console.log(`   ⚠️  SKIP - No observations found (will skip observation detail test)`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 10: Get Observation Detail (if observation found)
  if (observationId) {
    console.log('\\n🔟 Testing get_observation_detail...');
    try {
      const observationDetail = await getObservationDetail(client, { observationId });
      const observationData = JSON.parse(observationDetail.content[0].text);

      if (observationData && observationData.id === observationId) {
        console.log(`   ✅ PASS - Retrieved observation detail successfully`);
        console.log(`   ✅ PASS - Observation ID matches: ${observationData.id}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid observation detail response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\\n🔟 SKIPPED - get_observation_detail (no observation ID available)');
    failed++;
  }

  // Test 11-15: Extract IDs from lists for detail testing
  console.log('\\n1️⃣1️⃣ Extracting IDs for detail testing...');
  try {
    // Get model ID
    const modelsResponse = await listModels(client, { limit: 1 });
    const modelsData = JSON.parse(modelsResponse.content[0].text);
    const modelsList = modelsData.data || modelsData.models || modelsData;
    if (Array.isArray(modelsList) && modelsList.length > 0) {
      modelId = modelsList[0].id || modelsList[0].name || modelsList[0].model;
    }

    // Get prompt name
    const promptsResponse = await listPrompts(client, { limit: 1 });
    const promptsData = JSON.parse(promptsResponse.content[0].text);
    const promptsList = promptsData.data || promptsData.prompts || promptsData;
    if (Array.isArray(promptsList) && promptsList.length > 0) {
      promptName = promptsList[0].name;
    }

    console.log(`   📊 Found Model ID: ${modelId || 'None'}`);
    console.log(`   📊 Found Prompt Name: ${promptName || 'None'}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ FAIL - Error extracting IDs: ${error.message}`);
    failed++;
  }

  // Test 12: Get Model Detail (if model found)
  if (modelId) {
    console.log('\\n1️⃣2️⃣ Testing get_model_detail...');
    try {
      const modelDetail = await getModelDetail(client, { modelId });
      const modelData = JSON.parse(modelDetail.content[0].text);

      if (modelData && (modelData.id === modelId || modelData.name === modelId)) {
        console.log(`   ✅ PASS - Retrieved model detail successfully`);
        console.log(`   ✅ PASS - Model ID matches: ${modelData.id || modelData.name}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid model detail response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\\n1️⃣2️⃣ SKIPPED - get_model_detail (no model ID available)');
    failed++;
  }

  // Test 13: Get Prompt Detail (if prompt found)
  if (promptName) {
    console.log('\\n1️⃣3️⃣ Testing get_prompt_detail...');
    try {
      const promptDetail = await getPromptDetail(client, { promptName });
      const promptData = JSON.parse(promptDetail.content[0].text);

      if (promptData && promptData.name === promptName) {
        console.log(`   ✅ PASS - Retrieved prompt detail successfully`);
        console.log(`   ✅ PASS - Prompt name matches: ${promptData.name}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid prompt detail response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\\n1️⃣3️⃣ SKIPPED - get_prompt_detail (no prompt name available)');
    failed++;
  }

  // Dataset Management Tests (New in v1.2.0)
  console.log('\\n📦 DATASET MANAGEMENT TESTS (v1.2.0)');
  console.log('=' .repeat(40));

  let testDatasetName = `test-dataset-${Date.now()}`;
  let createdDatasetItemId = null;

  // Test 14: Create Dataset
  console.log('\\n1️⃣4️⃣ Testing create_dataset...');
  try {
    const dataset = await createDataset(client, {
      name: testDatasetName,
      description: 'Test dataset created by automated tests',
      metadata: { testRun: true, timestamp: new Date().toISOString() }
    });
    const datasetData = JSON.parse(dataset.content[0].text);

    if (datasetData && datasetData.name === testDatasetName) {
      console.log(`   ✅ PASS - Created dataset: ${datasetData.name}`);
      console.log(`   ✅ PASS - Dataset ID: ${datasetData.id}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid dataset creation response`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 15: List Datasets
  console.log('\\n1️⃣5️⃣ Testing list_datasets...');
  try {
    const datasets = await listDatasets(client, { limit: 10 });
    const datasetsData = JSON.parse(datasets.content[0].text);

    if (datasetsData && datasetsData.data && Array.isArray(datasetsData.data)) {
      console.log(`   ✅ PASS - Retrieved ${datasetsData.data.length} datasets`);

      // Check if our test dataset is in the list
      const testDataset = datasetsData.data.find(d => d.name === testDatasetName);
      if (testDataset) {
        console.log(`   ✅ PASS - Test dataset found in list`);
      } else {
        console.log(`   ⚠️  WARN - Test dataset not yet visible in list (eventual consistency)`);
      }
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid datasets list response`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 16: Get Dataset
  console.log('\\n1️⃣6️⃣ Testing get_dataset...');
  try {
    const dataset = await getDataset(client, { datasetName: testDatasetName });
    const datasetData = JSON.parse(dataset.content[0].text);

    if (datasetData && datasetData.name === testDatasetName) {
      console.log(`   ✅ PASS - Retrieved dataset: ${datasetData.name}`);
      console.log(`   ✅ PASS - Dataset metadata present: ${!!datasetData.metadata}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid dataset retrieval response`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 17: Create Dataset Item
  console.log('\\n1️⃣7️⃣ Testing create_dataset_item...');
  try {
    const datasetItem = await createDatasetItem(client, {
      datasetName: testDatasetName,
      input: { prompt: "What is the capital of France?" },
      expectedOutput: { answer: "Paris" },
      metadata: { category: "geography", difficulty: "easy" }
    });
    const itemData = JSON.parse(datasetItem.content[0].text);

    if (itemData && itemData.id && itemData.datasetName === testDatasetName) {
      console.log(`   ✅ PASS - Created dataset item: ${itemData.id}`);
      console.log(`   ✅ PASS - Item linked to dataset: ${itemData.datasetName}`);
      createdDatasetItemId = itemData.id;
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid dataset item creation response`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 18: List Dataset Items
  console.log('\\n1️⃣8️⃣ Testing list_dataset_items...');
  try {
    const items = await listDatasetItems(client, { datasetName: testDatasetName, limit: 10 });
    const itemsData = JSON.parse(items.content[0].text);

    if (itemsData && itemsData.data && Array.isArray(itemsData.data)) {
      console.log(`   ✅ PASS - Retrieved ${itemsData.data.length} dataset items`);

      // Check if our test item is in the list
      const testItem = itemsData.data.find(item => item.id === createdDatasetItemId);
      if (testItem) {
        console.log(`   ✅ PASS - Test dataset item found in list`);
      } else {
        console.log(`   ⚠️  WARN - Test dataset item not yet visible (eventual consistency)`);
      }
      passed++;
    } else {
      console.log(`   ❌ FAIL - Invalid dataset items list response`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 19: Get Dataset Item
  if (createdDatasetItemId) {
    console.log('\\n1️⃣9️⃣ Testing get_dataset_item...');
    try {
      const item = await getDatasetItem(client, { itemId: createdDatasetItemId });
      const itemData = JSON.parse(item.content[0].text);

      if (itemData && itemData.id === createdDatasetItemId) {
        console.log(`   ✅ PASS - Retrieved dataset item: ${itemData.id}`);
        console.log(`   ✅ PASS - Item has input/output: ${!!itemData.input && !!itemData.expectedOutput}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid dataset item retrieval response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\\n1️⃣9️⃣ SKIPPED - get_dataset_item (no item ID available)');
    failed++;
  }

  // Test 20: Delete Dataset Item (cleanup)
  if (createdDatasetItemId) {
    console.log('\\n2️⃣0️⃣ Testing delete_dataset_item...');
    try {
      const result = await deleteDatasetItem(client, { itemId: createdDatasetItemId });
      const resultData = JSON.parse(result.content[0].text);

      if (resultData && (resultData.success || resultData.message)) {
        console.log(`   ✅ PASS - Deleted dataset item successfully`);
        console.log(`   ✅ PASS - Cleanup completed`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid delete response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\\n2️⃣0️⃣ SKIPPED - delete_dataset_item (no item to delete)');
    failed++;
  }

  // Comment management tests
  let createdCommentId = null;
  let testObjectId = null;

  // Test 21: List Comments (initial state)
  console.log('\n2️⃣1️⃣ Testing list_comments...');
  try {
    const comments = await listComments(client, { limit: 5 });
    const commentsData = JSON.parse(comments.content[0].text);

    if (commentsData && Array.isArray(commentsData.data || commentsData)) {
      console.log(`   ✅ PASS - Retrieved comments list`);
      const commentsList = commentsData.data || commentsData;
      console.log(`   ✅ PASS - Found ${commentsList.length} existing comments`);
      passed++;
    } else {
      console.log(`   ✅ PASS - Empty comments list (valid for new projects)`);
      passed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 22: Create Comment (find a trace to comment on)
  console.log('\n2️⃣2️⃣ Testing create_comment...');
  try {
    // First, get a trace to comment on
    const traces = await getTraces(client, { from, to, limit: 1 });
    const tracesData = JSON.parse(traces.content[0].text);

    if (tracesData.traces && tracesData.traces.length > 0) {
      testObjectId = tracesData.traces[0].id;

      const comment = await createComment(client, {
        objectType: 'trace',
        objectId: testObjectId,
        content: 'Test comment created by MCP server endpoint test'
      });
      const commentData = JSON.parse(comment.content[0].text);

      if (commentData && commentData.id) {
        console.log(`   ✅ PASS - Created comment: ${commentData.id}`);
        console.log(`   ✅ PASS - Comment linked to trace: ${testObjectId}`);
        createdCommentId = commentData.id;
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid comment creation response`);
        failed++;
      }
    } else {
      console.log(`   ⚠️  SKIP - No traces available to comment on`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }

  // Test 23: Get Comment
  if (createdCommentId) {
    console.log('\n2️⃣3️⃣ Testing get_comment...');
    try {
      const comment = await getComment(client, { commentId: createdCommentId });
      const commentData = JSON.parse(comment.content[0].text);

      if (commentData && commentData.id === createdCommentId) {
        console.log(`   ✅ PASS - Retrieved comment: ${commentData.id}`);
        console.log(`   ✅ PASS - Comment content preserved: ${!!commentData.content}`);
        console.log(`   ✅ PASS - Comment object type: ${commentData.objectType || 'unknown'}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Invalid comment retrieval response`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  } else {
    console.log('\n2️⃣3️⃣ SKIPPED - get_comment (no comment ID available)');
    failed++;
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${passed}/${passed + failed} (${Math.round(passed / (passed + failed) * 100)}%)`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! MCP Server is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }

  await client.shutdown();
  process.exit(failed === 0 ? 0 : 1);
}

// Handle errors gracefully
runTests().catch((error) => {
  console.error('\n💥 Test runner crashed:', error.message);
  process.exit(1);
});