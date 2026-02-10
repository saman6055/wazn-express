import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function updatePassword() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Hash the new password
  const newPassword = 'Saman123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  // Update the user's password
  const [result] = await connection.execute(
    'UPDATE users SET passwordHash = ? WHERE username = ?',
    [hashedPassword, 'Saman6055@gmail.com']
  );
  
  console.log('Password updated for Saman6055@gmail.com');
  console.log('Rows affected:', result.affectedRows);
  
  await connection.end();
}

updatePassword().catch(console.error);
