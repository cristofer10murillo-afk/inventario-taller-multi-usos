const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Remove states
code = code.replace(/const \[isImporting, setIsImporting\] = useState\(false\);\s*const importFileInputRef = useRef\(null\);\s*/, '');

// 2. Remove handleImportExcel function
code = code.replace(/\/\/ IMPORTACIÓN DE EXCEL POR LOTES[\s\S]*?const filteredMaterials = useMemo/g, 'const filteredMaterials = useMemo');

// 3. Remove the input and button from JSX
code = code.replace(/<input type="file" accept="\.xlsx, \.xls" ref={importFileInputRef} onChange={handleImportExcel} className="hidden" \/>\s*<button onClick={\(\) => importFileInputRef\.current\?\.click\(\)} disabled={isImporting} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2\.5 rounded-xl font-medium">\s*{isImporting \? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"><\/div> : <><Upload size={20} \/><span className="hidden sm:inline">Importar Excel<\/span><\/><}\s*<\/button>\s*/, '');

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx modified successfully');
