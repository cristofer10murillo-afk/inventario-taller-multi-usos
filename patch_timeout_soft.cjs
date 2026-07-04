const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const oldTimeoutStr = `    const timeoutId = setTimeout(() => {
      setLoadingError('No se pudo conectar a la base de datos de Firestore. Asegúrate de haber entrado a la consola de Firebase, ir a Firestore Database y hacer clic en "Crear base de datos".');
      setAuthLoading(false);
    }, 15000);`;

const newTimeoutStr = `    const timeoutId = setTimeout(() => {
      console.warn('Conexión lenta a Firestore. Es posible que un antivirus o red corporativa esté bloqueando WebSockets, forzando la caída a Long Polling (puede tardar hasta 30s).');
      // No cortamos la conexión ni mostramos error destructivo. Solo avisamos.
    }, 15000);`;

code = code.replace(oldTimeoutStr, newTimeoutStr);
fs.writeFileSync('src/App.jsx', code);
console.log("Timeout made non-destructive");
