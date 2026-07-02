import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, Plus, ArrowDownRight, ArrowUpRight, History, 
  Search, X, AlertCircle, Box, User, Download, MapPin,
  ClipboardList, Send, Settings2, Settings, Trash2,
  LogOut, Mail, KeyRound, UserPlus, ShieldCheck, Clock, CheckCircle2,
  ImagePlus, Camera, FilePlus, CalendarDays, BarChart3, TrendingUp, AlertTriangle,
  Paperclip, FileText, ExternalLink, Building2, Cpu, Shield, DollarSign, Tag,
  ShoppingCart, Truck, Database, Undo2, Edit, Wallet, ScrollText, Upload
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURACIÓN DE FIREBASE ---
const localFirebaseConfig = {
  apiKey: "AIza" + "SyAuBPW0xsIVclFMr1OURPzAPrvSPD9wyv4",
  authDomain: "inventario-de-repuestos-taller.firebaseapp.com",
  projectId: "inventario-de-repuestos-taller",
  storageBucket: "inventario-de-repuestos-taller.firebasestorage.app",
  messagingSenderId: "974025120647",
  appId: "1:974025120647:web:e4ac47ed91438e74bc9122",
  measurementId: "G-8SLD789ME0"
};

const isPreviewEnv = typeof window !== 'undefined' && typeof window.__firebase_config !== 'undefined';
const firebaseConfig = isPreviewEnv ? JSON.parse(window.__firebase_config) : localFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

const appId = isPreviewEnv && typeof window.__app_id !== 'undefined' ? window.__app_id : "inventario-taller"; 
const getColPath = (colName) => isPreviewEnv ? `artifacts/${appId}/public/data/${colName}` : colName;

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return d.getUTCFullYear() + "-W" + String(weekNo).padStart(2, '0');
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null); 
  const [masterOverride, setMasterOverride] = useState(false); 
  const [allUsers, setAllUsers] = useState([]); 

  const [materials, setMaterials] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [requests, setRequests] = useState([]); 
  const [bodegas, setBodegas] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: null, data: null });

  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState('all');
  const [historyFilterValue, setHistoryFilterValue] = useState('');

  // Seguro contra cargas infinitas (8 segundos)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authLoading) setAuthLoading(false);
    }, 8000); 
    return () => clearTimeout(timer);
  }, [authLoading]);

  // INICIALIZACIÓN DE AUTENTICACIÓN
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isPreviewEnv) {
          if (typeof window !== 'undefined' && typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
            await signInWithCustomToken(auth, window.__initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        }
      } catch (err) { console.error("Error inicializando autenticación:", err); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) { setUserData(null); setMasterOverride(false); setAuthLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  // CARGA DE PERFIL DE USUARIO
  useEffect(() => {
    if (!authUser) return;
    const userDocRef = doc(db, getColPath('users'), authUser.uid);
    
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      const isMasterAdmin = authUser.email === 'cristofer10murillo@gmail.com';
      if (docSnap.exists()) {
        const data = docSnap.data();
        let realName = data.name;
        if (isMasterAdmin && (!realName || realName.toLowerCase() === 'usuario' || realName === '')) {
          realName = 'Cristopher';
          updateDoc(userDocRef, { name: realName }); 
        }
        const userRole = (isMasterAdmin || (isPreviewEnv && authUser.isAnonymous)) ? 'master' : (data.role || 'basic');
        setUserData({ id: docSnap.id, ...data, name: realName, status: (isMasterAdmin || (isPreviewEnv && authUser.isAnonymous)) ? 'approved' : data.status, role: userRole });
      } else {
        const adminName = isMasterAdmin ? 'Cristopher' : (authUser.email || 'Anónimo');
        const initialStatus = (isMasterAdmin || (isPreviewEnv && authUser.isAnonymous)) ? 'approved' : 'pending';
        const initialRole = (isMasterAdmin || (isPreviewEnv && authUser.isAnonymous)) ? 'master' : 'basic';
        setUserData({ id: authUser.uid, status: initialStatus, name: adminName, role: initialRole });
        setDoc(userDocRef, { email: authUser.email || '', name: adminName, status: initialStatus, role: initialRole, createdAt: new Date().toISOString() });
      }
      setAuthLoading(false);
      setLoadingError(null); 
    }, (error) => {
      console.error("Error cargando perfil:", error);
      setLoadingError(`No se pudo leer tu perfil. Verifica Reglas de Seguridad. Detalles: ${error.message}`);
      setAuthLoading(false);
    });
    return () => unsubUser();
  }, [authUser]);

  // CARGA DE DATOS DE INVENTARIO
  useEffect(() => {
    if (!authUser || (userData?.status !== 'approved' && !masterOverride)) return;
    
    const unsubMaterials = onSnapshot(collection(db, getColPath('materials')), (snapshot) => { setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));
    const unsubTransactions = onSnapshot(collection(db, getColPath('transactions')), (snapshot) => { setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));
    const unsubRequests = onSnapshot(collection(db, getColPath('requests')), (snapshot) => { setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));
    const unsubBodegas = onSnapshot(collection(db, getColPath('bodegas')), (snapshot) => { setBodegas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));
    const unsubCostCenters = onSnapshot(collection(db, getColPath('costCenters')), (snapshot) => { setCostCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));
    const unsubSuppliers = onSnapshot(collection(db, getColPath('suppliers')), (snapshot) => { setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => console.error(error));

    return () => { unsubMaterials(); unsubTransactions(); unsubRequests(); unsubBodegas(); unsubCostCenters(); unsubSuppliers(); };
  }, [authUser, userData, masterOverride]);

  useEffect(() => {
    if (!authUser || userData?.role !== 'master') return;
    const unsub = onSnapshot(collection(db, getColPath('users')), snap => { setAllUsers(snap.docs.map(doc => ({id: doc.id, ...doc.data()}))); }, (error) => console.error(error));
    return () => unsub();
  }, [authUser, userData?.role]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (activeTab === 'inventory_taller') {
          return m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 (m.nombreBritt && m.nombreBritt.toLowerCase().includes(searchTerm.toLowerCase())) ||
                 (m.supplier && m.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
                 (m.location && m.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
                 (m.costCenter && m.costCenter.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      return false; 
    });
  }, [materials, searchTerm, activeTab]);

  const activeRequests = useMemo(() => {
    return [...requests].filter(r => r.status !== 'completed').sort((a, b) => new Date(b.requestDate || b.date) - new Date(a.requestDate || a.date)).reverse();
  }, [requests]);

  const completedRequestsAsTx = useMemo(() => {
    return requests.filter(r => r.status === 'completed').map(r => ({ ...r, isRequest: true, type: 'ORDER_RECEIVED', date: r.receivedDate || r.date }));
  }, [requests]);

  const combinedHistory = useMemo(() => {
    return [...transactions, ...completedRequestsAsTx].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, completedRequestsAsTx]);

  const filteredTransactions = useMemo(() => {
    let filtered = combinedHistory; 
    if (historySearchTerm.trim()) {
      const lowerSearch = historySearchTerm.toLowerCase();
      filtered = filtered.filter(tx => {
        const isGeneric = tx.isRequest && !tx.materialId;
        if (isGeneric) return 'pedido general'.includes(lowerSearch);
        const m = materials.find(mat => mat.id === tx.materialId);
        if (!m) return false;
        return m.name.toLowerCase().includes(lowerSearch) || m.sku.toLowerCase().includes(lowerSearch) || (m.nombreBritt && m.nombreBritt.toLowerCase().includes(lowerSearch));
      });
    }
    if (historyFilterType === 'month' && historyFilterValue) {
      filtered = filtered.filter(tx => tx.date.startsWith(historyFilterValue));
    } else if (historyFilterType === 'week' && historyFilterValue) {
      filtered = filtered.filter(tx => getWeekNumber(new Date(tx.date)) === historyFilterValue);
    }
    return filtered;
  }, [combinedHistory, historySearchTerm, historyFilterType, historyFilterValue, materials]); 

  const bodegasInventory = useMemo(() => {
    const inventory = {}; 
    bodegas.forEach(b => { inventory[b.id] = {}; });
    const chronologicTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    chronologicTx.forEach(tx => {
        if (tx.type === 'OUT' && tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') {
            if (inventory[tx.bodegaDestino]) { inventory[tx.bodegaDestino][tx.materialId] = (inventory[tx.bodegaDestino][tx.materialId] || 0) + tx.quantity; }
        } else if (tx.type === 'USE_BODEGA' && tx.bodegaOrigen) {
             if (inventory[tx.bodegaOrigen] && inventory[tx.bodegaOrigen][tx.materialId] !== undefined) {
                 inventory[tx.bodegaOrigen][tx.materialId] -= tx.quantity;
                 if(inventory[tx.bodegaOrigen][tx.materialId] < 0) inventory[tx.bodegaOrigen][tx.materialId] = 0;
             }
        } else if (tx.type === 'RETURN_BODEGA' && tx.bodegaOrigen) {
            if (inventory[tx.bodegaOrigen] && inventory[tx.bodegaOrigen][tx.materialId] !== undefined) {
                inventory[tx.bodegaOrigen][tx.materialId] -= tx.quantity;
                if(inventory[tx.bodegaOrigen][tx.materialId] < 0) inventory[tx.bodegaOrigen][tx.materialId] = 0;
            }
        }
    });
    return inventory;
  }, [transactions, bodegas]);

  const exportToExcel = (startDate = null, endDate = null, targetBodegaId = null) => {
    if (activeTab !== 'inventory_taller' && activeTab !== 'requests' && activeTab !== 'history' && activeTab !== 'history_bodegas' && activeTab !== 'bodegas_auxiliares') return;
    const loadScript = (src) => new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const script = document.createElement('script'); script.src = src; script.onload = () => resolve(window.XLSX); script.onerror = reject; document.head.appendChild(script);
    });

    loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js').then((XLSX) => {
        const wb = XLSX.utils.book_new();
        let currentRequests = activeRequests; 
        let currentTransactions = combinedHistory; 
        
        if (startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T23:59:59');
          currentRequests = activeRequests.filter(r => { const d = new Date(r.date); return d >= start && d <= end; });
          currentTransactions = combinedHistory.filter(tx => { const d = new Date(tx.date); return d >= start && d <= end; });
        }

        let rawData = [];
        let sheetName = "Datos";
        let fileName = "exportacion.xlsx";

        if (activeTab === 'inventory_taller') {
          rawData = materials.map(m => ({
            'Centro de Costos': m.costCenter || '---', 'Ubicación': m.location || 'N/A', 'Proveedor': m.supplier || 'N/A',
            'SKU': m.sku, 'Repuesto': m.name, 'Nombre Britt': m.nombreBritt || '---', 'Valor Unitario ($)': m.price || 0,
            'Stock Actual': m.stock, 'Stock Mínimo': m.minStock || 0, 'Stock Máximo': m.maxStock || 0, 'Valor Total ($)': (m.stock || 0) * (m.price || 0)
          }));
          sheetName = "Inv_Principal";
          fileName = `inventario_principal.xlsx`;
        } else if (activeTab === 'requests') {
          rawData = currentRequests.map(r => {
            const isGeneric = !r.materialId;
            const m = r.materialId ? materials.find(mat => mat.id === r.materialId) : null;
            const reqDateStr = r.requestDate ? new Date(r.requestDate + 'T00:00:00').toLocaleDateString('es-ES') : new Date(r.date).toLocaleDateString('es-ES');
            return { 'Fecha de Solicitud': reqDateStr, 'N° de Pedido': r.orderNumber || '---', 'Proveedor': r.supplier || '---', 'Máquina': r.machine || '---', 'Repuesto Solicitado': isGeneric ? 'Pedido General' : (m?.name || 'Desconocido'), 'SKU': isGeneric ? '---' : (m?.sku || '---'), 'Nombre Britt': isGeneric ? '---' : (m?.nombreBritt || '---'), 'Cantidad': r.quantity || '---', 'Solicitante': r.user, 'Adjunto': r.fileUrl ? 'Sí' : 'No' };
          });
          sheetName = "Registro_Solicitudes";
          fileName = "solicitudes_activas.xlsx";
        } else if (activeTab === 'history' || activeTab === 'history_bodegas') {
          let txsToExport = currentTransactions;
          if (activeTab === 'history_bodegas') {
             txsToExport = currentTransactions.filter(tx => (tx.type === 'OUT' && tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') || tx.type === 'USE_BODEGA' || tx.type === 'RETURN_BODEGA');
          }
          rawData = txsToExport.map(tx => {
            const isGeneric = tx.isRequest && !tx.materialId;
            const m = tx.materialId ? materials.find(mat => mat.id === tx.materialId) : null;
            const dateStr = new Date(tx.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            let destinoBodega = '---';
            if (tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') { destinoBodega = bodegas.find(b => b.id === tx.bodegaDestino)?.name || 'Bodega Eliminada'; }
            if (tx.bodegaOrigen) { destinoBodega = bodegas.find(b => b.id === tx.bodegaOrigen)?.name || 'Bodega Eliminada'; }
            let tipoMovimiento = tx.type;
            if (tx.type === 'IN') tipoMovimiento = 'ENTRADA'; else if (tx.type === 'OUT') tipoMovimiento = 'SALIDA'; else if (tx.type === 'USE_BODEGA') tipoMovimiento = 'USO BODEGA AUX'; else if (tx.type === 'RETURN_BODEGA') tipoMovimiento = 'DEVOLUCIÓN DE BODEGA'; else tipoMovimiento = 'PEDIDO RECIBIDO';
            return { 'Fecha y Hora': dateStr, 'Proveedor': tx.supplier || (m?.supplier || '---'), 'Tipo de Movimiento': tipoMovimiento, 'Repuesto': isGeneric ? 'Pedido General' : (m?.name || 'Desconocido'), 'SKU': isGeneric ? '---' : (m?.sku || '---'), 'Valor Unitario ($)': m?.price || 0, 'Cantidad': tx.quantity || '---', 'Bodega Involucrada': destinoBodega, 'Usuario Físico/Responsable': tx.user, 'Registrado en Sistema Por': tx.registeredBy || 'Anónimo/Sistema', };
          });
          sheetName = activeTab === 'history_bodegas' ? "Historial_Bodegas" : "Historial_Global";
          fileName = activeTab === 'history_bodegas' ? "historial_bodegas_auxiliares.xlsx" : "historial_movimientos.xlsx";
        } else if (activeTab === 'bodegas_auxiliares') {
             const bodegasToExport = targetBodegaId ? bodegas.filter(b => b.id === targetBodegaId) : bodegas;
             bodegasToExport.forEach(b => {
                 const bodegaItems = bodegasInventory[b.id] || {};
                 const data = Object.keys(bodegaItems).map(matId => {
                     const m = materials.find(mat => mat.id === matId);
                     return { 'Bodega': b.name, 'Responsable': b.owner, 'Repuesto': m ? m.name : 'Desconocido', 'SKU': m ? m.sku : '---', 'Costo Unitario ($)': m ? m.price : 0, 'Cantidad': bodegaItems[matId], 'Valor Total Parcial ($)': (m ? (m.price || 0) : 0) * bodegaItems[matId] };
                 }).filter(item => item.Cantidad > 0);
                 if(data.length > 0) rawData = [...rawData, ...data];
             });
             sheetName = targetBodegaId && bodegasToExport.length > 0 ? bodegasToExport[0].name.replace(/\s+/g, '_') : "Bodegas_Auxiliares";
             fileName = targetBodegaId && bodegasToExport.length > 0 ? `inventario_${bodegasToExport[0].name.replace(/\s+/g, '_').toLowerCase()}.xlsx` : "inventario_todas_bodegas.xlsx";
        }

        if (rawData.length === 0) { alert("No hay datos para exportar con los filtros actuales."); return; }
        const wsData = XLSX.utils.json_to_sheet(rawData);
        const wscols = Object.keys(rawData[0]).map(key => {
          let maxLength = key.length; 
          rawData.forEach(row => { const valStr = row[key] !== null && row[key] !== undefined ? row[key].toString() : ''; if (valStr.length > maxLength) maxLength = valStr.length; });
          return { wch: Math.min(maxLength + 3, 50) }; 
        });
        wsData['!cols'] = wscols;
        XLSX.utils.book_append_sheet(wb, wsData, sheetName);
        XLSX.writeFile(wb, fileName);
        closeModal(); 
      }).catch(err => console.error("Error al generar Excel: ", err));
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    const fileRef = ref(storage, `repuestos/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const uploadDocument = async (file) => {
    if (!file) return null;
    const fileRef = ref(storage, `solicitudes/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const handleAddMaterial = async (data) => {
    const { imageFile, ...newMaterial } = data;
    let imageUrl = null;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    await addDoc(collection(db, getColPath('materials')), { ...newMaterial, imageUrl, createdBy: userData?.name || 'Usuario Admin', createdAt: new Date().toISOString() });
    closeModal();
  };

  const handleEditMaterial = async (data) => {
    const { id, imageFile, ...updatedData } = data;
    let newImageUrl = updatedData.imageUrl; 
    if (imageFile) newImageUrl = await uploadImage(imageFile);
    await updateDoc(doc(db, getColPath('materials'), id), { ...updatedData, imageUrl: newImageUrl });
    closeModal();
  };

  const handleDeleteMaterial = async (materialId) => {
    await deleteDoc(doc(db, getColPath('materials'), materialId));
    closeModal();
  };

  const handleTransaction = async ({ materialId, type, quantity, user: txUser, bodegaOrigen }) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    if (type === 'USE_BODEGA' || type === 'RETURN_BODEGA') {
        if (type === 'RETURN_BODEGA') { await updateDoc(doc(db, getColPath('materials'), materialId), { stock: material.stock + quantity }); }
        await addDoc(collection(db, getColPath('transactions')), { materialId, type, quantity, date: new Date().toISOString(), user: txUser, bodegaOrigen: bodegaOrigen, registeredBy: userData?.name || authUser?.email || 'Sistema/Admin' });
    } else {
        await updateDoc(doc(db, getColPath('materials'), materialId), { stock: type === 'IN' ? material.stock + quantity : material.stock - quantity });
        await addDoc(collection(db, getColPath('transactions')), { materialId, type, quantity, date: new Date().toISOString(), user: txUser, bodegaDestino: 'ninguna', registeredBy: userData?.name || authUser?.email || 'Sistema/Admin' });
    }
    closeModal();
  };

  const handleMultipleDispatch = async ({ cartItems, user: txUser, bodegaDestino }) => {
    for (const item of cartItems) {
      const material = materials.find(m => m.id === item.materialId);
      if (!material || material.stock < item.quantity) { throw new Error(`Stock insuficiente para ${item.name}`); }
      await updateDoc(doc(db, getColPath('materials'), material.id), { stock: material.stock - item.quantity });
      await addDoc(collection(db, getColPath('transactions')), { materialId: material.id, type: 'OUT', quantity: item.quantity, date: new Date().toISOString(), user: txUser, bodegaDestino: bodegaDestino, registeredBy: userData?.name || authUser?.email || 'Sistema/Admin' });
    }
    setActiveTab('history');
  };

  const handleRequestMaterial = async (requestData) => {
    const { requestFile, ...dataToSave } = requestData;
    let fileUrl = null; let fileName = null;
    if (requestFile) { fileUrl = await uploadDocument(requestFile); fileName = requestFile.name; }
    await addDoc(collection(db, getColPath('requests')), { ...dataToSave, fileUrl, fileName, status: 'pending', date: new Date().toISOString(), registeredBy: userData?.name || authUser?.email || 'Sistema/Admin' });
    setActiveTab('requests');
  };

  const handleCompleteRequest = async (requestId) => {
    await updateDoc(doc(db, getColPath('requests'), requestId), { status: 'completed', receivedDate: new Date().toISOString() });
    closeModal();
  };

  const handleDeleteRequest = async (requestId) => {
    await deleteDoc(doc(db, getColPath('requests'), requestId));
    closeModal();
  };

  const handleDeleteHistoryRecord = async (recordId, isRequest) => {
    try { const collectionName = isRequest ? 'requests' : 'transactions'; await deleteDoc(doc(db, getColPath(collectionName), recordId)); closeModal(); } catch (err) { console.error(err); }
  };

  const handleCreateBodega = async (bodegaData) => { await addDoc(collection(db, getColPath('bodegas')), { ...bodegaData, createdAt: new Date().toISOString() }); };
  const handleUpdateBodega = async ({ id, name, owner }) => { await updateDoc(doc(db, getColPath('bodegas'), id), { name, owner }); closeModal(); };
  const handleUpdateBodegaLimits = async ({ bodegaId, materialId, newLimit }) => {
    const bodega = bodegas.find(b => b.id === bodegaId);
    if (!bodega) return;
    const updatedLimits = { ...(bodega.limits || {}) };
    if (newLimit === '' || newLimit === null || newLimit === undefined) { delete updatedLimits[materialId]; } else { updatedLimits[materialId] = parseInt(newLimit, 10); }
    await updateDoc(doc(db, getColPath('bodegas'), bodegaId), { limits: updatedLimits });
  };
  const handleDeleteBodega = async (bodegaId) => { if(window.confirm("¿Seguro que deseas eliminar esta bodega auxiliar?")) { await deleteDoc(doc(db, getColPath('bodegas'), bodegaId)); } };
  const handleCreateCostCenter = async (costCenterData) => { await addDoc(collection(db, getColPath('costCenters')), { ...costCenterData, createdAt: new Date().toISOString() }); };
  const handleUpdateCostCenter = async ({ id, name }) => { await updateDoc(doc(db, getColPath('costCenters'), id), { name }); closeModal(); };
  const handleDeleteCostCenter = async (costCenterId) => { if(window.confirm("¿Seguro que deseas eliminar este Centro de Costos?")) { await deleteDoc(doc(db, getColPath('costCenters'), costCenterId)); } };
  const handleCreateSupplier = async (supplierData) => { await addDoc(collection(db, getColPath('suppliers')), { ...supplierData, createdAt: new Date().toISOString() }); };
  const handleDeleteSupplier = async (supplierId) => { if(window.confirm("¿Seguro que deseas eliminar este Proveedor?")) { await deleteDoc(doc(db, getColPath('suppliers'), supplierId)); } };
  const handleUpdateUserStatus = async (userId, newStatus) => { await updateDoc(doc(db, getColPath('users'), userId), { status: newStatus }); };
  const handleUpdateUserRole = async (userId, newRole) => { await updateDoc(doc(db, getColPath('users'), userId), { role: newRole }); };
  const handleDeleteUser = async (userId) => { await deleteDoc(doc(db, getColPath('users'), userId)); closeModal(); };

  const openModal = (type, data = null) => setModalConfig({ isOpen: true, type, data });
  const closeModal = () => setModalConfig({ isOpen: false, type: null, data: null });
  const handleLogout = () => { signOut(auth); setMasterOverride(false); };

  const handleAdminDirectLogin = async (password) => {
    try { setAuthLoading(true); await signInWithEmailAndPassword(auth, 'cristofer10murillo@gmail.com', password); setMasterOverride(true); setActiveTab('settings'); } 
    catch (error) { setLoadingError("Fallo al iniciar sesión."); } finally { setAuthLoading(false); }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#0f1423] flex flex-col items-center justify-center space-y-6">
      <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-500"></div>
      <p className="text-indigo-400 font-medium animate-pulse">Conectando a Nexus Pro...</p>
    </div>
  );

  if (loadingError) return (
    <div className="min-h-screen bg-[#0f1423] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-5 bg-rose-500/10 rounded-full mb-6"><AlertCircle size={56} className="text-rose-500" /></div>
      <h2 className="text-3xl font-bold text-white mb-4">Conexión Rechazada</h2>
      <p className="text-slate-400 max-w-lg mb-8 text-sm">{loadingError}</p>
      <button onClick={() => {setLoadingError(null); setAuthLoading(false); signOut(auth);}} className="px-8 py-3 bg-indigo-600 text-white rounded-xl">Reintentar</button>
    </div>
  );

  if (!authUser) return <AuthScreen onAdminDirectLogin={handleAdminDirectLogin} auth={auth} />;
  
  if (userData?.status === 'pending' && !masterOverride) return <PendingScreen userData={userData} onLogout={handleLogout} onMasterBypass={async (password) => { 
    try { setAuthLoading(true); await signInWithEmailAndPassword(auth, 'cristofer10murillo@gmail.com', password); setMasterOverride(true); setActiveTab('settings'); } 
    catch(err) { alert("Clave incorrecta."); } finally { setAuthLoading(false); }
  }} />;

  const SidebarItem = ({ icon: Icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'}`}>
      <Icon size={20} /><span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0f1423] bg-gradient-to-br from-[#0f1423] via-[#151b2e] to-[#0f1423] flex flex-col md:flex-row text-slate-200">
      
      <aside className="w-full md:w-64 bg-[#151b2e]/80 border-r border-white/5 p-6 flex flex-col z-10">
        <div className="flex items-center space-x-3 mb-10"><div className="p-2 bg-indigo-600 rounded-lg"><Package size={24} className="text-white" /></div><h1 className="text-lg font-bold text-white">Nexus Pro <br/><span className="text-indigo-400 text-xs">by Cristopher</span></h1></div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={BarChart3} label="Panel de Resumen" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-4 pb-2"><p className="text-[10px] text-slate-500 px-4 uppercase tracking-widest">Inventario</p></div>
          <SidebarItem icon={Box} label="Taller de Máquinas" isActive={activeTab === 'inventory_taller'} onClick={() => setActiveTab('inventory_taller')} />
          <SidebarItem icon={Database} label="Bodegas Auxiliares" isActive={activeTab === 'bodegas_auxiliares'} onClick={() => setActiveTab('bodegas_auxiliares')} />
          
          {userData?.role !== 'visitante' && (
            <>
              <div className="pt-4 pb-2"><p className="text-[10px] text-slate-500 px-4 uppercase tracking-widest">Gestión de Pedidos</p></div>
              <SidebarItem icon={ShoppingCart} label="Despacho a Técnicos" isActive={activeTab === 'dispatch_cart'} onClick={() => setActiveTab('dispatch_cart')} />
              <SidebarItem icon={FilePlus} label="Realizar Solicitud" isActive={activeTab === 'new_request'} onClick={() => setActiveTab('new_request')} />
              <SidebarItem icon={ClipboardList} label="Registro Solicitudes" isActive={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
            </>
          )}

          <div className="pt-4 pb-2"><p className="text-[10px] text-slate-500 px-4 uppercase tracking-widest">Otros</p></div>
          <SidebarItem icon={History} label="Historial Principal" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem icon={ScrollText} label="Historial Bodegas Aux." isActive={activeTab === 'history_bodegas'} onClick={() => setActiveTab('history_bodegas')} />
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5 flex flex-col space-y-3">
          {userData?.role !== 'visitante' && (
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg border ${activeTab === 'settings' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-black/20 text-slate-400 border-white/5'}`}>
              <Settings size={16} /><span className="text-sm font-medium">Ajustes Principales</span>
            </button>
          )}
          <div className="flex items-center justify-between px-2 pt-2 text-slate-400 border-t border-white/5 mt-2">
            <span className="text-xs truncate">{userData?.name || 'Usuario'}</span><button onClick={handleLogout} className="hover:text-red-400"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-auto h-screen">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">
              {activeTab === 'dashboard' ? 'Panel de Resumen Global' : activeTab === 'inventory_taller' ? 'Inventario Principal' : activeTab === 'bodegas_auxiliares' ? 'Bodegas Auxiliares' : activeTab === 'dispatch_cart' ? 'Despacho Múltiple a Técnicos' : activeTab === 'new_request' ? 'Realizar Nueva Solicitud' : activeTab === 'requests' ? 'Registro de Solicitudes' : activeTab === 'history_bodegas' ? 'Historial de Bodegas Auxiliares' : activeTab === 'settings' ? 'Ajustes Principales' : 'Historial de Movimientos'}
            </h2>
            <p className="text-slate-400 mt-1 text-sm">Hola, <span className="text-indigo-400">{userData?.name || 'Usuario'}</span>.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(['inventory_taller', 'requests', 'history', 'history_bodegas', 'bodegas_auxiliares'].includes(activeTab)) && (
              <button onClick={() => openModal('EXPORT_EXCEL')} className="flex items-center space-x-2 bg-[#1e253c] text-slate-200 px-4 py-2.5 rounded-xl font-medium"><Download size={20} /><span className="hidden sm:inline">Exportar Todas (Excel)</span></button>
            )}
            {(userData?.role === 'master' || userData?.role === 'admin') && activeTab === 'inventory_taller' && (
              <>
                <input type="file" accept=".xlsx, .xls" ref={importFileInputRef} onChange={handleImportExcel} className="hidden" />
                <button onClick={() => importFileInputRef.current?.click()} disabled={isImporting} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium">
                  {isImporting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Upload size={20} /><span className="hidden sm:inline">Importar Excel</span></>}
                </button>
                <button onClick={() => openModal('ADD_MATERIAL')} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium"><Plus size={20} /><span className="hidden sm:inline">Nuevo Repuesto</span></button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardTab materials={materials} transactions={transactions} bodegas={bodegas} bodegasInventory={bodegasInventory} openModal={openModal} userData={userData} />}
        {activeTab === 'new_request' && <NewRequestTab materials={materials} onSubmit={handleRequestMaterial} />}
        {activeTab === 'dispatch_cart' && <DispatchCartTab materials={materials} bodegas={bodegas} bodegasInventory={bodegasInventory} onSubmit={handleMultipleDispatch} />}
        {activeTab === 'bodegas_auxiliares' && <BodegasAuxiliaresTab bodegas={bodegas} materials={materials} bodegasInventory={bodegasInventory} openModal={openModal} userData={userData} exportToExcel={exportToExcel} onUpdateLimits={handleUpdateBodegaLimits}/>}
        {activeTab === 'history_bodegas' && <BodegasHistoryTab transactions={combinedHistory} materials={materials} bodegas={bodegas} userData={userData} openModal={openModal} />}

        {!['dashboard', 'new_request', 'dispatch_cart', 'bodegas_auxiliares', 'history_bodegas'].includes(activeTab) && (
          <div className="bg-[#1e253c]/50 rounded-2xl border border-white/5 overflow-hidden">
            {activeTab === 'inventory_taller' && (
              <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                <div className="relative max-w-md w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} /><input type="text" placeholder="Buscar en el Inventario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0f1423] border border-white/10 text-white outline-none" /></div>
              </div>
            )}

            <div className="overflow-x-auto">
              {activeTab === 'inventory_taller' && (
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase"><th className="p-4 w-16">Foto</th><th className="p-4">Proveedor</th><th className="p-4">SKU</th><th className="p-4">Repuesto</th><th className="p-4">Ubicación</th><th className="p-4">Nombre Britt</th><th className="p-4">C. Costos</th><th className="p-4">Stock</th><th className="p-4">Mín / Máx</th><th className="p-4 text-center">Total</th>{userData?.role !== 'visitante' && <th className="p-4 text-right">Acciones</th>}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMaterials.length === 0 ? <tr><td colSpan={11} className="p-8 text-center text-slate-500">No se encontraron repuestos.</td></tr> : 
                    filteredMaterials.map(material => (
                      <tr key={material.id} className="hover:bg-white/5">
                        <td className="p-4">{material.imageUrl ? (<img src={material.imageUrl} alt="" onClick={() => openModal('VIEW_IMAGE', { imageUrl: material.imageUrl, name: material.name })} className="w-10 h-10 rounded-lg object-cover cursor-pointer" />) : (<div className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center text-slate-600"><Box size={20} /></div>)}</td>
                        <td className="p-4 text-slate-400 text-sm">{material.supplier || '---'}</td>
                        <td className="p-4 text-slate-400 font-mono text-sm">{material.sku}</td>
                        <td className="p-4"><button onClick={() => openModal('MATERIAL_DETAILS', { material })} className="font-semibold text-white hover:text-indigo-400">{material.name}</button></td>
                        <td className="p-4 text-slate-400 text-sm">{material.location || '---'}</td>
                        <td className="p-4 text-slate-400 text-sm">{material.nombreBritt || '---'}</td>
                        <td className="p-4 text-slate-300 font-mono text-xs">{material.costCenter || '---'}</td>
                        <td className="p-4"><span className={`px-3 py-1 rounded-full text-sm font-medium ${material.stock < material.minStock ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{material.stock} unid.</span></td>
                        <td className="p-4 text-slate-500 text-sm">{material.minStock} / {material.maxStock}</td>
                        <td className="p-4 text-center"><span className="text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg">${((material.stock || 0) * (material.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                        {userData?.role !== 'visitante' && (
                          <td className="p-4 text-right"><div className="flex justify-end space-x-2"><button onClick={() => openModal('TRANSACTION', { material, type: 'IN' })} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><ArrowDownRight size={20} /></button><button onClick={() => openModal('TRANSACTION', { material, type: 'OUT' })} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"><ArrowUpRight size={20} /></button></div></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'requests' && (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead><tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase"><th className="p-4">Fecha</th><th className="p-4">N° Pedido</th><th className="p-4">Proveedor</th><th className="p-4">Máquina</th><th className="p-4">Solicitante</th><th className="p-4">Repuesto / SKU</th><th className="p-4">Cant</th><th className="p-4 text-center">Adjunto</th><th className="p-4 text-right">Acción</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {activeRequests.length === 0 ? <tr><td colSpan="9" className="p-8 text-center text-slate-500">Sin solicitudes.</td></tr> :
                    activeRequests.map(r => {
                      const isGeneric = !r.materialId; const m = r.materialId ? materials.find(mat => mat.id === r.materialId) : null;
                      return (
                        <tr key={r.id} className="hover:bg-white/5">
                          <td className="p-4 text-slate-400 text-sm font-medium">{new Date(r.requestDate || r.date).toLocaleDateString()}</td>
                          <td className="p-4 text-slate-300 font-mono text-sm">{r.orderNumber || '---'}</td>
                          <td className="p-4 text-slate-300 text-sm">{r.supplier || '---'}</td><td className="p-4 text-slate-300 text-sm">{r.machine || '---'}</td>
                          <td className="p-4 text-slate-200 font-medium flex items-center space-x-2 mt-2"><User size={16} className="text-slate-500"/> <span>{r.user}</span></td>
                          <td className="p-4"><div className="font-medium text-white">{isGeneric ? 'Pedido General' : (m?.name || 'Desconocido')}</div><div className="text-xs text-slate-500 font-mono">{isGeneric ? '---' : (m?.sku || '---')}</div></td>
                          <td className="p-4 text-indigo-400 font-bold">{r.quantity || '---'}</td>
                          <td className="p-4 text-center">{r.fileUrl ? (<a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-400"><FileText size={14}/></a>) : (<span className="text-slate-600 text-xs italic">---</span>)}</td>
                          <td className="p-4 text-right whitespace-nowrap"><button onClick={() => openModal('COMPLETE_REQUEST', { request: r })} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm mr-2"><CheckCircle2 size={16}/><span>Llegada</span></button><button onClick={() => openModal('DELETE_REQUEST', { request: r })} className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg"><Trash2 size={16}/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {activeTab === 'history' && (
                <div className="flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                    <div className="flex items-center space-x-2 w-full xl:w-auto"><History size={18} className="text-indigo-400" /><span className="text-white font-semibold">Filtros</span></div>
                    <div className="flex-1 w-full max-w-md relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input type="text" placeholder="Buscar..." value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0f1423] border border-white/10 text-white outline-none" />{historySearchTerm && (<button onClick={() => setHistorySearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"><X size={14}/></button>)}</div>
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                      <select className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none" value={historyFilterType} onChange={(e) => { setHistoryFilterType(e.target.value); setHistoryFilterValue(''); }}><option value="all">Ver Todo</option><option value="month">Por Mes</option><option value="week">Por Semana</option></select>
                      {historyFilterType === 'month' && <input type="month" value={historyFilterValue} onChange={(e) => setHistoryFilterValue(e.target.value)} className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none" />}
                      {historyFilterType === 'week' && <input type="week" value={historyFilterValue} onChange={(e) => setHistoryFilterValue(e.target.value)} className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none" />}
                      {historyFilterValue && <button onClick={() => setHistoryFilterValue('')} className="p-2 bg-white/5 text-slate-400 rounded-lg"><X size={16}/></button>}
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse min-w-[1100px]">
                    <thead><tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase"><th className="p-4">Fecha y Hora</th><th className="p-4">Tipo</th><th className="p-4">Repuesto / SKU</th><th className="p-4">Nombre Britt</th><th className="p-4">Cant</th><th className="p-4">Responsable</th>{userData?.role === 'master' && <th className="p-4 text-right">Acción</th>}</tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTransactions.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">Sin movimientos.</td></tr> :
                      filteredTransactions.map(tx => {
                        const isGeneric = tx.isRequest && !tx.materialId; const m = tx.materialId ? materials.find(mat => mat.id === tx.materialId) : null;
                        return (
                          <tr key={tx.id} className="hover:bg-white/5">
                            <td className="p-4 text-slate-400 text-sm">{new Date(tx.date).toLocaleString()}</td>
                            <td className="p-4"><span className="text-xs font-bold text-indigo-400">{tx.type}</span></td>
                            <td className="p-4"><div className="font-medium text-white">{isGeneric ? 'Pedido General' : (m?.name || 'Eliminado')}</div><div className="text-xs text-slate-500 font-mono">{isGeneric ? '---' : (m?.sku || '---')}</div></td>
                            <td className="p-4 text-slate-400 text-sm">{isGeneric ? '---' : (m?.nombreBritt || '---')}</td>
                            <td className="p-4 text-slate-200 font-bold">{tx.quantity || '---'}</td>
                            <td className="p-4"><div className="text-slate-200 font-medium flex items-center mb-1"><User size={14} className="text-slate-500 mr-1"/><span>{tx.user}</span></div><div className="text-[10px] text-slate-500 uppercase">Por: {tx.registeredBy || 'Anónimo'}</div></td>
                            {userData?.role === 'master' && <td className="p-4 text-right"><button onClick={() => openModal('DELETE_HISTORY', { record: tx })} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><Trash2 size={16} /></button></td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="p-6">
                  <SettingsDashboard materials={materials} allUsers={allUsers} bodegas={bodegas} costCenters={costCenters} suppliers={suppliers} onDelete={(material) => openModal('DELETE_MATERIAL', { material })} onEdit={(material) => openModal('EDIT_MATERIAL', { material })} onUpdateUserStatus={handleUpdateUserStatus} onUpdateUserRole={handleUpdateUserRole} onDeleteUser={(user) => openModal('DELETE_USER', { user })} onCreateBodega={handleCreateBodega} onEditBodega={(bodega) => openModal('EDIT_BODEGA', { bodega })} onDeleteBodega={handleDeleteBodega} onCreateCostCenter={handleCreateCostCenter} onEditCostCenter={(cc) => openModal('EDIT_COST_CENTER', { costCenter: cc })} onDeleteCostCenter={handleDeleteCostCenter} onCreateSupplier={handleCreateSupplier} onDeleteSupplier={handleDeleteSupplier} userData={userData} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto bg-[#0f1423]/80 backdrop-blur-md">
          <div className="bg-[#1e253c] border border-white/10 shadow-2xl w-full max-w-md rounded-3xl relative p-6">
             {modalConfig.type === 'VIEW_IMAGE' && (<div className="flex flex-col items-center"><button onClick={closeModal} className="absolute -top-12 right-0 p-2 text-white"><X size={28}/></button><img src={modalConfig.data.imageUrl} alt="img" className="max-h-[80vh] rounded-xl object-contain"/></div>)}
             {modalConfig.type === 'EXPORT_EXCEL' && <ExportExcelForm activeTab={activeTab} onSubmit={exportToExcel} onClose={closeModal} />}
             {modalConfig.type === 'ADD_MATERIAL' && <AddMaterialForm materials={materials} costCenters={costCenters} suppliers={suppliers} onSubmit={handleAddMaterial} onClose={closeModal} />}
             {modalConfig.type === 'EDIT_MATERIAL' && <EditMaterialForm materials={materials} costCenters={costCenters} suppliers={suppliers} material={modalConfig.data.material} onSubmit={handleEditMaterial} onClose={closeModal} userRole={userData?.role} />}
             {modalConfig.type === 'DELETE_MATERIAL' && <DeleteMaterialForm material={modalConfig.data.material} onSubmit={handleDeleteMaterial} onClose={closeModal} />}
             {modalConfig.type === 'TRANSACTION' && <TransactionForm material={modalConfig.data.material} type={modalConfig.data.type} bodegaOrigen={modalConfig.data.bodegaOrigen} onSubmit={handleTransaction} onClose={closeModal} />}
             {modalConfig.type === 'COMPLETE_REQUEST' && <CompleteRequestForm request={modalConfig.data.request} onSubmit={handleCompleteRequest} onClose={closeModal} />}
             {modalConfig.type === 'DELETE_REQUEST' && <DeleteRequestForm request={modalConfig.data.request} onSubmit={handleDeleteRequest} onClose={closeModal} />}
             {modalConfig.type === 'DELETE_USER' && <DeleteUserForm user={modalConfig.data.user} onSubmit={handleDeleteUser} onClose={closeModal} />}
             {modalConfig.type === 'DELETE_HISTORY' && <DeleteHistoryForm record={modalConfig.data.record} onSubmit={handleDeleteHistoryRecord} onClose={closeModal} />}
             {modalConfig.type === 'EDIT_BODEGA' && <EditBodegaForm bodega={modalConfig.data.bodega} onSubmit={handleUpdateBodega} onClose={closeModal} />}
             {modalConfig.type === 'MANAGE_BODEGA_LIMITS' && <ManageBodegaLimitsForm bodega={modalConfig.data.bodega} materials={materials} onSubmit={handleUpdateBodegaLimits} onClose={closeModal} />}
             {modalConfig.type === 'EDIT_COST_CENTER' && <EditCostCenterForm costCenter={modalConfig.data.costCenter} onSubmit={handleUpdateCostCenter} onClose={closeModal} />}
             {modalConfig.type === 'MATERIAL_DETAILS' && (<div><h3 className="text-2xl font-bold text-white mb-2">{modalConfig.data.material.name}</h3><button onClick={closeModal} className="w-full py-2 bg-white/10 text-white rounded-xl mt-4">Cerrar</button></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function BodegasHistoryTab({ transactions, materials, bodegas, userData, openModal }) { return <div className="p-6 bg-[#1e253c]/50 rounded-2xl text-white">Historial de Bodegas</div>; }
function BodegasAuxiliaresTab({ bodegas, materials, bodegasInventory, openModal, userData, exportToExcel, onUpdateLimits }) { return <div className="p-6 bg-[#1e253c]/50 rounded-2xl text-white">Bodegas Auxiliares</div>; }
function DispatchCartTab({ materials, bodegas, bodegasInventory, onSubmit }) { return <div className="p-6 bg-[#1e253c]/50 rounded-2xl text-white">Despacho a Técnicos</div>; }
function NewRequestTab({ materials, onSubmit }) { return <div className="p-6 bg-[#1e253c]/50 rounded-2xl text-white">Nueva Solicitud</div>; }
function DashboardTab({ materials, transactions, bodegas, bodegasInventory, openModal, userData }) { return <div className="p-6 bg-[#1e253c]/50 rounded-2xl text-white">Panel de Resumen</div>; }
function ExportExcelForm({ activeTab, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-white">Exportar a Excel</h3><button onClick={() => onSubmit(null, null)} className="w-full py-2 bg-emerald-600 text-white rounded-xl">Descargar</button></div>; }
function AddMaterialForm({ materials, costCenters, suppliers, onSubmit, onClose }) { return <div>Añadir Repuesto (Oculto por brevedad)</div>; }
function EditMaterialForm({ materials, costCenters, suppliers, material, onSubmit, onClose, userRole }) { return <div>Editar Repuesto (Oculto por brevedad)</div>; }
function DeleteMaterialForm({ material, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-rose-500">Borrar Repuesto</h3><button onClick={() => onSubmit(material.id)} className="w-full py-2 bg-rose-600 text-white rounded-xl">Confirmar</button></div>; }
function TransactionForm({ material, type, bodegaOrigen, onSubmit, onClose }) { return <div>Formulario de Transacción (Oculto por brevedad)</div>; }
function CompleteRequestForm({ request, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-emerald-400">Confirmar Llegada</h3><button onClick={() => onSubmit(request.id)} className="w-full py-2 bg-emerald-600 text-white rounded-xl">Confirmar</button></div>; }
function DeleteRequestForm({ request, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-rose-500">Eliminar Solicitud</h3><button onClick={() => onSubmit(request.id)} className="w-full py-2 bg-rose-600 text-white rounded-xl">Eliminar</button></div>; }
function DeleteUserForm({ user, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-rose-500">Eliminar Usuario</h3><button onClick={() => onSubmit(user.id)} className="w-full py-2 bg-rose-600 text-white rounded-xl">Eliminar</button></div>; }
function DeleteHistoryForm({ record, onSubmit, onClose }) { return <div className="space-y-4"><h3 className="text-xl font-bold text-rose-500">Borrar Registro</h3><button onClick={() => onSubmit(record.id, record.isRequest)} className="w-full py-2 bg-rose-600 text-white rounded-xl">Confirmar</button></div>; }
function EditBodegaForm({ bodega, onSubmit, onClose }) { return <div>Editar Bodega</div>; }
function ManageBodegaLimitsForm({ bodega, materials, onSubmit, onClose }) { return <div>Administrar Límites</div>; }
function EditCostCenterForm({ costCenter, onSubmit, onClose }) { return <div>Editar C.C.</div>; }
function SettingsDashboard(props) { return <div className="text-white">Panel de Configuración (Oculto por brevedad)</div>; }
function AuthScreen({ onAdminDirectLogin, auth }) { return <div className="text-white p-10 text-center">Pantalla de Autenticación (Oculto por brevedad)</div>; }
function PendingScreen({ userData, onLogout, onMasterBypass }) { return <div className="text-white p-10 text-center">Cuenta Pendiente (Oculto por brevedad)</div>; }