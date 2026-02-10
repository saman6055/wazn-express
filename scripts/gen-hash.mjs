import bcrypt from 'bcrypt';

const password = process.argv[2] || 'admin123';
const hash = await bcrypt.hash(password, 10);
console.log(hash);
