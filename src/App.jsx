import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, Plus, ArrowDownRight, ArrowUpRight, History, 
  Search, X, AlertCircle, Box, User, Download, MapPin,
  ClipboardList, Send, Settings2, Settings, Trash2,
  LogOut, Mail, KeyRound, UserPlus, ShieldCheck, Clock, CheckCircle2,
  ImagePlus, Camera, FilePlus, CalendarDays, BarChart3, TrendingUp, AlertTriangle,
  Paperclip, FileText, ExternalLink, Building2, Cpu, Shield, DollarSign, Tag,
  ShoppingCart, Truck, Database, Undo2, Edit, Wallet, ScrollText
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
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
const db = initializeFirestore(app, { 
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
  experimentalForceLongPolling: true
});
const storage = getStorage(app); 
const appId = isPreviewEnv && typeof window.__app_id !== 'undefined' ? window.__app_id : "inventario-britt"; 

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

  // 1. INICIALIZACIÓN DE AUTENTICACIÓN
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
      } catch (err) {
        console.error("Error inicializando autenticación:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setUserData(null); 
        setMasterOverride(false); 
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const userDocRef = doc(db, 'users', authUser.uid);
    
    
    const timeoutId = setTimeout(() => {
      console.warn('Conexión lenta a Firestore. Es posible que un antivirus o red corporativa esté bloqueando WebSockets, forzando la caída a Long Polling (puede tardar hasta 30s).');
      // No cortamos la conexión ni mostramos error destructivo. Solo avisamos.
    }, 15000);

    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      clearTimeout(timeoutId);

      const isMasterAdmin = authUser.email === 'cristofer10murillo@gmail.com';
      if (docSnap.exists()) {
        const data = docSnap.data();
        let realName = data.name;
        if (isMasterAdmin && (!realName || realName.toLowerCase() === 'usuario' || realName === '')) {
          realName = 'Cristofer Lizano';
          updateDoc(userDocRef, { name: realName }); 
        }
        
        const userRole = (isMasterAdmin || isPreviewEnv) ? 'master' : (data.role || 'basic');
        
        setUserData({ 
            id: docSnap.id, 
            ...data, 
            name: realName, 
            status: (isMasterAdmin || isPreviewEnv) ? 'approved' : data.status,
            role: userRole
        });
      } else {
        const adminName = isMasterAdmin ? 'Cristofer Lizano' : (authUser.email || 'Anónimo');
        const initialStatus = (isMasterAdmin || isPreviewEnv) ? 'approved' : 'pending';
        const initialRole = (isMasterAdmin || isPreviewEnv) ? 'master' : 'basic';
        
        setUserData({ id: authUser.uid, status: initialStatus, name: adminName, role: initialRole });
        setDoc(userDocRef, { email: authUser.email || '', name: adminName, status: initialStatus, role: initialRole, createdAt: new Date().toISOString() });
      }
      setAuthLoading(false);
      setLoadingError(null); 
    }, (error) => {
      console.error("Error cargando perfil de usuario:", error);
      clearTimeout(timeoutId);
      setLoadingError(`No se pudo leer tu perfil. Detalles: ${error.message}`);
      setAuthLoading(false);
    });
    
    return () => {
      clearTimeout(timeoutId);
      unsubUser();
    };

  }, [authUser]);

  useEffect(() => {
    if (!authUser || (userData?.status !== 'approved' && !masterOverride)) return;
    
    const materialsRef = collection(db, 'materials');
    const unsubMaterials = onSnapshot(materialsRef, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error Materials:", error));

    const transactionsRef = collection(db, 'transactions');
    const unsubTransactions = onSnapshot(transactionsRef, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error Transactions:", error));

    const requestsRef = collection(db, 'requests');
    const unsubRequests = onSnapshot(requestsRef, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error Requests:", error));

    const bodegasRef = collection(db, 'bodegas');
    const unsubBodegas = onSnapshot(bodegasRef, (snapshot) => {
      setBodegas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error Bodegas:", error));

    const costCentersRef = collection(db, 'costCenters');
    const unsubCostCenters = onSnapshot(costCentersRef, (snapshot) => {
      setCostCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error CostCenters:", error));

    const suppliersRef = collection(db, 'suppliers');
    const unsubSuppliers = onSnapshot(suppliersRef, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error Suppliers:", error));

    return () => { unsubMaterials(); unsubTransactions(); unsubRequests(); unsubBodegas(); unsubCostCenters(); unsubSuppliers(); };
  }, [authUser, userData, masterOverride]);

  useEffect(() => {
    if (!authUser || userData?.role !== 'master') return;
    const usersRef = collection(db, 'users');
    const unsub = onSnapshot(usersRef, snap => {
      setAllUsers(snap.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }, (error) => console.error("Error Users:", error));
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
    return [...requests]
      .filter(r => r.status !== 'completed')
      .sort((a, b) => new Date(b.requestDate || b.date) - new Date(a.requestDate || a.date)).reverse();
  }, [requests]);

  const completedRequestsAsTx = useMemo(() => {
    return requests
      .filter(r => r.status === 'completed')
      .map(r => ({
        ...r,
        isRequest: true,
        type: 'ORDER_RECEIVED',
        date: r.receivedDate || r.date 
      }));
  }, [requests]);

  const combinedHistory = useMemo(() => {
    return [...transactions, ...completedRequestsAsTx]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, completedRequestsAsTx]);

  const filteredTransactions = useMemo(() => {
    let filtered = combinedHistory; 

    if (historySearchTerm.trim()) {
      const lowerSearch = historySearchTerm.toLowerCase();
      filtered = filtered.filter(tx => {
        const isGeneric = tx.isRequest && !tx.materialId;
        if (isGeneric) {
          return 'pedido general'.includes(lowerSearch);
        }
        const m = materials.find(mat => mat.id === tx.materialId);
        if (!m) return false;
        
        return m.name.toLowerCase().includes(lowerSearch) || 
               m.sku.toLowerCase().includes(lowerSearch) ||
               (m.nombreBritt && m.nombreBritt.toLowerCase().includes(lowerSearch));
      });
    }

    if (historyFilterType === 'month' && historyFilterValue) {
      filtered = filtered.filter(tx => tx.date.startsWith(historyFilterValue));
    } else if (historyFilterType === 'week' && historyFilterValue) {
      filtered = filtered.filter(tx => {
        const txWeek = getWeekNumber(new Date(tx.date));
        return txWeek === historyFilterValue;
      });
    }
    return filtered;
  }, [combinedHistory, historySearchTerm, historyFilterType, historyFilterValue, materials]); 

  const bodegasInventory = useMemo(() => {
    const inventory = {}; 
    
    bodegas.forEach(b => {
        inventory[b.id] = {};
    });

    const chronologicTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    chronologicTx.forEach(tx => {
        if (tx.type === 'OUT' && tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') {
            if (inventory[tx.bodegaDestino]) {
                inventory[tx.bodegaDestino][tx.materialId] = (inventory[tx.bodegaDestino][tx.materialId] || 0) + tx.quantity;
            }
        }
        else if (tx.type === 'USE_BODEGA' && tx.bodegaOrigen) {
             if (inventory[tx.bodegaOrigen] && inventory[tx.bodegaOrigen][tx.materialId] !== undefined) {
                 inventory[tx.bodegaOrigen][tx.materialId] -= tx.quantity;
                 if(inventory[tx.bodegaOrigen][tx.materialId] < 0) inventory[tx.bodegaOrigen][tx.materialId] = 0;
             }
        }
        else if (tx.type === 'RETURN_BODEGA' && tx.bodegaOrigen) {
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
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(window.XLSX);
      script.onerror = reject;
      document.head.appendChild(script);
    });

    loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js')
      .then((XLSX) => {
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
            'Centro de Costos': m.costCenter || '---',
            'Ubicación': m.location || 'N/A',
            'Proveedor': m.supplier || 'N/A',
            'SKU': m.sku,
            'Repuesto': m.name,
            'Nombre Britt': m.nombreBritt || '---',
            'Valor Unitario ($)': m.price || 0,
            'Stock Actual': m.stock,
            'Stock Mínimo': m.minStock || 0,
            'Stock Máximo': m.maxStock || 0,
            'Valor Total ($)': (m.stock || 0) * (m.price || 0)
          }));
          sheetName = "Inv_Principal";
          fileName = `inventario_principal.xlsx`;

        } else if (activeTab === 'requests') {
          rawData = currentRequests.map(r => {
            const isGeneric = !r.materialId;
            const m = r.materialId ? materials.find(mat => mat.id === r.materialId) : null;
            const reqDateStr = r.requestDate ? new Date(r.requestDate + 'T00:00:00').toLocaleDateString('es-ES') : new Date(r.date).toLocaleDateString('es-ES');
            return { 
              'Fecha de Solicitud': reqDateStr, 
              'N° de Pedido': r.orderNumber || '---',
              'Proveedor': r.supplier || '---',
              'Máquina': r.machine || '---',
              'Repuesto Solicitado': isGeneric ? 'Pedido General' : (m?.name || 'Desconocido'), 
              'SKU': isGeneric ? '---' : (m?.sku || '---'), 
              'Nombre Britt': isGeneric ? '---' : (m?.nombreBritt || '---'),
              'Cantidad': r.quantity || '---', 
              'Solicitante': r.user,
              'Adjunto': r.fileUrl ? 'Sí' : 'No'
            };
          });
          sheetName = "Registro_Solicitudes_Activas";
          fileName = "solicitudes_activas.xlsx";

        } else if (activeTab === 'history' || activeTab === 'history_bodegas') {
          let txsToExport = currentTransactions;
          if (activeTab === 'history_bodegas') {
             txsToExport = currentTransactions.filter(tx => 
                (tx.type === 'OUT' && tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') ||
                tx.type === 'USE_BODEGA' || 
                tx.type === 'RETURN_BODEGA'
             );
          }

          rawData = txsToExport.map(tx => {
            const isGeneric = tx.isRequest && !tx.materialId;
            const m = tx.materialId ? materials.find(mat => mat.id === tx.materialId) : null;
            const dateStr = new Date(tx.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            let destinoBodega = '---';
            if (tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') {
              const b = bodegas.find(b => b.id === tx.bodegaDestino);
              destinoBodega = b ? b.name : 'Bodega Eliminada';
            }
            if (tx.bodegaOrigen) {
              const b = bodegas.find(b => b.id === tx.bodegaOrigen);
              destinoBodega = b ? b.name : 'Bodega Eliminada';
            }

            let tipoMovimiento = tx.type;
            if (tx.type === 'IN') tipoMovimiento = 'ENTRADA';
            else if (tx.type === 'OUT') tipoMovimiento = 'SALIDA';
            else if (tx.type === 'USE_BODEGA') tipoMovimiento = 'USO BODEGA AUX';
            else if (tx.type === 'RETURN_BODEGA') tipoMovimiento = 'DEVOLUCIÓN DE BODEGA';
            else tipoMovimiento = 'PEDIDO RECIBIDO';

            return { 
              'Fecha y Hora': dateStr, 
              'Proveedor': tx.supplier || (m?.supplier || '---'),
              'Tipo de Movimiento': tipoMovimiento, 
              'Repuesto': isGeneric ? 'Pedido General' : (m?.name || 'Desconocido'), 
              'SKU': isGeneric ? '---' : (m?.sku || '---'), 
              'Valor Unitario ($)': m?.price || 0,
              'Cantidad': tx.quantity || '---', 
              'Bodega Involucrada': destinoBodega,
              'Usuario Físico/Responsable': tx.user,
              'Registrado en Sistema Por': tx.registeredBy || 'Anónimo/Sistema',
            };
          });
          sheetName = activeTab === 'history_bodegas' ? "Historial_Bodegas" : "Historial_Global";
          fileName = activeTab === 'history_bodegas' ? "historial_bodegas_auxiliares.xlsx" : "historial_movimientos.xlsx";
        } else if (activeTab === 'bodegas_auxiliares') {
             const bodegasToExport = targetBodegaId ? bodegas.filter(b => b.id === targetBodegaId) : bodegas;
             
             bodegasToExport.forEach(b => {
                 const bodegaItems = bodegasInventory[b.id] || {};
                 const data = Object.keys(bodegaItems).map(matId => {
                     const m = materials.find(mat => mat.id === matId);
                     return {
                         'Bodega': b.name,
                         'Responsable': b.owner,
                         'Repuesto': m ? m.name : 'Desconocido',
                         'SKU': m ? m.sku : '---',
                         'Costo Unitario ($)': m ? m.price : 0,
                         'Cantidad': bodegaItems[matId],
                         'Valor Total Parcial ($)': (m ? (m.price || 0) : 0) * bodegaItems[matId]
                     };
                 }).filter(item => item.Cantidad > 0);
                 if(data.length > 0) rawData = [...rawData, ...data];
             });
             sheetName = targetBodegaId && bodegasToExport.length > 0 ? bodegasToExport[0].name.replace(/\s+/g, '_') : "Bodegas_Auxiliares";
             fileName = targetBodegaId && bodegasToExport.length > 0 ? `inventario_${bodegasToExport[0].name.replace(/\s+/g, '_').toLowerCase()}.xlsx` : "inventario_todas_bodegas.xlsx";
        }

        if (rawData.length === 0) {
          alert("No hay datos para exportar con los filtros actuales.");
          return;
        }

        const wsData = XLSX.utils.json_to_sheet(rawData);
        const wscols = Object.keys(rawData[0]).map(key => {
          let maxLength = key.length; 
          rawData.forEach(row => {
            const valStr = row[key] !== null && row[key] !== undefined ? row[key].toString() : '';
            if (valStr.length > maxLength) maxLength = valStr.length;
          });
          return { wch: Math.min(maxLength + 3, 50) }; 
        });
        wsData['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, wsData, sheetName);
        XLSX.writeFile(wb, fileName);
        closeModal(); 
      })
      .catch(err => console.error("Error al generar Excel: ", err));
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    const fileRef = ref(storage, `repuestos/${Date.now()}_${file.name}`);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
    try {
      await Promise.race([uploadBytes(fileRef, file), timeout]);
      return await getDownloadURL(fileRef);
    } catch (error) {
      console.warn("Fallo subiendo imagen (timeout o red). Se guardará sin imagen.", error);
      alert("La imagen no pudo subir por un bloqueo en la red. El repuesto se guardará sin foto.");
      return null;
    }
  };

  const uploadDocument = async (file) => {
    if (!file) return null;
    const fileRef = ref(storage, `solicitudes/${Date.now()}_${file.name}`);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
    try {
      await Promise.race([uploadBytes(fileRef, file), timeout]);
      return await getDownloadURL(fileRef);
    } catch (error) {
      console.warn("Fallo subiendo documento (timeout o red). Se guardará sin documento.", error);
      alert("El documento no pudo subir por un bloqueo en la red. La solicitud se guardará sin documento.");
      return null;
    }
  };

  const handleAddMaterial = async (data) => {
    const { imageFile, ...newMaterial } = data;
    let imageUrl = null;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    await addDoc(collection(db, 'materials'), { 
      ...newMaterial, 
      imageUrl, 
      createdBy: userData?.name || 'Usuario Admin', 
      createdAt: new Date().toISOString() 
    });
    closeModal();
  };

  const handleEditMaterial = async (data) => {
    const { id, imageFile, ...updatedData } = data;
    let newImageUrl = updatedData.imageUrl; 
    if (imageFile) newImageUrl = await uploadImage(imageFile);
    await updateDoc(doc(db, 'materials', id), { ...updatedData, imageUrl: newImageUrl });
    closeModal();
  };

  const handleDeleteMaterial = async (materialId) => {
    await deleteDoc(doc(db, 'materials', materialId));
    closeModal();
  };

  const handleTransaction = async ({ materialId, type, quantity, user: txUser, bodegaOrigen }) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    if (type === 'USE_BODEGA' || type === 'RETURN_BODEGA') {
        if (type === 'RETURN_BODEGA') {
            const newStock = material.stock + quantity;
            await updateDoc(doc(db, 'materials', materialId), { stock: newStock });
        }
        await addDoc(collection(db, 'transactions'), { 
          materialId, type, quantity, date: new Date().toISOString(), user: txUser,
          bodegaOrigen: bodegaOrigen,
          registeredBy: userData?.name || authUser?.email || 'Sistema/Admin'
        });
    } else {
        const newStock = type === 'IN' ? material.stock + quantity : material.stock - quantity;
        await updateDoc(doc(db, 'materials', materialId), { stock: newStock });
        await addDoc(collection(db, 'transactions'), { 
          materialId, type, quantity, date: new Date().toISOString(), user: txUser,
          bodegaDestino: 'ninguna',
          registeredBy: userData?.name || authUser?.email || 'Sistema/Admin'
        });
    }
    closeModal();
  };

  const handleMultipleDispatch = async ({ cartItems, user: txUser, bodegaDestino }) => {
    for (const item of cartItems) {
      const material = materials.find(m => m.id === item.materialId);
      if (!material || material.stock < item.quantity) {
         throw new Error(`Stock insuficiente para ${item.name}`);
      }
      const newStock = material.stock - item.quantity;
      await updateDoc(doc(db, 'materials', material.id), { stock: newStock });
      await addDoc(collection(db, 'transactions'), { 
        materialId: material.id, 
        type: 'OUT', 
        quantity: item.quantity, 
        date: new Date().toISOString(), 
        user: txUser,
        bodegaDestino: bodegaDestino, 
        registeredBy: userData?.name || authUser?.email || 'Sistema/Admin'
      });
    }
    setActiveTab('history');
  };

  const handleRequestMaterial = async (requestData) => {
    const { requestFile, ...dataToSave } = requestData;
    let fileUrl = null;
    let fileName = null;
    
    if (requestFile) {
      fileUrl = await uploadDocument(requestFile);
      fileName = requestFile.name;
    }

    await addDoc(collection(db, 'requests'), { 
      ...dataToSave, 
      fileUrl,
      fileName,
      status: 'pending', 
      date: new Date().toISOString(), 
      registeredBy: userData?.name || authUser?.email || 'Sistema/Admin'
    });
    setActiveTab('requests');
  };

  const handleCompleteRequest = async (requestId) => {
    await updateDoc(doc(db, 'requests', requestId), { 
      status: 'completed', 
      receivedDate: new Date().toISOString() 
    });
    closeModal();
  };

  const handleDeleteRequest = async (requestId) => {
    await deleteDoc(doc(db, 'requests', requestId));
    closeModal();
  };

  const handleDeleteHistoryRecord = async (recordId, isRequest) => {
    try {
      const collectionName = isRequest ? 'requests' : 'transactions';
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, recordId));
      closeModal();
    } catch (err) {
      console.error("Error deleting history record:", err);
    }
  };

  const handleCreateBodega = async (bodegaData) => {
    await addDoc(collection(db, 'bodegas'), {
      ...bodegaData,
      createdAt: new Date().toISOString()
    });
  };

  const handleUpdateBodega = async ({ id, name, owner }) => {
    await updateDoc(doc(db, 'bodegas', id), { name, owner });
    closeModal();
  };

  const handleUpdateBodegaLimits = async ({ bodegaId, materialId, newLimit }) => {
    const bodega = bodegas.find(b => b.id === bodegaId);
    if (!bodega) return;
    const updatedLimits = { ...(bodega.limits || {}) };
    if (newLimit === '' || newLimit === null || newLimit === undefined) {
      delete updatedLimits[materialId];
    } else {
      updatedLimits[materialId] = parseInt(newLimit, 10);
    }
    await updateDoc(doc(db, 'bodegas', bodegaId), { limits: updatedLimits });
  };

  const handleDeleteBodega = async (bodegaId) => {
    if(window.confirm("¿Seguro que deseas eliminar esta bodega auxiliar? Los repuestos que tenga asignados ya no se mostrarán en esta vista.")) {
      await deleteDoc(doc(db, 'bodegas', bodegaId));
    }
  };

  const handleCreateCostCenter = async (costCenterData) => {
    await addDoc(collection(db, 'costCenters'), {
      ...costCenterData,
      createdAt: new Date().toISOString()
    });
  };

  const handleUpdateCostCenter = async ({ id, name }) => {
    await updateDoc(doc(db, 'costCenters', id), { name });
    closeModal();
  };

  const handleDeleteCostCenter = async (costCenterId) => {
    if(window.confirm("¿Seguro que deseas eliminar este Centro de Costos?")) {
      await deleteDoc(doc(db, 'costCenters', costCenterId));
    }
  };

  const handleCreateSupplier = async (supplierData) => {
    await addDoc(collection(db, 'suppliers'), {
      ...supplierData,
      createdAt: new Date().toISOString()
    });
  };

  const handleDeleteSupplier = async (supplierId) => {
    if(window.confirm("¿Seguro que deseas eliminar este Proveedor de la lista oficial?")) {
      await deleteDoc(doc(db, 'suppliers', supplierId));
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
  };
  
  const handleUpdateUserRole = async (userId, newRole) => {
    await updateDoc(doc(db, 'users', userId), { role: newRole });
  };

  const handleDeleteUser = async (userId) => {
    await deleteDoc(doc(db, 'users', userId));
    closeModal();
  };

  const openModal = (type, data = null) => setModalConfig({ isOpen: true, type, data });
  const closeModal = () => setModalConfig({ isOpen: false, type: null, data: null });
  const handleLogout = () => { signOut(auth); setMasterOverride(false); };

  const handleAdminDirectLogin = async (password) => {
    try {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, 'cristofer10murillo@gmail.com', password);
      setMasterOverride(true);
      setActiveTab('settings');
    } catch (error) {
      setLoadingError("Fallo al iniciar sesión como Admin. Contraseña incorrecta o el usuario no existe.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#0f1423] flex flex-col items-center justify-center space-y-6">
      <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-500"></div>
      <p className="text-indigo-400 font-medium tracking-wide animate-pulse">Conectando a International Nexus Pro...</p>
    </div>
  );

  if (loadingError) return (
    <div className="min-h-screen bg-[#0f1423] bg-gradient-to-br from-[#0f1423] via-[#1a1c3a] to-[#0f1423] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-5 bg-rose-500/10 rounded-full mb-6 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
        <AlertCircle size={56} className="text-rose-500" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-4">Conexión Rechazada</h2>
      <p className="text-slate-400 max-w-lg mb-8 text-sm leading-relaxed bg-[#1e253c]/50 p-4 rounded-xl border border-white/5">{loadingError}</p>
      <button onClick={() => {setLoadingError(null); setAuthLoading(false); signOut(auth);}} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] font-semibold">Volver a intentar</button>
    </div>
  );

  if (!authUser) return <AuthScreen onAdminDirectLogin={handleAdminDirectLogin} auth={auth} />;
  
  if (userData?.status === 'pending' && !masterOverride) return <PendingScreen userData={userData} onLogout={handleLogout} onMasterBypass={async (password) => { 
    try {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, 'cristofer10murillo@gmail.com', password);
      setMasterOverride(true); 
      setActiveTab('settings'); 
    } catch(err) {
      alert("Contraseña de administrador incorrecta.");
    } finally {
      setAuthLoading(false);
    }
  }} />;

  const SidebarItem = ({ icon: Icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'}`}>
      <Icon size={20} /><span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0f1423] bg-gradient-to-br from-[#0f1423] via-[#151b2e] to-[#0f1423] flex flex-col md:flex-row font-sans text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#151b2e]/80 backdrop-blur-xl border-r border-white/5 p-6 flex flex-col shadow-2xl z-10">
        <div className="flex items-center space-x-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)] shrink-0"><Package size={24} className="text-white" /></div>
          <h1 className="text-lg font-bold tracking-tight leading-tight text-white">
            International Nexus Pro <br/>
            <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">by Cristofer Lizano</span>
          </h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={BarChart3} label="Panel de Resumen" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-4 pb-2"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4">Inventario</p></div>
          <SidebarItem icon={Box} label="Taller de Máquinas" isActive={activeTab === 'inventory_taller'} onClick={() => setActiveTab('inventory_taller')} />
          <SidebarItem icon={Database} label="Bodegas Auxiliares" isActive={activeTab === 'bodegas_auxiliares'} onClick={() => setActiveTab('bodegas_auxiliares')} />
          
          {userData?.role !== 'visitante' && (
            <>
              <div className="pt-4 pb-2"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4">Gestión de Pedidos y Salidas</p></div>
              <SidebarItem icon={ShoppingCart} label="Despacho a Técnicos" isActive={activeTab === 'dispatch_cart'} onClick={() => setActiveTab('dispatch_cart')} />
              <SidebarItem icon={FilePlus} label="Realizar Solicitud" isActive={activeTab === 'new_request'} onClick={() => setActiveTab('new_request')} />
              <SidebarItem icon={ClipboardList} label="Registro Solicitudes" isActive={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
            </>
          )}

          <div className="pt-4 pb-2"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4">Otros</p></div>
          <SidebarItem icon={History} label="Historial Principal" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem icon={ScrollText} label="Historial Bodegas Aux." isActive={activeTab === 'history_bodegas'} onClick={() => setActiveTab('history_bodegas')} />
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5 flex flex-col space-y-3">
          {userData?.role !== 'visitante' && (
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg transition-all border ${activeTab === 'settings' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md' : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5 hover:text-slate-200'}`}>
              <Settings size={16} /><span className="text-sm font-medium">Ajustes Principales</span>
            </button>
          )}
          <div className="flex items-center justify-between px-2 pt-2 text-slate-400 border-t border-white/5 mt-2">
            <span className="text-xs truncate">{userData?.name || 'Usuario'}</span>
            <button onClick={handleLogout} className="p-1 hover:text-red-400 transition-colors tooltip" title="Cerrar Sesión"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-auto h-screen">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {activeTab === 'dashboard' ? 'Panel de Resumen Global' : 
               activeTab === 'inventory_taller' ? 'Inventario Principal' : 
               activeTab === 'bodegas_auxiliares' ? 'Bodegas Auxiliares' : 
               activeTab === 'dispatch_cart' ? 'Despacho Múltiple a Técnicos' : 
               activeTab === 'new_request' ? 'Realizar Nueva Solicitud' : 
               activeTab === 'requests' ? 'Registro de Solicitudes' : 
               activeTab === 'history_bodegas' ? 'Historial de Bodegas Auxiliares' :
               activeTab === 'settings' ? 'Ajustes Principales' : 'Historial de Movimientos'}
            </h2>
            <p className="text-slate-400 mt-1 text-sm">
              Hola, <span className="font-semibold text-indigo-400">{userData?.name || 'Usuario'}</span>. 
              {activeTab === 'dashboard' ? ' Métricas y costos en tiempo real del inventario.' : 
               activeTab === 'inventory_taller' ? ' Gestiona los repuestos, entradas y salidas.' : 
               activeTab === 'bodegas_auxiliares' ? ' Control de stock asignado a vehículos o técnicos.' : 
               activeTab === 'dispatch_cart' ? ' Prepara un carrito con varios repuestos para despachar a una bodega auxiliar.' : 
               activeTab === 'new_request' ? ' Genera un nuevo pedido de repuestos con sus adjuntos correspondientes.' : 
               activeTab === 'requests' ? ' Historial de repuestos solicitados por el personal y sus documentos.' : 
               activeTab === 'history_bodegas' ? ' Registro exclusivo de salidas, usos y devoluciones de las bodegas auxiliares.' :
               activeTab === 'settings' ? ' Zona restringida: Configuración y administración.' : ' Registro detallado de todas las operaciones físicas.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(activeTab === 'inventory_taller' || activeTab === 'requests' || activeTab === 'history' || activeTab === 'history_bodegas' || activeTab === 'bodegas_auxiliares') && (
              <button onClick={() => openModal('EXPORT_EXCEL')} className="flex items-center space-x-2 bg-[#1e253c] border border-white/10 hover:bg-[#252d47] text-slate-200 px-4 py-2.5 rounded-xl transition-all font-medium shadow-sm">
                <Download size={20} /><span className="hidden sm:inline">Exportar Todas (Excel)</span>
              </button>
            )}
            {(userData?.role === 'master' || userData?.role === 'admin') && activeTab === 'inventory_taller' && (
              <>
                <button onClick={() => openModal('ADD_MATERIAL')} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all font-medium"><Plus size={20} /><span className="hidden sm:inline">Nuevo Repuesto</span></button>
              </>
            )}
          </div>
        </header>

        {/* --- Pestañas y Componentes --- */}
        {activeTab === 'dashboard' && <DashboardTab materials={materials} transactions={transactions} bodegas={bodegas} bodegasInventory={bodegasInventory} openModal={openModal} userData={userData} />}
        {activeTab === 'new_request' && <NewRequestTab materials={materials} onSubmit={handleRequestMaterial} />}
        {activeTab === 'dispatch_cart' && <DispatchCartTab materials={materials} bodegas={bodegas} bodegasInventory={bodegasInventory} onSubmit={handleMultipleDispatch} />}
        {activeTab === 'bodegas_auxiliares' && <BodegasAuxiliaresTab bodegas={bodegas} materials={materials} bodegasInventory={bodegasInventory} openModal={openModal} userData={userData} exportToExcel={exportToExcel} onUpdateLimits={handleUpdateBodegaLimits}/>}
        {activeTab === 'history_bodegas' && <BodegasHistoryTab transactions={combinedHistory} materials={materials} bodegas={bodegas} userData={userData} openModal={openModal} />}

        {activeTab !== 'dashboard' && activeTab !== 'new_request' && activeTab !== 'dispatch_cart' && activeTab !== 'bodegas_auxiliares' && activeTab !== 'history_bodegas' && (
          <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            {activeTab === 'inventory_taller' && (
              <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input type="text" placeholder={`Buscar en el Inventario...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0f1423] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {/* TABLA: INVENTARIO PRINCIPAL */}
              {activeTab === 'inventory_taller' && (
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-semibold w-16">Foto</th>
                      <th className="p-4 font-semibold">Proveedor</th>
                      <th className="p-4 font-semibold">SKU</th>
                      <th className="p-4 font-semibold">Repuesto</th>
                      <th className="p-4 font-semibold">Ubicación</th>
                      <th className="p-4 font-semibold">Nombre Britt</th>
                      <th className="p-4 font-semibold">C. Costos</th>
                      <th className="p-4 font-semibold">Stock Actual</th>
                      <th className="p-4 font-semibold">Mín / Máx</th>
                      <th className="p-4 font-semibold text-center">Valor Total</th>
                      {userData?.role !== 'visitante' && <th className="p-4 font-semibold text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMaterials.length === 0 ? <tr><td colSpan={userData?.role !== 'visitante' ? "11" : "10"} className="p-8 text-center text-slate-500">No se encontraron repuestos.</td></tr> : 
                    filteredMaterials.map(material => (
                      <tr key={material.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          {material.imageUrl ? (
                            <img 
                              src={material.imageUrl} 
                              alt={material.name} 
                              onClick={() => openModal('VIEW_IMAGE', { imageUrl: material.imageUrl, name: material.name })}
                              className="w-12 h-12 rounded-lg object-cover border border-white/10 shadow-sm hover:opacity-70 transition-opacity cursor-pointer" 
                              title="Haz clic para ampliar" 
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-black/30 flex items-center justify-center text-slate-600 border border-white/5"><Box size={20} /></div>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 text-sm font-medium">{material.supplier || '---'}</td>
                        <td className="p-4 text-slate-400 font-mono text-sm">{material.sku}</td>
                        <td className="p-4">
                          <button 
                            onClick={() => openModal('MATERIAL_DETAILS', { material })} 
                            className="font-semibold text-slate-100 hover:text-indigo-400 text-left transition-colors cursor-pointer border-b border-dashed border-transparent hover:border-indigo-400/50 pb-0.5"
                            title="Ver detalles logísticos"
                          >
                            {material.name}
                          </button>
                        </td>
                        <td className="p-4 text-slate-400 text-sm">
                          {material.location ? (
                            <div className="flex items-center space-x-1 text-indigo-300"><MapPin size={14}/><span>{material.location}</span></div>
                          ) : (
                            <span className="text-slate-500">---</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 text-sm">{material.nombreBritt || '---'}</td>
                        <td className="p-4">
                          <div className="text-slate-300 font-mono text-xs">{material.costCenter || '---'}</div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${material.stock < material.minStock ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{material.stock} uds.</span>
                        </td>
                        <td className="p-4 text-slate-500 text-sm">{material.minStock} / {material.maxStock}</td>
                        <td className="p-4 text-center">
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                            ${((material.stock || 0) * (material.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        {userData?.role !== 'visitante' && (
                          <td className="p-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <button onClick={() => openModal('TRANSACTION', { material, type: 'IN' })} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg tooltip transition-colors" title="Entrada"><ArrowDownRight size={20} /></button>
                              <button onClick={() => openModal('TRANSACTION', { material, type: 'OUT' })} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg tooltip transition-colors" title="Salida (1 item)"><ArrowUpRight size={20} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* TABLA: SOLICITUDES */}
              {activeTab === 'requests' && (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-semibold">Fecha de Pedido</th>
                      <th className="p-4 font-semibold">N° Pedido</th>
                      <th className="p-4 font-semibold">Proveedor</th>
                      <th className="p-4 font-semibold">Máquina</th>
                      <th className="p-4 font-semibold">Solicitante</th>
                      <th className="p-4 font-semibold">Repuesto / SKU</th>
                      <th className="p-4 font-semibold">Cant</th>
                      <th className="p-4 font-semibold text-center">Adjunto</th>
                      <th className="p-4 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeRequests.length === 0 ? <tr><td colSpan="10" className="p-8 text-center text-slate-500">Aún no hay solicitudes activas pendientes.</td></tr> :
                    activeRequests.map(r => {
                      const isGeneric = !r.materialId;
                      const m = r.materialId ? materials.find(mat => mat.id === r.materialId) : null;
                      const reqDateStr = r.requestDate ? new Date(r.requestDate + 'T00:00:00').toLocaleDateString('es-ES') : new Date(r.date).toLocaleDateString('es-ES');
                      
                      return (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-slate-400 text-sm font-medium">{reqDateStr}</td>
                          <td className="p-4 text-slate-300 font-mono text-sm">{r.orderNumber || '---'}</td>
                          <td className="p-4 text-slate-300 text-sm">{r.supplier || '---'}</td>
                          <td className="p-4 text-slate-300 text-sm">{r.machine || '---'}</td>
                          <td className="p-4 text-slate-200 font-medium flex items-center space-x-2 mt-2"><User size={16} className="text-slate-500"/> <span>{r.user}</span></td>
                          <td className="p-4">
                            <div className="font-medium text-white">{isGeneric ? 'Pedido General' : (m?.name || 'Desconocido')}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{isGeneric ? '---' : (m?.sku || '---')}</div>
                          </td>
                          <td className="p-4 text-indigo-400 font-bold">{r.quantity || '---'}</td>
                          <td className="p-4 text-center">
                            {r.fileUrl ? (
                               <a href={r.fileUrl} target="_blank" rel="noreferrer" title={r.fileName} className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                                 <FileText size={14}/><span>Ver Documento</span><ExternalLink size={12} className="ml-1 opacity-50"/>
                               </a>
                            ) : (
                               <span className="text-slate-600 text-xs italic">Sin adjunto</span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <button onClick={() => openModal('COMPLETE_REQUEST', { request: r })} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors mr-2">
                              <CheckCircle2 size={16}/><span>Marcar Llegada</span>
                            </button>
                            <button onClick={() => openModal('DELETE_REQUEST', { request: r })} className="inline-flex items-center justify-center p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors tooltip" title="Eliminar Solicitud">
                              <Trash2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* TABLA: HISTORIAL GENERAL */}
              {activeTab === 'history' && (
                <div className="flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                    <div className="flex items-center space-x-2 w-full xl:w-auto">
                      <History size={18} className="text-indigo-400" />
                      <span className="text-white font-semibold">Filtros de Búsqueda</span>
                    </div>

                    <div className="flex-1 w-full max-w-md relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Buscar por Nombre, SKU o Nombre Britt..." 
                        value={historySearchTerm} 
                        onChange={(e) => setHistorySearchTerm(e.target.value)} 
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white transition-all" 
                      />
                      {historySearchTerm && (
                        <button onClick={() => setHistorySearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors tooltip" title="Limpiar búsqueda">
                          <X size={14}/>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                      <select
                        className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={historyFilterType}
                        onChange={(e) => { setHistoryFilterType(e.target.value); setHistoryFilterValue(''); }}
                      >
                        <option value="all">Ver Todo</option>
                        <option value="month">Por Mes</option>
                        <option value="week">Por Semana</option>
                      </select>
                      
                      {historyFilterType === 'month' && (
                        <input 
                          type="month" 
                          value={historyFilterValue} 
                          onChange={(e) => setHistoryFilterValue(e.target.value)}
                          className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                      {historyFilterType === 'week' && (
                        <input 
                          type="week" 
                          value={historyFilterValue} 
                          onChange={(e) => setHistoryFilterValue(e.target.value)}
                          className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                      {historyFilterValue && (
                         <button onClick={() => setHistoryFilterValue('')} className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors tooltip" title="Limpiar filtro"><X size={16}/></button>
                      )}
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse min-w-[1100px]">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Fecha y Hora</th>
                        <th className="p-4 font-semibold">Proveedor</th>
                        <th className="p-4 font-semibold">Tipo</th>
                        <th className="p-4 font-semibold">Repuesto / SKU</th>
                        <th className="p-4 font-semibold">Nombre Britt</th>
                        <th className="p-4 font-semibold">Cant</th>
                        <th className="p-4 font-semibold">Responsable y Registro</th>
                        <th className="p-4 font-semibold text-center">Adjunto</th>
                        {userData?.role === 'master' && <th className="p-4 font-semibold text-right">Acción</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTransactions.length === 0 ? <tr><td colSpan={userData?.role === 'master' ? 10 : 9} className="p-8 text-center text-slate-500">No se encontraron movimientos con este filtro.</td></tr> :
                      filteredTransactions.map(tx => {
                        const isGeneric = tx.isRequest && !tx.materialId;
                        const m = tx.materialId ? materials.find(mat => mat.id === tx.materialId) : null;
                        
                        return (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-slate-400 text-sm">{new Date(tx.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="p-4 text-slate-400 text-sm">{tx.supplier || (m?.supplier || '---')}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                tx.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                tx.type === 'OUT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                tx.type === 'USE_BODEGA' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                tx.type === 'RETURN_BODEGA' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {tx.type === 'IN' ? <ArrowDownRight size={14}/> : 
                                 tx.type === 'OUT' ? <ArrowUpRight size={14}/> : 
                                 tx.type === 'USE_BODEGA' ? <Database size={14}/> :
                                 tx.type === 'RETURN_BODEGA' ? <Undo2 size={14}/> :
                                 <Package size={14}/>}
                                <span>{tx.type === 'IN' ? 'ENTRADA' : tx.type === 'OUT' ? 'SALIDA' : tx.type === 'USE_BODEGA' ? 'USO BODEGA AUX' : tx.type === 'RETURN_BODEGA' ? 'DEVOLUCIÓN BODEGA' : 'LLEGADA PEDIDO'}</span>
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white">{isGeneric ? 'Pedido General' : (m?.name || 'Repuesto Eliminado')}</div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">{isGeneric ? '---' : (m?.sku || '---')}</div>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">{isGeneric ? '---' : (m?.nombreBritt || '---')}</td>
                            <td className="p-4 text-slate-200 font-bold">{tx.quantity || '---'}</td>
                            <td className="p-4">
                              <div className="text-slate-200 font-medium flex items-center space-x-1.5 mb-1"><User size={14} className="text-slate-500"/><span>{tx.user}</span></div>
                              {tx.bodegaDestino && tx.bodegaDestino !== 'ninguna' ? (
                                <div className="text-[10px] text-amber-400 font-bold mb-1 flex items-center space-x-1"><Truck size={12}/><span>Destino: {bodegas.find(b => b.id === tx.bodegaDestino)?.name || 'Bodega Eliminada'}</span></div>
                              ) : null}
                              {tx.bodegaOrigen && tx.type === 'USE_BODEGA' ? (
                                <div className="text-[10px] text-amber-400 font-bold mb-1 flex items-center space-x-1"><Database size={12}/><span>Origen: {bodegas.find(b => b.id === tx.bodegaOrigen)?.name || 'Bodega Eliminada'}</span></div>
                              ) : null}
                              {tx.bodegaOrigen && tx.type === 'RETURN_BODEGA' ? (
                                <div className="text-[10px] text-blue-400 font-bold mb-1 flex items-center space-x-1"><Undo2 size={12}/><span>Origen: {bodegas.find(b => b.id === tx.bodegaOrigen)?.name || 'Bodega Eliminada'}</span></div>
                              ) : null}
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1"><ShieldCheck size={12} className="text-indigo-400/70"/><span>Registró: {tx.registeredBy || 'Anónimo'}</span></div>
                            </td>
                            <td className="p-4 text-center">
                              {tx.fileUrl ? (
                                 <a href={tx.fileUrl} target="_blank" rel="noreferrer" title={tx.fileName} className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                                   <FileText size={14}/><span>Ver</span>
                                 </a>
                              ) : (
                                 <span className="text-slate-600 text-xs italic">---</span>
                              )}
                            </td>
                            {userData?.role === 'master' && (
                              <td className="p-4 text-right">
                                <button onClick={() => openModal('DELETE_HISTORY', { record: tx })} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg transition-colors tooltip" title="Eliminar Registro Permanente">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TABLA: AJUSTES */}
              {activeTab === 'settings' && (
                <div className="p-6">
                  <SettingsDashboard 
                    materials={materials} allUsers={allUsers} bodegas={bodegas} costCenters={costCenters} suppliers={suppliers}
                    onDelete={(material) => openModal('DELETE_MATERIAL', { material })} 
                    onEdit={(material) => openModal('EDIT_MATERIAL', { material })}
                    onUpdateUserStatus={handleUpdateUserStatus}
                    onUpdateUserRole={handleUpdateUserRole}
                    onDeleteUser={(user) => openModal('DELETE_USER', { user })}
                    onCreateBodega={handleCreateBodega}
                    onEditBodega={(bodega) => openModal('EDIT_BODEGA', { bodega })}
                    onDeleteBodega={handleDeleteBodega}
                    onCreateCostCenter={handleCreateCostCenter}
                    onEditCostCenter={(cc) => openModal('EDIT_COST_CENTER', { costCenter: cc })}
                    onDeleteCostCenter={handleDeleteCostCenter}
                    onCreateSupplier={handleCreateSupplier}
                    onDeleteSupplier={handleDeleteSupplier}
                    userData={userData}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- Modales --- */}
      {modalConfig.isOpen && (
        <div className={`fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto ${modalConfig.type === 'VIEW_IMAGE' ? 'bg-[#0f1423]/95' : 'bg-[#0f1423]/80 backdrop-blur-md pt-10 pb-10'}`}>
          <div className={`${modalConfig.type === 'VIEW_IMAGE' ? 'bg-transparent shadow-none w-auto max-w-4xl' : 'bg-[#1e253c] border border-white/10 shadow-2xl w-full max-w-md'} rounded-3xl relative animate-in fade-in zoom-in-95 duration-200`}>
            
            {modalConfig.type === 'VIEW_IMAGE' && (
              <div className="relative flex flex-col items-center">
                <button onClick={closeModal} className="absolute -top-12 right-0 p-2 text-white hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={28}/></button>
                <img src={modalConfig.data.imageUrl} alt={modalConfig.data.name} className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl border-2 border-white/10" />
                <p className="mt-4 px-6 py-2 bg-black/50 backdrop-blur-md text-white text-lg font-semibold rounded-lg shadow-lg border border-white/5">{modalConfig.data.name}</p>
              </div>
            )}

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
            
            {/* Modal de Detalles del Repuesto */}
            {modalConfig.type === 'MATERIAL_DETAILS' && (
              <div className="p-6 text-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{modalConfig.data.material.name}</h3>
                    <p className="text-sm font-mono text-indigo-400">{modalConfig.data.material.sku}</p>
                  </div>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-white bg-black/20 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400"><Building2 size={24} /></div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Proveedor</p>
                      <p className="text-lg text-white font-medium">{modalConfig.data.material.supplier || 'No registrado'}</p>
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><DollarSign size={24} /></div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Valor Unitario</p>
                      <p className="text-xl text-emerald-400 font-bold">${(modalConfig.data.material.price || 0).toLocaleString('en-US')}</p>
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400"><Tag size={24} /></div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Centro de Costos</p>
                      <p className="text-lg text-white font-mono">{modalConfig.data.material.costCenter || 'No asignado'}</p>
                    </div>
                  </div>
                </div>

                <button onClick={closeModal} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-colors">
                  Cerrar Detalles
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- PESTAÑA: HISTORIAL EXCLUSIVO DE BODEGAS ---
function BodegasHistoryTab({ transactions, materials, bodegas, userData, openModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBodega, setFilterBodega] = useState('all');

  // Filtramos solo transacciones relacionadas con bodegas
  const bodegasTxs = useMemo(() => {
     let filtered = transactions.filter(tx => 
        (tx.type === 'OUT' && tx.bodegaDestino && tx.bodegaDestino !== 'ninguna') ||
        tx.type === 'USE_BODEGA' || 
        tx.type === 'RETURN_BODEGA'
     );

     if (filterBodega !== 'all') {
        filtered = filtered.filter(tx => tx.bodegaDestino === filterBodega || tx.bodegaOrigen === filterBodega);
     }

     if (searchTerm.trim()) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(tx => {
           const m = materials.find(mat => mat.id === tx.materialId);
           const bDest = bodegas.find(b => b.id === tx.bodegaDestino);
           const bOrig = bodegas.find(b => b.id === tx.bodegaOrigen);
           
           const matMatch = m && (m.name.toLowerCase().includes(lowerSearch) || m.sku.toLowerCase().includes(lowerSearch));
           const bMatch = (bDest && bDest.name.toLowerCase().includes(lowerSearch)) || (bOrig && bOrig.name.toLowerCase().includes(lowerSearch));
           
           return matMatch || bMatch;
        });
     }

     return filtered;
  }, [transactions, filterBodega, searchTerm, materials, bodegas]);

  return (
    <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden flex flex-col">
       <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex items-center space-x-2 w-full xl:w-auto">
             <ScrollText size={18} className="text-indigo-400" />
             <span className="text-white font-semibold">Filtros Auxiliares</span>
          </div>
          
          <div className="flex-1 w-full max-w-md relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <input 
               type="text" 
               placeholder="Buscar repuesto o bodega..." 
               value={searchTerm} 
               onChange={(e) => setSearchTerm(e.target.value)} 
               className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white transition-all" 
             />
             {searchTerm && (
               <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors tooltip" title="Limpiar búsqueda">
                 <X size={14}/>
               </button>
             )}
          </div>

          <div className="w-full xl:w-auto">
             <select
               className="bg-[#0f1423] border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
               value={filterBodega}
               onChange={(e) => setFilterBodega(e.target.value)}
             >
               <option value="all">Todas las Bodegas</option>
               {bodegas.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
               ))}
             </select>
          </div>
       </div>

       <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
             <thead>
                <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                   <th className="p-4 font-semibold">Fecha y Hora</th>
                   <th className="p-4 font-semibold">Movimiento</th>
                   <th className="p-4 font-semibold">Bodega Implicada</th>
                   <th className="p-4 font-semibold">Repuesto / SKU</th>
                   <th className="p-4 font-semibold">Cant</th>
                   <th className="p-4 font-semibold">Usuario Físico</th>
                   {userData?.role === 'master' && <th className="p-4 font-semibold text-right">Acción</th>}
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {bodegasTxs.length === 0 ? <tr><td colSpan={userData?.role === 'master' ? 7 : 6} className="p-8 text-center text-slate-500">No hay movimientos registrados en bodegas auxiliares.</td></tr> :
                bodegasTxs.map(tx => {
                   const m = materials.find(mat => mat.id === tx.materialId);
                   const isDespacho = tx.type === 'OUT';
                   const isUse = tx.type === 'USE_BODEGA';
                   
                   let bodegaName = 'Eliminada';
                   if (isDespacho) bodegaName = bodegas.find(b => b.id === tx.bodegaDestino)?.name || bodegaName;
                   else bodegaName = bodegas.find(b => b.id === tx.bodegaOrigen)?.name || bodegaName;

                   return (
                      <tr key={`aux-${tx.id}`} className="hover:bg-white/5 transition-colors">
                         <td className="p-4 text-slate-400 text-sm">{new Date(tx.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                         <td className="p-4">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isDespacho ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                              isUse ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {isDespacho ? <Truck size={14}/> : isUse ? <Database size={14}/> : <Undo2 size={14}/>}
                              <span>{isDespacho ? 'INGRESÓ A BODEGA' : isUse ? 'USADO POR TÉCNICO' : 'DEVUELTO AL TALLER'}</span>
                            </span>
                         </td>
                         <td className="p-4 font-bold text-white">{bodegaName}</td>
                         <td className="p-4">
                            <div className="font-medium text-slate-200">{m?.name || 'Repuesto Eliminado'}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{m?.sku || '---'}</div>
                         </td>
                         <td className="p-4 text-white font-bold text-lg">{tx.quantity}</td>
                         <td className="p-4 text-slate-300 text-sm flex items-center mt-2"><User size={14} className="text-slate-500 mr-2"/> {tx.user}</td>
                         {userData?.role === 'master' && (
                            <td className="p-4 text-right">
                              <button onClick={() => openModal('DELETE_HISTORY', { record: tx })} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg transition-colors tooltip" title="Eliminar Registro Permanente">
                                <Trash2 size={16} />
                              </button>
                            </td>
                         )}
                      </tr>
                   )
                })}
             </tbody>
          </table>
       </div>
    </div>
  )
}

// --- PESTAÑA: BODEGAS AUXILIARES ---
function BodegasAuxiliaresTab({ bodegas, materials, bodegasInventory, openModal, userData, exportToExcel, onUpdateLimits }) {
    const [selectedBodega, setSelectedBodega] = useState(bodegas.length > 0 ? bodegas[0].id : null);
    const [bodegaSearchTerm, setBodegaSearchTerm] = useState('');
    const [showBodegaResults, setShowBodegaResults] = useState(false);
    const [localSearch, setLocalSearch] = useState('');

    useEffect(() => {
        if (bodegas.length > 0 && !selectedBodega) {
            setSelectedBodega(bodegas[0].id);
        }
    }, [bodegas, selectedBodega]);

    const filteredBodegas = useMemo(() => {
        if (!bodegaSearchTerm) return bodegas;
        return bodegas.filter(b => 
            b.name.toLowerCase().includes(bodegaSearchTerm.toLowerCase()) || 
            b.owner.toLowerCase().includes(bodegaSearchTerm.toLowerCase())
        );
    }, [bodegas, bodegaSearchTerm]);

    if (bodegas.length === 0) {
        return (
            <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 p-10 text-center flex flex-col items-center">
                <Database size={64} className="text-slate-500 mb-4 opacity-50"/>
                <h3 className="text-xl font-bold text-white mb-2">No hay bodegas auxiliares</h3>
                <p className="text-slate-400 max-w-md">Para utilizar esta función, ve a "Ajustes Principales" y crea una nueva bodega asignándole un nombre y un responsable.</p>
            </div>
        );
    }

    const currentInventory = bodegasInventory[selectedBodega] || {};
    const inventoryItems = Object.keys(currentInventory).map(matId => {
        const mat = materials.find(m => m.id === matId);
        return {
            id: matId,
            material: mat,
            quantity: currentInventory[matId]
        };
    }).filter(item => item.quantity > 0); 

    const selectedBodegaObj = bodegas.find(b => b.id === selectedBodega);

    const filteredInventoryItems = inventoryItems.filter(item => {
        if (!localSearch) return true;
        const ls = localSearch.toLowerCase();
        return item.material?.name.toLowerCase().includes(ls) || 
               item.material?.sku.toLowerCase().includes(ls) ||
               (item.material?.nombreBritt && item.material.nombreBritt.toLowerCase().includes(ls));
    });

    let selectedBodegaValue = 0;
    inventoryItems.forEach(item => {
        if (item.material && item.quantity > 0) {
            selectedBodegaValue += (item.quantity * (item.material.price || 0));
        }
    });

    const handleSelectBodega = (b) => {
        setSelectedBodega(b.id);
        setBodegaSearchTerm(''); 
        setShowBodegaResults(false);
    };

    return (
        <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            {/* Buscador de Bodegas */}
            <div className="p-6 border-b border-white/10 bg-black/20 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar bodega o técnico..."
                        value={bodegaSearchTerm}
                        onChange={(e) => { setBodegaSearchTerm(e.target.value); setShowBodegaResults(true); }}
                        onFocus={() => setShowBodegaResults(true)}
                        onBlur={() => setTimeout(() => setShowBodegaResults(false), 200)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0f1423] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                    />
                    {showBodegaResults && (
                        <ul className="absolute z-20 w-full bg-[#1e253c] border border-white/10 shadow-2xl rounded-xl mt-2 max-h-60 overflow-y-auto divide-y divide-white/5">
                            {filteredBodegas.length === 0 ? (
                                <li className="p-4 text-slate-500 text-center text-sm">No se encontraron bodegas.</li>
                            ) : filteredBodegas.map(b => (
                                <li 
                                    key={b.id} 
                                    className="p-3 hover:bg-indigo-500/10 transition-colors cursor-pointer flex flex-col"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelectBodega(b); }}
                                >
                                    <span className="font-semibold text-white">{b.name}</span>
                                    <span className="text-xs text-slate-400">Técnico: {b.owner}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                {selectedBodegaObj && (
                    <div className="flex items-center justify-between w-full md:w-auto p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-indigo-500/20 rounded-lg"><Truck className="text-indigo-400" size={24}/></div>
                            <div>
                                <h4 className="text-lg font-bold text-white">{selectedBodegaObj.name}</h4>
                                <p className="text-sm text-indigo-300 flex items-center mt-1"><User size={14} className="mr-1"/> {selectedBodegaObj.owner}</p>
                                <p className="text-sm text-emerald-400 font-bold flex items-center mt-1"><Wallet size={14} className="mr-1"/> ${selectedBodegaValue.toLocaleString('en-US')}</p>
                            </div>
                        </div>
                        <button onClick={() => exportToExcel(null, null, selectedBodegaObj.id)} className="p-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-lg transition-colors tooltip" title={`Exportar Excel de ${selectedBodegaObj.name}`}>
                            <Download size={20}/>
                        </button>
                    </div>
                )}
            </div>

            <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Package className="text-indigo-400"/> <span>Inventario Actual</span>
                    </h3>
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar en esta bodega..." 
                                value={localSearch} 
                                onChange={(e) => setLocalSearch(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0f1423] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-sm"
                            />
                        </div>
                        {userData?.role === 'master' && selectedBodegaObj && (
                            <button onClick={() => openModal('MANAGE_BODEGA_LIMITS', { bodega: selectedBodegaObj })} className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shadow-sm">
                                Máximos (Master)
                            </button>
                        )}
                    </div>
                </div>

                <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1e253c] border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold w-16">Foto</th>
                                <th className="p-4 font-semibold">SKU</th>
                                <th className="p-4 font-semibold">Repuesto</th>
                                <th className="p-4 font-semibold text-center">Límite Máx</th>
                                <th className="p-4 font-semibold text-center">Stock en Bodega</th>
                                {userData?.role !== 'visitante' && <th className="p-4 font-semibold text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredInventoryItems.length === 0 ? (
                                <tr><td colSpan={userData?.role !== 'visitante' ? "6" : "5"} className="p-8 text-center text-slate-500">No hay repuestos que coincidan en esta bodega.</td></tr>
                            ) : (
                                filteredInventoryItems.map(item => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            {item.material?.imageUrl ? (
                                                <img src={item.material.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center"><Box size={16} className="text-slate-600"/></div>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-400 font-mono text-sm">{item.material?.sku || '---'}</td>
                                        <td className="p-4 font-medium text-white">{item.material?.name || 'Repuesto Eliminado'}</td>
                                        <td className="p-4 text-center">
                                            {userData?.role === 'master' ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        placeholder="∞" 
                                                        id={`inline-limit-${item.id}`} 
                                                        defaultValue={selectedBodegaObj?.limits?.[item.id] !== undefined ? selectedBodegaObj.limits[item.id] : ''}
                                                        className="w-16 px-2 py-1 bg-[#0f1423] border border-white/10 rounded-lg text-white text-center text-sm font-mono outline-none focus:ring-1 focus:ring-purple-500 transition-all" 
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            const btn = e.currentTarget;
                                                            const inputVal = document.getElementById(`inline-limit-${item.id}`).value;
                                                            onUpdateLimits({ bodegaId: selectedBodegaObj.id, materialId: item.id, newLimit: inputVal });
                                                            
                                                            // Visual feedback
                                                            const originalClass = btn.className;
                                                            btn.className = "p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors";
                                                            setTimeout(() => {
                                                                btn.className = originalClass;
                                                            }, 1500);
                                                        }} 
                                                        className="p-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors tooltip"
                                                        title="Guardar Límite"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-mono text-sm px-2 py-1 bg-black/40 rounded-lg border border-white/5">
                                                    {selectedBodegaObj?.limits?.[item.id] !== undefined ? selectedBodegaObj.limits[item.id] : '∞'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center text-indigo-400 font-bold text-lg">{item.quantity}</td>
                                        {userData?.role !== 'visitante' && (
                                          <td className="p-4 text-right">
                                              <div className="flex justify-end space-x-2">
                                                <button 
                                                    onClick={() => openModal('TRANSACTION', { material: {...item.material, stock: item.quantity}, type: 'RETURN_BODEGA', bodegaOrigen: selectedBodega })} 
                                                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium transition-colors tooltip"
                                                    title="Devolver al inventario principal"
                                                >
                                                    <Undo2 size={16}/>
                                                </button>
                                                <button 
                                                    onClick={() => openModal('TRANSACTION', { material: {...item.material, stock: item.quantity}, type: 'USE_BODEGA', bodegaOrigen: selectedBodega })} 
                                                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-sm font-medium transition-colors"
                                                    title="Reportar que este repuesto fue instalado/usado"
                                                >
                                                    Usar Item
                                                </button>
                                              </div>
                                          </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- PESTAÑA: DESPACHO MÚLTIPLE (CARRITO) ---
function DispatchCartTab({ materials, bodegas, bodegasInventory, onSubmit }) {
  const [user, setUser] = useState('');
  const [bodegaDestino, setBodegaDestino] = useState('ninguna');
  const [bodegaSearchTerm, setBodegaSearchTerm] = useState('');
  const [showBodegaResults, setShowBodegaResults] = useState(false);

  const [cartItems, setCartItems] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [quantity, setQuantity] = useState('');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBodegas = useMemo(() => {
    if (!bodegaSearchTerm) return bodegas;
    return bodegas.filter(b => 
      b.name.toLowerCase().includes(bodegaSearchTerm.toLowerCase()) || 
      b.owner.toLowerCase().includes(bodegaSearchTerm.toLowerCase())
    );
  }, [bodegas, bodegaSearchTerm]);

  const handleSelectBodegaDestino = (id, displayName) => {
    setBodegaDestino(id);
    setBodegaSearchTerm(displayName);
    setShowBodegaResults(false);
  };

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return materials.filter(m => {
      return m.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
             m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (m.nombreBritt && m.nombreBritt.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [searchTerm, materials]);

  const handleAddToCart = (material) => {
    const qty = parseInt(quantity, 10);
    if (!qty || isNaN(qty) || qty <= 0) {
      setError(`Ingresa una cantidad válida para ${material.name}`);
      return;
    }
    if (qty > material.stock) {
      setError(`No hay suficiente stock de ${material.name}. Solo hay ${material.stock} disponibles.`);
      return;
    }

    if (bodegaDestino && bodegaDestino !== 'ninguna') {
      const destBodega = bodegas.find(b => b.id === bodegaDestino);
      const maxLimit = destBodega?.limits?.[material.id];
      if (maxLimit !== undefined) {
         const currentInBodega = bodegasInventory[bodegaDestino]?.[material.id] || 0;
         const existingInCart = cartItems.find(i => i.materialId === material.id)?.quantity || 0;
         if (currentInBodega + existingInCart + qty > maxLimit) {
             setError(`¡ALERTA! Límite superado. La bodega "${destBodega.name}" solo permite un máximo de ${maxLimit} uds. para el repuesto "${material.name}". Ya tienen ${currentInBodega} uds y hay ${existingInCart} en el carrito.`);
             return;
         }
      }
    }
    
    const existingIndex = cartItems.findIndex(item => item.materialId === material.id);
    if (existingIndex >= 0) {
      const updatedCart = [...cartItems];
      const newTotalQty = updatedCart[existingIndex].quantity + qty;
      if (newTotalQty > material.stock) {
         setError(`El total solicitado supera el stock actual (${material.stock}).`);
         return;
      }
      updatedCart[existingIndex].quantity = newTotalQty;
      setCartItems(updatedCart);
    } else {
      setCartItems([...cartItems, { materialId: material.id, name: material.name, sku: material.sku, inventoryType: material.inventoryType, quantity: qty }]);
    }
    
    setSearchTerm('');
    setQuantity('');
    setShowResults(false);
    setError('');
  };

  const handleRemoveFromCart = (index) => {
    const updatedCart = [...cartItems];
    updatedCart.splice(index, 1);
    setCartItems(updatedCart);
  };

  const handleSubmit = async () => {
    if (!user.trim()) { setError('Falta especificar el nombre del técnico/responsable.'); return; }
    if (cartItems.length === 0) { setError('El carrito de despacho está vacío.'); return; }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const finalBodegaDestino = bodegaDestino || 'ninguna';
      await onSubmit({ cartItems, user, bodegaDestino: finalBodegaDestino });
      setCartItems([]);
      setUser('');
      setBodegaDestino('ninguna');
      setBodegaSearchTerm('');
    } catch (err) {
      setError(err.message || 'Hubo un error al procesar el despacho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center space-x-3 mb-8 border-b border-white/10 pb-6">
        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><ShoppingCart size={28} /></div>
        <div>
          <h2 className="text-2xl font-bold text-white">Despacho Múltiple a Técnicos</h2>
          <p className="text-slate-400 text-sm mt-1">Prepara una lista de repuestos para salida masiva hacia una bodega auxiliar.</p>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-sm"><AlertCircle size={20} className="shrink-0" /><span>{error}</span></div>}

      {/* Fila 1: Técnico y Bodega Destino */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Técnico / Responsable</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" value={user} onChange={(e) => setUser(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#0f1423] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 shadow-sm" required placeholder="Nombre de quién retira" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide flex items-center space-x-2"><Truck size={16}/><span>Bodega Auxiliar (Destino)</span></label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              value={bodegaSearchTerm} 
              onChange={(e) => { setBodegaSearchTerm(e.target.value); setShowBodegaResults(true); setBodegaDestino(''); }} 
              onFocus={() => setShowBodegaResults(true)}
              onBlur={() => setTimeout(() => setShowBodegaResults(false), 200)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all shadow-sm placeholder-slate-600" 
              placeholder="Buscar bodega o técnico..." 
            />
            {showBodegaResults && (
              <ul className="absolute z-20 w-full bg-[#1e253c] border border-white/10 shadow-2xl rounded-xl mt-2 max-h-60 overflow-y-auto divide-y divide-white/5">
                <li 
                  className="p-3 hover:bg-indigo-500/10 transition-colors cursor-pointer text-slate-300 text-sm font-medium"
                  onMouseDown={(e) => { e.preventDefault(); handleSelectBodegaDestino('ninguna', '--- Uso Inmediato / Sin Bodega ---'); }}
                >
                  --- Uso Inmediato / Sin Bodega ---
                </li>
                {filteredBodegas.length === 0 ? (
                  <li className="p-3 text-slate-500 text-center text-sm">No se encontraron resultados.</li>
                ) : filteredBodegas.map(b => (
                  <li 
                    key={b.id} 
                    className="p-3 hover:bg-indigo-500/10 transition-colors cursor-pointer flex flex-col"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectBodegaDestino(b.id, `${b.name} (Encargado: ${b.owner})`); }}
                  >
                    <span className="font-semibold text-white">{b.name}</span>
                    <span className="text-xs text-slate-400">Encargado: {b.owner}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Buscador de repuestos */}
      <div className="bg-black/20 p-5 rounded-2xl border border-white/5 mb-8">
        <label className="block text-sm font-semibold text-indigo-300 mb-3 uppercase tracking-wide">Buscar y Agregar Repuesto al Carrito</label>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)} placeholder="Escribe SKU, Nombre o Britt..." className="w-full pl-12 pr-4 py-3.5 bg-[#0f1423] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500 shadow-sm transition-all" />
            
            {showResults && searchTerm && (
              <ul className="absolute z-20 w-full bg-[#1e253c] border border-white/10 shadow-2xl rounded-xl mt-2 max-h-60 overflow-y-auto divide-y divide-white/5">
                {searchResults.map(m => (
                  <li key={m.id} className="p-4 hover:bg-indigo-500/10 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="font-semibold text-white flex items-center space-x-2"><span>{m.name}</span></div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{m.sku} {m.nombreBritt ? `| ${m.nombreBritt}` : ''}</div>
                      <div className="text-xs text-indigo-300 mt-1 font-medium">C. Costos: {m.costCenter || '---'} | Valor: ${(m.price || 0).toLocaleString('en-US')}</div>
                      <div className={`text-xs mt-1 font-semibold ${m.stock > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>Stock disponible: {m.stock}</div>
                    </div>
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <input type="number" min="1" max={m.stock} placeholder="Cant" id={`qty-${m.id}`} className="w-20 px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg text-white outline-none focus:ring-1 focus:ring-indigo-500" onFocus={(e) => setQuantity(e.target.value)} onChange={(e) => setQuantity(e.target.value)} />
                      <button type="button" onClick={() => {
                        const qtyInput = document.getElementById(`qty-${m.id}`);
                        if (qtyInput) setQuantity(qtyInput.value);
                        setTimeout(() => handleAddToCart(m), 50); // Delay for state update
                      }} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-md">Añadir</button>
                    </div>
                  </li>
                ))}
                {searchResults.length === 0 && <li className="p-6 text-center text-slate-500 text-sm flex flex-col items-center"><Box className="mb-2 opacity-50" size={24}/> No se encontraron repuestos.</li>}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Tabla del Carrito */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Lista de Salida ({cartItems.length} items)</h3>
        {cartItems.length === 0 ? (
          <div className="p-8 bg-black/20 rounded-xl border border-white/5 text-center text-slate-500 flex flex-col items-center">
            <ShoppingCart size={32} className="mb-3 opacity-50"/>
            <p>El carrito está vacío. Busca y añade repuestos arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1e253c] border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Repuesto</th>
                  <th className="p-4 font-semibold">SKU</th>
                  <th className="p-4 font-semibold text-center">Cantidad</th>
                  <th className="p-4 font-semibold text-right">Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cartItems.map((item, index) => (
                  <tr key={index} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-medium text-white">{item.name}</td>
                    <td className="p-4 text-slate-400 font-mono text-sm">{item.sku}</td>
                    <td className="p-4 text-indigo-400 font-bold text-center text-lg">{item.quantity}</td>
                    <td className="p-4 text-right">
                      <button type="button" onClick={() => handleRemoveFromCart(index)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors tooltip" title="Quitar de la lista"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Botón Final */}
      <div className="pt-6 border-t border-white/10 flex justify-end">
        <button type="button" onClick={handleSubmit} disabled={isSubmitting || cartItems.length === 0} className="px-8 py-4 text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all flex items-center space-x-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center">
          {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Truck size={22}/> <span>Confirmar y Procesar Salida Múltiple</span></>}
        </button>
      </div>
    </div>
  );
}

// --- PESTAÑA: REALIZAR SOLICITUD ---
function NewRequestTab({ materials, onSubmit }) {
  const [inventoryType] = useState('taller'); 
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]); 
  const [orderNumber, setOrderNumber] = useState('');
  const [supplier, setSupplier] = useState(''); 
  const [machine, setMachine] = useState(''); 
  const [user, setUser] = useState(''); 
  const [requestFile, setRequestFile] = useState(null);
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRequestFile(file);
    }
  };

  const handleClearFile = () => {
    setRequestFile(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user.trim()) { setError('Falta especificar el nombre del solicitante'); return; }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await onSubmit({ 
        inventoryType, 
        user,
        requestDate, 
        orderNumber, 
        supplier, 
        machine, 
        requestFile 
      });
      setOrderNumber('');
      setSupplier('');
      setMachine('');
      setRequestFile(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError('Hubo un error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden p-6 md:p-10 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3 mb-8 border-b border-white/10 pb-6">
        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><FilePlus size={28} /></div>
        <div>
          <h2 className="text-2xl font-bold text-white">Formulario de Pedido</h2>
          <p className="text-slate-400 text-sm mt-1">Completa los detalles y adjunta la documentación del pedido general.</p>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-sm"><AlertCircle size={20} className="shrink-0" /><span>{error}</span></div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Área a la que pertenece</label>
            <input type="text" value="Taller de Máquinas" disabled className="w-full px-4 py-3 rounded-xl bg-[#0f1423] border border-white/10 outline-none text-white opacity-50 cursor-not-allowed shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Fecha de Solicitud</label>
            <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all shadow-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Solicitante</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" value={user} onChange={(e) => setUser(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#0f1423] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 shadow-sm" required placeholder="Nombre de quién lo pide" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Máquina Destino</label>
            <div className="relative">
              <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" value={machine} onChange={(e) => setMachine(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#0f1423] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 shadow-sm" required placeholder="Ej: Máquina Espresso, Molino..." />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">N° de Pedido</label>
            <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 font-mono shadow-sm" placeholder="Ej: REQ-00123 (Opcional)" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Proveedor</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#0f1423] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 shadow-sm" required placeholder="Ej: Amazon, Proveedor Local..." />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Adjuntar Archivo de Soporte (Opcional)</label>
          <div className="flex items-center space-x-4">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-5 py-3 bg-[#0f1423] border border-white/10 hover:border-indigo-500/50 hover:bg-[#151b2e] text-slate-300 rounded-xl transition-all shadow-sm">
              <Paperclip size={20} className="text-indigo-400" />
              <span>{requestFile ? 'Cambiar Archivo' : 'Seleccionar Archivo'}</span>
            </button>
            <input 
              type="file" 
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/jpg" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            {requestFile && (
              <div className="flex flex-1 items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl">
                <div className="flex items-center space-x-2 text-indigo-300 truncate">
                  <FileText size={18} className="shrink-0" />
                  <span className="truncate text-sm font-medium">{requestFile.name}</span>
                </div>
                <button type="button" onClick={handleClearFile} className="p-1 hover:text-rose-400 text-slate-400 transition-colors ml-2 shrink-0"><X size={18} /></button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">Formatos permitidos: PDF, Word, Excel, JPG, PNG.</p>
        </div>

        <div className="pt-8 border-t border-white/10 flex justify-end">
          <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all flex items-center space-x-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed">
            {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Send size={20}/> <span>Registrar Pedido</span></>}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- PANEL DE RESUMEN (DASHBOARD) ---
function DashboardTab({ materials, transactions, bodegas, bodegasInventory, openModal, userData }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [bodegaSearchTerm, setBodegaSearchTerm] = useState('');
  const [selectedBodegaCost, setSelectedBodegaCost] = useState(null);

  // Cálculos Financieros en Dólares ($)
  const valorTaller = useMemo(() => {
    return materials.reduce((acc, m) => acc + ((Number(m.stock) || 0) * (Number(m.price) || 0)), 0);
  }, [materials]);

  const valorBodegas = useMemo(() => {
    let total = 0;
    Object.values(bodegasInventory).forEach(bodegaItems => {
       Object.entries(bodegaItems).forEach(([matId, qty]) => {
          const m = materials.find(mat => mat.id === matId);
          if (m && qty > 0) total += (qty * (Number(m.price) || 0));
       });
    });
    return total;
  }, [bodegasInventory, materials]);

  const valorBodegaSeleccionada = useMemo(() => {
    if (!selectedBodegaCost) return 0;
    let total = 0;
    const bodegaItems = bodegasInventory[selectedBodegaCost.id] || {};
    Object.entries(bodegaItems).forEach(([matId, qty]) => {
      const m = materials.find(mat => mat.id === matId);
      if (m && qty > 0) total += (qty * (Number(m.price) || 0));
    });
    return total;
  }, [selectedBodegaCost, bodegasInventory, materials]);

  const zeroStock = useMemo(() => materials.filter(m => m.stock === 0), [materials]);
  const lowStock = useMemo(() => materials.filter(m => m.stock > 0 && m.stock <= m.minStock), [materials]);

  const topDispatched = useMemo(() => {
    let filteredTx = transactions.filter(tx => tx.type === 'OUT');
    
    if (selectedMonth) {
      filteredTx = filteredTx.filter(tx => tx.date.startsWith(selectedMonth));
    }

    const counts = {};
    filteredTx.forEach(tx => {
      counts[tx.materialId] = (counts[tx.materialId] || 0) + tx.quantity;
    });
    
    const ranked = Object.keys(counts).map(matId => {
      const mat = materials.find(m => m.id === matId);
      return {
        materialId: matId,
        name: mat ? mat.name : 'Repuesto Eliminado',
        sku: mat ? mat.sku : '---',
        total: counts[matId],
        imageUrl: mat ? mat.imageUrl : null,
        stock: mat ? mat.stock : 0,
        inventoryType: mat ? (mat.inventoryType || 'taller') : 'taller'
      };
    }).sort((a, b) => b.total - a.total);
    
    return ranked.slice(0, 10);
  }, [transactions, materials, selectedMonth]);

  const filteredBodegasDashboard = useMemo(() => {
    if (!bodegaSearchTerm) return bodegas;
    return bodegas.filter(b =>
      b.name.toLowerCase().includes(bodegaSearchTerm.toLowerCase()) ||
      b.owner.toLowerCase().includes(bodegaSearchTerm.toLowerCase())
    );
  }, [bodegas, bodegaSearchTerm]);

  const handleSelectBodegaCost = (b) => {
    setSelectedBodegaCost(b);
    setBodegaSearchTerm('');
  };

  const maxDispatch = topDispatched.length > 0 ? Math.max(...topDispatched.map(d => d.total)) : 1;

  const costosPorProveedor = useMemo(() => {
    const totals = {};
    materials.forEach(m => {
      const supplier = typeof m.supplier === 'string' ? m.supplier : (m.supplier?.name || 'Sin Proveedor');
      const cost = (Number(m.stock) || 0) * (Number(m.price) || 0);
      if (cost > 0) {
          totals[supplier] = (totals[supplier] || 0) + cost;
      }
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const costosPorCentroCostos = useMemo(() => {
    const totals = {};
    materials.forEach(m => {
      const cc = typeof m.costCenter === 'string' ? m.costCenter : (m.costCenter?.name || 'Sin Asignar');
      const cost = (Number(m.stock) || 0) * (Number(m.price) || 0);
      if (cost > 0) {
          totals[cc] = (totals[cc] || 0) + cost;
      }
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  return (
    <div className="space-y-6">
      
      {/* Resumen Financiero de Costos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Taller Principal */}
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 p-6 rounded-2xl border border-emerald-500/30 flex items-center space-x-5 shadow-lg">
           <div className="p-4 bg-emerald-500/20 rounded-xl text-emerald-400"><Wallet size={36}/></div>
           <div>
             <p className="text-xs text-emerald-400/80 font-bold uppercase tracking-wider mb-1">Costo Inv. Principal</p>
             <h3 className="text-3xl font-black text-white">${valorTaller.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
           </div>
        </div>

        {/* Total Bodegas Auxiliares */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 p-6 rounded-2xl border border-indigo-500/30 flex items-center space-x-5 shadow-lg">
           <div className="p-4 bg-indigo-500/20 rounded-xl text-indigo-400"><Truck size={36}/></div>
           <div>
             <p className="text-xs text-indigo-400/80 font-bold uppercase tracking-wider mb-1">Costo Total Bodegas</p>
             <h3 className="text-3xl font-black text-white">${valorBodegas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
           </div>
        </div>

        {/* Buscador de Costo por Bodega Específica */}
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 p-6 rounded-2xl border border-blue-500/30 flex flex-col justify-center shadow-lg relative">
           <div className="flex justify-between items-start mb-3">
               <div>
                   <p className="text-xs text-blue-400/80 font-bold uppercase tracking-wider mb-1">Consultar Bodega</p>
                   <h3 className="text-2xl font-black text-white">
                       {selectedBodegaCost ? `$${valorBodegaSeleccionada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$ 0.00'}
                   </h3>
                   {selectedBodegaCost && (
                       <p className="text-[10px] text-blue-300 font-medium mt-0.5 truncate max-w-[150px]">{selectedBodegaCost.name}</p>
                   )}
               </div>
               <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 shrink-0"><Search size={24}/></div>
           </div>

           <div className="relative mt-auto">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/50" size={14} />
               <input
                   type="text"
                   placeholder="Buscar técnico o bodega..."
                   value={bodegaSearchTerm}
                   onChange={(e) => setBodegaSearchTerm(e.target.value)}
                   className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/20 border border-blue-500/30 text-white placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all"
               />
               {bodegaSearchTerm && (
                   <ul className="absolute z-20 w-full bg-[#1e253c] border border-blue-500/30 shadow-2xl rounded-lg mt-1 max-h-40 overflow-y-auto divide-y divide-white/5">
                       {filteredBodegasDashboard.length === 0 ? (
                           <li className="p-2 text-slate-500 text-center text-[10px]">No se encontraron resultados.</li>
                       ) : filteredBodegasDashboard.map(b => (
                           <li
                               key={b.id}
                               className="p-2 hover:bg-blue-500/20 transition-colors cursor-pointer flex flex-col"
                               onMouseDown={(e) => { e.preventDefault(); handleSelectBodegaCost(b); }}
                           >
                               <span className="font-semibold text-white text-xs">{b.name}</span>
                               <span className="text-[10px] text-slate-400">Encargado: {b.owner}</span>
                           </li>
                       ))}
                   </ul>
               )}
           </div>
        </div>
      </div>

      {/* SECCIÓN DE COSTOS POR PROVEEDOR Y CENTRO DE COSTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Costos por Proveedor */}
        <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
          <div className="bg-indigo-500/10 p-4 border-b border-indigo-500/20 flex items-center space-x-3">
            <Building2 className="text-indigo-400" size={24} />
            <h3 className="font-bold text-white text-lg">Costo Total por Proveedor</h3>
          </div>
          <div className="p-4 flex-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {costosPorProveedor.length === 0 ? (
              <p className="text-slate-500 text-center mt-6 text-sm">No hay datos suficientes.</p>
            ) : (
              <ul className="space-y-2">
                {costosPorProveedor.map(([supplier, total]) => (
                  <li key={supplier} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="font-medium text-slate-300 text-sm">{supplier}</span>
                    <span className="text-emerald-400 font-bold">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Costos por Centro de Costos */}
        <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
          <div className="bg-purple-500/10 p-4 border-b border-purple-500/20 flex items-center space-x-3">
            <Tag className="text-purple-400" size={24} />
            <h3 className="font-bold text-white text-lg">Costo por Centro de Costos</h3>
          </div>
          <div className="p-4 flex-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {costosPorCentroCostos.length === 0 ? (
              <p className="text-slate-500 text-center mt-6 text-sm">No hay datos suficientes.</p>
            ) : (
              <ul className="space-y-2">
                {costosPorCentroCostos.map(([cc, total]) => (
                  <li key={cc} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="font-mono text-slate-300 text-sm">{cc}</span>
                    <span className="text-emerald-400 font-bold">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarjeta: Agotados */}
        <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl border border-rose-500/20 shadow-lg overflow-hidden flex flex-col">
          <div className="bg-rose-500/10 p-4 border-b border-rose-500/20 flex items-center space-x-3">
            <AlertCircle className="text-rose-500" size={24} />
            <h3 className="font-bold text-rose-400 text-lg">Agotados (0 uds)</h3>
            <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">{zeroStock.length}</span>
          </div>
          <div className="p-4 flex-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {zeroStock.length === 0 ? (
              <p className="text-slate-500 text-center mt-6 text-sm">No hay repuestos agotados.</p>
            ) : (
              <ul className="space-y-2">
                {zeroStock.map(m => (
                  <li key={m.id} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <div>
                      <div className="flex items-center">
                        <p className="font-medium text-white text-sm">{m.name}</p>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">{m.sku} | {m.nombreBritt || 'Sin nombre Britt'}</p>
                    </div>
                    {userData?.role !== 'visitante' && (
                      <button onClick={() => openModal('TRANSACTION', { material: m, type: 'IN' })} className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-xs rounded-lg transition-colors border border-rose-500/30">Ingresar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tarjeta: Stock Crítico */}
        <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl border border-amber-500/20 shadow-lg overflow-hidden flex flex-col">
          <div className="bg-amber-500/10 p-4 border-b border-amber-500/20 flex items-center space-x-3">
            <AlertTriangle className="text-amber-500" size={24} />
            <h3 className="font-bold text-amber-400 text-lg">Stock Crítico (Bajo Mín)</h3>
            <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">{lowStock.length}</span>
          </div>
          <div className="p-4 flex-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {lowStock.length === 0 ? (
              <p className="text-slate-500 text-center mt-6 text-sm">No hay repuestos en estado crítico.</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map(m => (
                  <li key={m.id} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <div>
                      <div className="flex items-center">
                        <p className="font-medium text-white text-sm">{m.name}</p>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">{m.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-bold">{m.stock} uds</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Mín: {m.minStock}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN RANKING DE SALIDAS */}
      <div className="bg-[#1e253c]/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/20">
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-indigo-400" size={24} />
            <h3 className="font-bold text-white text-lg">Repuestos con Mayor Salida</h3>
          </div>

          <div className="flex items-center space-x-3 bg-[#0f1423] px-4 py-2 rounded-xl border border-white/10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtrar Mes:</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white outline-none focus:ring-0 text-sm cursor-pointer"
            />
            {selectedMonth && (
               <button onClick={() => setSelectedMonth('')} className="text-slate-500 hover:text-rose-400 ml-1 tooltip" title="Quitar filtro de mes"><X size={16}/></button>
            )}
          </div>
        </div>

        <div className="p-6">
          {topDispatched.length === 0 ? (
            <div className="text-center py-10">
              <Box size={48} className="mx-auto text-white/10 mb-3" />
              <p className="text-slate-400">No hay registros de salidas {selectedMonth ? 'para el mes seleccionado' : ''} en esta área.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {topDispatched.map((item, index) => (
                <div key={item.materialId} className="flex items-center space-x-4">
                  <div className="w-8 text-center text-slate-500 font-bold text-lg">{index + 1}</div>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center"><Box size={16} className="text-slate-600"/></div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center truncate pr-4">
                        <p className="text-white font-medium truncate">{item.name}</p>
                        <span className="text-xs text-slate-500 font-mono mx-2">({item.sku})</span>
                      </div>
                      <p className="text-indigo-300 font-bold whitespace-nowrap ml-2">{item.total} salidas</p>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all duration-1000 ease-out relative"
                        style={{ width: `${(item.total / maxDispatch) * 100}%` }}
                      >
                         <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 w-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Stock Restante actual: {item.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- FORMULARIOS GENERALES ---

function ExportExcelForm({ activeTab, onSubmit, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const handleExportRange = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) { setError('Por favor selecciona ambas fechas.'); return; }
    if (new Date(startDate) > new Date(endDate)) { setError('La fecha de inicio no puede ser mayor a la fecha de fin.'); return; }
    onSubmit(startDate, endDate);
  };

  return (
    <div className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center space-x-2"><CalendarDays className="text-emerald-400" /><span>Exportar Datos</span></h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
      <p className="text-sm text-slate-400 mb-6">{(activeTab === 'inventory_taller' || activeTab === 'bodegas_auxiliares') ? 'El inventario exportará el stock actual del área seleccionada. Las fechas no aplican al stock actual.' : 'Selecciona un rango de fechas para exportar los registros específicos, o exporta el historial completo.'}</p>
      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center space-x-2 text-sm"><AlertCircle size={18} /><span>{error}</span></div>}
      
      {(activeTab !== 'inventory_taller' && activeTab !== 'bodegas_auxiliares') && (
        <form onSubmit={handleExportRange} className="space-y-4 mb-6 p-4 bg-black/20 border border-white/5 rounded-xl">
          <div className="flex flex-col space-y-3">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Fecha de Inicio</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-slate-200" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Fecha de Fin</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-slate-200" /></div>
          </div>
          <button type="submit" className="w-full py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg text-sm font-medium transition-colors">Exportar Rango</button>
        </form>
      )}
      <div className="pt-4 border-t border-white/10"><button type="button" onClick={() => onSubmit(null, null)} className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors">Exportar Todo (Completo)</button></div>
    </div>
  );
}

function AddMaterialForm({ materials, costCenters, suppliers, onSubmit, onClose }) {
  const [name, setName] = useState(''); 
  const [sku, setSku] = useState('');
  const [nombreBritt, setNombreBritt] = useState(''); 
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState(''); 
  const [maxStock, setMaxStock] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || minStock === '' || maxStock === '') { setError('Faltan campos obligatorios'); return; }
    
    const skuUpper = sku.trim().toUpperCase();
    if (materials.some(m => m.sku.toUpperCase() === skuUpper)) {
      setError(`El SKU "${skuUpper}" ya está registrado en el sistema general.`);
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      await onSubmit({ 
        name, 
        sku: skuUpper, 
        nombreBritt, 
        supplier, 
        location, 
        costCenter,
        price: parseFloat(price) || 0,
        minStock: parseInt(minStock, 10), 
        maxStock: parseInt(maxStock, 10), 
        stock: parseInt(initialStock, 10), 
        imageFile, 
        inventoryType: 'taller' 
      });
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar. Verifica tu conexión a internet.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center space-x-2"><span>Añadir Nuevo Repuesto</span></h3><button type="button" onClick={onClose} disabled={isUploading} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
      {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center space-x-2 text-sm"><AlertCircle size={18} className="shrink-0" /><span>{error}</span></div>}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-4 scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/20 rounded-xl bg-black/20 hover:bg-black/40 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {imagePreview ? <img src={imagePreview} alt="Preview" className="h-32 object-cover rounded-lg shadow-sm" /> : <div className="text-center text-slate-500"><Camera size={32} className="mx-auto mb-2 opacity-50" /><span className="text-sm font-medium">Toca para añadir una foto</span></div>}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
        </div>
        
        <div><label className="block text-sm font-medium text-slate-400 mb-1">Nombre del Repuesto</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-400 mb-1">SKU</label><input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-white" required/></div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Nombre Britt / Interno</label><input type="text" value={nombreBritt} onChange={(e) => setNombreBritt(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><Building2 size={14}/><span>Proveedor Oficial</span></label>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white">
              <option value="">--- Seleccionar ---</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><Tag size={14}/><span>Centro de Costos</span></label>
            <select value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white">
              <option value="">--- Seleccionar ---</option>
              {costCenters.map(cc => <option key={cc.id} value={cc.name}>{cc.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><MapPin size={14}/><span>Ubicación (Estante, Gaveta...)</span></label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" placeholder="Ej: Estante A, Gaveta 3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><DollarSign size={14}/><span>Valor Unitario ($)</span></label>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" placeholder="Ej: 15.50" />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Inicial</label><input type="number" min="0" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Mínimo</label><input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Máximo</label><input type="number" min="1" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex space-x-3">
        <button type="button" onClick={onClose} disabled={isUploading} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" disabled={isUploading} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] flex justify-center items-center transition-colors">
          {isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Guardar Repuesto'}
        </button>
      </div>
    </form>
  );
}

function EditMaterialForm({ materials, costCenters, suppliers, material, onSubmit, onClose, userRole }) {
  const [name, setName] = useState(material.name || ''); 
  const [sku, setSku] = useState(material.sku || '');
  const [nombreBritt, setNombreBritt] = useState(material.nombreBritt || ''); 
  const [supplier, setSupplier] = useState(material.supplier || '');
  const [location, setLocation] = useState(material.location || '');
  const [costCenter, setCostCenter] = useState(material.costCenter || '');
  const [price, setPrice] = useState(material.price ?? '');
  const [minStock, setMinStock] = useState(material.minStock ?? ''); 
  const [maxStock, setMaxStock] = useState(material.maxStock ?? '');
  const [stock, setStock] = useState(material.stock ?? 0);
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(material.imageUrl || null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const isBasic = userRole === 'basic';
  const isMaster = userRole === 'master'; 

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || (!isBasic && (minStock === '' || maxStock === ''))) { setError('Faltan campos obligatorios'); return; }

    const skuUpper = sku.trim().toUpperCase();
    if (materials.some(m => m.sku.toUpperCase() === skuUpper && m.id !== material.id)) {
      setError(`El SKU "${skuUpper}" ya está registrado en otro repuesto.`);
      return;
    }

    setIsUploading(true);
    setError('');
    
    try {
      const finalMinStock = isBasic ? material.minStock : parseInt(minStock, 10);
      const finalMaxStock = isBasic ? material.maxStock : parseInt(maxStock, 10);
      const finalStock = isMaster ? parseInt(stock, 10) : material.stock;

      await onSubmit({ 
        id: material.id, 
        name, 
        sku: skuUpper, 
        nombreBritt, 
        supplier, 
        location, 
        costCenter,
        price: parseFloat(price) || 0,
        imageUrl: material.imageUrl, 
        minStock: finalMinStock, 
        maxStock: finalMaxStock, 
        inventoryType: 'taller', 
        stock: finalStock, 
        imageFile 
      });
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al actualizar los datos. Verifica tu conexión a internet.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center space-x-2"><span>Ajustar Repuesto</span></h3><button type="button" onClick={onClose} disabled={isUploading} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
      
      {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center space-x-2 text-sm"><AlertCircle size={18} className="shrink-0" /><span>{error}</span></div>}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-4 scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/20 rounded-xl bg-black/20 hover:bg-black/40 transition-colors cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
          {imagePreview ? (
            <><img src={imagePreview} alt="Preview" className="h-32 object-cover rounded-lg shadow-sm opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/60 rounded-xl"><span className="text-white font-medium flex items-center space-x-2"><ImagePlus size={20}/> <span>Cambiar Foto</span></span></div></>
          ) : (<div className="text-center text-slate-500"><Camera size={32} className="mx-auto mb-2 opacity-50" /><span className="text-sm font-medium">Añadir foto</span></div>)}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
        </div>

        {isMaster && (
          <div className="p-4 bg-rose-900/20 border border-rose-500/30 rounded-xl mb-4">
            <label className="block text-sm font-semibold text-rose-400 mb-1">Stock Actual (Corrección Master)</label>
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-rose-500/30 focus:ring-2 focus:ring-rose-500 outline-none text-white font-bold text-lg" required/>
            <p className="text-xs text-rose-400/70 mt-1">Modifica esto solo si hubo un error en el conteo o para limpiar datos de prueba.</p>
          </div>
        )}

        {!isBasic && (
          <div className="flex space-x-4 p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-xl mb-4 mt-2">
            <div className="flex-1"><label className="block text-sm font-semibold text-indigo-300 mb-1">Mínimo</label><input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-indigo-500/30 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
            <div className="flex-1"><label className="block text-sm font-semibold text-indigo-300 mb-1">Máximo</label><input type="number" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-indigo-500/30 focus:ring-2 focus:ring-indigo-500 outline-none text-white" required/></div>
          </div>
        )}

        <div><label className="block text-sm font-medium text-slate-400 mb-1">Nombre</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} required disabled={isBasic}/></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-400 mb-1">SKU</label><input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} required disabled={isBasic}/></div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Nombre Britt</label><input type="text" value={nombreBritt} onChange={(e) => setNombreBritt(e.target.value)} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isBasic}/></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><Building2 size={14}/><span>Proveedor</span></label>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isBasic}>
              <option value="">--- Seleccionar ---</option>
              {/* Si el repuesto tenía un proveedor antiguo que no está en la nueva lista, lo mostramos para no perder el dato */}
              {supplier && !suppliers.find(s => s.name === supplier) && (
                 <option value={supplier}>{supplier} (Anterior)</option>
              )}
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><Tag size={14}/><span>Centro de Costos</span></label>
            <select value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isBasic}>
              <option value="">--- Seleccionar ---</option>
              {costCenter && !costCenters.find(cc => cc.name === costCenter) && (
                 <option value={costCenter}>{costCenter} (Anterior)</option>
              )}
              {costCenters.map(cc => <option key={cc.id} value={cc.name}>{cc.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><MapPin size={14}/><span>Ubicación (Estante, Gaveta...)</span></label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white" placeholder="Ej: Estante A, Gaveta 3"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center space-x-1"><DollarSign size={14}/><span>Valor Unitario ($)</span></label>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={`w-full px-4 py-2 rounded-xl bg-[#0f1423] border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-white ${isBasic ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="Ej: 15.50" disabled={isBasic}/>
          </div>
        </div>

      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex space-x-3">
        <button type="button" onClick={onClose} disabled={isUploading} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" disabled={isUploading} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] flex justify-center transition-colors">{isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Guardar Cambios'}</button>
      </div>
    </form>
  );
}

function DeleteMaterialForm({ material, onSubmit, onClose }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(material.id); }} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-rose-500 flex items-center space-x-2"><Trash2 className="text-rose-500"/><span>Borrar Repuesto</span></h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
      <div className="mb-6 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-300 text-sm">¿Estás seguro de eliminar <b className="text-white">{material.name}</b>?<br/><span className="text-rose-400 italic mt-2 block">Esta acción no se puede deshacer y afectará a todos los usuarios.</span></div>
      <div className="flex space-x-3"><button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button><button type="submit" className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors shadow-lg">Sí, Eliminar</button></div>
    </form>
  );
}

function TransactionForm({ material, type, bodegaOrigen, onSubmit, onClose }) {
  const [quantity, setQuantity] = useState(''); 
  const [user, setUser] = useState('');
  const [error, setError] = useState('');

  const isEntry = type === 'IN';
  const isReturn = type === 'RETURN_BODEGA';
  const isUse = type === 'USE_BODEGA';

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(quantity,10);
    if (!quantity || isNaN(qty) || qty <= 0) { setError('Ingresa una cantidad válida mayor a 0'); return; }
    if (!user.trim()) { setError('Debes especificar quién realiza la operación'); return; }
    
    // Solo bloqueamos por stock si no es una entrada al taller principal y si no es un retorno a bodega (que suma)
    if (!isEntry && !isReturn && qty > material.stock) { setError(`Stock insuficiente. Solo hay ${material.stock} disponibles.`); return; }
    
    onSubmit({ materialId: material.id, type, quantity: qty, user, bodegaOrigen });
  }

  // Títulos y etiquetas dinámicas según el tipo de transacción
  let titleText = isEntry ? 'Registrar Entrada' : 'Registrar Salida';
  let qtyLabel = 'Cantidad a ' + (isEntry ? 'ingresar' : 'retirar');
  let userLabel = '¿Quién ' + (isEntry ? 'ingresa' : 'retira') + '?';
  let btnText = isEntry ? 'Confirmar Entrada' : 'Confirmar Salida';
  let Icon = isEntry ? ArrowDownRight : ArrowUpRight;
  let iconColor = isEntry ? 'text-emerald-400' : 'text-rose-400';
  let btnColor = isEntry ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500';

  if (isUse) {
      titleText = 'Reportar Uso en Bodega';
      qtyLabel = 'Cantidad utilizada/instalada';
      userLabel = 'Técnico que reporta';
      btnText = 'Confirmar Uso';
      Icon = Database;
      iconColor = 'text-amber-400';
      btnColor = 'bg-amber-600 hover:bg-amber-500';
  } else if (isReturn) {
      titleText = 'Devolver a Taller';
      qtyLabel = 'Cantidad a devolver';
      userLabel = 'Técnico que devuelve';
      btnText = 'Confirmar Devolución';
      Icon = Undo2;
      iconColor = 'text-blue-400';
      btnColor = 'bg-blue-600 hover:bg-blue-500';
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 text-slate-200">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Icon className={iconColor} />
              <span>{titleText}</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1 uppercase tracking-wide">{material.name}</p>
          <div className="flex items-center space-x-3 mt-1.5 text-xs font-medium text-slate-500">
            <span className="flex items-center space-x-1"><Tag size={12}/> <span>{material.costCenter || 'Sin CC'}</span></span>
            <span className="flex items-center space-x-1"><DollarSign size={12}/> <span>${(material.price || 0).toLocaleString('en-US')}</span></span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      
      {error && <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-sm"><AlertCircle size={18} className="shrink-0" /><span>{error}</span></div>}
      
      <div className="space-y-4">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{qtyLabel}</label>
            <div className="relative">
                <input type="number" min="1" max={(!isEntry && !isReturn) ? material.stock : undefined} value={quantity} onChange={e=>setQuantity(e.target.value)} required className="w-full px-4 py-2.5 bg-[#0f1423] border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus/>
                {(!isEntry && !isReturn) && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Max: {material.stock}</span>}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{userLabel}</label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="text" value={user} onChange={e=>setUser(e.target.value)} required placeholder="Nombre..." className="w-full pl-10 pr-4 py-2.5 bg-[#0f1423] border border-white/10 text-white placeholder-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"/>
            </div>
        </div>
      </div>
      <div className="mt-8 flex space-x-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
          <button type="submit" className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium shadow-lg transition-colors ${btnColor}`}>{btnText}</button>
      </div>
    </form>
  );
}

function CompleteRequestForm({ request, onSubmit, onClose }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(request.id); }} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="text-emerald-400"/><span>Confirmar Llegada</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      
      <div className="mb-6 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-300 text-sm leading-relaxed">
        ¿Confirmas que el pedido <b>{request.orderNumber || 'General'}</b> solicitado por <b>{request.user}</b> ya ha sido recibido en las instalaciones?
        <br/><br/>
        <span className="text-emerald-400/80 italic block">Esta acción marcará el pedido como completado y se guardará permanentemente en el Historial Físico con sus documentos adjuntos.</span>
      </div>
      
      <div className="flex space-x-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Sí, Confirmar Llegada</button>
      </div>
    </form>
  );
}

function DeleteRequestForm({ request, onSubmit, onClose }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(request.id); }} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-rose-500 flex items-center space-x-2"><Trash2 className="text-rose-500"/><span>Eliminar Solicitud</span></h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      <div className="mb-6 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-300 text-sm leading-relaxed">
        ¿Estás seguro de eliminar el pedido <b>{request.orderNumber || 'General'}</b> solicitado por <b>{request.user}</b>?<br/><br/>
        <span className="text-rose-400/80 italic block">Esta acción no se puede deshacer y el pedido desaparecerá permanentemente del registro.</span>
      </div>
      <div className="flex space-x-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors shadow-lg">Sí, Eliminar</button>
      </div>
    </form>
  );
}

function DeleteUserForm({ user, onSubmit, onClose }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(user.id); }} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-rose-500 flex items-center space-x-2"><Trash2 className="text-rose-500"/><span>Eliminar Usuario</span></h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      <div className="mb-6 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-300 text-sm leading-relaxed">
        ¿Estás seguro de eliminar el registro de <b>{user.name}</b> ({user.email})?<br/><br/>
        <span className="text-rose-400/80 italic block">Se revocará su acceso inmediatamente. Si vuelve a iniciar sesión, requerirá autorización nuevamente como usuario nuevo.</span>
      </div>
      <div className="flex space-x-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors shadow-lg">Sí, Eliminar</button>
      </div>
    </form>
  );
}

function DeleteHistoryForm({ record, onSubmit, onClose }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(record.id, record.isRequest); }} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-rose-500 flex items-center space-x-2"><Trash2 className="text-rose-500"/><span>Borrar Registro Histórico</span></h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      <div className="mb-6 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-300 text-sm leading-relaxed">
        ¿Estás seguro de eliminar permanentemente este movimiento del historial?<br/><br/>
        <span className="text-rose-400 italic block">Nota: Esto solo borra el registro visual de la tabla (ideal para limpieza de datos de prueba). Si necesitas ajustar las cantidades del repuesto, ve a "Ajustes Principales" y edita el stock del repuesto directamente.</span>
      </div>
      <div className="flex space-x-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors shadow-lg">Sí, Eliminar Registro</button>
      </div>
    </form>
  );
}

function EditBodegaForm({ bodega, onSubmit, onClose }) {
  const [name, setName] = useState(bodega.name || '');
  const [owner, setOwner] = useState(bodega.owner || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit({ id: bodega.id, name, owner });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white flex items-center space-x-2"><Edit className="text-indigo-400"/><span>Editar Bodega Auxiliar</span></h3>
        <button type="button" onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      
      <div className="space-y-4 mb-8">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 uppercase tracking-wide">Nombre de la Bodega</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full px-4 py-3 bg-[#0f1423] border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 uppercase tracking-wide">Técnico Asignado</label>
            <input type="text" value={owner} onChange={e=>setOwner(e.target.value)} required className="w-full px-4 py-3 bg-[#0f1423] border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
        </div>
      </div>

      <div className="flex space-x-3">
        <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] flex justify-center items-center">
          {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}

function ManageBodegaLimitsForm({ bodega, materials, onSubmit, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return materials.filter(m => 
      m.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.nombreBritt && m.nombreBritt.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 15); // Mostrar hasta 15 para mantener el modal ligero
  }, [searchTerm, materials]);

  return (
    <div className="p-6 text-slate-200">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Settings2 className="text-purple-400" />
              <span>Límites de Despacho</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">Bodega: <span className="font-semibold text-purple-300">{bodega.name}</span></p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      
      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl mb-6">
          <p className="text-sm text-purple-300 leading-relaxed">
              Busca un repuesto y define cuántas unidades como máximo puede tener esta bodega en su inventario. El sistema bloqueará despachos que superen este límite. Si borras el valor, será "ilimitado".
          </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
            type="text" 
            placeholder="Buscar repuesto por nombre o SKU..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-3 bg-[#0f1423] border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-sm"
            autoFocus
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-xl bg-black/20 scrollbar-thin scrollbar-thumb-white/10">
          {!searchTerm ? (
             <div className="p-8 text-center text-slate-500 text-sm">Empieza a escribir para buscar repuestos.</div>
          ) : searchResults.length === 0 ? (
             <div className="p-8 text-center text-slate-500 text-sm">No se encontraron repuestos.</div>
          ) : (
             searchResults.map(m => {
                 const currentLimit = bodega.limits?.[m.id];
                 return (
                     <div key={m.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/5 transition-colors">
                         <div>
                             <p className="font-medium text-white text-sm">{m.name}</p>
                             <p className="text-xs text-slate-500 font-mono mt-0.5">{m.sku}</p>
                             {currentLimit !== undefined && (
                                <p className="text-[10px] text-purple-400 font-semibold uppercase mt-1">Límite actual: {currentLimit} uds.</p>
                             )}
                         </div>
                         <div className="flex items-center space-x-2 w-full sm:w-auto">
                             <input 
                                 type="number" 
                                 min="0"
                                 placeholder="Ilimitado" 
                                 id={`limit-${m.id}`} 
                                 defaultValue={currentLimit !== undefined ? currentLimit : ''}
                                 className="w-24 px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg text-white outline-none focus:ring-1 focus:ring-purple-500 text-sm" 
                             />
                             <button 
                                 type="button" 
                                 onClick={(e) => {
                                     const btn = e.target;
                                     const inputVal = document.getElementById(`limit-${m.id}`).value;
                                     onSubmit({ bodegaId: bodega.id, materialId: m.id, newLimit: inputVal });
                                     btn.innerText = "Guardado";
                                     btn.classList.add("bg-emerald-600/20", "text-emerald-400", "border-emerald-500/30");
                                     setTimeout(() => {
                                         btn.innerText = "Guardar";
                                         btn.classList.remove("bg-emerald-600/20", "text-emerald-400", "border-emerald-500/30");
                                     }, 2000);
                                 }} 
                                 className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-sm font-medium transition-colors w-20"
                             >
                                 Guardar
                             </button>
                         </div>
                     </div>
                 );
             })
          )}
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
        <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors shadow-sm">Cerrar Modal</button>
      </div>
    </div>
  );
}

function EditCostCenterForm({ costCenter, onSubmit, onClose }) {
  const [name, setName] = useState(costCenter.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit({ id: costCenter.id, name });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white flex items-center space-x-2"><Edit className="text-emerald-400"/><span>Editar Centro de Costos</span></h3>
        <button type="button" onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>
      
      <div className="space-y-4 mb-8">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 uppercase tracking-wide">Nombre o Código</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full px-4 py-3 bg-[#0f1423] border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"/>
        </div>
      </div>

      <div className="flex space-x-3">
        <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-black/20 hover:bg-black/40 border border-white/5 text-slate-300 rounded-xl font-medium transition-colors">Cancelar</button>
        <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] flex justify-center items-center">
          {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}

// --- AJUSTES Y PANELES DE ADMIN ---
function SettingsDashboard({ materials, allUsers, bodegas, costCenters, suppliers, onDelete, onEdit, onUpdateUserStatus, onUpdateUserRole, onDeleteUser, onCreateBodega, onEditBodega, onDeleteBodega, onCreateCostCenter, onEditCostCenter, onDeleteCostCenter, onCreateSupplier, onDeleteSupplier, userData }) {
  const [adminSearch, setAdminSearch] = useState('');
  const [creationSearch, setCreationSearch] = useState('');

  const [newBodegaName, setNewBodegaName] = useState('');
  const [newBodegaOwner, setNewBodegaOwner] = useState('');

  const [newCostCenterName, setNewCostCenterName] = useState('');
  
  const [newSupplierName, setNewSupplierName] = useState('');

  const filteredForAdmin = useMemo(() => {
    return materials.filter(m => m.name.toLowerCase().includes(adminSearch.toLowerCase()) || m.sku.toLowerCase().includes(adminSearch.toLowerCase()));
  }, [materials, adminSearch]);

  const creationHistory = useMemo(() => {
    return [...materials].filter(m => m.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [materials]);

  const filteredCreationHistory = useMemo(() => {
    if (!creationSearch) return creationHistory;
    const lower = creationSearch.toLowerCase();
    return creationHistory.filter(m => 
      m.name.toLowerCase().includes(lower) || 
      m.sku.toLowerCase().includes(lower) ||
      (m.createdBy && m.createdBy.toLowerCase().includes(lower))
    );
  }, [creationHistory, creationSearch]);

  const handleAddBodega = (e) => {
    e.preventDefault();
    if(newBodegaName.trim() && newBodegaOwner.trim()){
      onCreateBodega({ name: newBodegaName, owner: newBodegaOwner });
      setNewBodegaName('');
      setNewBodegaOwner('');
    }
  };

  const handleAddCostCenter = (e) => {
    e.preventDefault();
    if(newCostCenterName.trim()){
      onCreateCostCenter({ name: newCostCenterName });
      setNewCostCenterName('');
    }
  };

  const handleAddSupplier = (e) => {
    e.preventDefault();
    if(newSupplierName.trim()){
      onCreateSupplier({ name: newSupplierName });
      setNewSupplierName('');
    }
  };

  return (
    <div className="space-y-10 text-slate-200">
      <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
        <div className="flex items-center space-x-3 text-white"><ShieldCheck size={20} className={userData?.role === 'master' ? "text-emerald-400" : userData?.role === 'admin' ? "text-indigo-400" : "text-slate-400"} /><span className="font-semibold">Nivel de Acceso: {userData?.role === 'master' ? 'Master Total' : userData?.role === 'admin' ? 'Administrador Secundario' : 'Básico / Limitado'}</span></div>
      </div>
      
      {/* SECCIÓN SOLO PARA EL MASTER */}
      {userData?.role === 'master' && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/20 p-6 rounded-2xl border border-white/5 lg:row-span-2">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center space-x-2"><Truck className="text-amber-400"/><span>Bodegas Auxiliares de Técnicos</span></h4>
              
              <form onSubmit={handleAddBodega} className="mb-6 space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Nombre de la Bodega</label>
                    <input type="text" value={newBodegaName} onChange={e=>setNewBodegaName(e.target.value)} placeholder="Ej: Bodega Móvil 1" className="w-full px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-white text-sm" required/>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Técnico Asignado</label>
                    <input type="text" value={newBodegaOwner} onChange={e=>setNewBodegaOwner(e.target.value)} placeholder="Ej: Carlos Jiménez" className="w-full px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-white text-sm" required/>
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-md w-full">Crear Bodega</button>
              </form>

              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0f1423]">
                 <div className="bg-[#1e253c] px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5">Bodegas Registradas</div>
                 <div className="max-h-[350px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                     {bodegas.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No hay bodegas creadas.</p> :
                     bodegas.map(b => (
                         <div key={b.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                             <div><p className="font-semibold text-white text-sm">{b.name}</p><p className="text-xs text-slate-400 flex items-center mt-0.5"><User size={12} className="mr-1"/> {b.owner}</p></div>
                             <div className="flex space-x-1">
                               <button onClick={() => onEditBodega(b)} className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors tooltip" title="Editar Nombre/Técnico"><Edit size={16}/></button>
                               <button onClick={() => onDeleteBodega(b.id)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors tooltip" title="Borrar Bodega"><Trash2 size={16}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
              </div>
            </div>

            {/* SECCION PROVEEDORES OFICIALES */}
            <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center space-x-2"><Building2 className="text-indigo-400"/><span>Proveedores Oficiales</span></h4>
              
              <form onSubmit={handleAddSupplier} className="mb-6 flex space-x-2 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Nombre del Proveedor</label>
                    <input type="text" value={newSupplierName} onChange={e=>setNewSupplierName(e.target.value)} placeholder="Ej: Importadora Jiménez" className="w-full px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-white text-sm" required/>
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-md h-[38px]">Añadir</button>
              </form>

              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0f1423]">
                 <div className="bg-[#1e253c] px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5">Lista Oficial</div>
                 <div className="max-h-32 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                     {suppliers.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No hay proveedores creados.</p> :
                     suppliers.map(s => (
                         <div key={s.id} className="p-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                             <p className="font-medium text-white text-sm">{s.name}</p>
                             <button onClick={() => onDeleteSupplier(s.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                         </div>
                     ))}
                 </div>
              </div>
            </div>

            {/* SECCION CENTRO DE COSTOS */}
            <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center space-x-2"><Tag className="text-emerald-400"/><span>Centros de Costos Oficiales</span></h4>
              
              <form onSubmit={handleAddCostCenter} className="mb-6 flex space-x-2 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Nombre o Código del C.C.</label>
                    <input type="text" value={newCostCenterName} onChange={e=>setNewCostCenterName(e.target.value)} placeholder="Ej: Mantenimiento Preventivo" className="w-full px-3 py-2 bg-[#0f1423] border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-white text-sm" required/>
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-md h-[38px]">Añadir</button>
              </form>

              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0f1423]">
                 <div className="bg-[#1e253c] px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5">Lista Oficial</div>
                 <div className="max-h-32 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                     {costCenters.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No hay Centros de Costos creados.</p> :
                     costCenters.map(cc => (
                         <div key={cc.id} className="p-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                             <p className="font-mono font-medium text-indigo-300 text-sm">{cc.name}</p>
                             <div className="flex space-x-1">
                                <button onClick={() => onEditCostCenter(cc)} className="p-1.5 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"><Edit size={14}/></button>
                                <button onClick={() => onDeleteCostCenter(cc.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
              </div>
            </div>

        </div>

        <div>
          <h4 className="text-lg font-bold text-white mb-4 flex items-center space-x-2"><UserPlus className="text-indigo-400"/><span>Autorización y Roles de Personal</span></h4>
          <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/5 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">Nombre / Correo</th>
                  <th className="p-4 font-semibold">Estado</th>
                  <th className="p-4 font-semibold">Rol</th>
                  <th className="p-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allUsers.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white flex items-center space-x-2">
                        <span>{user.name}</span>
                        {user.email === 'cristofer10murillo@gmail.com' && <Shield size={14} className="text-indigo-400" title="Propietario del Sistema" />}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{user.email}</div>
                    </td>
                    <td className="p-4">{user.status === 'approved' ? <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold"><CheckCircle2 size={14}/><span>Aprobado</span></span> : <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold"><Clock size={14}/><span>Pendiente</span></span>}</td>
                    <td className="p-4">
                      {user.email === 'cristofer10murillo@gmail.com' ? (
                        <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider">Master (Fijo)</span>
                      ) : (
                        <select 
                          value={user.role || 'basic'} 
                          onChange={(e) => onUpdateUserRole(user.id, e.target.value)}
                          className="bg-[#0f1423] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          disabled={user.status !== 'approved'}
                        >
                          <option value="admin">Admin Secundario</option>
                          <option value="basic">Básico</option>
                          <option value="visitante">Visitante</option>
                        </select>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {user.email !== 'cristofer10murillo@gmail.com' ? (
                        <>
                          {user.status === 'pending' ? (
                            <button onClick={() => onUpdateUserStatus(user.id, 'approved')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors mr-2">Conceder Acceso</button> 
                          ) : (
                            <button onClick={() => onUpdateUserStatus(user.id, 'pending')} className="px-3 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 text-slate-300 rounded-lg text-sm font-medium transition-colors mr-2">Bloquear</button>
                          )}
                          <button onClick={() => onDeleteUser(user)} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-sm font-medium transition-colors" title="Eliminar Usuario">
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600 italic">No modificable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {(userData?.role === 'master' || userData?.role === 'admin') && (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h4 className="text-lg font-bold text-white flex items-center space-x-2">
              <FilePlus className="text-purple-400"/>
              <span>Registro de Creación de Repuestos</span>
            </h4>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Buscar repuesto, SKU o correo..." 
                value={creationSearch} 
                onChange={(e) => setCreationSearch(e.target.value)} 
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-purple-500 text-sm text-white transition-all" 
              />
              {creationSearch && (
                <button onClick={() => setCreationSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors tooltip" title="Limpiar">
                  <X size={14}/>
                </button>
              )}
            </div>
          </div>

          <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-[#1e253c] border-b border-white/5 text-slate-400 text-sm uppercase tracking-wider sticky top-0"><th className="p-4 font-semibold">Fecha de Ingreso</th><th className="p-4 font-semibold">Repuesto Registrado</th><th className="p-4 font-semibold">SKU</th><th className="p-4 font-semibold">Ingresado Por</th><th className="p-4 font-semibold text-right">Acción</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filteredCreationHistory.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-500">No se encontraron registros de creación.</td></tr> :
                filteredCreationHistory.map(material => (
                  <tr key={`history-${material.id}`} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-sm text-slate-400">{new Date(material.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-4 font-medium text-white">{material.name}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{material.sku}</td>
                    <td className="p-4 text-sm text-slate-300 flex items-center space-x-2"><User size={16} className="text-slate-500"/><span className="font-semibold">{material.createdBy}</span></td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(material)} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                        <Settings2 size={16}/><span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h4 className="text-lg font-bold text-white flex items-center space-x-2"><Trash2 className="text-rose-500"/><span>Gestión de Repuestos</span></h4>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input type="text" placeholder="Buscar para editar o eliminar..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0f1423] border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white transition-all" />
          </div>
        </div>
        
        <div className="border border-rose-500/20 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-[#1e253c] border-b border-rose-500/20 text-rose-400 text-sm uppercase tracking-wider sticky top-0 z-10"><th className="p-4 font-semibold">Foto</th><th className="p-4 font-semibold">Repuesto / SKU</th><th className="p-4 font-semibold">C. Costos</th><th className="p-4 font-semibold text-right">Administrar</th></tr></thead>
            <tbody className="divide-y divide-rose-500/10 bg-black/20">
              {filteredForAdmin.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">No se encontraron resultados en tu búsqueda.</td></tr> :
              filteredForAdmin.map(material => (
                <tr key={material.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">{material.imageUrl ? <img src={material.imageUrl} alt="img" className="w-10 h-10 rounded-lg object-cover shadow-sm border border-white/10"/> : <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center"><Box size={20} className="text-slate-600"/></div>}</td>
                  <td className="p-4"><div className="font-medium text-white">{material.name}</div><div className="text-xs text-slate-500 font-mono mt-0.5">{material.sku}</div></td>
                  <td className="p-4"><div className="text-indigo-300 font-mono text-xs">{material.costCenter || '---'}</div></td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(material)} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-sm font-medium mr-2 transition-colors"><Settings2 size={16}/><span>Editar / Foto</span></button>
                    {userData?.role !== 'basic' && userData?.role !== 'visitante' && (
                      <button onClick={() => onDelete(material)} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium transition-colors"><Trash2 size={16}/><span>Eliminar</span></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onAdminDirectLogin, auth }) {
  const [isLogin, setIsLogin] = useState(true); 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [name, setName] = useState(''); 
  const [error, setError] = useState(''); 
  const [resetMessage, setResetMessage] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [showAdminBypass, setShowAdminBypass] = useState(false); 
  const [adminPass, setAdminPass] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  
  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Por favor, escribe tu correo electrónico en la casilla de arriba y luego haz clic nuevamente en "¿Olvidaste tu contraseña?".');
      setResetMessage('');
      return;
    }
    setLoading(true);
    setError('');
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Se ha enviado un enlace seguro a tu correo. Revisa tu bandeja de entrada y la carpeta de Spam.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No existe ninguna cuenta registrada con este correo electrónico.');
      } else if (err.code === 'auth/invalid-email') {
         setError('El formato del correo electrónico no es válido.');
      } else {
        setError('Ocurrió un error al enviar el correo. Por favor, intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminPass) {
      setError("Por favor ingresa la contraseña.");
      return;
    }
    setAdminLoading(true);
    setError('');
    try {
      await onAdminDirectLogin(adminPass);
    } catch (err) {
      setError("Contraseña de Administrador incorrecta.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setError(''); 
    setResetMessage('');
    setLoading(true);
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else {
        if (!name.trim()) throw new Error("Debes ingresar tu nombre real.");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), { email, name, status: 'pending', role: 'basic', createdAt: new Date().toISOString() });
      }
    } catch (err) { 
      setError(err.code === 'auth/invalid-credential' ? "Correo o contraseña incorrectos." : err.code === 'auth/email-already-in-use' ? "Este correo ya está registrado." : err.message); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1423] bg-gradient-to-br from-[#0f1423] via-[#1a1c3a] to-[#0f1423] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1e253c]/60 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-white/10">
        <div className="flex justify-center mb-6"><div className="text-indigo-400"><ShieldCheck size={56} strokeWidth={1.5} /></div></div>
        <h2 className="text-2xl font-bold text-center text-white">{isLogin ? 'International Nexus Pro' : 'International Nexus Pro - Registro'}</h2>
        <p className="text-center text-slate-400 text-xs tracking-widest uppercase mb-8 mt-2 font-semibold">Control Operations</p>
        
        {error && <div className="mb-6 p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-sm rounded-xl flex items-center space-x-2"><AlertCircle size={18} className="shrink-0"/><span>{error}</span></div>}
        {resetMessage && <div className="mb-6 p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm rounded-xl flex items-center space-x-2"><CheckCircle2 size={18} className="shrink-0"/><span>{resetMessage}</span></div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && <div><label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Nombre Completo</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full pl-10 pr-4 py-3 bg-[#0f1423]/50 border border-transparent focus:border-indigo-500 text-white rounded-xl outline-none transition-all placeholder-slate-600" placeholder="Ej: Juan Pérez" /></div></div>}
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Identificación</label>
            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 bg-[#0f1423]/50 border border-transparent focus:border-indigo-500 text-white rounded-xl outline-none transition-all placeholder-slate-600" placeholder="Usuario o Correo" /></div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Contraseña</label>
            <div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full pl-10 pr-4 py-3 bg-[#0f1423]/50 border border-transparent focus:border-indigo-500 text-white rounded-xl outline-none transition-all placeholder-slate-600" placeholder="••••••••" /></div>
          </div>

          {isLogin && (
            <div className="flex justify-end mt-2">
              <button type="button" onClick={handlePasswordReset} disabled={loading} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-colors mt-6 flex justify-center items-center min-h-[50px]">
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : (isLogin ? 'Ingresar al Sistema' : 'Registrarse')}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={() => {setIsLogin(!isLogin); setError(''); setResetMessage(''); setShowAdminBypass(false);}} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          {!showAdminBypass ? (
            <button onClick={() => setShowAdminBypass(true)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider font-semibold">
              ¿Eres Cristofer? Ingresar como Admin
            </button>
          ) : (
            <form onSubmit={handleAdminSubmit} className="flex space-x-2">
              <input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} placeholder="Clave Maestra" className="flex-1 px-4 py-2.5 bg-[#0f1423]/50 border border-white/10 outline-none focus:border-indigo-500 text-white rounded-xl text-sm transition-all" autoFocus disabled={adminLoading} />
              <button type="submit" disabled={adminLoading} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center min-w-[70px]">
                {adminLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingScreen({ userData, onLogout, onMasterBypass }) {
  const [showBypass, setShowBypass] = useState(false); 
  const [masterPass, setMasterPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBypass = async (e) => { 
    e.preventDefault(); 
    if(masterPass) {
      setLoading(true);
      setError('');
      try {
        await onMasterBypass(masterPass);
      } catch (err) {
        setError("Contraseña de administrador incorrecta.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1423] bg-gradient-to-br from-[#0f1423] via-[#1a1c3a] to-[#0f1423] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1e253c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center border border-white/10">
        <div className="flex justify-center mb-6"><div className="p-4 bg-amber-500/10 rounded-full text-amber-400 border border-amber-500/20"><Clock size={48} /></div></div>
        <h2 className="text-2xl font-bold text-white mb-2">Cuenta en Revisión</h2>
        <p className="text-slate-400 mb-6">Hola <b className="text-white">{userData?.name}</b>, hemos recibido tu registro. Cristofer debe autorizar tu acceso en el panel de Ajustes antes de ver el inventario.</p>
        <button onClick={onLogout} className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 rounded-xl font-medium transition-colors flex justify-center items-center space-x-2"><LogOut size={18} /><span>Salir por ahora</span></button>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col items-center">
          {!showBypass ? <button onClick={() => setShowBypass(true)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider font-semibold">¿Eres Cristofer? Ingresar como Admin</button> : 
          <div className="w-full flex flex-col space-y-2">
            {error && <span className="text-rose-400 text-xs font-medium">{error}</span>}
            <form onSubmit={handleBypass} className="flex space-x-2 w-full">
              <input type="password" value={masterPass} onChange={e=>setMasterPass(e.target.value)} placeholder="Clave Maestra" className="flex-1 px-3 py-2 bg-[#0f1423] border border-white/10 outline-none focus:border-indigo-500 text-white rounded-lg text-sm transition-all" autoFocus disabled={loading} />
              <button type="submit" disabled={loading} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-[70px]">
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Entrar'}
              </button>
            </form>
          </div>}
        </div>
      </div>
    </div>
  );
}