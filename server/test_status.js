const mongoose = require('mongoose');
const MONGO = 'mongodb+srv://tusharjangid1309_db_user:jNQUkWCztQGIpBsk@cluster0.q8pjblc.mongodb.net/filingbuddy?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGO).then(async () => {
  const User = require('./models/User');
  const admin = await User.findOne({ email: 'admin1@test.com' });
  admin.password = 'Test@123';
  await admin.save();
  console.log('Password reset OK');

  const Task = require('./models/Task');
  const task = await Task.findOne({ taskId: 'FB/2026/T025' });
  console.log('T025 original status:', task.status, '| isAwaitingFta:', task.isAwaitingFta);

  const updated = await Task.findByIdAndUpdate(task._id, { $set: { status: 'completed', isAwaitingFta: false } }, { new: true, runValidators: true });
  console.log('T025 after -> completed:', updated.status, '| isAwaitingFta:', updated.isAwaitingFta);

  const reverted = await Task.findByIdAndUpdate(task._id, { $set: { status: 'wip', isAwaitingFta: false } }, { new: true });
  console.log('T025 reverted -> wip:', reverted.status);
  process.exit(0);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
