import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch, query, orderBy, limit
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { 
  Package, AlertTriangle, Clock, Plus, Edit, Trash2, Search, CheckCircle,
  TrendingDown, X, Coffee, Truck, Settings, Shield, User, Box,
  History, Download, Calendar, ClipboardList, LayoutGrid, ImageIcon, LayoutDashboard,
  Wallet, BellRing, LogOut, UploadCloud, FileSpreadsheet, ChevronRight, ChevronDown, Inbox, Users, Eye, EyeOff, Archive, Layers
} from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
// NOTA DE SEGURIDAD: En un entorno real, estas claves deben ir en un archivo .env
const firebaseConfig = {
  apiKey: "AIza" + "SyAuBPW0xsIVclFMr1OURPzAPrvSPD9wyv4",
  authDomain: "inventario-de-repuestos-taller.firebaseapp.com",
  projectId: "inventario-de-repuestos-taller",
  storageBucket: "inventario-de-repuestos-taller.firebasestorage.app",
  messagingSenderId: "974025120647",
  appId: "1:974025120647:web:e4ac47ed91438e74bc9122",
  measurementId: "G-8SLD789ME0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const getDbCollection = (colName) => collection(db, colName);
const getDbDoc = (colName, docId) => doc(db, colName, String(docId));

// --- 2. CONFIGURACIÓN DE DIVISAS ---
const monedas = {
  CRC: { simbolo: '₡', nombre: 'Colón Costarricense' },
  USD: { simbolo: '$', nombre: 'Dólar Estadounidense' },
  EUR: { simbolo: '€', nombre: 'Euro' }
};

// --- CARGA DINÁMICA DE LIBRERÍA EXCEL ---
const getXLSX = async () => {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Fallo la carga de XLSX"));
    document.head.appendChild(script);
  });
};

// --- COMPONENTE: BUSCADOR INTELIGENTE ---
const BuscadorProducto = ({ inventario, valor, onChange, placeholder = "Buscar producto...", className = "" }) => {
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (valor) {
      const prod = inventario.find(p => String(p.id) === String(valor));
      if (prod) setBusquedaLocal(`${prod.codigo} - ${prod.nombre}`);
    } else { setBusquedaLocal(''); }
  }, [valor, inventario]);

  const filtrados = inventario.filter(p => {
    const nom = String(p.nombre || '').toLowerCase();
    const cod = String(p.codigo || '').toLowerCase();
    const busq = busquedaLocal.toLowerCase();
    return nom.includes(busq) || cod.includes(busq);
  });

  return (
    <div className="relative w-full text-left">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-[#5B50FF] w-4 h-4 transition-colors" />
        <input 
          type="text" value={busquedaLocal || ''} 
          onChange={(e) => { setBusquedaLocal(e.target.value); setAbierto(true); if (e.target.value === '') onChange(''); }} 
          onFocus={(e) => { setAbierto(true); e.target.select(); }} 
          onBlur={() => { setTimeout(() => { setAbierto(false); }, 200); }} 
          placeholder={placeholder} 
          className={`pl-11 pr-4 py-3.5 w-full bg-[#131627] border border-[#2d324f] rounded-xl outline-none focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] text-white placeholder-slate-500 transition-all text-sm shadow-sm ${className}`} 
        />
      </div>
      {abierto && (
        <div className="absolute z-50 w-full mt-2 bg-[#1e2235] border border-[#2d324f] rounded-2xl shadow-2xl max-h-64 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 custom-scrollbar">
          {filtrados.length > 0 ? filtrados.map(p => (
            <div key={p.id} onMouseDown={(e) => { e.preventDefault(); onChange(p.id); setAbierto(false); }} className="px-5 py-3.5 hover:bg-[#131627] cursor-pointer border-b border-[#2d324f]/50 last:border-0 transition-colors">
              <p className="font-semibold text-white text-sm truncate">{p.nombre || 'Sin nombre'}</p>
              <p className="text-xs text-slate-400 mt-1">{p.codigo || 'S/N'} <span className="mx-1">•</span> <span className="font-medium text-[#5B50FF] bg-[#5B50FF]/10 px-2 py-0.5 rounded-md border border-[#5B50FF]/20">Stock: {p.cantidad}</span></p>
            </div>
          )) : <div className="px-5 py-6 text-sm text-slate-500 text-center flex flex-col items-center gap-2"><Package className="w-6 h-6 opacity-30"/> No hay resultados</div>}
        </div>
      )}
    </div>
  );
};

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [fbUser, setFbUser] = useState(null);
  const [sessionEmail, setSessionEmail] = useState(localStorage.getItem('nexus_email') || '');
  const [loginPassword, setLoginPassword] = useState(localStorage.getItem('nexus_pwd') || '');
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('nexus_email'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userList, setUserList] = useState([]);

  // --- ESTADOS DE DATOS PRINCIPALES ---
  const [inventario, setInventario] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [planimetrias, setPlanimetrias] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);

  // --- ESTADOS DE UI Y NAVEGACIÓN ---
  const [pestañaActiva, setPestañaActiva] = useState('dashboard');
  const [notificacion, setNotificacion] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [mostrarOcultosAdmin, setMostrarOcultosAdmin] = useState(false);
  const [filtroMaquinaId, setFiltroMaquinaId] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [filasExpandidas, setFilasExpandidas] = useState({});
  const [imagenAmpliada, setImagenAmpliada] = useState(null);

  // --- ESTADOS DE SOLICITUDES ---
  const [listaSolicitud, setListaSolicitud] = useState([]);
  const [solTipoSeleccion, setSolTipoSeleccion] = useState('maquina');
  const [solMaquinaId, setSolMaquinaId] = useState('');
  const [solMaquinaCant, setSolMaquinaCant] = useState(1);
  const [solProductoId, setSolProductoId] = useState('');
  const [solProductoCant, setSolProductoCant] = useState(1);

  // --- ESTADOS DE INGRESOS ---
  const [listaIngreso, setListaIngreso] = useState([]);
  const [ingresoProductoId, setIngresoProductoId] = useState('');
  const [ingresoCantidad, setIngresoCantidad] = useState(1);
  const [ingresoVencimiento, setIngresoVencimiento] = useState('');
  const [responsableIngreso, setResponsableIngreso] = useState('');

  // --- ESTADOS DE DESPACHO ---
  const [responsableDespacho, setResponsableDespacho] = useState('');
  const [tipoDespacho, setTipoDespacho] = useState('maquina'); 
  const [despachoMaquinaId, setDespachoMaquinaId] = useState('');
  const [despachoCantidad, setDespachoCantidad] = useState(1);
  const [despachoProductoId, setDespachoProductoId] = useState('');
  const [despachoProductoCantidad, setDespachoProductoCantidad] = useState(1);
  const [listaDespachoIndividual, setListaDespachoIndividual] = useState([]);

  // --- ESTADOS DE MODALES Y FORMULARIOS ---
  const [modalInvAbierto, setModalInvAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [formDataInv, setFormDataInv] = useState({ codigo: '', nombre: '', categoria: '', cantidad: 0, minimo: 0, maximo: 0, vencimiento: '', costo: 0, lotes: [], activo: true });
  
  const [modalMaqAbierto, setModalMaqAbierto] = useState(false);
  const [maquinaEditando, setMaquinaEditando] = useState(null);
  const [formDataMaq, setFormDataMaq] = useState({ nombre: '', receta: [] });
  
  const [modalPlanAbierto, setModalPlanAbierto] = useState(false);
  const [planEditando, setPlanEditando] = useState(null);
  const [formDataPlan, setFormDataPlan] = useState({ maquinaId: '', imagenUrl: '', moneda: 'CRC', detalles: [] });
  const [activePlanTab, setActivePlanTab] = useState('');
  
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [subiendoImagenSlot, setSubiendoImagenSlot] = useState(null);
  const [mostrarConfirmacionBorrarTodo, setMostrarConfirmacionBorrarTodo] = useState(false);

  // --- UTILIDADES ---
  const notify = (mensaje, tipo = 'success') => { 
    setNotificacion({ mensaje, tipo }); 
    setTimeout(() => setNotificacion(null), 5000); 
  };

  // --- EFECTOS DE FIREBASE (SINCRONIZACIÓN) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { 
        console.warn("Error de Autenticación de Firebase:", err); 
        notify("Atención: Firebase bloqueó la conexión.", "error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // Cargar lista de usuarios (solo lectura básica)
  useEffect(() => {
    const unsubUsers = onSnapshot(getDbCollection('users_access'), (s) => {
      setUserList(s.docs.map(d => ({ ...d.data(), id: d.id })));
    }, e => console.warn("Aviso permisos usuarios:", e));
    return () => unsubUsers();
  }, []);

  // Cargar colecciones principales
  useEffect(() => {
    if (!isLogged) return;
    
    const handleError = (err) => { 
      console.error("Firebase Error:", err);
      if (err.code === 'permission-denied') notify("Acceso bloqueado: Reglas de Firestore deniegan la lectura.", "error"); 
      else notify(`Error DB: ${err.message}`, "error");
    };
    
    const unsubInv = onSnapshot(getDbCollection('inventario'), (s) => setInventario(s.docs.map(d => ({ ...d.data(), id: d.id }))), handleError);
    const unsubMaq = onSnapshot(getDbCollection('maquinas'), (s) => setMaquinas(s.docs.map(d => ({ ...d.data(), id: d.id }))), handleError);
    const unsubPlan = onSnapshot(getDbCollection('planimetrias'), (s) => setPlanimetrias(s.docs.map(d => ({ ...d.data(), id: d.id }))), handleError);
    const unsubDev = onSnapshot(getDbCollection('devoluciones'), (s) => setDevoluciones(s.docs.map(d => ({ ...d.data(), id: d.id }))), handleError);
    
    // MEJORA 3: Optimización del historial (Solo últimos 100 registros)
    const historialQuery = query(getDbCollection('historial'), orderBy('fecha', 'desc'), limit(100));
    const unsubHist = onSnapshot(historialQuery, (s) => setHistorial(s.docs.map(d => ({ ...d.data(), id: d.id }))), handleError);

    return () => { unsubInv(); unsubMaq(); unsubHist(); unsubPlan(); unsubDev(); };
  }, [isLogged]);

  // Validar permisos del usuario logueado
  useEffect(() => {
    if (!isLogged) return; if (sessionEmail.toLowerCase().trim() !== 'cristofer10murillo@gmail.com' && userList.length === 0) return;
    const emailLower = sessionEmail.toLowerCase().trim();
    if (emailLower === 'cristofer10murillo@gmail.com') {
      setIsAdmin(true); setAccessDenied(false);
    } else {
      const me = userList.find(u => String(u.email || '').toLowerCase().trim() === emailLower);
      if (me) { setAccessDenied(me.status !== 'authorized'); setIsAdmin(false); } 
      else { setAccessDenied(true); setIsAdmin(false); }
    }
  }, [isLogged, sessionEmail, userList]);

  // Limpiar carrito si se cambia el tipo de despacho
  useEffect(() => {
    setListaDespachoIndividual([]);
    setDespachoProductoId(''); setDespachoProductoCantidad(1);
    setDespachoMaquinaId(''); setDespachoCantidad(1);
  }, [tipoDespacho]);

  // Selección automática de planimetría
  useEffect(() => {
    if (planimetrias.length > 0 && !activePlanTab) setActivePlanTab(planimetrias[0].id);
    else if (planimetrias.length === 0) setActivePlanTab('');
  }, [planimetrias, activePlanTab]);


  // --- LÓGICA MEMORIZADA (KPIs y Proyecciones) ---
  
  // Cálculo de KPIs
  const kpis = useMemo(() => {
    let valorTotal = 0;
    const listaAlertas = [];
    const inventarioActivo = inventario.filter(i => i.activo !== false);

    inventarioActivo.forEach(item => {
      valorTotal += (Number(item.cantidad || 0) * (Number(item.costo || 0)));
      if (Number(item.cantidad || 0) <= Number(item.minimo || 0)) {
        listaAlertas.push({ id: item.id + '_b', item: item.nombre || 'S/N', tipo: 'Stock Crítico', mensaje: `Quedan ${item.cantidad || 0} uds`, color: 'rose', icon: <TrendingDown className="w-5 h-5"/> });
      }
      
      let cantVencidaOMenos30 = 0;
      let cantPorVencer60 = 0;

      if (item.lotes && item.lotes.length > 0) {
        item.lotes.forEach(lote => {
          if (lote.vencimiento) {
             const diff = new Date(lote.vencimiento) - new Date();
             const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
             if (dias <= 30) cantVencidaOMenos30 += lote.cantidad;
             else if (dias <= 60) cantPorVencer60 += lote.cantidad;
          }
        });
      } else if (item.vencimiento) {
         const diff = new Date(item.vencimiento) - new Date();
         const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
         if (dias <= 30) cantVencidaOMenos30 += Number(item.cantidad);
         else if (dias <= 60) cantPorVencer60 += Number(item.cantidad);
      }

      if (cantVencidaOMenos30 > 0) {
         listaAlertas.push({
            id: item.id + '_dev', productoId: item.id, item: item.nombre || 'S/N',
            tipo: 'Vencido o ≤30 días', mensaje: `${cantVencidaOMenos30} uds afectadas`, color: 'rose',
            icon: <AlertTriangle className="w-5 h-5"/>, accionDevolver: true, cantDefectuosa: cantVencidaOMenos30
         });
      }
      if (cantPorVencer60 > 0) {
         listaAlertas.push({
            id: item.id + '_warn', productoId: item.id, item: item.nombre || 'S/N',
            tipo: 'Por vencer', mensaje: `${cantPorVencer60} uds en 31-60 días`, color: 'amber',
            icon: <Calendar className="w-5 h-5"/>, accionDevolver: false
         });
      }
    });
    return { valorTotal, alertas: listaAlertas, totalProductos: inventarioActivo.length };
  }, [inventario]);

  // Simulación de Despacho
  const proyeccionDespacho = useMemo(() => {
    if (tipoDespacho === 'maquina') {
      const maq = maquinas.find(m => String(m.id) === String(despachoMaquinaId));
      if (!maq || despachoCantidad < 1) return [];
      return maq.receta.map(r => {
        const p = inventario.find(inv => String(inv.id) === String(r.productoId));
        const requerido = Number(r.cantidad) * despachoCantidad;
        const stockActual = Number(p?.cantidad) || 0;
        return { 
          productoId: r.productoId, nombre: p?.nombre || 'Eliminado', 
          requerido, stockActual, 
          diferencia: stockActual - requerido, suficiente: (stockActual - requerido) >= 0 
        };
      });
    } else {
      if (listaDespachoIndividual.length === 0) return [];
      const consolidados = {};
      listaDespachoIndividual.forEach(item => {
        if (!consolidados[item.productoId]) consolidados[item.productoId] = { ...item, requerido: 0 };
        consolidados[item.productoId].requerido += item.cantidad;
      });

      return Object.values(consolidados).map(item => {
        const p = inventario.find(inv => String(inv.id) === String(item.productoId));
        const stockActual = Number(p?.cantidad) || 0;
        return {
          productoId: item.productoId, nombre: item.nombre,
          requerido: item.requerido, stockActual: stockActual,
          diferencia: stockActual - item.requerido, suficiente: (stockActual - item.requerido) >= 0
        };
      });
    }
  }, [tipoDespacho, despachoMaquinaId, despachoCantidad, listaDespachoIndividual, inventario, maquinas]);

  const tieneResponsable = responsableDespacho.trim().length > 0;
  const tieneSeleccion = tipoDespacho === 'maquina' ? !!despachoMaquinaId : listaDespachoIndividual.length > 0;
  const sePuedeDespachar = proyeccionDespacho.length > 0 && proyeccionDespacho.every(p => p.suficiente) && tieneResponsable && tieneSeleccion;

  const maquinaFiltro = useMemo(() => maquinas.find(m => String(m.id) === String(filtroMaquinaId)), [filtroMaquinaId, maquinas]);
  
  const maxMaquinasPosibles = useMemo(() => {
    if (!maquinaFiltro || !maquinaFiltro.receta) return 0;
    let min = Infinity;
    for (const req of maquinaFiltro.receta) {
      const prod = inventario.find(p => String(p.id) === String(req.productoId));
      const qty = Number(prod?.cantidad) || 0;
      const reqQty = Number(req.cantidad) || 1;
      const posibles = Math.floor(qty / reqQty);
      if (posibles < min) min = posibles;
    }
    return min === Infinity ? 0 : min;
  }, [maquinaFiltro, inventario]);

  const inventarioAdminFiltrado = useMemo(() => {
    return inventario.filter(i => {
      const isOculto = i.activo === false;
      if (mostrarOcultosAdmin && !isOculto) return false;
      if (!mostrarOcultosAdmin && isOculto) return false;

      const nom = String(i.nombre || '').toLowerCase();
      const cod = String(i.codigo || '').toLowerCase();
      const busq = busquedaAdmin.toLowerCase();
      return nom.includes(busq) || cod.includes(busq);
    });
  }, [inventario, busquedaAdmin, mostrarOcultosAdmin]);

  const materialesConsolidados = useMemo(() => {
    const mapa = {};
    listaSolicitud.forEach(item => {
      if (item.tipo === 'maquina') {
        const maq = maquinas.find(m => String(m.id) === String(item.refId));
        if (maq && maq.receta) maq.receta.forEach(r => mapa[r.productoId] = (mapa[r.productoId] || 0) + (Number(r.cantidad) * Number(item.cantidad)));
      } else {
        mapa[item.refId] = (mapa[item.refId] || 0) + Number(item.cantidad);
      }
    });
    return Object.keys(mapa).map(prodId => {
      const p = inventario.find(inv => String(inv.id) === String(prodId));
      return { codigo: p?.codigo || 'N/A', nombre: p?.nombre || 'Eliminado', cantidad: mapa[prodId] };
    }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  }, [listaSolicitud, maquinas, inventario]);


  // --- FUNCIONES CORE (BASE DE DATOS Y AUTH) ---

  const saveToCloud = async (col, data) => {
    try {
      const id = data.id?.toString() || Date.now().toString();
      await setDoc(getDbDoc(col, id), data, { merge: true });
      return true;
    } catch (e) { notify(`Denegado (${col}): Verifica Reglas de Firebase`, "error"); return false; }
  };

  const deleteFromCloud = async (col, id) => {
    try { await deleteDoc(getDbDoc(col, id)); } catch (e) { notify("Denegado: Verifica Firebase", "error"); }
  };

  const toggleProductoActivo = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === false ? true : false;
      await updateDoc(getDbDoc('inventario', id), { activo: newStatus });
      notify(newStatus ? "Producto reactivado y visible" : "Producto ocultado correctamente");
    } catch (e) { notify("Error al cambiar estado del producto", "error"); }
  };

  const loginSuccess = (email, pwd) => {
    setIsLogged(true); localStorage.setItem('nexus_email', email); localStorage.setItem('nexus_pwd', pwd);
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError(''); 
    const email = sessionEmail.trim().toLowerCase();
    const pwd = loginPassword.trim();
    if (!email || !pwd) return setLoginError('Ingrese correo y contraseña');

    if (email === 'cristofer10murillo@gmail.com') {
      if (pwd === 'Shariton24') { 
        loginSuccess(email, pwd);
      } else { setLoginError('Contraseña incorrecta'); }
    } else {
      const user = userList.find(u => String(u.email || '').toLowerCase().trim() === email);
      if (!user) return setLoginError('Usuario no encontrado. Regístrate primero.');
      if (user.password !== pwd) return setLoginError('Contraseña incorrecta.');
      if (user.status !== 'authorized') return setLoginError('Tu acceso está pendiente de autorización.');
      loginSuccess(email, pwd);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLoginError(''); 
    const email = sessionEmail.trim().toLowerCase();
    const pwd = loginPassword.trim();
    
    if (!email || !pwd) return setLoginError('Ingrese correo y contraseña');
    if (email === 'cristofer10murillo@gmail.com') return setLoginError('ID reservado. Inicia sesión.');

    const userExists = userList.find(u => String(u.email || '').toLowerCase().trim() === email);
    if (userExists) return setLoginError('Este correo ya está registrado. Inicia sesión.');

    const success = await saveToCloud('users_access', { id: email.replace(/\./g, '_'), email, password: pwd, status: 'pending' });
    if (success) loginSuccess(email, pwd);
  };

  const handleLogout = () => { 
    localStorage.removeItem('nexus_email'); localStorage.removeItem('nexus_pwd'); 
    setIsLogged(false); setSessionEmail(''); setLoginPassword(''); setIsAdmin(false); setAccessDenied(false);
  };

  // --- LÓGICA DE NEGOCIO (DESPACHO, INGRESO, EXCEL) ---

  // MEJORA 5: Despacho seguro usando Batch
  const executarDespacho = async () => {
    if (!sePuedeDespachar) return notify("Verifique la simulación de stock", "error");

    try {
      const batch = writeBatch(db); // Iniciamos transacción segura

      for (const item of proyeccionDespacho) {
        const p = inventario.find(pi => String(pi.id) === String(item.productoId));
        let lotesActuales = p.lotes && Array.isArray(p.lotes) ? [...p.lotes] : [];
        
        if (lotesActuales.length === 0 && Number(p.cantidad) > 0) {
          lotesActuales.push({ cantidad: Number(p.cantidad), vencimiento: p.vencimiento || '' });
        }

        let cantADescontar = item.requerido;
        lotesActuales.sort((a, b) => {
          if (!a.vencimiento) return 1; if (!b.vencimiento) return -1;
          return new Date(a.vencimiento) - new Date(b.vencimiento);
        });

        for (let i = 0; i < lotesActuales.length; i++) {
          if (cantADescontar <= 0) break;
          if (lotesActuales[i].cantidad > 0) {
            const descontar = Math.min(lotesActuales[i].cantidad, cantADescontar);
            lotesActuales[i].cantidad -= descontar;
            cantADescontar -= descontar;
          }
        }
        
        lotesActuales = lotesActuales.filter(l => l.cantidad > 0);
        const nuevaCantTotal = lotesActuales.reduce((acc, l) => acc + l.cantidad, 0);
        const proximoVencer = lotesActuales.find(l => l.cantidad > 0 && l.vencimiento)?.vencimiento || '';

        // Añadimos la actualización al batch
        const prodRef = doc(db, 'inventario', item.productoId);
        batch.update(prodRef, { cantidad: nuevaCantTotal, lotes: lotesActuales, vencimiento: proximoVencer });
      }

      // Registro en historial (también al batch)
      if (tipoDespacho === 'maquina') {
        const maq = maquinas.find(m => String(m.id) === String(despachoMaquinaId));
        const histRef = doc(collection(db, 'historial'));
        batch.set(histRef, {
          fecha: new Date().toISOString(), tipo: 'Salida', 
          producto: maq?.nombre, cantidad: despachoCantidad,
          responsable: responsableDespacho, detalles: `Despacho ${despachoCantidad}x ${maq?.nombre}`
        });
      } else {
        for (const item of proyeccionDespacho) {
          const histRef = doc(collection(db, 'historial'));
          batch.set(histRef, {
            fecha: new Date().toISOString(), tipo: 'Salida', 
            producto: item.nombre, cantidad: item.requerido,
            responsable: responsableDespacho, detalles: 'Despacho Individual (Consolidado)'
          });
        }
      }

      // Ejecutamos todo el batch junto
      await batch.commit();

      notify("Despacho registrado correctamente y seguro");
      setResponsableDespacho(''); 
      setDespachoCantidad(1); 
      setDespachoProductoCantidad(1);
      setListaDespachoIndividual([]);
      setPestañaActiva('historial');
    } catch (e) {
      console.error(e);
      notify("Hubo un error al guardar el despacho. No se hicieron cambios.", "error");
    }
  };

  const executarIngreso = async () => {
    if (!responsableIngreso.trim()) return notify("Indique el responsable", "error");
    if (listaIngreso.length === 0) return notify("La lista está vacía", "error");

    try {
      const batch = writeBatch(db);
      const ingresosAgrupados = {};
      
      listaIngreso.forEach(item => {
        if (!ingresosAgrupados[item.productoId]) ingresosAgrupados[item.productoId] = [];
        ingresosAgrupados[item.productoId].push(item);
      });

      for (const prodId in ingresosAgrupados) {
        const prod = inventario.find(p => String(p.id) === String(prodId));
        if (!prod) continue;
        
        let lotesActuales = prod.lotes && Array.isArray(prod.lotes) ? [...prod.lotes] : [];
        if (lotesActuales.length === 0 && Number(prod.cantidad) > 0) {
          lotesActuales.push({ cantidad: Number(prod.cantidad), vencimiento: prod.vencimiento || '' });
        }
        
        const itemsDelProducto = ingresosAgrupados[prodId];
        for (const item of itemsDelProducto) {
          lotesActuales.push({ cantidad: Number(item.cantidad), vencimiento: item.vencimiento || '' });
        }
        
        const lotesMap = {};
        lotesActuales.forEach(l => {
          if (l.cantidad > 0) {
             const key = l.vencimiento || 'SIN_FECHA';
             if (!lotesMap[key]) lotesMap[key] = 0;
             lotesMap[key] += Number(l.cantidad);
          }
        });

        lotesActuales = Object.keys(lotesMap).map(key => ({
          vencimiento: key === 'SIN_FECHA' ? '' : key,
          cantidad: lotesMap[key]
        }));

        lotesActuales.sort((a, b) => {
          if (!a.vencimiento) return 1; if (!b.vencimiento) return -1;
          return new Date(a.vencimiento) - new Date(b.vencimiento);
        });

        const nuevaCantTotal = lotesActuales.reduce((acc, l) => acc + l.cantidad, 0);
        const proximoVencer = lotesActuales.find(l => l.cantidad > 0 && l.vencimiento)?.vencimiento || '';

        const prodRef = doc(db, 'inventario', prodId);
        batch.update(prodRef, { cantidad: nuevaCantTotal, lotes: lotesActuales, vencimiento: proximoVencer });

        for (const item of itemsDelProducto) {
          const histRef = doc(collection(db, 'historial'));
          batch.set(histRef, {
            fecha: new Date().toISOString(), tipo: 'Entrada', producto: item.nombre, cantidad: item.cantidad,
            responsable: responsableIngreso, detalles: `Ingreso de inventario. Vence: ${item.vencimiento || 'N/A'}`
          });
        }
      }
      
      await batch.commit();
      notify("Ingreso registrado correctamente");
      setListaIngreso([]); setResponsableIngreso(''); setPestañaActiva('historial');
    } catch (e) { notify("Error al registrar ingreso.", "error"); }
  };

  const exportarExcel = async (headers, rows, filename) => {
    try {
      const XLSX = await getXLSX();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Datos");
      XLSX.writeFile(wb, `${filename}.xlsx`);
      notify('Excel descargado');
    } catch (e) { notify('Error al generar Excel', 'error'); }
  };

  

  // --- RENDERS DE COMPONENTES AUXILIARES ---

  const procesarDevolucion = async (productoId) => {
    const prod = inventario.find(p => String(p.id) === String(productoId));
    if (!prod) return;

    let lotesRestantes = [];
    let cantRemovida = 0;

    if (prod.lotes && prod.lotes.length > 0) {
        prod.lotes.forEach(lote => {
            if (lote.vencimiento) {
                const diff = new Date(lote.vencimiento) - new Date();
                const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
                if (dias <= 30) cantRemovida += lote.cantidad;
                else lotesRestantes.push(lote);
            } else lotesRestantes.push(lote);
        });
    } else {
        cantRemovida = Number(prod.cantidad);
        lotesRestantes = [];
    }

    if (cantRemovida <= 0) return notify("No se encontraron unidades en esta condición.", "error");

    const nuevaCantTotal = lotesRestantes.reduce((acc, l) => acc + l.cantidad, 0);
    const proximoVencer = lotesRestantes.find(l => l.cantidad > 0 && l.vencimiento)?.vencimiento || '';

    try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'inventario', prod.id), { cantidad: nuevaCantTotal, lotes: lotesRestantes, vencimiento: proximoVencer });
        
        batch.set(doc(collection(db, 'devoluciones')), {
            fecha: new Date().toISOString(), productoId: prod.id, producto: prod.nombre,
            codigo: prod.codigo || 'N/A', cantidad: cantRemovida, responsable: sessionEmail,
            motivo: 'Retiro por caducidad (≤30 días o vencido)'
        });

        batch.set(doc(collection(db, 'historial')), {
            fecha: new Date().toISOString(), tipo: 'Salida', producto: prod.nombre,
            cantidad: cantRemovida, responsable: sessionEmail, detalles: 'Movido a Devoluciones por caducidad'
        });

        await batch.commit();
        notify(`Se despacharon ${cantRemovida} unidades a Devoluciones exitosamente`);
    } catch (error) { notify("Error de permisos al procesar devolución.", "error"); }
  };

  const resolverDevolucion = async (dev) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'devoluciones', dev.id));
      batch.set(doc(collection(db, 'historial')), {
        fecha: new Date().toISOString(), tipo: 'Salida', producto: dev.producto,
        cantidad: dev.cantidad, responsable: sessionEmail, detalles: 'Liquidación de devolución finalizada'
      });
      await batch.commit();
      notify("Producto liquidado y eliminado de devoluciones exitosamente");
    } catch (e) { notify("Error al intentar liquidar la devolución.", "error"); }
  };


  // --- PANTALLAS PRINCIPALES ---

  // PANTALLA LOGIN
  if (!isLogged) return (
    <div className="min-h-screen bg-[#0d101b] flex items-center justify-center p-4 font-sans selection:bg-[#5B50FF]/30 selection:text-white">
      <div className="bg-[#1e2235] border border-[#2d324f] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] w-full max-w-sm p-10 text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-[#5B50FF]/10 blur-[80px] pointer-events-none"></div>
        <div className="relative z-10">
          <Shield className="w-12 h-12 mx-auto mb-4 text-[#8a82ff]" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Nexus Pro</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">Control Operations</p>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{isRegistering ? 'Correo Electrónico' : 'Identificación'}</label>
              <input type="text" value={sessionEmail || ''} onChange={e => { setSessionEmail(e.target.value); setLoginError(''); }} className="w-full p-4 bg-[#131627] border border-[#2d324f] rounded-xl text-sm font-medium text-white outline-none focus:bg-[#181c30] focus:ring-1 focus:ring-[#5B50FF] focus:border-[#5B50FF] transition-all" placeholder="Usuario o Correo" />
            </div>
            <div className="animate-in slide-in-from-top-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{sessionEmail.toLowerCase().trim() === 'cristofer10murillo@gmail.com' ? 'Master Key' : 'Contraseña'}</label>
              <input type="password" value={loginPassword || ''} onChange={e => { setLoginPassword(e.target.value); setLoginError(''); }} className="w-full p-4 bg-[#131627] border border-[#2d324f] rounded-xl text-sm font-medium text-white outline-none focus:bg-[#181c30] focus:ring-1 focus:ring-[#5B50FF] focus:border-[#5B50FF] transition-all" placeholder="••••••••" />
            </div>
            {loginError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold py-3 rounded-xl text-center animate-in fade-in">{loginError}</div>}
            <button type="submit" className="w-full bg-[#5B50FF] hover:bg-[#4a40d4] text-white font-semibold py-4 rounded-xl mt-2 shadow-[0_0_20px_rgba(91,80,255,0.3)] transition-all active:scale-[0.98]">{isRegistering ? 'Crear Cuenta' : 'Ingresar al Sistema'}</button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }} className="text-xs font-medium text-slate-400 hover:text-[#5B50FF] transition-colors">{isRegistering ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // PANTALLA PENDIENTE DE APROBACIÓN
  if (accessDenied && !isAdmin) return (
    <div className="min-h-screen bg-[#0d101b] flex items-center justify-center p-6 text-center font-sans">
      <div className="bg-[#1e2235] p-10 rounded-3xl shadow-2xl border border-[#2d324f] max-w-md animate-in fade-in duration-500">
        <Clock className="w-16 h-16 text-amber-500 mx-auto mb-6 opacity-80" />
        <h2 className="text-2xl font-bold text-white">Acceso Pendiente</h2>
        <p className="mt-4 text-slate-400 text-sm leading-relaxed">Hola <span className="font-semibold text-slate-200">{sessionEmail}</span>. Tu solicitud de acceso está siendo revisada por administración.</p>
        <button onClick={handleLogout} className="mt-8 text-[#5B50FF] font-semibold flex items-center justify-center mx-auto hover:text-[#7a72ff] transition-colors"><LogOut className="w-4 h-4 mr-2" /> Usar otra cuenta</button>
      </div>
    </div>
  );

  // APLICACIÓN PRINCIPAL
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans pb-24 selection:bg-[#5B50FF]/30 selection:text-white relative">
      
      {/* LIGHTBOX DE IMÁGENES */}
      {imagenAmpliada && (
        <div className="fixed inset-0 z-[600] bg-[#0B0F19]/95 backdrop-blur-xl flex items-center justify-center p-6 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setImagenAmpliada(null)}>
          <button className="absolute top-8 right-8 bg-[#1e2235] text-white p-3 rounded-full hover:bg-rose-500 transition-colors border border-[#2d324f] shadow-2xl z-10"><X className="w-6 h-6"/></button>
          <img src={imagenAmpliada} className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-[#2d324f]" alt="Plano Ampliado" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* NOTIFICACIONES TOAST */}
      {notificacion && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[300] px-6 py-3 bg-[#1e2235] border border-[#2d324f] shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-white rounded-full flex items-center gap-3 animate-in slide-in-from-top-5 fade-in duration-300">
          {notificacion.tipo === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400"/> : <CheckCircle className="w-4 h-4 text-emerald-400"/>}
          <span className="text-sm font-medium">{notificacion.mensaje}</span>
        </div>
      )}
      
      {/* NAVEGACIÓN SUPERIOR */}
      <header className="sticky top-0 z-[100] bg-[#1e2235]/80 backdrop-blur-xl border-b border-[#2d324f] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setPestañaActiva('dashboard')}>
            <div className="bg-[#5B50FF] p-2.5 rounded-xl shadow-[0_0_15px_rgba(91,80,255,0.4)] group-hover:scale-105 transition-transform"><Package className="w-5 h-5 text-white"/></div>
            <div><h1 className="text-lg font-bold tracking-tight text-white leading-none">Nexus Pro</h1><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Control System</p></div>
          </div>
          <nav className="hidden md:flex items-center gap-1.5 p-1.5 bg-[#0F141E] rounded-2xl border border-[#2d324f] overflow-x-auto custom-scrollbar">
            {[
              {id:'dashboard', label:'Panel', icon: <LayoutDashboard className="w-4 h-4"/>},
              {id:'inventario', label:'Bodega', icon: <Box className="w-4 h-4"/>},
              {id:'ingreso', label:'Ingresos', icon: <Inbox className="w-4 h-4"/>},
              {id:'despacho', label:'Salidas', icon: <Truck className="w-4 h-4"/>},
              {id:'solicitud', label:'Solicitudes', icon: <ClipboardList className="w-4 h-4"/>},
              {id:'historial', label:'Historial', icon: <History className="w-4 h-4"/>},
              {id:'devoluciones', label:'Devoluciones', icon: <Archive className="w-4 h-4"/>},
              {id:'planimetrias', label:'Planimetrías', icon: <LayoutGrid className="w-4 h-4"/>}
            ].map(t => (
              <button key={t.id} onClick={() => setPestañaActiva(t.id)} className={`px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all whitespace-nowrap ${pestañaActiva === t.id ? 'bg-[#5B50FF] text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-[#2A3143]/50'}`}>{t.icon} {t.label}</button>
            ))}
            <div className="w-px h-6 bg-[#2d324f] mx-2"></div>
            <button onClick={handleLogout} className="px-3 py-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" title="Cerrar Sesión"><LogOut className="w-4 h-4"/></button>
          </nav>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL DE PESTAÑAS */}
      <main className="max-w-7xl mx-auto p-6 pt-10 animate-in fade-in duration-500">
        
        {/* === PESTAÑA: DASHBOARD === */}
        {pestañaActiva === 'dashboard' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-[#5B50FF] to-[#8a82ff] rounded-3xl p-10 text-white shadow-[0_10px_40px_rgba(91,80,255,0.2)] relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
              <div className="relative z-10"><h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Resumen Operativo</h2><p className="text-indigo-100 font-medium text-sm">Monitoreo de capital y estado de stock en tiempo real.</p></div>
              <div className="relative z-10 bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center gap-4"><div className="bg-white/20 p-3 rounded-xl"><User className="w-5 h-5"/></div><div><p className="text-[10px] text-indigo-100 uppercase tracking-wider font-semibold">Sesión Actual</p><p className="font-semibold text-sm">{sessionEmail}</p></div></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1e2235] p-6 rounded-3xl border border-[#2d324f] flex items-start gap-5 hover:border-[#5B50FF]/50 transition-all"><div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400"><Wallet className="w-6 h-6"/></div><div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Capital Valorizado</p><h3 className="text-3xl font-bold text-white">₡{kpis.valorTotal.toLocaleString()}</h3></div></div>
              <div className="bg-[#1e2235] p-6 rounded-3xl border border-[#2d324f] flex items-start gap-5 hover:border-[#5B50FF]/50 transition-all"><div className="bg-[#5B50FF]/10 border border-[#5B50FF]/20 p-4 rounded-2xl text-[#5B50FF]"><Box className="w-6 h-6"/></div><div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total SKUs Activos</p><h3 className="text-3xl font-bold text-white">{kpis.totalProductos}</h3></div></div>
              <div className={`bg-[#1e2235] p-6 rounded-3xl flex items-start gap-5 border transition-all ${kpis.alertas.length > 0 ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'border-[#2d324f]'}`}><div className={`p-4 rounded-2xl border ${kpis.alertas.length > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-[#0F141E] border-[#2d324f] text-slate-500'}`}><BellRing className="w-6 h-6"/></div><div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Alertas Detectadas</p><h3 className={`text-3xl font-bold ${kpis.alertas.length > 0 ? 'text-rose-400' : 'text-white'}`}>{kpis.alertas.length}</h3></div></div>
            </div>

            {kpis.alertas.length > 0 && (
              <div className="pt-4">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500"/> Notificaciones de Inventario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {kpis.alertas.map(a => (
                    <div key={a.id} className={`bg-[#1e2235] p-5 rounded-2xl border border-[#2d324f] flex flex-col justify-between relative overflow-hidden`}>
                      <div className="flex items-start gap-4">
                        <div className={`absolute left-0 top-0 w-1 h-full bg-${a.color}-500`}></div>
                        <div className={`p-3 rounded-xl bg-[#0F141E] border border-[#2d324f] text-${a.color}-400 shrink-0`}>{a.icon}</div>
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider text-${a.color}-400 mb-1`}>{a.tipo}</p>
                          <p className="font-semibold text-white text-sm leading-tight">{a.item}</p>
                          <p className="text-xs text-slate-400 mt-1.5">{a.mensaje}</p>
                        </div>
                      </div>
                      {a.accionDevolver && (
                        <button onClick={() => procesarDevolucion(a.productoId)} className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          <Archive className="w-3.5 h-3.5" /> Despachar a Devoluciones
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === PESTAÑA: BODEGA === */}
        {pestañaActiva === 'inventario' && (
          <div className="space-y-6">
            <div className="bg-[#1e2235] p-4 rounded-3xl border border-[#2d324f] shadow-lg flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#5B50FF] transition-colors w-4 h-4"/><input type="text" placeholder="Buscar por nombre o SKU..." value={busqueda || ''} onChange={e => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl text-sm outline-none text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all"/></div>
              <div className="w-full lg:w-72 relative"><select value={filtroMaquinaId || ''} onChange={e => setFiltroMaquinaId(e.target.value)} className="w-full pl-4 pr-10 py-3.5 bg-[#0F141E] border border-[#2d324f] text-slate-300 rounded-xl text-sm font-medium outline-none cursor-pointer focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all appearance-none"><option value="">Bodega Completa</option><optgroup label="Filtrar por Receta">{maquinas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</optgroup></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"/></div>
            </div>

            {maquinaFiltro && (
              <div className="bg-[#5B50FF]/10 border border-[#5B50FF]/30 p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-6 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4"><div className="bg-[#0F141E] border border-[#5B50FF]/30 p-3 rounded-2xl shadow-sm"><Coffee className="w-6 h-6 text-[#5B50FF]"/></div><div><h3 className="text-lg font-bold text-white">Capacidad: {maquinaFiltro.nombre}</h3><p className="text-slate-400 text-xs font-medium mt-1">Límite basado en el inventario actual de la receta.</p></div></div>
                <div className="bg-[#0F141E] border border-[#5B50FF]/30 px-8 py-4 rounded-2xl shadow-sm flex flex-col items-center min-w-[150px]"><span className="text-3xl font-black text-[#5B50FF] leading-none">{maxMaquinasPosibles}</span><span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mt-1">Unidades</span></div>
              </div>
            )}

            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden">
               <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#0F141E] border-b border-[#2d324f]"><tr><th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider">SKU / Producto</th><th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider text-center">En Bodega</th>{maquinaFiltro && <th className="px-6 py-4 font-semibold text-xs text-[#5B50FF] uppercase tracking-wider text-center bg-[#5B50FF]/5">Simulación</th>}<th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider text-center">Caducidad</th></tr></thead><tbody className="divide-y divide-[#2d324f]">
                    {inventario.filter(i => i.activo !== false).filter(i => {
                      const match = String(i.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) || String(i.codigo || '').toLowerCase().includes(busqueda.toLowerCase());
                      const recipe = maquinaFiltro ? maquinaFiltro.receta.some(r => String(r.productoId) === String(i.id)) : true;
                      return match && recipe;
                    }).map(item => {
                      const req = maquinaFiltro?.receta?.find(r => String(r.productoId) === String(item.id));
                      const sim = req ? Math.floor(Number(item.cantidad) / Number(req.cantidad)) : null;
                      const critico = Number(item.cantidad) <= Number(item.minimo);
                      
                      let fechaMostrar = item.vencimiento || 'Sin Fecha';
                      let multiplesLotes = false; // MEJORA 4: Indicador de Múltiples Lotes
                      if (item.lotes && item.lotes.length > 0) {
                         const lotesValidos = item.lotes.filter(l => l.cantidad > 0 && l.vencimiento);
                         if (lotesValidos.length > 0) {
                            lotesValidos.sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento));
                            fechaMostrar = lotesValidos[0].vencimiento;
                            multiplesLotes = lotesValidos.length > 1; // Si hay más de un lote válido, encendemos el flag
                         } else {
                            fechaMostrar = 'Sin Fecha';
                         }
                      }

                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className={`p-2.5 rounded-xl border ${critico ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-[#0F141E] border-[#2d324f] text-slate-500 group-hover:text-[#5B50FF] group-hover:border-[#5B50FF]/50 transition-colors'}`}><Package className="w-4 h-4"/></div>
                              <div>
                                <p className="font-semibold text-slate-200">{item.nombre || 'S/N'}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.codigo || 'S/C'} <span className="mx-1">•</span> {item.categoria || 'Gen'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1.5 rounded-lg font-bold ${critico ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'text-slate-300 bg-[#0F141E] border border-[#2d324f]'}`}>{item.cantidad || 0}</span>
                          </td>
                          {maquinaFiltro && (
                            <td className="px-6 py-4 text-center bg-[#5B50FF]/5">
                              {sim !== null ? <span className={`font-bold ${sim === maxMaquinasPosibles ? 'text-[#5B50FF]' : 'text-slate-400'}`}>{sim}</span> : <span className="text-slate-600">-</span>}
                            </td>
                          )}
                          <td className="px-6 py-4 text-center flex flex-col items-center justify-center gap-1">
                            <span className={`text-xs font-medium ${fechaMostrar !== 'Sin Fecha' ? 'text-slate-400' : 'text-slate-600 italic'}`}>{fechaMostrar}</span>
                            {/* MEJORA 4: Badge Visual para Operadores */}
                            {multiplesLotes && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md flex items-center gap-1" title="El sistema tomará primero la fecha más cercana al despachar."><Layers className="w-3 h-3"/> Varios Lotes</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody></table></div>
            </div>
          </div>
        )}

        {/* === PESTAÑA: INGRESOS === */}
        {pestañaActiva === 'ingreso' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8 space-y-8 flex flex-col">
              <div className="flex items-center gap-3"><div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20"><Inbox className="w-6 h-6 text-emerald-400"/></div><div><h3 className="text-2xl font-bold text-white tracking-tight">Ingreso de Bodega</h3><p className="text-xs text-slate-400 mt-1">Registra entrada de productos al inventario.</p></div></div>
              <div className="space-y-6">
                <div className="space-y-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Responsable del Ingreso</label><input type="text" placeholder="Tu nombre..." value={responsableIngreso || ''} onChange={e => setResponsableIngreso(e.target.value)} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
                <div className="space-y-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Seleccionar Insumo</label><BuscadorProducto inventario={inventario.filter(p => p.activo !== false)} valor={ingresoProductoId} onChange={setIngresoProductoId} className="!py-3.5 !rounded-xl !bg-[#0F141E]" /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Cant. Recibida</label><input type="number" min="1" value={ingresoCantidad || ''} onChange={e => setIngresoCantidad(Number(e.target.value))} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none font-bold text-emerald-400 text-center focus:border-[#5B50FF]" /></div><div className="space-y-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Fecha Caducidad</label><input type="date" value={ingresoVencimiento || ''} onChange={e => setIngresoVencimiento(e.target.value)} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-slate-300 focus:border-[#5B50FF]" /></div></div>
                <button onClick={() => {
                  if (!ingresoProductoId) return notify("Seleccione un insumo", "error");
                  if (ingresoCantidad <= 0) return notify("Cantidad inválida", "error");
                  const prod = inventario.find(p => String(p.id) === String(ingresoProductoId));
                  if (!prod) return notify("Producto no encontrado", "error");
                  setListaIngreso(prev => [...prev, { id: Date.now() + Math.random(), productoId: prod.id, nombre: prod.nombre, codigo: prod.codigo, cantidad: ingresoCantidad, vencimiento: ingresoVencimiento }]);
                  setIngresoProductoId(''); setIngresoCantidad(1); setIngresoVencimiento(''); notify("Insumo añadido al consolidado");
                }} className="w-full bg-[#2d324f] hover:bg-[#3f466b] text-white py-4 rounded-xl font-semibold transition-all flex justify-center items-center gap-2"><Plus className="w-4 h-4"/> Añadir a Consolidado</button>
              </div>
            </div>

            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden flex flex-col">
              <div className="p-6 bg-[#0F141E] border-b border-[#2d324f] flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2">Consolidado de Entrada</h3><span className="bg-[#5B50FF]/10 text-[#5B50FF] border border-[#5B50FF]/20 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{listaIngreso.length} Items</span></div>
              <div className="flex-1 p-6 space-y-3 overflow-y-auto custom-scrollbar min-h-[250px] max-h-[350px]">
                {listaIngreso.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-[#131627] border border-[#2d324f] rounded-xl hover:border-emerald-500/50 transition-colors"><div><p className="font-semibold text-sm text-slate-200">{item.nombre}</p><p className="text-[10px] text-slate-500 mt-1">Vence: <span className="font-medium text-slate-300">{item.vencimiento || 'N/A'}</span></p></div><div className="flex items-center gap-4"><span className="font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">+{item.cantidad}</span><button onClick={() => setListaIngreso(listaIngreso.filter(i => i.id !== item.id))} className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button></div></div>
                ))}
                {listaIngreso.length === 0 && <p className="text-center py-10 text-slate-500 text-sm">No hay productos en el consolidado.</p>}
              </div>
              <div className="p-6 bg-[#0F141E] border-t border-[#2d324f]"><button onClick={executarIngreso} disabled={listaIngreso.length === 0} className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all flex justify-center items-center gap-2 ${listaIngreso.length === 0 ? 'bg-[#2d324f] text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20 active:scale-[0.98]'}`}>Confirmar Ingreso al Inventario <ChevronRight className="w-4 h-4"/></button></div>
            </div>
          </div>
        )}

        {/* === PESTAÑA: DESPACHO === */}
        {pestañaActiva === 'despacho' && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-2xl overflow-hidden">
              <div className="bg-[#0F141E] border-b border-[#2d324f] p-8 flex items-center gap-4">
                 <div className="bg-[#1e2235] p-3 rounded-2xl border border-[#2d324f]"><Truck className="w-6 h-6 text-rose-400" /></div>
                 <div>
                   <h2 className="text-xl font-bold text-white">Registro de Salidas</h2>
                   <p className="text-sm text-slate-500">Descuenta inventario de forma consolidada.</p>
                 </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400">Responsable</label>
                    <input type="text" placeholder="Nombre de quien retira..." value={responsableDespacho || ''} onChange={e => setResponsableDespacho(e.target.value)} 
                           className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400">Modalidad</label>
                    <div className="flex bg-[#0F141E] border border-[#2d324f] p-1.5 rounded-xl">
                      <button onClick={()=>setTipoDespacho('maquina')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${tipoDespacho==='maquina'?'bg-[#2d324f] text-white shadow-sm':'text-slate-500 hover:text-slate-300'}`}>Por Máquina</button>
                      <button onClick={()=>setTipoDespacho('producto')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${tipoDespacho==='producto'?'bg-[#2d324f] text-white shadow-sm':'text-slate-500 hover:text-slate-300'}`}>Individual</button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F141E] border border-[#2d324f] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-end shadow-inner">
                  {tipoDespacho === 'maquina' ? (
                    <>
                      <div className="md:col-span-3 space-y-2">
                        <label className="text-xs font-semibold text-slate-400">Seleccionar Equipo</label>
                        <select value={despachoMaquinaId || ''} onChange={e=>setDespachoMaquinaId(e.target.value)} className="w-full p-3.5 bg-[#1e2235] border border-[#2d324f] rounded-xl outline-none text-sm font-medium text-white focus:border-[#5B50FF] transition-all cursor-pointer">
                          <option value="">--- Seleccionar ---</option>
                          {maquinas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 text-center block">Cant.</label>
                        <input type="number" min="1" value={despachoCantidad || ''} onChange={e=>setDespachoCantidad(Number(e.target.value))} className="w-full p-3.5 bg-[#1e2235] border border-[#2d324f] rounded-xl outline-none text-center font-bold text-white focus:border-[#5B50FF]" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-3 space-y-2">
                        <label className="text-xs font-semibold text-slate-400">Buscar Insumo</label>
                        <BuscadorProducto inventario={inventario.filter(p => p.activo !== false)} valor={despachoProductoId} onChange={setDespachoProductoId} className="!py-3.5 !rounded-xl !bg-[#1e2235]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 text-center block">Cant.</label>
                        <input type="number" min="1" value={despachoProductoCantidad || ''} onChange={e=>setDespachoProductoCantidad(Number(e.target.value))} className="w-full p-3.5 bg-[#1e2235] border border-[#2d324f] rounded-xl outline-none text-center font-bold text-white focus:border-[#5B50FF]" />
                      </div>
                      <div className="md:col-span-4 mt-2">
                        <button onClick={() => {
                          if (!despachoProductoId) return notify("Seleccione un insumo", "error");
                          if (despachoProductoCantidad <= 0) return notify("Cantidad inválida", "error");
                          const prod = inventario.find(p => String(p.id) === String(despachoProductoId));
                          if (!prod) return notify("Producto no encontrado", "error");
                          setListaDespachoIndividual(prev => [...prev, { id: Date.now() + Math.random(), productoId: prod.id, nombre: prod.nombre, cantidad: despachoProductoCantidad }]);
                          setDespachoProductoId(''); setDespachoProductoCantidad(1); notify("Insumo añadido al carrito de despacho");
                        }} className="w-full bg-[#2d324f] hover:bg-[#3f466b] text-white py-3 rounded-xl font-semibold transition-all flex justify-center items-center gap-2">
                          <Plus className="w-4 h-4"/> Añadir al Carrito de Salida
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {tieneSeleccion && (
                  <div className="bg-[#0F141E] border border-[#2d324f] rounded-2xl p-6 shadow-inner animate-in fade-in slide-in-from-bottom-4 mt-8">
                    <h3 className="font-bold text-white flex items-center mb-6">
                      <TrendingDown className="w-5 h-5 mr-2 text-rose-500" /> Resumen de Despacho (Consolidado)
                    </h3>
                    <div className="overflow-x-auto border border-[#2d324f] rounded-xl custom-scrollbar max-h-64">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#131627] border-b border-[#2d324f] sticky top-0 z-10">
                          <tr>
                            <th className="p-4 font-semibold text-xs text-slate-400 uppercase tracking-widest">Insumo</th>
                            <th className="p-4 font-semibold text-xs text-slate-400 uppercase tracking-widest text-center">Stock Actual</th>
                            <th className="p-4 font-semibold text-xs text-slate-400 uppercase tracking-widest text-center">Salida</th>
                            <th className="p-4 font-semibold text-xs text-slate-400 uppercase tracking-widest text-center">Restante</th>
                            {tipoDespacho === 'producto' && <th className="p-4"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d324f]">
                          {proyeccionDespacho.map((p, i) => (
                            <tr key={i} className={`transition-colors ${p.suficiente ? 'bg-[#0F141E] hover:bg-white/5' : 'bg-rose-500/10'}`}>
                              <td className="p-4 font-semibold text-slate-200">{p.nombre}</td>
                              <td className="p-4 text-center text-slate-400">{p.stockActual}</td>
                              <td className="p-4 text-center font-bold text-[#5B50FF]">- {p.requerido}</td>
                              <td className={`p-4 text-center font-bold ${p.suficiente ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {p.diferencia} {!p.suficiente && <span className="text-[9px] uppercase ml-2 bg-rose-500 text-white px-2 py-0.5 rounded shadow">Falta Stock</span>}
                              </td>
                              {tipoDespacho === 'producto' && (
                                <td className="p-4 text-right">
                                  <button onClick={() => setListaDespachoIndividual(listaDespachoIndividual.filter(item => item.id !== listaDespachoIndividual.find(x => x.productoId === p.productoId)?.id))} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-4 h-4"/></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!sePuedeDespachar && (
                      <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center text-rose-400 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
                        {!tieneResponsable ? "Identificación Requerida: Ingrese el responsable para autorizar." : "Stock Insuficiente: No hay existencias suficientes para esta salida."}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={executarDespacho} disabled={!sePuedeDespachar} className={`w-full text-white py-4 rounded-xl font-bold text-sm transition-all mt-8 flex justify-center items-center gap-2 ${sePuedeDespachar ? 'bg-[#5B50FF] shadow-[0_0_20px_rgba(91,80,255,0.3)] hover:bg-[#4a40d4] active:scale-[0.98]' : 'bg-[#2d324f] text-slate-500 cursor-not-allowed'}`}>
                  Procesar Salida Definitiva <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === PESTAÑA: SOLICITUDES === */}
        {pestañaActiva === 'solicitud' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8 space-y-8 flex flex-col">
              <h3 className="text-2xl font-bold text-white tracking-tight">Nueva Solicitud</h3>
              <div className="flex bg-[#0F141E] border border-[#2d324f] p-1.5 rounded-xl">
                <button onClick={() => setSolTipoSeleccion('maquina')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${solTipoSeleccion === 'maquina' ? 'bg-[#2d324f] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Por Máquina</button>
                <button onClick={() => setSolTipoSeleccion('producto')} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${solTipoSeleccion === 'producto' ? 'bg-[#2d324f] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Por Insumo</button>
              </div>
              
              <div className="space-y-6">
                {solTipoSeleccion === 'maquina' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Modelo de Máquina</label>
                      <select value={solMaquinaId || ''} onChange={e => setSolMaquinaId(e.target.value)} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] transition-all cursor-pointer">
                        <option value="">-- Escoger --</option>
                        {maquinas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Cantidad Unidades</label>
                      <input type="number" min="1" value={solMaquinaCant ?? ''} onChange={e => setSolMaquinaCant(Number(e.target.value))} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none font-bold text-white focus:border-[#5B50FF]" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Seleccionar Insumo</label>
                      <BuscadorProducto inventario={inventario.filter(p => p.activo !== false)} valor={solProductoId} onChange={setSolProductoId} className="!py-3.5 !rounded-xl !bg-[#0F141E]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Cantidad a Pedir</label>
                      <input type="number" min="1" value={solProductoCant ?? ''} onChange={e => setSolProductoCant(Number(e.target.value))} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none font-bold text-white focus:border-[#5B50FF]" />
                    </div>
                  </>
                )}
                <button onClick={() => {
                  if (solTipoSeleccion === 'maquina') {
                    if (!solMaquinaId) return notify("Seleccione una máquina", "error");
                    const maq = maquinas.find(m => String(m.id) === String(solMaquinaId));
                    if (maq) setListaSolicitud([...listaSolicitud, { id: Date.now() + Math.random(), tipo: 'maquina', refId: maq.id, nombre: maq.nombre, cantidad: solMaquinaCant }]);
                    setSolMaquinaId(''); setSolMaquinaCant(1);
                  } else {
                    if (!solProductoId) return notify("Seleccione un insumo", "error");
                    const prod = inventario.find(p => String(p.id) === String(solProductoId));
                    if (prod) setListaSolicitud([...listaSolicitud, { id: Date.now() + Math.random(), tipo: 'producto', refId: prod.id, nombre: prod.nombre, cantidad: solProductoCant }]);
                    setSolProductoId(''); setSolProductoCant(1);
                  }
                  notify('Añadido a solicitud exitosamente');
                }} className="w-full bg-[#5B50FF] text-white py-4 rounded-xl font-semibold shadow-[0_0_20px_rgba(91,80,255,0.3)] hover:bg-[#4a40d4] active:scale-[0.98] transition-all mt-4 flex justify-center items-center gap-2">
                  <Plus className="w-4 h-4"/> Añadir a la Lista
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 bg-[#0F141E] border-b border-[#2d324f] flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#5B50FF]"/> Lista de Pedido</h3>
                  <button onClick={() => setListaSolicitud([])} className="text-rose-500 text-xs font-semibold hover:underline">Limpiar</button>
                </div>
                <div className="p-6 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {listaSolicitud.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-[#131627] border border-[#2d324f] rounded-xl hover:border-[#5B50FF]/50 transition-colors">
                      <span className="font-semibold text-sm text-slate-200">{item.nombre}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#5B50FF] bg-[#5B50FF]/10 px-3 py-1 rounded-lg border border-[#5B50FF]/20">x{item.cantidad}</span>
                        <button onClick={() => setListaSolicitud(listaSolicitud.filter(i => i.id !== item.id))} className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                  {listaSolicitud.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">La lista está vacía</p>}
                </div>
              </div>

              <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 bg-[#0F141E] border-b border-[#2d324f] flex justify-between items-center">
                  <h3 className="font-bold text-white">Resumen Consolidado</h3>
                  <button onClick={() => exportarExcel(['SKU', 'Producto', 'Cant'], materialesConsolidados.map(c => [c.codigo, c.nombre, c.cantidad]), 'SolicitudMateriales')} className="text-xs bg-[#5B50FF] text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-[#4a40d4] active:scale-95 transition-all flex items-center">
                    <Download className="w-3 h-3 mr-1.5"/> Excel
                  </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar max-h-64">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#131627] border-b border-[#2d324f] sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">SKU</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d324f]">
                      {materialesConsolidados.map((c, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 font-mono text-slate-400 text-xs">{c.codigo}</td>
                          <td className="px-6 py-3 font-semibold text-slate-200">{c.nombre}</td>
                          <td className="px-6 py-3 text-center font-bold text-white">{c.cantidad}</td>
                        </tr>
                      ))}
                      {materialesConsolidados.length === 0 && <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500 text-sm">No hay insumos consolidados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === PESTAÑA: HISTORIAL === */}
        {pestañaActiva === 'historial' && (
          <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden animate-in fade-in duration-500">
             <div className="p-6 px-8 border-b border-[#2d324f] flex justify-between items-center bg-[#0F141E]">
               <div>
                 <h2 className="text-lg font-bold text-white">Bitácora de Movimientos</h2>
                 <p className="text-xs text-slate-500 mt-1">Registro inmutable de entradas y salidas. Mostrando los últimos 100.</p>
               </div>
               <div className="bg-[#5B50FF]/10 text-[#5B50FF] py-1.5 px-3 rounded-lg font-semibold text-[10px] uppercase tracking-wider border border-[#5B50FF]/20">Auditoría Activa</div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-[#131627] border-b border-[#2d324f]">
                    <tr>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Acción</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Concepto</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center">Impacto</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d324f]">
                    {historial.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(h=>(
                      <tr key={h.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-8 py-4 text-slate-400 text-xs font-medium">{new Date(h.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-8 py-4"><span className={`py-1 px-2.5 rounded-md font-semibold text-[10px] uppercase tracking-wider border ${h.tipo === 'Entrada' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>{h.tipo}</span></td>
                        <td className="px-8 py-4">
                          <p className="font-semibold text-slate-200">{h.producto}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{h.detalles}</p>
                        </td>
                        <td className={`px-8 py-4 text-center font-bold ${h.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {h.tipo === 'Entrada' ? '+' : '-'}{h.cantidad}
                        </td>
                        <td className="px-8 py-4 text-xs font-medium text-slate-400">{h.responsable}</td>
                      </tr>
                    ))}
                    {historial.length === 0 && <tr><td colSpan="5" className="p-20 text-center text-slate-500 text-sm">No hay registros generados.</td></tr>}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {/* === PESTAÑA: DEVOLUCIONES === */}
        {pestañaActiva === 'devoluciones' && (
          <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl overflow-hidden animate-in fade-in duration-500">
             <div className="p-6 px-8 border-b border-[#2d324f] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F141E]">
               <div>
                 <h2 className="text-lg font-bold text-white flex items-center gap-2"><Archive className="w-5 h-5 text-rose-500"/> Registro de Devoluciones y Mermas</h2>
                 <p className="text-xs text-slate-500 mt-1">Productos retirados del inventario principal por vencimiento (≤30 días).</p>
               </div>
               <button onClick={() => exportarExcel(['Fecha', 'SKU', 'Producto', 'Cantidad', 'Motivo', 'Responsable'], devoluciones.map(d => [new Date(d.fecha).toLocaleString(), d.codigo, d.producto, d.cantidad, d.motivo, d.responsable]), 'Reporte_Devoluciones')} className="text-xs bg-[#2d324f] hover:bg-[#3f466b] text-white px-4 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center border border-[#3f466b]">
                  <Download className="w-4 h-4 mr-2"/> Exportar Reporte
               </button>
             </div>
             <div className="overflow-x-auto min-h-[300px]">
               <table className="w-full text-left text-sm">
                  <thead className="bg-[#131627] border-b border-[#2d324f]">
                    <tr>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Fecha de Retiro</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">SKU / Producto</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center">Cant. Retirada</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Motivo</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-8 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d324f]">
                    {devoluciones.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(d=>(
                      <tr key={d.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-8 py-4 text-slate-400 text-xs font-medium">{new Date(d.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-8 py-4">
                          <p className="font-semibold text-slate-200">{d.producto}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{d.codigo}</p>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <span className="font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">{d.cantidad} uds</span>
                        </td>
                        <td className="px-8 py-4 text-xs font-medium text-amber-500">{d.motivo}</td>
                        <td className="px-8 py-4 text-xs font-medium text-slate-400">{d.responsable}</td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => resolverDevolucion(d)} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ml-auto shadow-sm">
                            <CheckCircle className="w-3.5 h-3.5"/> Liquidar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {devoluciones.length === 0 && <tr><td colSpan="6" className="p-20 text-center text-slate-500 text-sm"><div className="flex flex-col items-center"><Archive className="w-10 h-10 mb-3 opacity-20"/> No hay devoluciones registradas.</div></td></tr>}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {/* === PESTAÑA: PLANIMETRIAS === */}
        {pestañaActiva === 'planimetrias' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {planimetrias.length > 0 && (
              <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                {planimetrias.map(p => {
                  const maq = maquinas.find(m => String(m.id) === String(p.maquinaId));
                  return (
                    <button 
                      key={p.id} 
                      onClick={() => setActivePlanTab(p.id)} 
                      className={`px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all shadow-sm flex items-center gap-2 border ${activePlanTab === p.id ? 'bg-[#5B50FF] text-white border-[#5B50FF] shadow-[0_0_15px_rgba(91,80,255,0.4)]' : 'bg-[#1e2235] border-[#2d324f] text-slate-400 hover:text-white hover:bg-[#2A3143]'}`}
                    >
                      <LayoutGrid className="w-4 h-4"/> {maq?.nombre || 'Planimetría sin máquina'}
                    </button>
                  );
                })}
              </div>
            )}

            {planimetrias.length === 0 ? (
              <div className="py-32 border-2 border-dashed border-[#2d324f] bg-[#1e2235] rounded-[3rem] text-center text-slate-500 flex flex-col items-center gap-4">
                <LayoutGrid className="w-12 h-12 opacity-30"/> 
                <span className="font-medium text-sm">No hay planimetrías configuradas. Ve al Mando Central para crearlas.</span>
              </div>
            ) : (
              planimetrias.filter(p => p.id === activePlanTab).map(p => {
                const maq = maquinas.find(m => String(m.id) === String(p.maquinaId));
                return (
                  <div key={p.id} className="bg-[#1e2235] rounded-[3rem] border border-[#2d324f] shadow-2xl overflow-hidden flex flex-col transition-all">
                    <div className="p-8 bg-[#0F141E] border-b border-[#2d324f] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{maq?.nombre || 'Máquina no asignada'}</h2>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-[#5B50FF] uppercase tracking-widest font-bold border border-[#5B50FF]/30 bg-[#5B50FF]/10 px-3 py-1 rounded-lg">Vista de Planograma</p>
                          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold bg-[#131627] px-3 py-1 rounded-lg border border-[#2d324f]">{p.detalles.length} Slots</p>
                        </div>
                      </div>
                      {p.imagenUrl && (
                        <button onClick={() => setImagenAmpliada(p.imagenUrl)} className="flex items-center gap-2 bg-[#131627] border border-[#2d324f] px-5 py-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-[#5B50FF]/50 transition-all group">
                          <ImageIcon className="w-4 h-4 text-[#5B50FF] group-hover:scale-110 transition-transform"/> Ver Imagen Original de Referencia
                        </button>
                      )}
                    </div>
                    
                    <div className="p-8 bg-[#131627] min-h-[400px] overflow-x-auto">
                      <div className="min-w-[800px] grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 bg-[#0F141E] p-8 rounded-3xl border border-[#2d324f] shadow-inner">
                        {p.detalles.map((d, i) => (
                          <div key={i} className={`bg-[#1e2235] border border-[#2d324f] rounded-2xl p-3 flex flex-col items-center justify-between text-center hover:border-[#5B50FF] transition-all shadow-md relative group overflow-hidden ${d.doble ? 'col-span-2' : 'col-span-1'}`}>
                            
                            <div className={`absolute top-0 w-full h-1.5 ${d.doble ? 'bg-amber-400' : 'bg-[#5B50FF]'}`}></div>
                            
                            <div className="w-full flex justify-between items-start mb-2 mt-1">
                               <span className="bg-[#0F141E] border border-[#2d324f] text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-inner">{d.posicion}</span>
                               <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-md">{monedas[p.moneda || 'CRC'].simbolo}{Number(d.precio).toLocaleString()}</span>
                            </div>
                            
                            <div className={`w-full ${d.doble ? 'h-32' : 'h-24'} bg-[#0F141E] border border-[#2d324f] rounded-xl flex items-center justify-center mb-2 overflow-hidden p-2 group-hover:bg-[#131627] transition-colors relative`}>
                              {d.imagenProductoUrl ? (
                                <img src={d.imagenProductoUrl} className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" alt={d.descripcion} />
                              ) : (
                                <Package className="w-8 h-8 text-slate-600 opacity-30"/>
                              )}
                              {d.doble && <div className="absolute bottom-1 right-1 opacity-20"><LayoutGrid className="w-4 h-4 text-amber-500" /></div>}
                            </div>
                            
                            <div className="w-full mt-auto">
                              <span className="text-[9px] text-slate-500 font-mono block mb-1 uppercase tracking-widest">{d.codigoVenta || 'N/A'}</span>
                              <span className="text-[11px] font-bold text-slate-200 leading-tight line-clamp-2">{d.descripcion || 'Espacio Vacío'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* === BOTÓN FLOTANTE MANDO CENTRAL === */}
      {isAdmin && (
        <div className="fixed bottom-8 right-8 z-[200]">
          <button onClick={() => setPestañaActiva('configuracion')} className="bg-[#1e2235] hover:bg-[#5B50FF] text-[#5B50FF] hover:text-white p-4 rounded-full shadow-2xl border border-[#2d324f] hover:border-[#5B50FF] hover:scale-105 transition-all flex items-center justify-center group">
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
      )}

      {/* === ÁREA DE CONFIGURACIÓN MAESTRA (FULLSCREEN) === */}
      {pestañaActiva === 'configuracion' && isAdmin && (
        <div className="fixed inset-0 bg-[#0B0F19]/95 backdrop-blur-2xl z-[250] overflow-y-auto animate-in fade-in duration-300">
          <div className="max-w-6xl mx-auto p-8 pt-16 space-y-12 pb-20">
            <div className="flex justify-between items-center border-b border-[#2d324f] pb-8">
               <div>
                 <h2 className="text-3xl font-bold tracking-tight text-white">Mando Central</h2>
                 <p className="text-slate-400 text-sm mt-1">Configuración avanzada y exportación de datos.</p>
               </div>
               <button onClick={() => setPestañaActiva('dashboard')} className="p-3 bg-[#1e2235] border border-[#2d324f] rounded-full hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400 transition-colors shadow-sm"><X className="w-6 h-6"/></button>
            </div>
            
            {/* SECCIÓN: GESTIÓN DE INVENTARIO MAESTRO CON BUSCADOR */}
            <div className="bg-[#1e2235] border border-[#2d324f] rounded-3xl p-8 space-y-6 shadow-xl flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div><h3 className="text-lg font-bold text-white">Gestión de Inventario Maestro</h3><p className="text-slate-400 text-xs mt-1">Busca, edita y elimina productos de la bodega general.</p></div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setMostrarOcultosAdmin(!mostrarOcultosAdmin)} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 border ${mostrarOcultosAdmin ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-[#131627] text-slate-400 border-[#2d324f] hover:text-white'}`}>
                    {mostrarOcultosAdmin ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>} {mostrarOcultosAdmin ? 'Ocultos' : 'Activos'}
                  </button>
                  <button onClick={() => { setProductoEditando(null); setFormDataInv({ codigo: '', nombre: '', categoria: '', cantidad: 0, minimo: 0, costo: 0, vencimiento: '', lotes: [], activo: true }); setModalInvAbierto(true); }} className="bg-[#5B50FF] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a40d4] transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(91,80,255,0.3)] whitespace-nowrap"><Plus className="w-4 h-4"/> Nuevo Artículo</button>
                </div>
              </div>
              <div className="relative w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#5B50FF] transition-colors w-4 h-4"/>
                <input type="text" placeholder="Buscar producto por nombre o código SKU para editar..." value={busquedaAdmin || ''} onChange={e => setBusquedaAdmin(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-[#0F141E] border border-[#2d324f] rounded-xl text-sm outline-none text-white focus:border-[#5B50FF] transition-all"/>
              </div>
              <div className="overflow-x-auto border border-[#2d324f] rounded-xl max-h-[400px] bg-[#0F141E] custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#131627] border-b border-[#2d324f] sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider">SKU / Artículo</th>
                      <th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider text-center">Stock Actual</th>
                      <th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider text-center">Caducidad</th>
                      <th className="px-6 py-4 font-semibold text-xs text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d324f]">
                    {inventarioAdminFiltrado.map(item => {
                      let fechaMostrarAdmin = item.vencimiento || '-';
                      if (item.lotes && item.lotes.length > 0) {
                         const lotesValidos = item.lotes.filter(l => l.cantidad > 0 && l.vencimiento);
                         if (lotesValidos.length > 0) {
                            lotesValidos.sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento));
                            fechaMostrarAdmin = lotesValidos[0].vencimiento;
                         } else {
                            fechaMostrarAdmin = '-';
                         }
                      }
                      
                      return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 flex items-center gap-3">
                            <button onClick={() => setFilasExpandidas(prev => ({...prev, [item.id]: !prev[item.id]}))} className="text-slate-500 hover:text-[#5B50FF] transition-colors p-1 bg-[#131627] border border-[#2d324f] rounded-md">
                              {filasExpandidas[item.id] ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                            </button>
                            <div>
                              <p className="font-semibold text-slate-200 text-sm leading-tight">{item.nombre || 'S/N'}</p>
                              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.codigo || 'S/C'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center font-bold text-white">{item.cantidad || 0}</td>
                          <td className="px-6 py-3 text-center text-xs text-slate-400">{fechaMostrarAdmin}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => toggleProductoActivo(item.id, item.activo)} className={`p-2 bg-[#131627] border border-[#2d324f] rounded-lg transition-colors ${item.activo === false ? 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50' : 'text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50'}`} title={item.activo === false ? "Restaurar Producto" : "Ocultar Producto"}>
                                {item.activo === false ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                              </button>
                              <button onClick={() => { 
                                setProductoEditando(item.id); 
                                let lotesEdicion = item.lotes && item.lotes.length > 0 ? [...item.lotes] : (item.cantidad > 0 ? [{ cantidad: item.cantidad, vencimiento: fechaMostrarAdmin !== '-' ? fechaMostrarAdmin : '' }] : []);
                                setFormDataInv({...item, vencimiento: fechaMostrarAdmin !== '-' ? fechaMostrarAdmin : '', lotes: lotesEdicion}); 
                                setModalInvAbierto(true); 
                              }} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-[#5B50FF] hover:bg-[#5B50FF]/10 hover:border-[#5B50FF]/50 transition-colors" title="Editar Producto"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => deleteFromCloud('inventario', item.id)} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors" title="Eliminar Producto"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </td>
                        </tr>
                        {filasExpandidas[item.id] && (
                          <tr className="bg-[#0F141E] border-b border-[#2d324f]">
                            <td colSpan="4" className="px-6 py-4 pl-16">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#5B50FF] mb-3 flex items-center gap-2"><Calendar className="w-3 h-3"/> Desglose de Lotes Registrados</h4>
                              {item.lotes && item.lotes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                  {item.lotes.filter(l=>l.cantidad > 0).map((lote, i) => (
                                    <div key={i} className="flex justify-between items-center bg-[#131627] border border-[#2d324f] p-3 rounded-xl shadow-sm">
                                      <span className="text-xs text-slate-400 font-medium">{lote.vencimiento || 'Sin fecha'}</span>
                                      <span className="text-xs font-bold text-white bg-white/5 border border-white/10 px-2 py-1 rounded-md">{lote.cantidad} uds</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No hay registros de lotes para este producto. Su inventario está vacío o fue consolidado globalmente.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )})}
                    {inventarioAdminFiltrado.length === 0 && <tr><td colSpan="4" className="py-10 text-center text-slate-500 text-sm">No se encontraron productos.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN: REPORTES */}
            <div className="bg-[#1e2235] border border-[#2d324f] rounded-3xl p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 text-white"><FileSpreadsheet className="w-6 h-6 text-[#5B50FF]"/><h3 className="text-lg font-bold">Exportación de Datos (Excel)</h3></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={()=>exportarExcel(['SKU','Material','Cat','Stock','Min','Costo','Vence'], inventario.map(i=>[i.codigo,i.nombre,i.categoria,i.cantidad,i.minimo,i.costo,i.vencimiento]), 'Bodega_Nexus')} className="p-5 bg-[#0F141E] border border-[#2d324f] rounded-2xl hover:border-[#5B50FF] hover:bg-white/5 transition-all text-left flex items-center gap-4 group">
                  <Package className="text-indigo-400 w-8 h-8 shrink-0 group-hover:text-[#5B50FF] transition-colors"/> <div><p className="font-bold text-sm text-slate-200">Inventario</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Base Maestra</p></div>
                </button>
                <button onClick={()=>exportarExcel(['Maquina','Insumo','Cant'], maquinas.flatMap(m=>m.receta.map(r=>[m.nombre, inventario.find(p=>String(p.id)===String(r.productoId))?.nombre, r.cantidad])), 'Recetarios_Nexus')} className="p-5 bg-[#0F141E] border border-[#2d324f] rounded-2xl hover:border-emerald-500 hover:bg-white/5 transition-all text-left flex items-center gap-4 group">
                  <Settings className="text-emerald-500 w-8 h-8 shrink-0 group-hover:text-emerald-400 transition-colors"/> <div><p className="font-bold text-sm text-slate-200">Recetas</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Desglose BOM</p></div>
                </button>
                <button onClick={()=>exportarExcel(['Maquina','Pos','Nombre','Precio'], planimetrias.flatMap(p=>p.detalles.map(d=>[maquinas.find(m=>String(m.id)===String(p.maquinaId))?.nombre, d.posicion, d.descripcion, d.precio])), 'Paneles_Nexus')} className="p-5 bg-[#0F141E] border border-[#2d324f] rounded-2xl hover:border-cyan-500 hover:bg-white/5 transition-all text-left flex items-center gap-4 group">
                  <LayoutGrid className="text-cyan-500 w-8 h-8 shrink-0 group-hover:text-cyan-400 transition-colors"/> <div><p className="font-bold text-sm text-slate-200">Planos</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Config. Botonera</p></div>
                </button>
                <button onClick={() => {
                  const hds = ['Fecha','Operacion','Detalle','SKU','Insumo','Impacto','User'];
                  const rws = [];
                  historial.forEach(h => {
                    if (h.detalles?.startsWith('Despacho')) {
                      const m = maquinas.find(mx => mx.nombre === h.producto);
                      if(m) m.receta.forEach(r => {
                        const pi = inventario.find(px => String(px.id) === String(r.productoId));
                        rws.push([new Date(h.fecha).toLocaleString(), h.tipo, h.detalles, pi?.codigo||'-', pi?.nombre||'Elm', r.cantidad*h.cantidad, h.responsable]);
                      });
                    } else {
                      const pi = inventario.find(px => px.nombre === h.producto);
                      rws.push([new Date(h.fecha).toLocaleString(), h.tipo, 'Individual', pi?.codigo||'-', h.producto, h.cantidad, h.responsable]);
                    }
                  });
                  exportarExcel(hds, rws, 'Historial_Desglosado_Nexus');
                }} className="p-5 bg-[#0F141E] border border-[#2d324f] rounded-2xl hover:border-amber-500 hover:bg-white/5 transition-all text-left flex items-center gap-4 group">
                  <History className="text-amber-500 w-8 h-8 shrink-0 group-hover:text-amber-400 transition-colors"/> <div><p className="font-bold text-sm text-slate-200">Kardex</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Historial Detallado</p></div>
                </button>
              </div>
            </div>

            {/* SECCIÓN: CONTROL DE ACCESOS */}
            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#5B50FF]"/>Control de Accesos</h3>
                  <p className="text-slate-400 text-xs mt-1">Autoriza o revoca el ingreso de los usuarios a la plataforma.</p>
                </div>
              </div>
              <div className="overflow-x-auto bg-[#0F141E] border border-[#2d324f] rounded-xl custom-scrollbar max-h-[300px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#131627] text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-[#2d324f] sticky top-0 z-10">
                    <tr>
                      <th className="py-4 px-6">Usuario / Correo</th>
                      <th className="py-4 px-6 text-center">Contraseña</th>
                      <th className="py-4 px-6 text-center">Estado de Acceso</th>
                      <th className="py-4 px-6 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d324f]">
                    {userList.filter(u => u.email !== 'cristofer10murillo@gmail.com').map(u => (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-medium text-slate-200">{u.email}</td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <span className="font-mono text-xs text-slate-400 w-20 text-center">
                              {visiblePasswords[u.id] ? (u.password || 'N/A') : '••••••••'}
                            </span>
                            <button 
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                              className="text-slate-500 hover:text-[#5B50FF] transition-colors"
                              title="Mostrar/Ocultar contraseña"
                            >
                              {visiblePasswords[u.id] ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${u.status === 'authorized' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {u.status === 'authorized' ? 'Autorizado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => saveToCloud('users_access', { ...u, status: u.status === 'authorized' ? 'pending' : 'authorized' })} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${u.status === 'authorized' ? 'bg-[#0F141E] text-rose-500 border-rose-500/30 hover:bg-rose-500/10' : 'bg-[#5B50FF] border-transparent text-white hover:bg-[#4a40d4]'}`}>
                              {u.status === 'authorized' ? 'Revocar Acceso' : 'Autorizar Ingreso'}
                            </button>
                            <button onClick={async () => { await deleteFromCloud('users_access', u.id); notify(`Usuario ${u.email} eliminado del sistema`); }} className="p-2 bg-[#0F141E] border border-rose-500/30 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors shadow-sm" title="Eliminar usuario definitivamente"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {userList.filter(u => u.email !== 'cristofer10murillo@gmail.com').length === 0 && (<tr><td colSpan="4" className="py-10 text-center text-slate-500 text-sm">No hay usuarios registrados.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN: EDICIÓN DE HISTORIAL (AUDITORÍA) */}
            <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-[#5B50FF]"/>Edición de Bitácora</h3>
                  <p className="text-slate-400 text-xs mt-1">Elimina registros de prueba del historial para mantener la auditoría limpia.</p>
                </div>
              </div>
              <div className="overflow-x-auto bg-[#0F141E] border border-[#2d324f] rounded-xl custom-scrollbar max-h-[300px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#131627] text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-[#2d324f] sticky top-0 z-10">
                    <tr>
                      <th className="py-4 px-6">Fecha / Hora</th>
                      <th className="py-4 px-6">Acción</th>
                      <th className="py-4 px-6">Concepto / Producto</th>
                      <th className="py-4 px-6">Usuario</th>
                      <th className="py-4 px-6 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d324f]">
                    {historial.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(h => (
                      <tr key={h.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-medium text-slate-400 text-xs">{new Date(h.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${h.tipo === 'Entrada' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                            {h.tipo}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-slate-200 text-sm font-semibold">{h.producto}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">{h.detalles}</p>
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-xs">{h.responsable}</td>
                        <td className="py-4 px-6 text-right">
                          <button onClick={async () => { await deleteFromCloud('historial', h.id); notify('Registro eliminado de la bitácora'); }} className="p-2 bg-[#0F141E] border border-rose-500/30 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors shadow-sm" title="Eliminar registro permanentemente"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                    {historial.length === 0 && (<tr><td colSpan="5" className="py-10 text-center text-slate-500 text-sm">No hay registros en el historial.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* SECCIÓN: IMPORTACIÓN */}
              <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8 flex flex-col">
                
              </div>

              {/* SECCIÓN: MÁQUINAS */}
              <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8 flex flex-col">
                <div className="mb-6"><h3 className="text-lg font-bold text-white">Gestión de Equipos (BOM)</h3><p className="text-slate-400 text-xs mt-1">Administra recetas de ingredientes por máquina.</p></div>
                <div className="flex-1 overflow-y-auto max-h-[220px] pr-2 space-y-3 custom-scrollbar mb-4">
                  {maquinas.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-4 bg-[#0F141E] rounded-xl border border-[#2d324f] hover:border-[#5B50FF]/50 transition-colors group">
                      <div>
                        <p className="font-bold text-sm text-slate-200">{m.nombre}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{m.receta.length} Ingredientes</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setMaquinaEditando(m.id); setFormDataMaq({nombre:m.nombre, receta:m.receta}); setModalMaqAbierto(true); }} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-[#5B50FF] hover:bg-[#2A3143] transition-colors"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deleteFromCloud('maquinas', m.id)} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-rose-500 hover:bg-[#2A3143] transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                  {maquinas.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No hay equipos registrados.</div>}
                </div>
                <button onClick={() => { setMaquinaEditando(null); setFormDataMaq({nombre:'', receta:[]}); setModalMaqAbierto(true); }} className="w-full bg-[#131627] border border-[#2d324f] text-[#5B50FF] py-3.5 rounded-xl font-bold text-sm hover:border-[#5B50FF]/50 hover:bg-[#5B50FF]/10 transition-colors flex justify-center items-center gap-2"><Plus className="w-4 h-4"/> Nuevo Equipo</button>
              </div>
              
              {/* SECCIÓN: PLANIMETRÍAS (ADMIN) */}
              <div className="bg-[#1e2235] rounded-3xl border border-[#2d324f] shadow-xl p-8 flex flex-col md:col-span-2 lg:col-span-2">
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">Gestión de Planimetrías (Front-Panels)</h3>
                    <p className="text-slate-400 text-xs mt-1">Configura visualmente las ranuras y combinaciones de productos para la venta.</p>
                  </div>
                  {planimetrias.length > 0 && (
                    <button onClick={() => setMostrarConfirmacionBorrarTodo(true)} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-colors shadow-sm">
                      Borrar Todas
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[250px] pr-2 space-y-3 custom-scrollbar mb-4">
                  {planimetrias.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 bg-[#0F141E] rounded-xl border border-[#2d324f] hover:border-[#5B50FF]/50 transition-colors group">
                      <div>
                        <p className="font-bold text-sm text-slate-200">{maquinas.find(m => String(m.id) === String(p.maquinaId))?.nombre || 'Máquina no asignada'}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{p.detalles.length} Espacios configurados</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setPlanEditando(p.id); setFormDataPlan(p); setModalPlanAbierto(true); }} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-[#5B50FF] hover:bg-[#2A3143] transition-colors"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deleteFromCloud('planimetrias', p.id)} className="p-2 bg-[#131627] border border-[#2d324f] rounded-lg text-rose-500 hover:bg-[#2A3143] transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                  {planimetrias.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No hay planimetrías registradas.</div>}
                </div>
                <button onClick={() => { setPlanEditando(null); setFormDataPlan({maquinaId:'', imagenUrl:'', moneda:'CRC', detalles:[]}); setModalPlanAbierto(true); }} className="w-full bg-[#131627] border border-[#2d324f] text-[#5B50FF] py-3.5 rounded-xl font-bold text-sm hover:border-[#5B50FF]/50 hover:bg-[#5B50FF]/10 transition-colors flex justify-center items-center gap-2"><Plus className="w-4 h-4"/> Nueva Planimetría</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODALES (EDITAR INVENTARIO, MÁQUINA, PLANIMETRÍA) === */}
      {modalInvAbierto && (
        <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-[#1e2235] border border-[#2d324f] rounded-3xl w-full max-w-lg p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">{productoEditando ? 'Editar Insumo' : 'Nuevo Insumo'}</h2><button onClick={()=>setModalInvAbierto(false)} className="text-slate-500 hover:text-rose-400"><X className="w-6 h-6"/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase">SKU</label><input value={formDataInv.codigo || ''} onChange={e=>setFormDataInv({...formDataInv, codigo:e.target.value})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase">Categoría</label><input value={formDataInv.categoria || ''} onChange={e=>setFormDataInv({...formDataInv, categoria:e.target.value})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
              </div>
              <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase">Nombre del Producto</label><input value={formDataInv.nombre || ''} onChange={e=>setFormDataInv({...formDataInv, nombre:e.target.value})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-sm text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase">Costo Unit. (₡)</label><input type="number" value={formDataInv.costo ?? ''} onChange={e=>setFormDataInv({...formDataInv, costo:Number(e.target.value)})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-center font-bold text-white text-lg focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase">Alerta Mínima</label><input type="number" value={formDataInv.minimo ?? ''} onChange={e=>setFormDataInv({...formDataInv, minimo:Number(e.target.value)})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none text-center font-bold text-white text-lg focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" /></div>
              </div>

              {/* GESTIÓN DE LOTES */}
              <div className="bg-[#0F141E] border border-[#2d324f] rounded-2xl p-4 mt-2">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-bold text-[#5B50FF] uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4"/> Lotes & Caducidades</label>
                  <button onClick={() => setFormDataInv({ ...formDataInv, lotes: [...(formDataInv.lotes || []), { cantidad: 0, vencimiento: '' }] })} type="button" className="text-[10px] bg-[#2d324f] hover:bg-[#3f466b] text-white px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1"><Plus className="w-3 h-3"/> Nuevo Lote</button>
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-2 mb-4">
                  {(formDataInv.lotes || []).map((l, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-[#131627] p-2 rounded-xl border border-[#2d324f]">
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 uppercase font-bold ml-1 mb-0.5 block">Vencimiento</label>
                        <input type="date" value={l.vencimiento || ''} onChange={e=>{
                          const nl = [...(formDataInv.lotes || [])]; nl[idx].vencimiento = e.target.value; setFormDataInv({ ...formDataInv, lotes: nl });
                        }} className="w-full px-2 py-1.5 bg-[#0F141E] border border-[#2d324f] rounded-lg outline-none text-xs text-slate-300 focus:border-[#5B50FF] transition-all" />
                      </div>
                      <div className="w-24">
                        <label className="text-[9px] text-slate-500 uppercase font-bold ml-1 mb-0.5 block text-center">Cant.</label>
                        <input type="number" min="0" value={l.cantidad ?? ''} onChange={e=>{
                          const nl = [...(formDataInv.lotes || [])]; nl[idx].cantidad = e.target.value; setFormDataInv({ ...formDataInv, lotes: nl });
                        }} className="w-full px-2 py-1.5 bg-[#0F141E] border border-[#2d324f] rounded-lg outline-none text-xs text-center font-bold text-white focus:border-[#5B50FF] transition-all" placeholder="Cant" />
                      </div>
                      <div className="flex items-end h-full mt-4">
                        <button onClick={() => {
                          const nl = [...(formDataInv.lotes || [])]; nl.splice(idx, 1); setFormDataInv({ ...formDataInv, lotes: nl });
                        }} type="button" className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Eliminar este lote"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                  {(!formDataInv.lotes || formDataInv.lotes.length === 0) && <p className="text-xs text-slate-500 text-center py-4 italic">No hay unidades en stock. Añade un lote.</p>}
                </div>
                
                <div className="flex justify-between items-center px-4 py-3 bg-[#131627] border border-[#2d324f] rounded-xl shadow-inner">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Stock Total Resultante:</span>
                  <span className="text-lg font-black text-emerald-400">{(formDataInv.lotes || []).reduce((a, l) => a + Number(l.cantidad || 0), 0)} uds</span>
                </div>
              </div>

              <div className="pt-2"><button onClick={() => {
                if (!formDataInv.nombre || !formDataInv.codigo) return notify("SKU y Nombre requeridos", "error");
                let lotesLimpios = (formDataInv.lotes || []).filter(l => Number(l.cantidad) > 0);
                const lotesMap = {};
                lotesLimpios.forEach(l => {
                  const key = l.vencimiento || 'SIN_FECHA';
                  if (!lotesMap[key]) lotesMap[key] = 0;
                  lotesMap[key] += Number(l.cantidad);
                });
                let lotesConsolidados = Object.keys(lotesMap).map(key => ({ vencimiento: key === 'SIN_FECHA' ? '' : key, cantidad: lotesMap[key] }));
                lotesConsolidados.sort((a, b) => {
                  if (!a.vencimiento) return 1; if (!b.vencimiento) return -1;
                  return new Date(a.vencimiento) - new Date(b.vencimiento);
                });
                const nuevaCantTotal = lotesConsolidados.reduce((acc, l) => acc + l.cantidad, 0);
                const proximaFecha = lotesConsolidados.find(l => l.cantidad > 0 && l.vencimiento)?.vencimiento || '';
                
                saveToCloud('inventario', { ...formDataInv, cantidad: nuevaCantTotal, vencimiento: proximaFecha, lotes: lotesConsolidados, id: productoEditando || Date.now().toString() });
                setModalInvAbierto(false); notify("Insumo guardado");
              }} className="w-full bg-[#5B50FF] text-white p-4 rounded-xl font-bold text-sm hover:bg-[#4a40d4] transition-colors shadow-[0_0_20px_rgba(91,80,255,0.3)]">Guardar Cambios Definitivos</button></div>
            </div>
          </div>
        </div>
      )}

      {modalMaqAbierto && (
        <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#1e2235] border border-[#2d324f] rounded-3xl w-full max-w-2xl p-8 space-y-6 flex flex-col max-h-[90vh] shadow-[0_20px_60px_rgb(0,0,0,0.1)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-white">Receta de Equipo (BOM)</h2><button onClick={()=>setModalMaqAbierto(false)} className="text-slate-500 hover:text-rose-400"><X className="w-6 h-6"/></button></div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider ml-1">Identificador del Equipo</label>
              <input placeholder="Ej. Máquina Snacks" value={formDataMaq.nombre || ''} onChange={e=>setFormDataMaq({...formDataMaq, nombre:e.target.value})} className="w-full p-3.5 bg-[#0F141E] border border-[#2d324f] rounded-xl outline-none font-bold text-white focus:border-[#5B50FF] focus:ring-1 focus:ring-[#5B50FF] transition-all" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar border-t border-b border-[#2d324f] py-4">
               {formDataMaq.receta.map((r, i) => (
                 <div key={i} className="flex gap-3 items-center bg-[#131627] p-3 border border-[#2d324f] rounded-2xl">
                   <div className="flex-1">
                     <BuscadorProducto inventario={inventario.filter(p => p.activo !== false)} valor={r.productoId} onChange={v=>{ const nr=[...formDataMaq.receta]; nr[i].productoId=v; setFormDataMaq({...formDataMaq, receta:nr}); }} className="!py-2.5 !rounded-lg" />
                   </div>
                   <div className="w-20"><input type="number" min="1" value={r.cantidad ?? ''} onChange={e=>{ const nr=[...formDataMaq.receta]; nr[i].cantidad=e.target.value; setFormDataMaq({...formDataMaq, receta:nr}); }} className="w-full p-2.5 bg-[#0F141E] border border-[#2d324f] rounded-lg text-center font-bold text-sm text-white outline-none focus:border-[#5B50FF] transition-colors" /></div>
                   <button onClick={()=>{ const nr = formDataMaq.receta.filter((_, idx)=>idx!==i); setFormDataMaq({...formDataMaq, receta:nr}); }} className="p-3 text-rose-500 bg-[#0F141E] border border-[#2d324f] rounded-lg hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors"><Trash2 className="w-4 h-4"/></button>
                 </div>
               ))}
               {formDataMaq.receta.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No hay ingredientes en esta receta.</div>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={()=>setFormDataMaq({...formDataMaq, receta:[...formDataMaq.receta, {productoId:'', cantidad:1}]})} className="flex-1 p-3.5 border border-[#2d324f] bg-[#0F141E] text-slate-300 rounded-xl font-bold text-sm hover:border-[#5B50FF]/50 transition-all">Añadir Ingrediente</button>
              <button onClick={() => {
                if (!formDataMaq.nombre) return notify("Nombre requerido", "error");
                saveToCloud('maquinas', { ...formDataMaq, id: maquinaEditando || Date.now().toString() });
                setModalMaqAbierto(false); notify("Máquina guardada");
              }} className="flex-1 bg-[#5B50FF] text-white p-3.5 rounded-xl font-bold text-sm hover:bg-[#4a40d4] transition-colors shadow-[0_0_15px_rgba(91,80,255,0.3)]">Guardar Receta</button>
            </div>
          </div>
        </div>
      )}

      {modalPlanAbierto && (
        <div className="fixed inset-0 bg-[#0B0F19]/90 backdrop-blur-sm z-[300] p-6 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 text-left">
          <div className="max-w-5xl mx-auto bg-[#1e2235] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#2d324f] p-8 md:p-10 space-y-10 my-10">
            <div className="flex justify-between items-center border-b border-[#2d324f] pb-6"><h2 className="text-2xl font-bold text-white">Constructor de Planimetría</h2><button onClick={()=>setModalPlanAbierto(false)} className="text-slate-500 hover:text-rose-400 p-2 rounded-full transition-colors"><X className="w-6 h-6"/></button></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#131627] p-6 rounded-2xl border border-[#2d324f]">
               <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-400 ml-1">Vincular Máquina</label><select value={formDataPlan.maquinaId || ''} onChange={e=>setFormDataPlan({...formDataPlan, maquinaId:e.target.value})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl text-sm font-medium text-white outline-none focus:border-[#5B50FF]"><option value="">-- Seleccionar --</option>{maquinas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
               <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-400 ml-1">Moneda</label><select value={formDataPlan.moneda || 'CRC'} onChange={e=>setFormDataPlan({...formDataPlan, moneda:e.target.value})} className="w-full p-3 bg-[#0F141E] border border-[#2d324f] rounded-xl text-sm font-medium text-white outline-none focus:border-[#5B50FF]">{Object.keys(monedas).map(c=><option key={c} value={c}>{c} ({monedas[c].simbolo})</option>)}</select></div>
               <div className="space-y-1.5 relative">
                 <label className="text-xs font-semibold text-slate-400 ml-1">Imagen de Referencia</label>
                 <label className="flex items-center justify-center p-3 bg-[#0F141E] border border-[#2d324f] text-slate-300 rounded-xl text-sm font-medium cursor-pointer hover:border-[#5B50FF] transition-colors"><UploadCloud className="mr-2 w-4 h-4 text-[#5B50FF]"/> {subiendoImagen ? 'Procesando...' : 'Subir Imagen'}
                   <input type="file" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return; setSubiendoImagen(true);
                      try {
                        const path = `images/${Date.now()}_${file.name}`; const refImg = ref(storage, path); await uploadBytes(refImg, file);
                        const url = await getDownloadURL(refImg); setFormDataPlan(prev => ({ ...prev, imagenUrl: url })); notify("Imagen cargada");
                      } catch (err) { notify("Error al subir imagen", "error"); } finally { setSubiendoImagen(false); }
                   }} disabled={subiendoImagen} />
                 </label>
                 {formDataPlan.imagenUrl && (
                   <button type="button" onClick={() => setImagenAmpliada(formDataPlan.imagenUrl)} className="absolute right-2 top-8 bg-[#131627] text-[#5B50FF] p-2 rounded-lg border border-[#2d324f] hover:bg-[#5B50FF]/10 transition-colors" title="Ver imagen ampliada">
                     <Search className="w-4 h-4"/>
                   </button>
                 )}
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white">Mapeo de Posiciones</h3><button type="button" onClick={()=>setFormDataPlan({...formDataPlan, detalles:[...formDataPlan.detalles, {posicion:'', descripcion:'', codigoVenta:'', precio:0, doble: false, imagenProductoUrl: ''}]})} className="bg-[#131627] border border-[#2d324f] text-[#5B50FF] py-2 px-5 rounded-lg font-semibold text-xs hover:border-[#5B50FF]/50 transition-colors flex items-center gap-2"><Plus className="w-3 h-3"/> Nueva Posición</button></div>
               <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                  {formDataPlan.detalles.map((d, i)=>(
                    <div key={i} className={`flex flex-wrap md:flex-nowrap gap-3 items-center p-4 rounded-2xl border border-[#2d324f] relative overflow-hidden transition-colors ${d.doble ? 'bg-[#5B50FF]/5 border-[#5B50FF]/30' : 'bg-[#131627]'}`}>
                       {d.doble && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400/80"></div>}
                       
                       <div className="w-16 h-16 shrink-0 bg-[#0F141E] border border-[#2d324f] rounded-xl relative overflow-hidden flex items-center justify-center group cursor-pointer shadow-inner">
                         {d.imagenProductoUrl ? ( <img src={d.imagenProductoUrl} className="w-full h-full object-contain p-1" alt="Prod" /> ) : ( <ImageIcon className="w-5 h-5 text-slate-600" /> )}
                         <div className="absolute inset-0 bg-[#5B50FF]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           {subiendoImagenSlot === i ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <UploadCloud className="w-5 h-5 text-white" />}
                         </div>
                         <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={async (e) => {
                            const file = e.target.files[0]; if (!file) return; setSubiendoImagenSlot(i);
                            try {
                              const path = `images/slot_${Date.now()}_${file.name}`; const refImg = ref(storage, path); await uploadBytes(refImg, file);
                              const url = await getDownloadURL(refImg); const nd = [...formDataPlan.detalles]; nd[i].imagenProductoUrl = url; setFormDataPlan(prev => ({ ...prev, detalles: nd }));
                            } catch (err) { notify("Error al subir imagen", "error"); } finally { setSubiendoImagenSlot(null); }
                         }} disabled={subiendoImagenSlot === i} title="Subir imagen" />
                       </div>

                       <div className="w-16"><label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Pos</label><input placeholder="A1" value={d.posicion || ''} onChange={e=>{ const nd = [...formDataPlan.detalles]; nd[i].posicion = e.target.value; setFormDataPlan({...formDataPlan, detalles:nd}); }} className="w-full p-2.5 bg-[#0F141E] border border-[#2d324f] rounded-lg text-center font-bold text-sm text-[#5B50FF] outline-none focus:border-[#5B50FF]" /></div>
                       <div className="w-20"><label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Cód.</label><input placeholder="CV1" value={d.codigoVenta || ''} onChange={e=>{ const nd = [...formDataPlan.detalles]; nd[i].codigoVenta = e.target.value; setFormDataPlan({...formDataPlan, detalles:nd}); }} className="w-full p-2.5 bg-[#0F141E] border border-[#2d324f] rounded-lg text-center font-mono font-bold text-xs text-slate-300 outline-none focus:border-[#5B50FF]" /></div>
                       <div className="flex-1 min-w-[120px]"><label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Producto (Botón)</label><input placeholder="Nombre visible..." value={d.descripcion || ''} onChange={e=>{ const nd = [...formDataPlan.detalles]; nd[i].descripcion = e.target.value; setFormDataPlan({...formDataPlan, detalles:nd}); }} className="w-full p-2.5 bg-[#0F141E] border border-[#2d324f] rounded-lg font-medium text-sm text-white outline-none focus:border-[#5B50FF]" /></div>
                       <div className="w-24"><label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Precio</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-xs">{monedas[formDataPlan.moneda || 'CRC'].simbolo}</span><input type="number" value={d.precio ?? ''} onChange={e=>{ const nd = [...formDataPlan.detalles]; nd[i].precio = e.target.value; setFormDataPlan({...formDataPlan, detalles:nd}); }} className="w-full pl-6 p-2.5 bg-[#0F141E] border border-[#2d324f] rounded-lg text-right font-bold text-sm text-emerald-400 outline-none focus:border-[#5B50FF]" /></div></div>
                       <div className="w-12 flex flex-col justify-center items-center">
                         <label className="text-[8px] font-semibold text-slate-500 uppercase block mb-1 text-center">Doble</label>
                         <button type="button" onClick={() => { const nd = [...formDataPlan.detalles]; nd[i].doble = !nd[i].doble; setFormDataPlan({...formDataPlan, detalles:nd}); }} className={`w-10 h-5 rounded-full relative transition-colors shadow-inner ${d.doble ? 'bg-amber-500' : 'bg-[#0F141E] border border-[#2d324f]'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${d.doble ? 'left-[22px]' : 'left-0.5'}`}></div>
                         </button>
                       </div>
                       <div className="flex items-end h-full pt-4 md:pt-0"><button type="button" onClick={()=>{ const nd = formDataPlan.detalles.filter((_, idx)=>idx!==i); setFormDataPlan({...formDataPlan, detalles:nd}); }} className="p-2.5 text-rose-500 bg-[#0F141E] border border-[#2d324f] rounded-lg hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors"><Trash2 className="w-4 h-4"/></button></div>
                    </div>
                  ))}
                  {formDataPlan.detalles.length === 0 && <div className="py-16 border-2 border-dashed border-[#2d324f] rounded-3xl text-center text-slate-500 text-sm">Agrega posiciones para crear el mapa de la máquina.</div>}
               </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-[#2d324f]">
              <button onClick={()=>setModalPlanAbierto(false)} className="px-6 py-3 bg-[#131627] border border-[#2d324f] rounded-xl font-semibold text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={()=>{ if(!formDataPlan.maquinaId) return notify("Seleccione una máquina", "error"); saveToCloud('planimetrias', formDataPlan); setModalPlanAbierto(false); notify("Plano guardado"); }} className="px-8 py-3 bg-[#5B50FF] text-white rounded-xl font-semibold text-sm hover:bg-[#4a40d4] transition-colors shadow-[0_0_15px_rgba(91,80,255,0.3)]">Guardar Planimetría</button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacionBorrarTodo && (
        <div className="fixed inset-0 bg-[#0B0F19]/90 backdrop-blur-sm z-[600] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1e2235] border border-[#2d324f] rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center animate-in zoom-in-95">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4 opacity-80" />
            <h3 className="text-xl font-bold text-white mb-2">¿Borrar todo?</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">Estás a punto de eliminar <strong>todas</strong> las planimetrías del sistema. Esta acción es definitiva y no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setMostrarConfirmacionBorrarTodo(false)} className="flex-1 px-4 py-3.5 bg-[#131627] border border-[#2d324f] rounded-xl font-bold text-sm text-slate-300 hover:text-white transition-colors">Cancelar</button>
              <button onClick={async () => {
                try {
                  for (const p of planimetrias) { await deleteFromCloud('planimetrias', p.id); }
                  notify("Todas las planimetrías han sido borradas."); setMostrarConfirmacionBorrarTodo(false);
                } catch (e) { notify("Error al borrar", "error"); }
              }} className="flex-1 px-4 py-3.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors shadow-[0_0_15px_rgba(225,29,72,0.3)]">Sí, borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}