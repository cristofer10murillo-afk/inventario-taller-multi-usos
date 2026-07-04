const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const replacement = `
    const timeoutId = setTimeout(() => {
      setLoadingError('No se pudo conectar a la base de datos de Firestore. Asegúrate de haber entrado a la consola de Firebase, ir a Firestore Database y hacer clic en "Crear base de datos".');
      setAuthLoading(false);
    }, 8000);

    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      clearTimeout(timeoutId);
`;

code = code.replace(/const unsubUser = onSnapshot\(userDocRef, \(docSnap\) => \{/, replacement);

code = code.replace(/setLoadingError\(\`No se pudo leer tu perfil\. Detalles: \$\{error\.message\}\`\);/, "clearTimeout(timeoutId);\n      setLoadingError(`No se pudo leer tu perfil. Detalles: ${error.message}`);");

fs.writeFileSync('src/App.jsx', code);
console.log('Timeout added!');
