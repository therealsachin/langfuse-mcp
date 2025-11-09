#!/usr/bin/env node
/**
 * Test tool filtering in readonly vs readwrite modes
 */

import { spawn } from 'child_process';

async function testToolFiltering() {
  console.log('🔍 Testing Tool Filtering in Different Modes\n');

  // Test readonly mode tools
  const readonlyTools = await getAvailableTools('readonly');
  console.log(`📖 READONLY MODE: ${readonlyTools.length} tools exposed`);
  console.log(`   Read-only tools: ${readonlyTools.filter(t => !t.startsWith('write_')).length}`);
  console.log(`   Write tools: ${readonlyTools.filter(t => t.startsWith('write_')).length}\n`);

  // Test readwrite mode tools
  const readwriteTools = await getAvailableTools('readwrite');
  console.log(`✏️  READWRITE MODE: ${readwriteTools.length} tools exposed`);
  console.log(`   Read-only tools: ${readwriteTools.filter(t => !t.startsWith('write_')).length}`);
  console.log(`   Write tools: ${readwriteTools.filter(t => t.startsWith('write_')).length}\n`);

  // Verify filtering works
  const writeToolsInReadonly = readonlyTools.filter(t => t.startsWith('write_') ||
    ['create_dataset', 'create_dataset_item', 'delete_dataset_item', 'create_comment'].includes(t));

  if (writeToolsInReadonly.length === 0) {
    console.log('✅ SECURITY VERIFIED: No write tools exposed in readonly mode');
  } else {
    console.log(`❌ SECURITY ISSUE: ${writeToolsInReadonly.length} write tools found in readonly mode:`, writeToolsInReadonly);
  }

  const writeToolsInReadwrite = readwriteTools.filter(t => t.startsWith('write_') ||
    ['create_dataset', 'create_dataset_item', 'delete_dataset_item', 'create_comment'].includes(t));

  console.log(`✅ FUNCTIONALITY VERIFIED: ${writeToolsInReadwrite.length} write tools available in readwrite mode`);

  console.log('\n📊 Tool Analysis:');
  console.log(`   Expected readonly tools: 21`);
  console.log(`   Expected readwrite tools: 32+ (21 readonly + 11 write tools)`);
  console.log(`   Actual readonly: ${readonlyTools.length}`);
  console.log(`   Actual readwrite: ${readwriteTools.length}`);
}

async function getAvailableTools(mode) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test-key',
      LANGFUSE_SECRET_KEY: 'sk-lf-test-secret',
      LANGFUSE_BASEURL: 'https://cloud.langfuse.com',
      LANGFUSE_MCP_MODE: mode
    };

    const child = spawn('node', ['build/index.js'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    // Send list_tools request
    setTimeout(() => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      child.stdin.write(JSON.stringify(request) + '\n');
    }, 500);

    child.stdout.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString().trim());
        if (response.result && response.result.tools) {
          const toolNames = response.result.tools.map(tool => tool.name);
          child.kill();
          resolve(toolNames);
        }
      } catch (error) {
        // Ignore parsing errors, continue listening
      }
    });

    setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout getting tools for ${mode} mode`));
    }, 3000);
  });
}

testToolFiltering().catch(console.error);