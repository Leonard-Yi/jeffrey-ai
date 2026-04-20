const { PrismaClient } = require('@prisma/client');

async function test() {
  const response = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      text: '今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈' 
    })
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.slice(0, 3000));
}

test().catch(console.error);
