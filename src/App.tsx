import { useState, useEffect, useRef } from 'react';
import { useScale } from './hooks/useScale';
import { Scoreboard } from './components/Scoreboard';
import { TestWeightWindow } from './components/TestWeightWindow';
import { CalibrationTest } from './components/CalibrationTest';
import { HistoryView } from './components/HistoryView';
import { ReportIssueModal } from './components/ReportIssueModal';
import { RepairModule } from './components/RepairModule';
import { Zap, Beaker, LayoutDashboard, ClipboardCheck, History, Wrench, LogOut, AlertTriangle, Shield, Users } from 'lucide-react';
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
  const { role, isAdmin, loading: roleLoading } = useAuthRole(user); // RBAC

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
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false); // New Modal State
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
          {isAdmin && (
            <>
              {!isConnected && !isSimulating ? (
                <button
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 font-bold text-lg"
                >
                  <Zap className={clsx("w-5 h-5", isConnecting && "animate-pulse")} />
                  {isConnecting ? "CONECTANDO..." : "CONECTAR BALANZA"}
                </button>
              ) : (
                <button
                  onClick={isConnected ? disconnect : () => setIsSimulating(false)}
                  className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 rounded-xl transition-all duration-300 font-bold text-lg"
                >
                  {isConnected ? "DESCONECTAR" : "DETENER SIMULACIÓN"}
                </button>
              )}

              <button
                onClick={() => serialService.send('W')}
                className="px-6 py-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-yellow-900/20"
              >
                <Zap className="w-5 h-5" />
                RESET (W)
              </button>

              <button
                onClick={() => setIsTestWindowOpen(true)}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="w-5 h-5" />
                MONITOR SERIAL
              </button>

              <button
                onClick={() => setIsRepairOpen(true)}
                className="px-6 py-4 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/50 text-orange-300 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-orange-900/20"
              >
                <Wrench className="w-5 h-5" />
                PROCESOS MANUALES
              </button>
            </>
          )}

          {/* Available to All Users (Standard & Admin) */}
          <button
            onClick={() => setIsIssueOpen(true)}
            className="px-6 py-4 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-red-900/20"
          >
            <AlertTriangle className="w-5 h-5" />
            REPORTAR AVERÍA
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="col-span-1 md:col-span-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2"
          >
            <History className="w-5 h-5" />
            HISTORIAL DE OPERACIONES
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => {
                  serialService.send('W');
                  setIsCalibrationOpen(true);
                }}
                className="col-span-1 md:col-span-2 px-6 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-900/20"
              >
                <ClipboardCheck className="w-5 h-5" />
                PRUEBA DE 3 PUNTOS
              </button>

              <button
                onClick={() => setIsUserMgmtOpen(true)}
                className="col-span-1 md:col-span-2 px-6 py-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-900/20"
              >
                <Shield className="w-5 h-5" />
                GESTIÓN DE USUARIOS
              </button>
            </>
          )}
        </div>

        {/* Simulation Toggle (Dev Tool) */}
        {!isConnected && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={clsx(
                "text-xs flex items-center gap-2 px-3 py-1 rounded-full border transition-all",
                isSimulating
                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                  : "bg-white/5 border-white/10 text-white/30 hover:text-white/50"
              )}
            >
              <Beaker className="w-3 h-3" />
              {isSimulating ? "MODO SIMULACIÓN ACTIVO" : "Simular Datos"}
            </button>
          </div>
        )}

      </div>

      <TestWeightWindow
        isOpen={isTestWindowOpen}
        onClose={() => setIsTestWindowOpen(false)}
        rawBuffer={rawBuffer}
        lastReceived={lastReceived}
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
