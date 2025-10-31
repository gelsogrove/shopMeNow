#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing ShopMe MCP Server...\n');

// Test the MCP server
const serverPath = join(__dirname, 'mcp-server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Test request
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

console.log('📤 Sending test request...');
server.stdin.write(JSON.stringify(testRequest) + '\n');

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('📥 Server response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('🔍 Server logs:', data.toString());
});

server.on('close', (code) => {
  console.log(`\n✅ MCP Server test completed with code: ${code}`);
  if (output) {
    try {
      const response = JSON.parse(output);
      console.log('📋 Available tools:', response.result?.tools?.map(t => t.name) || []);
    } catch (e) {
      console.log('📋 Raw response:', output);
    }
  }
});

// Close after 5 seconds
setTimeout(() => {
  server.kill();
}, 5000);

