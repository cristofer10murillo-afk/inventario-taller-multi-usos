const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Replace hotmail with gmail
code = code.replace(/cristofer10murillo@hotmail\.com/g, 'cristofer10murillo@gmail.com');

// 2. Remove saveToCloud from master login
// We look for: await saveToCloud('users_access', { id: 'cristofer10murillo@gmail.com', email, status: 'authorized' });
code = code.replace(/await saveToCloud\('users_access', \{ id: 'cristofer10murillo@gmail\.com', email, status: 'authorized' \}\);\s*/g, '');

// 3. Fix the useEffect early return
const oldEffect = `  useEffect(() => {
    if (!isLogged || userList.length === 0) return;
    const emailLower = sessionEmail.toLowerCase().trim();
    if (emailLower === 'cristofer10murillo@gmail.com') {
      setIsAdmin(true); setAccessDenied(false);
    } else {
      const me = userList.find(u => String(u.email || '').toLowerCase().trim() === emailLower);
      if (me) { setAccessDenied(me.status !== 'authorized'); setIsAdmin(false); } 
      else { setAccessDenied(true); setIsAdmin(false); }
    }
  }, [isLogged, sessionEmail, userList]);`;

const newEffect = `  useEffect(() => {
    if (!isLogged) return;
    const emailLower = sessionEmail.toLowerCase().trim();
    if (emailLower === 'cristofer10murillo@gmail.com') {
      setIsAdmin(true); setAccessDenied(false);
    } else {
      if (userList.length === 0) return;
      const me = userList.find(u => String(u.email || '').toLowerCase().trim() === emailLower);
      if (me) { setAccessDenied(me.status !== 'authorized'); setIsAdmin(false); } 
      else { setAccessDenied(true); setIsAdmin(false); }
    }
  }, [isLogged, sessionEmail, userList]);`;

if (code.includes(oldEffect)) {
    code = code.replace(oldEffect, newEffect);
    console.log("Effect patched successfully.");
} else {
    console.log("oldEffect not found!");
}

fs.writeFileSync('src/App.jsx', code);
console.log('Done!');
