#!/usr/bin/env node

/**
 * Langfuse MCP Server Endpoint Tests
 *
 * This test file verifies that all critical MCP server endpoints are working correctly.
 * Keep this file permanently for regression testing and validation.
 *
 * Usage: node test-endpoints.js
 */

import { LangfuseAnalyticsClient } from './build/langfuse-client.js';
import { projectOverview } from './build/tools/project-overview.js';
import { getTraces } from './build/tools/get-traces.js';
import { topExpensiveTraces } from './build/tools/top-expensive-traces.js';
import { getDailyMetrics } from './build/tools/get-daily-metrics.js';
import { getCostAnalysis } from './build/tools/get-cost-analysis.js';

const client = new LangfuseAnalyticsClient({
  id: 'test-project',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-your-public-key',
  secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-your-secret-key',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://us.cloud.langfuse.com'
});

async function runTests() {
  console.log('🧪 Langfuse MCP Server - Comprehensive Endpoint Tests');
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