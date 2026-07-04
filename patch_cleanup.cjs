const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const cleanupReplacement = `
    return () => {
      clearTimeout(timeoutId);
      unsubUser();
    };
`;

code = code.replace(/return \(\) => unsubUser\(\);/, cleanupReplacement);

fs.writeFileSync('src/App.jsx', code);
console.log('Cleanup fixed!');
