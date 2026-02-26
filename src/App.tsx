import React, { useState, useEffect, useRef } from 'react';
import { useScale } from './hooks/useScale';
import { Scoreboard } from './components/Scoreboard';
import { TestWeightWindow } from './components/TestWeightWindow';
import { CalibrationTest } from './components/CalibrationTest';
import { HistoryView } from './components/HistoryView';
import { ReportIssueModal } from './components/ReportIssueModal';
import { RepairModule } from './components/RepairModule';
import { Zap, Activity, LayoutDashboard, ClipboardCheck, History, Wrench, LogOut, AlertTriangle, Shield, Users, Box, Megaphone, RotateCcw, Scale } from 'lucide-react';
import clsx from 'clsx';
import { serialService } from './services/SerialService';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Login } from './components/Login';
import { InventoryModal } from './components/InventoryModal';
import { InventoryListView } from './components/InventoryListView';
import { GlobalNotifications } from './components/GlobalNotifications';
import { BroadcastModal } from './components/BroadcastModal';
import { UserManagementModal } from './components/UserManagementModal';
import { useAuthRole } from './hooks/useAuthRole';

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isAdmin } = useAuthRole(user);
  const isWorkshop = user?.email?.split('@')[0].toLowerCase() === 'taller';
  const canAccessTechnicianUI = isAdmin || isWorkshop;

  const {
    weight, unit, isStable, isZero, isNet, isConnected, isConnecting, error,
    lastReceived, rawBuffer, connect, disconnect
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
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isInventoryListOpen, setIsInventoryListOpen] = useState(false);
  const isMaster = isAdmin || isWorkshop;
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const simInterval = useRef<number | null>(null);

  // Simulation Logic
  useEffect(() => {
    if (isSimulating) {
      let simWeight = 0;
      simInterval.current = window.setInterval(() => {
        simWeight += 0.1;
        if (simWeight > 20) simWeight = 0;
        const wStr = simWeight.toFixed(2);
        const frame = `\x02${wStr}\r`;
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
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col items-center p-4 relative overflow-x-hidden" translate="no">

      {/* Header */}
      <header className="w-full max-w-5xl h-16 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 z-50 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">SISDEPE</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Sistema de Pesaje</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-red-400 transition-colors flex items-center gap-2"
            title="Cerrar Sesión"
          >
            <span className="text-xs font-bold hidden md:block uppercase tracking-widest">SALIR</span>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-5xl z-10 flex flex-col gap-6 md:gap-8 px-4 pt-10 pb-10">

        <p className="text-white/40 text-sm italic uppercase tracking-widest font-black">Empresarial (SISDEPE)</p>

        {/* Scoreboard */}
        <Scoreboard
          weight={weight}
          unit={unit}
          isStable={isStable}
          isZero={isZero}
          isNet={isNet}
          isConnected={isConnected || isSimulating}
          error={error}
        />

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl mx-auto">
          {canAccessTechnicianUI && (
            <>
              {!isConnected && !isSimulating ? (
                <button
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all duration-300 flex items-center justify-center gap-2 font-black tracking-widest"
                >
                  <Zap className={clsx("w-5 h-5", isConnecting && "animate-pulse")} />
                  {isConnecting ? "CONECTANDO..." : "CONECTAR BALANZA"}
                </button>
              ) : (
                <button
                  onClick={isConnected ? disconnect : () => setIsSimulating(false)}
                  className="px-6 py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-500 rounded-xl transition-all duration-300 font-black tracking-widest"
                >
                  {isConnected ? "DESCONECTAR" : "DETENER SIMULACIÓN"}
                </button>
              )}

              <button
                onClick={() => serialService.send('W')}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <RotateCcw className="w-5 h-5" />
                RESET (W)
              </button>

              <button
                onClick={() => setIsTestWindowOpen(true)}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <LayoutDashboard className="w-5 h-5" />
                MONITOR SERIAL
              </button>

              <button
                onClick={() => setIsRepairOpen(true)}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Wrench className="w-5 h-5" />
                PROCESOS MANUALES
              </button>
            </>
          )}

          <button
            onClick={() => setIsInventoryOpen(true)}
            className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <Box className="w-5 h-5" />
            REGISTRO DE NUEVO EQUIPO
          </button>

          <button
            onClick={() => setIsInventoryListOpen(true)}
            className="px-6 py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <Box className="w-5 h-5" />
            BASE DE INVENTARIO
          </button>

          {isMaster && (
            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="px-6 py-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Megaphone className="w-5 h-5" />
              ENVIAR ANUNCIO
            </button>
          )}

          <button
            onClick={() => setIsIssueOpen(true)}
            className="px-6 py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <AlertTriangle className="w-5 h-5" />
            REPORTAR AVERÍA
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="col-span-1 md:col-span-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <History className="w-5 h-5" />
            HISTORIAL DE OPERACIONES
          </button>

          {canAccessTechnicianUI && (
            <>
              <button
                onClick={() => {
                  serialService.send('W');
                  setIsCalibrationOpen(true);
                }}
                className="col-span-1 md:col-span-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <ClipboardCheck className="w-5 h-5" />
                PRUEBA DE 3 PUNTOS
              </button>

              <button
                onClick={() => setIsUserMgmtOpen(true)}
                className="col-span-1 md:col-span-2 px-6 py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Shield className="w-5 h-5" />
                GESTIÓN DE USUARIOS
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <TestWeightWindow isOpen={isTestWindowOpen} onClose={() => setIsTestWindowOpen(false)} rawBuffer={rawBuffer} lastReceived={lastReceived} error={error} weight={weight} />
      <CalibrationTest isOpen={isCalibrationOpen} onClose={() => setIsCalibrationOpen(false)} currentWeight={weight} />
      <RepairModule isOpen={isRepairOpen} onClose={() => setIsRepairOpen(false)} />
      <ReportIssueModal isOpen={isIssueOpen} onClose={() => setIsIssueOpen(false)} />
      <UserManagementModal isOpen={isUserMgmtOpen} onClose={() => setIsUserMgmtOpen(false)} />
      <HistoryView isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <InventoryModal isOpen={isInventoryOpen} onClose={() => setIsInventoryOpen(false)} user={user} />
      <InventoryListView isOpen={isInventoryListOpen} onClose={() => setIsInventoryListOpen(false)} user={user} />
      <GlobalNotifications user={user} isMaster={isMaster} />
      {isMaster && <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} />}

      {/* Footer */}
      <footer className="w-full max-w-5xl py-6 text-center text-white/20 text-[10px] uppercase tracking-[0.2em] font-black">
        Estado del Sistema: {isConnected || isSimulating ? "Activo" : "En Espera"} • Web Serial API • v1.1.0-ESTABLE
      </footer>
    </div >
  );
}

export default App;
