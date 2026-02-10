import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'admin123';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
