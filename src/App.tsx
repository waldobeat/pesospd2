import { useState, useEffect, useRef } from 'react';
import { useScale } from './hooks/useScale';
import { Scoreboard } from './components/Scoreboard';
import { TestWeightWindow } from './components/TestWeightWindow';
import { CalibrationTest } from './components/CalibrationTest';
import { HistoryView } from './components/HistoryView';
import { RepairModule } from './components/RepairModule';
import { Login } from './components/Login'; // Import Login
import { Zap, Beaker, LayoutDashboard, ClipboardCheck, History, Wrench, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { serialService } from './services/SerialService';
import { auth } from './firebase'; // Import auth
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const {
    weight, unit, isStable, isZero, isNet, isConnected, isConnecting, error,
    lastReceived, rawBuffer, connect, disconnect
  } = useScale();


  const [isTestWindowOpen, setIsTestWindowOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

      {/* Main Container */}
      <div className="w-full max-w-4xl z-10 flex flex-col gap-8">

        {/* Title */}
        <div className="text-center space-y-2 relative">
          <button
            onClick={() => signOut(auth)}
            className="absolute right-0 top-0 p-2 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter bg-gradient-to-r from-blue-100 to-blue-400/50 bg-clip-text text-transparent">
            Sistema de Pesaje Certificado Empresarial (SISDEPE)
          </h1>
          <p className="text-white/40 font-medium">Marca no comercial programada por Jesus Infante</p>
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

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="col-span-1 md:col-span-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2"
          >
            <History className="w-5 h-5" />
            HISTORIAL DE OPERACIONES
          </button>

          <button
            onClick={() => {
              serialService.send('W'); // Ensure scale is awake before starting
              setIsCalibrationOpen(true);
            }}
            className="col-span-1 md:col-span-2 px-6 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-xl transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-900/20"
          >
            <ClipboardCheck className="w-5 h-5" />
            PRUEBA DE 3 PUNTOS
          </button>
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
