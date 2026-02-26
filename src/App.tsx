import { useState, useEffect, useRef } from 'react';
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
import { auth } from './firebase'; // Import auth
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Login } from './components/Login';
import { InventoryModal } from './components/InventoryModal';
import { InventoryListView } from './components/InventoryListView';
import { GlobalNotifications } from './components/GlobalNotifications';
import { BroadcastModal } from './components/BroadcastModal';
import { UserManagementModal } from './components/UserManagementModal';
import { useAuthRole } from './hooks/useAuthRole'; // Hook Integration

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { role, isAdmin, loading: roleLoading } = useAuthRole(user); // RBAC
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
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false); // New Modal State
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">

      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="fixed top-0 inset-x-0 h-20 bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto h-full px-6 md:px-10 flex items-center justify-between">

          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute -inset-2 bg-cyan-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <div className="relative w-12 h-12 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent" />
                <Scale className="w-6 h-6 text-cyan-400" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none text-white">SISDEPE</span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500 mt-1">Centro de Pesaje Certificado</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-8 mr-6 border-r border-white/5 pr-8">
              <StatusIndicator label="Balanza" active={isConnected} color="cyan" />
              <StatusIndicator label="Seguridad" active={isAdmin} color="blue" />
            </div>

            <button
              onClick={() => signOut(auth)}
              className="group relative px-5 py-2.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all duration-300 flex items-center gap-3"
            >
              <span className="text-xs font-black tracking-widest text-red-400 group-hover:text-red-300">SALIDA_SISTEMA</span>
              <LogOut className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-20">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Left Column: Display */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">
            <Scoreboard
              weight={weight}
              unit={unit}
              isStable={isStable}
              isZero={isZero}
              isNet={isNet}
              isConnected={isConnected || isSimulating}
              error={error}
            />
          </div>

          {/* Right Column / Bottom Grid: Controls */}
          <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6">

            <div className="p-1px rounded-3xl bg-gradient-to-br from-white/10 to-transparent shadow-2xl">
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-[23px] p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Controles Maestros</h3>
                  <Zap className="w-4 h-4 text-cyan-500/50" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {canAccessTechnicianUI && (
                    <>
                      {!isConnected && !isSimulating ? (
                        <ActionButton
                          onClick={() => connect()}
                          icon={Zap}
                          label="Inicializar Balanza"
                          variant="primary"
                          loading={isConnecting}
                        />
                      ) : (
                        <ActionButton
                          onClick={isConnected ? disconnect : () => setIsSimulating(false)}
                          icon={LogOut}
                          label={isConnected ? "Apagar Sistema" : "Parar Simulación"}
                          variant="danger"
                        />
                      )}

                      <ActionButton
                        onClick={() => serialService.send('W')}
                        icon={RotateCcw}
                        label="Reinicio Forzado (W)"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ActionCard
                onClick={() => setIsInventoryOpen(true)}
                icon={Box}
                label="Registrar Equipo"
                sub="Registro"
              />
              <ActionCard
                onClick={() => setIsInventoryListOpen(true)}
                icon={ClipboardCheck}
                label="Base de Datos"
                sub="Inventario"
                highlight
              />
              <ActionCard
                onClick={() => setIsIssueOpen(true)}
                icon={AlertTriangle}
                label="Falla"
                sub="Reportar"
                variant="danger"
              />
              <ActionCard
                onClick={() => setIsHistoryOpen(true)}
                icon={History}
                label="Historial"
                sub="Archivos"
              />
            </div>

            {canAccessTechnicianUI && (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    serialService.send('W');
                    setIsCalibrationOpen(true);
                  }}
                  className="w-full group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-white/5 hover:border-cyan-500/30 transition-all duration-500"
                >
                  <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                        <ClipboardCheck className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-black text-white tracking-wide">Calibración 3-Puntos</span>
                        <span className="block text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Verificación de Hardware</span>
                      </div>
                    </div>
                    <Box className="w-5 h-5 text-slate-700 group-hover:text-cyan-500/50 transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => setIsUserMgmtOpen(true)}
                  className="w-full group p-6 rounded-3xl bg-slate-900 border border-white/5 hover:border-blue-500/30 transition-all duration-500 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-black text-white tracking-wide">Gestión de Usuarios</span>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Control de Acceso RBAC</span>
                    </div>
                  </div>
                  <Users className="w-5 h-5 text-slate-700 group-hover:text-blue-500/50 transition-colors" />
                </button>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* Modals Mounting Points - Keeping for Logic */}
      <TestWeightWindow isOpen={isTestWindowOpen} onClose={() => setIsTestWindowOpen(false)} rawBuffer={rawBuffer} lastReceived={lastReceived} error={error} weight={weight} />
      <CalibrationTest isOpen={isCalibrationOpen} onClose={() => setIsCalibrationOpen(false)} currentWeight={weight} />
      <RepairModule isOpen={isRepairOpen} onClose={() => setIsRepairOpen(false)} />
      <ReportIssueModal isOpen={isIssueOpen} onClose={() => setIsIssueOpen(false)} />
      <UserManagementModal isOpen={isUserMgmtOpen} onClose={() => setIsUserMgmtOpen(false)} />
      <HistoryView isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <InventoryModal isOpen={isInventoryOpen} onClose={() => setIsInventoryOpen(false)} user={user} />
      <InventoryListView isOpen={isInventoryListOpen} onClose={() => setIsInventoryListOpen(false)} user={user} />

      {/* Global Notifications — covers issue reports AND transfers */}
      <GlobalNotifications
        user={user}
        isMaster={isMaster}
      />

      {/* Broadcast Modal — master-only announcement composer */}
      {isMaster && (
        <BroadcastModal
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
        />
      )}

      {/* System Status Footer */}
      <footer className="fixed bottom-0 inset-x-0 h-10 bg-slate-950/80 backdrop-blur-md border-t border-white/5 z-40 flex items-center px-10">
        <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
          <div className="flex items-center gap-2">
            <div className={clsx("w-1.5 h-1.5 rounded-full", (isConnected || isSimulating) ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" : "bg-slate-700")} />
            Sistema {(isConnected || isSimulating) ? "Activo" : "Listo"}
          </div>
          <span className="w-1 h-1 bg-slate-800 rounded-full" />
          <span>Web Serial / TLS 1.3</span>
          <span className="w-1 h-1 bg-slate-800 rounded-full" />
          <span>v2.0.Titanio</span>
        </div>
      </footer>

    </div >
  );
}

const StatusIndicator = ({ label, active, color }: { label: string, active: boolean, color: 'cyan' | 'blue' }) => (
  <div className="flex flex-col items-end gap-1">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</span>
    <div className="flex items-center gap-2">
      <span className={clsx("text-xs font-bold", active ? "text-white" : "text-slate-500")}>{active ? "HABILITADO" : "PROTEGIDO"}</span>
      <div className={clsx(
        "w-2 h-2 rounded-full",
        active
          ? (color === 'cyan' ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]')
          : "bg-slate-800"
      )} />
    </div>
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label, variant = 'secondary', loading }: any) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={clsx(
      "relative h-14 px-6 rounded-2xl font-black text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 group overflow-hidden",
      variant === 'primary' && "bg-cyan-500 text-slate-950 hover:bg-cyan-400 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]",
      variant === 'secondary' && "bg-slate-800 text-white hover:bg-slate-700 border border-white/5",
      variant === 'danger' && "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30"
    )}
  >
    {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
    {label}
  </button>
);

const ActionCard = ({ onClick, icon: Icon, label, sub, variant = 'neutral', highlight }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "group relative flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all duration-500 overflow-hidden",
      variant === 'danger'
        ? "bg-red-500/5 border-red-500/10 hover:border-red-500/40"
        : highlight
          ? "bg-cyan-500/5 border-cyan-500/10 hover:border-cyan-500/40"
          : "bg-slate-900 border-white/5 hover:border-white/20"
    )}
  >
    <div className={clsx(
      "p-3 rounded-2xl transition-all duration-500 group-hover:scale-110",
      variant === 'danger' ? "bg-red-500/10 text-red-400" : highlight ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-800 text-slate-400"
    )}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="text-center">
      <span className="block text-[11px] font-black tracking-widest text-white uppercase">{label}</span>
      <span className="block text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase mt-1 italic">{sub}</span>
    </div>
  </button>
);

export default App;
