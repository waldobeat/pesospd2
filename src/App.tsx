import { useState, useEffect, useRef } from 'react';
import { useScale } from './hooks/useScale';
import { Scoreboard } from './components/Scoreboard';
import { TestWeightWindow } from './components/TestWeightWindow';
import { CalibrationTest } from './components/CalibrationTest';
import { HistoryView } from './components/HistoryView';
import { ReportIssueModal } from './components/ReportIssueModal';
import { RepairModule } from './components/RepairModule';
import { UserNotificationsModal } from './components/UserNotificationsModal';
import { InventoryView } from './components/InventoryView';
import { SupportChatCenter } from './components/SupportChatCenter';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { AlertTriangle, Shield, Zap, LayoutDashboard, ClipboardCheck, History, Wrench, LogOut, Box, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { serialService } from './services/SerialService';
import { auth } from './firebase'; // Import auth
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Login } from './components/Login';

import { UserManagementModal } from './components/UserManagementModal';
import { useAuthRole } from './hooks/useAuthRole'; // Hook Integration

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isAdmin } = useAuthRole(user); // RBAC

  const {
    weight, unit, isStable, isZero, isNet, isConnected, isConnecting, error,
    rawBuffer, connect, disconnect
  } = useScale();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isTestWindowOpen, setIsTestWindowOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false); // Inventory modal toggle
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [unseenSupportMessages, setUnseenSupportMessages] = useState(0);
  const simInterval = useRef<number | null>(null);

  // Listener for unseen support messages
  useEffect(() => {
    if (user) {
      const q = isAdmin
        ? query(collection(db, 'messages'), where('recipient', '==', 'workshop'), where('seen', '==', false))
        : query(collection(db, 'messages'), where('recipient', '==', user.email?.toLowerCase()), where('seen', '==', false));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUnseenSupportMessages(snapshot.size);
      });
      return () => unsubscribe();
    }
  }, [user, isAdmin]);

  // Simulation Logic
  useEffect(() => {
    if (isSimulating) {
      let simWeight = 0;
      simInterval.current = window.setInterval(() => {
        simWeight += 0.1;
        if (simWeight > 20) simWeight = 0;

        const isError = Math.random() > 0.98; // 2% chance of error
        let frame = "";

        if (isError) {
          frame = `\x02?E\r`; // Hardware error
        } else {
          const wStr = simWeight.toFixed(2);
          frame = `\x02${wStr}\r`;
        }

        const encoder = new TextEncoder();
        serialService.emitData(encoder.encode(frame));
      }, 200);
    } else {
      if (simInterval.current) clearInterval(simInterval.current);
    }
    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, [isSimulating]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        Cargando sistema...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-blue-500/30 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none select-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none select-none" />

      {/* Fixed Professional Header */}
      <header className="fixed top-0 left-0 w-full min-h-[4rem] sm:h-16 py-2 sm:py-0 bg-black/80 backdrop-blur-md border-b border-white/10 z-50 flex flex-wrap sm:flex-nowrap items-center justify-between px-3 md:px-8 shadow-2xl gap-y-2">
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 relative group cursor-pointer">
            <div className="absolute inset-0 bg-white/10 blur-md rounded-full group-hover:bg-blue-500/30 transition-all"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
              <div className="w-4 h-4 sm:w-6 sm:h-6 border-[1.5px] sm:border-2 border-blue-500/30 rounded-full flex items-center justify-center relative">
                <div className="absolute w-0.5 h-1.5 sm:h-2 bg-orange-500 top-0.5 rounded-full origin-bottom animate-pulse"></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-white leading-none">
              SISDEPE
            </h1>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-blue-200/60 font-medium tracking-wide uppercase hidden sm:block">
              Sistema de Pesaje Certificado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-full border border-white/5">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-[9px] sm:text-xs font-bold text-white/50">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-red-400 transition-colors flex items-center gap-2"
            title="Cerrar Sesión"
          >
            <span className="text-xs font-bold hidden md:block">SALIR</span>
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Main Container padding adjustment for mobile - push content down to avoid covering with header */}
      <div className="w-full max-w-5xl z-10 flex flex-col gap-4 sm:gap-6 md:gap-8 px-2 sm:px-4 pt-[5.5rem] sm:pt-24 pb-16 sm:pb-10">

        <UserNotificationsModal isAdmin={isAdmin} />

        {isAdmin && (
          <Scoreboard
            weight={weight}
            unit={unit}
            isStable={isStable}
            isZero={isZero}
            isNet={isNet}
            isConnected={isConnected || isSimulating}
            error={error}
          />
        )}

        {isAdmin ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto mt-4 px-2 text-center">
            {!isConnected && !isSimulating ? (
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="group relative px-6 py-6 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 rounded-2xl transition-all duration-300 shadow-[0_0_40px_-10px_rgba(59,130,246,0.4)] border border-blue-400/30 flex flex-col items-center justify-center gap-3 font-bold text-lg overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className={clsx("w-12 h-12 rounded-full bg-white/10 flex items-center justify-center", isConnecting && "animate-pulse")}>
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span>{isConnecting ? "CONECTANDO..." : "CONECTAR BALANZA"}</span>
              </button>
            ) : (
              <button
                onClick={isConnected ? disconnect : () => setIsSimulating(false)}
                className="group relative px-6 py-6 bg-gradient-to-br from-red-900/40 to-red-950/40 hover:from-red-900/60 hover:to-red-950/60 border border-red-500/30 text-red-500 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(239,68,68,0.2)] flex flex-col items-center justify-center gap-3 font-bold text-lg overflow-hidden"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-red-500" />
                </div>
                <span>{isConnected ? "DESCONECTAR" : "DETENER SIMULACIÓN"}</span>
              </button>
            )}

            <button
              onClick={() => serialService.send('W')}
              className="group relative px-6 py-6 bg-gradient-to-br from-yellow-600/20 to-yellow-900/20 hover:from-yellow-500/30 hover:to-yellow-800/30 border border-yellow-500/30 text-yellow-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(234,179,8,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg overflow-hidden"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <span>RESET (W)</span>
            </button>

            <button
              onClick={() => setIsTestWindowOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 border border-white/10 text-white rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <LayoutDashboard className="w-6 h-6 text-white/80" />
              </div>
              <span>MONITOR SERIAL</span>
            </button>

            <button
              onClick={() => setIsRepairOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-orange-600/20 to-orange-900/20 hover:from-orange-500/30 hover:to-orange-800/30 border border-orange-500/30 text-orange-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(249,115,22,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                <Wrench className="w-6 h-6 text-orange-400" />
              </div>
              <span>PROCESO MANUAL</span>
            </button>

            <button
              onClick={() => setIsIssueOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-red-600/20 to-red-900/20 hover:from-red-500/30 hover:to-red-800/30 border border-red-500/30 text-red-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(239,68,68,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <span>REPORTAR AVERÍA</span>
            </button>

            <button
              onClick={() => setIsInventoryOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-blue-600/20 to-blue-900/20 hover:from-blue-500/30 hover:to-blue-800/30 border border-blue-500/30 text-blue-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(59,130,246,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
                <Box className="w-6 h-6 text-blue-400" />
              </div>
              <span>VER INVENTARIO</span>
            </button>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 border border-white/10 text-white rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
                <History className="w-6 h-6 text-white/80" />
              </div>
              <span>HISTORIAL</span>
            </button>

            <button
              onClick={() => {
                serialService.send('W');
                setIsCalibrationOpen(true);
              }}
              className="group relative px-6 py-6 bg-gradient-to-br from-purple-600/20 to-purple-900/20 hover:from-purple-500/30 hover:to-purple-800/30 border border-purple-500/30 text-purple-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(168,85,247,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-6 h-6 text-purple-400" />
              </div>
              <span>CALIBRACIÓN</span>
            </button>

            <button
              onClick={() => setIsUserMgmtOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-teal-600/20 to-teal-900/20 hover:from-teal-500/30 hover:to-teal-800/30 border border-teal-500/30 text-teal-400 rounded-2xl transition-all duration-300 shadow-[0_0_30px_-10px_rgba(20,184,166,0.15)] flex flex-col items-center justify-center gap-3 font-bold text-lg"
            >
              <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-teal-400" />
              </div>
              <span>USUARIOS</span>
            </button>

            <button
              onClick={() => setIsSupportChatOpen(true)}
              className="group relative px-6 py-6 bg-gradient-to-br from-blue-500/20 to-indigo-900/20 hover:from-blue-500/30 hover:to-indigo-800/30 border border-blue-500/30 text-blue-300 rounded-2xl transition-all duration-300 shadow-[0_0_40px_-5px_rgba(59,130,246,0.3)] flex flex-col items-center justify-center gap-3 font-extrabold text-lg overflow-hidden"
            >
              {unseenSupportMessages > 0 && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse border-2 border-[#0a0a0c]">
                  {unseenSupportMessages}
                </div>
              )}
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7 text-blue-400" />
              </div>
              <span className="tracking-tight">SOPORTE TALLER</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full max-w-4xl mx-auto mt-4 sm:mt-8 px-0 sm:px-4">
            <button
              onClick={() => setIsIssueOpen(true)}
              className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-red-950/20 to-red-900/10 hover:from-red-900/30 hover:to-red-800/20 border-2 border-red-500/30 hover:border-red-500/60 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-300 shadow-[0_0_40px_-10px_rgba(239,68,68,0.15)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500 relative z-10">
                <AlertTriangle className="w-8 h-8 sm:w-12 sm:h-12 text-red-500" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-red-400 mb-2 uppercase tracking-tighter relative z-10 text-center">Reportar Equipo</h3>
              <p className="text-xs sm:text-sm text-red-300/60 text-center relative z-10 px-2 sm:px-4">Notificar una avería al taller técnico.</p>
            </button>

            <button
              onClick={() => setIsInventoryOpen(true)}
              className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-blue-950/20 to-blue-900/10 hover:from-blue-900/30 hover:to-blue-800/20 border-2 border-blue-500/30 hover:border-blue-500/60 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-300 shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 sm:mb-6 group-hover:-translate-y-2 transition-transform duration-500 relative z-10">
                <Box className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tighter relative z-10 text-center">Inventario</h3>
              <p className="text-xs sm:text-sm text-white/40 text-center relative z-10 px-2">Ver equipos registrados en sucursal.</p>
            </button>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 border-2 border-white/10 hover:border-white/20 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-500 relative z-10">
                <History className="w-8 h-8 sm:w-10 sm:h-10 text-white/80" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tighter relative z-10 text-center">Historial</h3>
              <p className="text-xs sm:text-sm text-white/40 text-center relative z-10 px-2">Estatus y seguimiento de equipos.</p>
            </button>

            <button
              onClick={() => setIsSupportChatOpen(true)}
              className="group relative flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 hover:from-blue-600/20 hover:to-indigo-600/20 border-2 border-blue-500/30 hover:border-blue-500/60 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-300 shadow-[0_0_40px_-10px_rgba(37,99,235,0.15)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {unseenSupportMessages > 0 && (
                <div className="absolute top-4 sm:top-6 right-4 sm:right-8 px-3 sm:px-4 py-1 bg-blue-600 text-white text-[9px] sm:text-[10px] font-black rounded-full animate-bounce shadow-xl z-20">
                  {unseenSupportMessages > 1 ? `${unseenSupportMessages} MENSAJES` : 'NUEVO MENSAJE'}
                </div>
              )}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500 relative z-10">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tighter relative z-10 text-center">Soporte Técnico</h3>
              <p className="text-xs sm:text-sm text-white/40 text-center relative z-10 px-2">Chatea con el taller en tiempo real.</p>
            </button>
          </div>
        )}
      </div>

      <TestWeightWindow
        isOpen={isTestWindowOpen}
        onClose={() => setIsTestWindowOpen(false)}
        rawBuffer={rawBuffer}
        error={error}
        weight={weight}
      />

      <CalibrationTest
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        currentWeight={weight}
      />

      <RepairModule
        isOpen={isRepairOpen}
        onClose={() => setIsRepairOpen(false)}
      />

      <ReportIssueModal
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
      />

      <UserManagementModal
        isOpen={isUserMgmtOpen}
        onClose={() => setIsUserMgmtOpen(false)}
      />

      <InventoryView
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />

      <HistoryView
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <SupportChatCenter
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
      />

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-white/20 text-xs">
        System Status: {isConnected || isSimulating ? "Active" : "Idle"} • Web Serial API • v1.0.0
      </div>
    </div >
  );
}

export default App;
