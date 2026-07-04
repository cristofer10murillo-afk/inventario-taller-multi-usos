const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Hotmail -> Gmail
code = code.replace(/cristofer10murillo@hotmail\.com/g, 'cristofer10murillo@gmail.com');
code = code.replace(/cristopher/g, 'cristofer10murillo@gmail.com'); // just in case

// 2. Remove saveToCloud from master login
// We look for: await saveToCloud('users_access', { id: 'cristofer10murillo@gmail.com', email, status: 'authorized' });
code = code.replace(/await saveToCloud\('users_access', \{ id: 'cristofer10murillo@gmail\.com', email, status: 'authorized' \}\);\s*/g, '');

// 3. Fix useEffect condition
code = code.replace(
  /if \(!isLogged \|\| userList\.length === 0\) return;/g,
  "if (!isLogged) return; if (sessionEmail.toLowerCase().trim() !== 'cristofer10murillo@gmail.com' && userList.length === 0) return;"
);

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx fixed successfully!');
