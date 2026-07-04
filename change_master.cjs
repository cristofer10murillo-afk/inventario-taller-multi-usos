const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(/'cristopher'/g, "'cristofer10murillo@hotmail.com'");
code = code.replace(/=== 'Britt2026'/g, "=== 'Shariton24'");
fs.writeFileSync('src/App.jsx', code);
console.log('Replaced master credentials');
