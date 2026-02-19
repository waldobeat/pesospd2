import React, { useState } from 'react';
import { Wrench, FileDown, X, Check, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import { historyService } from '../services/HistoryService';

interface RepairModuleProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RepairModule: React.FC<RepairModuleProps> = ({ isOpen, onClose }) => {
    // Form State
    const [model, setModel] = useState("PD-2");
    const [serial, setSerial] = useState("");
    const [branch, setBranch] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [solution, setSolution] = useState("");
    const [note, setNote] = useState("");
    const [repaired, setRepaired] = useState(true);

    const resetForm = () => {
        setModel("PD-2");
        setSerial("");
        setBranch("");
        setDiagnosis("");
        setSolution("");
        setNote("");
        setRepaired(true);
    };

    const handleSaveAndGenerate = async () => {
        if (!serial || !diagnosis || !solution) {
            alert("Por favor complete los campos obligatorios (Serial, Diagnóstico, Solución)");
            return;
        }

        try {
            // 1. Save to History (Async)
            await historyService.save({
                model,
                serial,
                branch,
                diagnosis,
                solution,
                note,
                repaired
            }, 'repair');

            // 2. Generate PDF
            generatePDF();

            if (confirm("Registro guardado y PDF generado. ¿Desea cerrar el módulo?")) {
                onClose();
                resetForm();
            } else {
                resetForm();
            }
        } catch (error) {
            console.error(error);
            alert("Error al guardar en la nube.");
        }
    };

    const generatePDF = () => {
        // A4 Portrait: 210 x 297 mm
        const doc = new jsPDF();

        const renderReport = (startY: number, typeLabel: string) => {
            const pageHeight = 148.5; // Half of A4
            const pageWidth = 210;
            const centerX = pageWidth / 2;

            // Border
            // Color based on status
            const titleColor = repaired ? [41, 128, 185] : [192, 57, 43]; // Blue or Red

            doc.setDrawColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.setLineWidth(1);
            doc.rect(5, startY + 5, pageWidth - 10, pageHeight - 10);

            // Watermark (Original / Copia)
            doc.setTextColor(230);
            doc.setFontSize(50);
            doc.setFont("helvetica", "bold");
            // Rotate? No, jsPDF simpler without rotation plugin sometimes. 
            // Text plain center.
            doc.text(typeLabel.split(" - ")[0], centerX, startY + (pageHeight / 2), { align: 'center', baseline: 'middle' });

            // Title
            doc.setFontSize(16);
            doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.text("REPORTE TÉCNICO", centerX, startY + 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.setFont("helvetica", "normal");
            doc.text("Servicio Técnico - Central Luxor", centerX, startY + 20, { align: 'center' });

            // Label: Original/Copia
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.setFont("helvetica", "bold");
            doc.setFillColor(240);
            doc.rect(pageWidth - 45, startY + 5, 40, 6, 'F');
            doc.setTextColor(80);
            doc.text(typeLabel, pageWidth - 25, startY + 9, { align: 'center' });


            // Date
            doc.setFontSize(8);
            doc.setTextColor(60);
            const dateStr = new Date().toLocaleDateString();
            const timeStr = new Date().toLocaleTimeString();
            doc.text(`Fecha: ${dateStr} - ${timeStr}`, pageWidth - 10, startY + 20, { align: 'right' });

            // Status Banner
            doc.setFillColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.rect(6, startY + 25, pageWidth - 12, 7, 'F');
            doc.setTextColor(255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(repaired ? "ESTADO: REPARADO / OPERATIVO" : "ESTADO: PENDIENTE / NO REPARADO", centerX, startY + 29.5, { align: 'center' });

            // Info Grid
            doc.setTextColor(0);
            doc.setFontSize(9);

            const infoY = startY + 38;
            doc.text(`Modelo: ${model}`, 10, infoY);
            doc.text(`Nº Serie: ${serial}`, 80, infoY);

            if (branch) {
                doc.text(`Sucursal: ${branch}`, 150, infoY);
            } else {
                doc.setTextColor(150);
                doc.text("Sucursal: N/A", 150, infoY);
                doc.setTextColor(0);
            }

            doc.setDrawColor(200);
            doc.line(10, infoY + 3, pageWidth - 10, infoY + 3); // HR

            // Details
            let yPos = infoY + 8;

            const addSection = (label: string, content: string) => {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0);
                doc.setFontSize(9);
                doc.text(label, 10, yPos);

                yPos += 4;

                doc.setFont("helvetica", "normal");
                doc.setTextColor(50);
                doc.setFontSize(9);
                const splitContent = doc.splitTextToSize(content, 190);
                doc.text(splitContent, 10, yPos);
                yPos += (splitContent.length * 4) + 2;
            };

            addSection("Diagnóstico:", diagnosis);
            addSection("Solución:", solution);

            if (note) {
                addSection("Nota:", note);
            }

            // Label Box
            const boxY = startY + pageHeight - 38;
            const boxHeight = 25;

            doc.setDrawColor(200);
            doc.setLineWidth(0.5);
            (doc as any).setLineDash([2, 2], 0);
            doc.rect(centerX - 40, boxY, 80, boxHeight);
            (doc as any).setLineDash([], 0);

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("ETIQUETA DE CONTROL", centerX, boxY + (boxHeight / 2) + 1, { align: 'center' });

            // Signatures
            const signatureY = startY + pageHeight - 20;

            doc.setTextColor(0);
            doc.setFontSize(8);

            // Technician
            doc.line(20, signatureY, 70, signatureY);
            doc.setFont("times", "italic");
            doc.setFontSize(10);
            doc.text("Jesus Infante", 45, signatureY - 2, { align: 'center' });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text("Firma del Técnico", 45, signatureY + 4, { align: 'center' });

            // Client
            doc.line(pageWidth - 70, signatureY, pageWidth - 20, signatureY);
            doc.text("Recibí Conforme", pageWidth - 45, signatureY + 4, { align: 'center' });

            // Footer
            doc.setFontSize(7);
            doc.setTextColor(180);
            doc.text("SISDEPE - Reporte generado el " + new Date().toLocaleDateString(), centerX, startY + pageHeight - 6, { align: 'center' });
        };

        // Render Original (Top)
        renderReport(0, "ORIGINAL - CLIENTE");

        // Cut Line
        doc.setDrawColor(100);
        doc.setLineWidth(0.5);
        (doc as any).setLineDash([5, 5], 0);
        doc.line(0, 148.5, 210, 148.5);
        (doc as any).setLineDash([], 0);

        // Scissors Icon (Simulated with text for now, or X char)
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("- - - - - - - - CORTAR AQUÍ - - - - - - - - -", 105, 148.5, { align: 'center', baseline: 'middle' });

        // Render Copy (Bottom)
        renderReport(148.5, "COPIA - ARCHIVO");

        doc.save(`Reporte_Doble_${model}_${serial}.pdf`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-orange-900/20 to-transparent">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Wrench className="w-6 h-6 text-orange-400" />
                            Registro de Reparación Manual
                        </h2>
                        <p className="text-white/40 text-sm mt-1">
                            Generar informe técnico y guardar en historial
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-white/50 text-sm mb-2 font-bold">Modelo del Equipo</label>
                            <input
                                type="text"
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-white/50 text-sm mb-2 font-bold">Número de Serie <span className="text-orange-500">*</span></label>
                            <input
                                type="text"
                                value={serial}
                                onChange={e => setSerial(e.target.value)}
                                placeholder="EJ: SN-MANUAL-001"
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-white/50 text-sm mb-2 font-bold">Sucursal / Ubicación (Opcional)</label>
                            <input
                                type="text"
                                value={branch}
                                onChange={e => setBranch(e.target.value)}
                                placeholder="EJ: Sucursal Centro / Laboratorio"
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-white/50 text-sm mb-2 font-bold">Diagnóstico Técnico <span className="text-orange-500">*</span></label>
                        <textarea
                            value={diagnosis}
                            onChange={e => setDiagnosis(e.target.value)}
                            placeholder="Describa la falla encontrada..."
                            rows={3}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-white/50 text-sm mb-2 font-bold">Solución / Procedimiento <span className="text-orange-500">*</span></label>
                        <textarea
                            value={solution}
                            onChange={e => setSolution(e.target.value)}
                            placeholder="Describa el trabajo realizado y piezas reemplazadas..."
                            rows={3}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-white/50 text-sm mb-2 font-bold">Notas Adicionales (Opcional)</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Observaciones extra, recomendaciones..."
                            rows={2}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Status Toggle */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                        <span className="text-white font-bold">Estado Final del Equipo</span>
                        <div className="flex bg-black/40 rounded-lg p-1">
                            <button
                                onClick={() => setRepaired(true)}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                                    repaired ? "bg-green-600 text-white shadow-lg" : "text-white/30 hover:text-white"
                                )}
                            >
                                <Check className="w-4 h-4" /> Reparado
                            </button>
                            <button
                                onClick={() => setRepaired(false)}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                                    !repaired ? "bg-red-600 text-white shadow-lg" : "text-white/30 hover:text-white"
                                )}
                            >
                                <AlertTriangle className="w-4 h-4" /> Pendiente
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-white/50 hover:text-white transition-colors font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveAndGenerate}
                        className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 flex items-center gap-2 transition-all transform hover:scale-105"
                    >
                        <FileDown className="w-5 h-5" />
                        Guardar y Generar PDF
                    </button>
                </div>

            </div>
        </div>
    );
};
