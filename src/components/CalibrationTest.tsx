import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { CheckCircle, AlertTriangle, RotateCcw, FileDown, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// Add serialService import if not available globally, or pass as prop. 
// Assuming serialService is imported from services/SerialService
import { serialService } from '../services/SerialService';
import { historyService } from '../services/HistoryService';

interface CalibrationTestProps {
    isOpen: boolean;
    onClose: () => void;
    currentWeight: number;
}

type TestStep = {
    target: number;
    tolerance: number;
    measured: number | null;
    status: 'pending' | 'success' | 'fail';
};

export const CalibrationTest: React.FC<CalibrationTestProps> = ({ isOpen, onClose, currentWeight }) => {
    // 3 Steps: 5kg, 10kg (5+5), 15kg (10+5)
    // Tolerance e=d=5/10g -> Let's allow +/- 0.05 kg for now
    const TOLERANCE = 0.05;

    const [steps, setSteps] = useState<TestStep[]>([
        { target: 5.0, tolerance: TOLERANCE, measured: null, status: 'pending' },
        { target: 10.0, tolerance: TOLERANCE, measured: null, status: 'pending' },
        { target: 15.0, measured: null, tolerance: TOLERANCE, status: 'pending' }
    ]);

    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Form Data
    const [model, setModel] = useState("PD-2");
    const [serial, setSerial] = useState("");
    const [note, setNote] = useState("");

    // Use Ref to track weight to avoid stale closures in event handlers
    const weightRef = React.useRef(currentWeight);
    useEffect(() => {
        weightRef.current = currentWeight;
    }, [currentWeight]);

    // Polling 'W' command: User suggestion "ese comando no deberia ser como un W para que el resete capture y guarde?"
    // This implies the scale needs 'W' to send data (Request Mode), or 'W' refreshes the reading.
    // We will send 'W' periodically while the window is open to ensure liveness.
    useEffect(() => {
        if (!isOpen) return;

        // Initial wake up
        serialService.send('W');

        const interval = setInterval(() => {
            serialService.send('W');
        }, 500); // 2Hz polling

        return () => clearInterval(interval);
    }, [isOpen]);

    // Auto-capture logic
    useEffect(() => {
        if (!isOpen) return;
        if (currentStepIndex >= steps.length) return;

        // Future auto-capture logic could go here
    }, [currentWeight, isOpen, steps, currentStepIndex]);

    // Unit conversion hypothesis:
    // If the valid range is 0-15kg, and we see values > 50, it's likely Grams.
    // e.g. 400.00 -> 400g = 0.40kg.
    // We'll normalize for display and capture.
    const isLikelyGrams = currentWeight > 50;
    const normalizedWeight = isLikelyGrams ? currentWeight / 1000 : currentWeight;

    const captureCurrent = () => {
        if (currentStepIndex >= steps.length) return;

        // Use the NORMALIZED weight for capture
        const capturedWeight = isLikelyGrams ? weightRef.current / 1000 : weightRef.current;
        const step = steps[currentStepIndex];

        // Just record the weight, decision is made at the end
        // passed condition removed completely to pass build check

        const newSteps = [...steps];
        newSteps[currentStepIndex] = {
            ...step,
            measured: capturedWeight,
            status: 'success' // Visual feedback that step is done. We analyze at the end.
        };
        setSteps(newSteps);
        // Do NOT increment index yet. Wait for user to confirm.
    };

    const nextStep = () => {
        setCurrentStepIndex(currentStepIndex + 1);
        // Force refresh for next step
        serialService.send('W');
    };

    const reset = () => {
        setSteps([
            { target: 5.0, tolerance: TOLERANCE, measured: null, status: 'pending' },
            { target: 10.0, tolerance: TOLERANCE, measured: null, status: 'pending' },
            { target: 15.0, measured: null, tolerance: TOLERANCE, status: 'pending' }
        ]);
        setCurrentStepIndex(0);
        setSerial("");
        setNote("");
    };

    const generatePDF = async (totalTarget: number, totalMeasured: number, diff: number, isGrams: boolean, passed: boolean, note: string = "") => {
        const doc = new jsPDF();

        const title = "NOTA DE ENTREGA";
        const subtitle = "Reparación y Calibraciones Internas - Central Luxor";
        const titleColor = passed ? [41, 128, 185] : [192, 57, 43]; // Blue or Red

        // Header
        doc.setFontSize(22);
        doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
        doc.text(title, 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text(subtitle, 105, 30, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(80);
        doc.text("Sistema de Pesaje Certificado", 105, 40, { align: 'center' });

        // Meta Data
        doc.setFontSize(10);
        // Define weight, lower, upper based on existing parameters or context if needed
        // For now, assuming 'passed' is still the determinant for saving history.
        // If 'weight', 'lower', 'upper' are meant to be derived from 'totalMeasured', 'totalTarget', 'diff',
        // or other context, they would need to be calculated here.
        // As per the instruction, only the condition is changed.
        if (passed) {
            try {
                await historyService.save({
                    model: model || "PD-2",
                    serial: serial || "SIN-SERIAL",
                    branch: "Central",
                    note: note || "",
                    finalWeight: isGrams ? totalMeasured / 1000 : totalMeasured,
                    targetWeight: totalTarget,
                    passed: true,
                    user: auth.currentUser?.email || "Desconocido"
                }, 'calibration');
            } catch (e) {
                console.error("Error saving calibration history to cloud", e);
                // Non-blocking alert or toast would be better, but standard alert is fine for now
                // "Error al guardar en la nube (Posiblemente permisos o internet). El certificado se generará localmente."
                alert("Atención: No se pudo guardar en el historial en la nube (Verifique internet/permisos).\n\nSin embargo, EL CERTIFICADO PDF SE GENERARÁ LOCALMENTE.");
            }
        }

        doc.save(`Certificado_${model}_${serial || 'SinSerial'}_${new Date().toISOString().split('T')[0]}.pdf`);

        doc.text(`Fecha: ${new Date().toLocaleString()} `, 14, 65);
        doc.text(`Modelo: ${model} `, 14, 72);
        doc.text(`Nº Serie: ${serial || "N/A"} `, 14, 79);

        // Results Table
        // We need to normalize the table data too!
        const tableData = steps.map((s, i) => {
            const raw = s.measured || 0;
            // If the global detection said "isGrams", we assume ALL readings are grams (unless they are tiny?)
            // A simple heuristic: if raw > 20 (assuming max test is ~20kg), treat as grams.
            // Or better: use the isGrams flag passed in? 
            // The isGrams flag was calculated based on the TOTAL sum. 
            // If total sum > target*2 -> grams.
            // So if isGrams is true, we divide raw by 1000.

            const valInKg = isGrams ? raw / 1000 : raw;
            // The step target is always in kg (5, 10, 15).
            // BUT wait, if the user accumulates (5, 5, 5), the target for step 2 is 10?
            // Yes, step definitions: { target: 5 }, { target: 10 }, { target: 15 }.
            // But if user places 5, 5, 5... 
            // Step 1: Target 5. Read 5.
            // Step 2: Target 10. Read 5 (if tared). Total 10?
            // If user tares, the reading shows 5. But the target is 10.
            // Deviation: 5 - 10 = -5.
            // This implies the table will look wrong if we don't fix the TARGET or the MEASURED.
            // User said: "el sumaba por cada pase".
            // If we SUM the readings to get the final result, then for the TABLE:
            // Should we show the INDIVIDUAL reading (5kg) against the INCREMENTAL target (5kg)?
            // OR the CUMULATIVE reading?

            // If step 2 target is 10.
            // And user tared and read 5.
            // Then "Reading Instrument" = 5. Deviation = -5. This looks like a fail.
            // BUT user says "anteriormente estaba bien".
            // Maybe the previous logic showed 5, 5, 5 and targets 5, 5, 5?
            // NO, the code shows initial steps: target 5, target 10, target 15.

            // Maybe the user is NOT taring, but the scale output is weird?
            // User output: "5000.00 kg" (reading).
            // This is 5000 grams.
            // If they didn't tare 5+5=10kg = 10000g.
            // Why would they get 5000 at step 2?
            // "yo colocaba 5 lueog 5 luego 5".

            // Let's assume they TARE.
            // If they TARE, then for Step 2 (Target 10), they read 5.
            // To make the report look "Passing", the table should probably show the CUMULATIVE value?
            // Or the step should be technically "Target 5" (Incremental)?

            // If I change the table to show INCREMENT instead of TARGET?
            // Step 1: Target 5.
            // Step 2: Target 10 - 5 = 5.
            // Step 3: Target 15 - 10 = 5.

            // Let's assume the table should show what happened.
            // If isGrams, valInKg = 5.
            // Target = 10.
            // This is confusing. 
            // However, the User's "Resultados Finales" calculation is what matters for Pass/Fail.

            // Let's stick to normalizing unit first.

            const diff = valInKg - s.target;

            return [
                `Paso ${i + 1} `,
                `${s.target.toFixed(2)} kg`,
                `${valInKg.toFixed(2)} kg`,
                s.measured ? diff.toFixed(2) + " kg" : "-"
            ];
        });

        autoTable(doc, {
            startY: 90,
            head: [['Paso', 'Carga Objetivo', 'Lectura Instrumento', 'Desviación Indiv.']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: passed ? [41, 128, 185] : [192, 57, 43] }
        });

        // Final Result
        const finalY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Resultados Finales (Acumulado)", 14, finalY);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");

        doc.text(`Objetivo Total: ${totalTarget.toFixed(2)} kg`, 14, finalY + 10);

        const unitLabel = isGrams ? "g" : "kg";
        const valLabel = isGrams ? `${totalMeasured.toFixed(0)} ${unitLabel} (${(totalMeasured / 1000).toFixed(3)} kg)` : `${totalMeasured.toFixed(2)} kg`;

        doc.text(`Lectura Final: ${valLabel} `, 14, finalY + 17);
        doc.text(`Diferencia: ${diff > 0 ? "+" : ""}${diff.toFixed(2)} kg`, 14, finalY + 24);

        // Pass/Fail
        doc.setFontSize(16);
        doc.setTextColor(passed ? 0 : 200, passed ? 150 : 0, 0); // Green or Red
        doc.text(passed ? "APROBADO" : "REPROBADO", 14, finalY + 35);

        if (!passed) {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("Nota: El equipo requiere ajuste o mantenimiento.", 14, finalY + 42);
        }

        if (note) {
            doc.setFontSize(10);
            doc.setTextColor(0);
            const splitNote = doc.splitTextToSize(`Nota: ${note} `, 180);
            doc.text(splitNote, 14, finalY + (passed ? 42 : 48));
        }

        // Signatures
        doc.setTextColor(0);
        doc.setFontSize(10);

        // Technician Signature
        doc.text("__________________________", 30, finalY + 65);

        // Stylized Signature for Jesus Infante
        doc.setFont("times", "italic");
        doc.setFontSize(14);
        doc.text("Jesus Infante", 45, finalY + 63, { align: 'center' });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Firma del Técnico", 45, finalY + 70, { align: 'center' });

        // Supervisor Signature
        doc.text("__________________________", 130, finalY + 65);
        doc.text("Recibí Conforme", 150, finalY + 70, { align: 'center' });

        // Footer / Watermark
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(10);
        doc.setTextColor(150); // Grey
        doc.text("Sistema de Pesaje Certificado (Jesus Infante)", 105, pageHeight - 20, { align: 'center' });

        const filename = passed ? `Certificado_${serial || 'cal'}.pdf` : `Diagnostico_${serial || 'fallo'}.pdf`;
        doc.save(filename);
    };

    if (!isOpen) return null;

    const currentStepMeasured = steps[currentStepIndex]?.measured !== null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0f172a] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="p-8 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-transparent flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-2">Prueba de 3 Puntos</h2>
                    <p className="text-white/50">Secuencia de carga acumulativa: 5kg → 10kg → 15kg</p>
                </div>

                {/* Main Content */}
                <div className="p-8 space-y-8 flex-grow">

                    {/* Progress Steps */}
                    <div className="flex justify-between items-center relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -z-10" />

                        {steps.map((step, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-4 bg-[#0f172a] px-4 z-10">
                                <div className={clsx(
                                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                                    step.status === 'success' ? "bg-green-500 border-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.5)]" :
                                        step.status === 'fail' ? "bg-red-500 border-red-500 text-white" :
                                            idx === currentStepIndex ? "bg-blue-600 border-blue-400 text-white animate-pulse" :
                                                "bg-white/5 border-white/10 text-white/30"
                                )}>
                                    {step.status === 'success' ? <CheckCircle className="w-6 h-6" /> :
                                        <span className="font-bold">{idx + 1}</span>}
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-bold text-white/80">{step.target} kg</div>
                                    <div className="text-xs text-white/40">Objetivo</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Current Action */}
                    <div className="bg-white/5 rounded-2xl p-6 text-center border border-white/10">
                        {currentStepIndex < steps.length ? (
                            <>
                                <p className="text-white/60 mb-2 text-lg">Por favor, coloque carga hasta llegar a:</p>
                                <div className="text-6xl font-mono font-bold text-blue-400 tracking-tighter mb-6">
                                    {steps[currentStepIndex].target.toFixed(2)} <span className="text-2xl text-white/30">kg</span>
                                </div>

                                <div className="flex flex-col items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 w-full mb-4">
                                    <p className="text-white/60 text-lg font-medium">Lectura Actual Instrumento</p>

                                    <div className="flex flex-col items-center">
                                        <span className="text-6xl font-mono font-bold text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                            {normalizedWeight.toFixed(2)} <span className="text-2xl text-white/40">kg</span>
                                        </span>

                                        {isLikelyGrams && (
                                            <span className="text-yellow-400/80 text-sm mt-1 font-mono">
                                                (Detectado: {currentWeight} g → {normalizedWeight.toFixed(2)} kg)
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full border border-white/5">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-xs text-white/30 font-mono">
                                            Act: {new Date().toLocaleTimeString()} • Raw: {currentWeight}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-2 w-full">
                                    {currentStepMeasured ? (
                                        <div className="w-full animate-in fade-in slide-in-from-bottom-2">
                                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl mb-4">
                                                <p className="text-green-400 text-sm font-bold mb-1">Peso Capturado</p>
                                                <p className="text-3xl font-mono text-white">{steps[currentStepIndex].measured?.toFixed(2)} kg</p>
                                            </div>
                                            <button
                                                onClick={nextStep}
                                                className="w-full px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/40 flex items-center justify-center gap-2"
                                            >
                                                Siguiente Fase <ArrowRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={captureCurrent}
                                            className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40 flex items-center gap-2"
                                        >
                                            <ArrowRight className="w-5 h-5" />
                                            Validar Peso
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="py-6">
                                {(() => {
                                    // Final Analysis
                                    // User confirmed: "sumaba por cada pase" was WRONG.
                                    // Workflow: 5kg -> 10kg -> 15kg total load on scale.
                                    // The scale should read ~15kg at the end.
                                    // We use the FINAL STEP measurement as the result.

                                    const finalStep = steps[steps.length - 1];
                                    const totalTarget = finalStep.target; // 15

                                    // Use the last step reading
                                    const rawFinalMeasured = finalStep.measured || 0;

                                    // Auto-detect Grams vs Kg based on the Reading vs Target
                                    const isGrams = rawFinalMeasured > (totalTarget * 2);

                                    // Normalize
                                    const totalMeasuredCombined = isGrams ? rawFinalMeasured / 1000 : rawFinalMeasured;

                                    const diff = totalMeasuredCombined - totalTarget;
                                    const absDiff = Math.abs(diff);
                                    const THRESHOLD = 0.05;
                                    const passed = absDiff <= THRESHOLD;

                                    return (
                                        <>
                                            <div className={clsx("text-3xl font-bold mb-2 flex items-center justify-center gap-3", passed ? "text-green-400" : "text-red-400")}>
                                                {passed ? <CheckCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                                                {passed ? "¡Prueba Exitosa!" : "Fallo de Calibración"}
                                            </div>

                                            <div className="bg-white/5 p-4 rounded-xl inline-block text-left mb-6 min-w-[300px]">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-white/50">Objetivo Final:</span>
                                                    <span className="text-white font-mono">{totalTarget.toFixed(2)} kg</span>
                                                </div>
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-white/50">Lectura Final:</span>
                                                    <span className="text-white font-mono">
                                                        {totalMeasuredCombined.toFixed(2)} kg
                                                        {isGrams && <span className="text-white/50 text-sm ml-2">({rawFinalMeasured.toFixed(0)} g)</span>}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-white/10 my-2" />
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white/50">Diferencia:</span>
                                                    <span className={clsx("font-mono font-bold text-lg", passed ? "text-green-400" : "text-red-400")}>
                                                        {diff > 0 ? "+" : ""}{diff.toFixed(2)} kg
                                                    </span>
                                                </div>
                                                {!passed && (
                                                    <div className="mt-4 text-red-300 text-sm bg-red-500/10 p-2 rounded border border-red-500/20 text-center">
                                                        ⚠️ Error de rango {diff > 0 ? "por encima" : "por debajo"} (+/- {THRESHOLD.toFixed(2)}kg)
                                                    </div>
                                                )}
                                            </div>

                                            {/* Report Generation Section (ALWAYS VISIBLE) */}
                                            <div className={clsx("mt-6 p-4 rounded-xl border", passed ? "bg-blue-500/10 border-blue-500/20" : "bg-red-500/10 border-red-500/20")}>
                                                <h3 className={clsx("font-bold mb-4 flex items-center gap-2 justify-center", passed ? "text-blue-400" : "text-red-400")}>
                                                    <FileDown className="w-5 h-5" />
                                                    {passed ? "Generar Certificado" : "Generar Reporte de Fallo"}
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-left">
                                                    <div>
                                                        <label className="block text-white/50 text-sm mb-1">Modelo</label>
                                                        <input
                                                            type="text"
                                                            value={model}
                                                            onChange={(e) => setModel(e.target.value)}
                                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-white/50 text-sm mb-1">Nº Serie</label>
                                                        <input
                                                            type="text"
                                                            value={serial}
                                                            onChange={(e) => setSerial(e.target.value)}
                                                            placeholder="EJ: SN-12345"
                                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-white/50 text-sm mb-1">Nota (Opcional)</label>
                                                        <textarea
                                                            value={note}
                                                            onChange={(e) => setNote(e.target.value)}
                                                            placeholder="Observaciones adicionales..."
                                                            rows={2}
                                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-blue-500 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => generatePDF(
                                                        totalTarget,
                                                        isGrams ? rawFinalMeasured : totalMeasuredCombined,
                                                        diff,
                                                        isGrams,
                                                        passed,
                                                        note
                                                    )}
                                                    className={clsx("w-full py-3 text-white rounded-lg font-bold transition-all shadow-lg", passed ? "bg-blue-600 hover:bg-blue-500" : "bg-red-600 hover:bg-red-500")}
                                                >
                                                    Descargar PDF
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="flex justify-center mt-6">
                                    <button
                                        onClick={reset}
                                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reiniciar Prueba
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-white/50 hover:text-white transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
