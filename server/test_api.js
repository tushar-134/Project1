const http = require('http');

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: 'localhost', port: 5000, path, method, headers }, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Login
  const login = await request('POST', '/api/auth/login', { email: 'admin1@test.com', password: 'Test@123' });
  console.log('Login:', login.status, login.body.message || 'OK');
  if (!login.body.token) return;
  const token = login.body.token;

  // Get tasks list
  const list = await request('GET', '/api/tasks?category=All&status=All&month=2026-05', null, token);
  console.log('Tasks list status:', list.status, '| Count:', list.body.length);
  if (list.body.length > 0) {
    const t = list.body[0];
    console.log('First task:', t.taskId, '| status:', t.status);
    
    // PATCH status to completed
    const patch = await request('PATCH', '/api/tasks/' + t._id + '/status', { status: 'completed' }, token);
    console.log('PATCH to completed:', patch.status, '| status in response:', patch.body.status);
    
    // GET tasks again to confirm
    const list2 = await request('GET', '/api/tasks?category=All&status=All&month=2026-05', null, token);
    const updated = list2.body.find(x => x._id === t._id);
    console.log('After GET, task status:', updated ? updated.status : 'NOT FOUND');
    
    // Revert
    await request('PATCH', '/api/tasks/' + t._id + '/status', { status: t.status }, token);
    console.log('Reverted to original:', t.status);
  }
}
run().catch(console.error);
