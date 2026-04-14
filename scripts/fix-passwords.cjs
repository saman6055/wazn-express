const bcrypt = require('bcryptjs');

async function main() {
  const hash = bcrypt.hashSync('12345678', 12);
  console.log('Hash:', hash);
  const match = await bcrypt.compare('12345678', hash);
  console.log('Self-match:', match);
  console.log('SQL:');
  console.log(`UPDATE customers SET passwordHash='${hash}' WHERE passwordHash IS NOT NULL;`);
}
main();
