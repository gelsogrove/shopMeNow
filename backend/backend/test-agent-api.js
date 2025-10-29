const axios = require('axios');

async function testAgentAPI() {
  try {
    // Login
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@shopme.com',
      password: 'venezia44'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login OK');
    
    // Get agents
    const agentsRes = await axios.get('http://localhost:3001/api/workspaces/test-workspace-id/agent', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\n📊 Agents Response:');
    console.log(JSON.stringify(agentsRes.data, null, 2));
    
    // Check functions field
    const hasFunction = agentsRes.data.some(agent => agent.functions && agent.functions.length > 0);
    console.log('\n🔍 Has functions field?', hasFunction ? '✅ YES' : '❌ NO');
    
    if (hasFunction) {
      const routerAgent = agentsRes.data.find(a => a.agentType === 'ROUTER');
      if (routerAgent) {
        console.log('\n🧠 Router Agent functions:', routerAgent.functions);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAgentAPI();
