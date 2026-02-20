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
import { AlertTriangle, Shield, Zap, LayoutDashboard, ClipboardCheck, History, Wrench, LogOut, Box } from 'lucide-react';
import clsx from 'clsx';
import { serialService } from './services/SerialService';
import { auth } from './firebase'; // Import auth
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Login } from './components/Login';

import { UserManagementModal } from './components/UserManagementModal';
import { useAuthRole } from './hooks/useAuthRole'; // Hook Integration

// ... other imports

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
  const simInterval = useRef<number | null>(null);

  // Simulation Logic
  useEffect(() => {
    if (isSimulating) {
      let simWeight = 0;
      simInterval.current = window.setInterval(() => {
        simWeight += 0.1;
        if (simWeight > 20) simWeight = 0;
        // Frame: <STX>12.34<CR> or <STX>?<STATUS><CR> random error

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
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointing-events-none select-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full pointing-events-none select-none" />

      {/* Fixed Professional Header */}
      <header className="fixed top-0 left-0 w-full h-16 bg-black/80 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-4 md:px-8 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* Small Logo for Header */}
          <div className="w-10 h-10 relative group cursor-pointer">
            <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full group-hover:bg-blue-500/30 transition-all"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
              <div className="w-6 h-6 border-2 border-blue-500/30 rounded-full flex items-center justify-center relative">
                <div className="absolute w-0.5 h-2 bg-orange-500 top-0.5 rounded-full origin-bottom animate-pulse"></div>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-white leading-none">
              SISDEPE
            </h1>
            <p className="text-[10px] md:text-xs text-blue-200/60 font-medium tracking-wide uppercase hidden md:block">
              Sistema de Pesaje Certificado Empresarial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-xs font-bold text-white/50">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-red-400 transition-colors flex items-center gap-2"
            title="Cerrar Sesión"
          >
            <span className="text-xs font-bold hidden md:block">SALIR</span>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container - Added pt-24 for header spacing */}
      <div className="w-full max-w-5xl z-10 flex flex-col gap-6 md:gap-8 px-4 pt-24 pb-10">

        {/* Hero / Welcome Section (Mobile Only or Compact) */}
        <div className="text-center md:hidden space-y-2">
          <h2 className="text-2xl font-bold text-white">Sistema de Pesaje Certificado</h2>
          <p className="text-white/40 text-sm">Empresarial (SISDEPE)</p>
        </div>

        {/* User Notifications Auto-Modal */}
        <UserNotificationsModal isAdmin={isAdmin} />

        {/* Scoreboard - ONLY VISIBLE TO ADMINS */}
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

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto mt-4 px-2">
          {isAdmin && (
            <>
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
            </>
          )}

          {/* Available to All Users (Standard & Admin) */}
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

          {isAdmin && (
            <>
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
            </>
          )}
        </div>



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

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-white/20 text-xs">
        System Status: {isConnected || isSimulating ? "Active" : "Idle"} • Web Serial API • v1.0.0
      </div>
    </div>
  );
}

export default App;
