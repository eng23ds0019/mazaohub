const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

async function resetPassword() {
  await db.initDb();
  const newPassword = 'Mazao@2024';
  const hash = await bcrypt.hash(newPassword, 10);
  
  await db.run(
    'UPDATE users SET password = $1 WHERE email = $2',
    [hash, 'admin@mazaohub.com']
  );
  
  console.log('✅ Password reset successfully!');
  console.log('📧 Email:    admin@mazaohub.com');
  console.log('🔑 Password: Mazao@2024');
  process.exit(0);
}

resetPassword().catch(e => { console.error(e); process.exit(1); });
