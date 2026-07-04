const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Reemplazar collection()
code = code.replace(/collection\(db, 'artifacts', appId, 'public', 'data', '([^']+)'\)/g, "collection(db, '$1')");

// Reemplazar doc()
code = code.replace(/doc\(db, 'artifacts', appId, 'public', 'data', '([^']+)', ([^)]+)\)/g, "doc(db, '$1', $2)");

fs.writeFileSync('src/App.jsx', code);
console.log('Paths fixed');
