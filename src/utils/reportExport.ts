import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    FIXED_BRANCHES,
    FIXED_PESOS_MODELS,
    FIXED_BALANZAS_MODELS,
    type BranchReportData,
    type BranchId,
    calculateCategoryTotals,
    calculateBranchTotals
} from '../services/BranchReportService';

export const exportReportsToPDF = (
    reports: Record<BranchId, BranchReportData>,
    userEmail: string
) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Encabezado corporativo
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SISDEPE - SISTEMA DE CONTROL DE EQUIPOS', 14, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Reporte Oficial de Inventario: Tucacas | San Diego | San Juan', 14, 21);
    doc.text(`Generado: ${dateStr} • Auditor: ${userEmail || 'Auditoría Central'}`, 14, 27);

    // Resumen Ejecutivo en cajas
    let totalOperativos = 0;
    let totalTaller = 0;
    let totalDanados = 0;

    FIXED_BRANCHES.forEach(b => {
        const rep = reports[b.id];
        if (rep) {
            const totals = calculateBranchTotals(rep);
            totalOperativos += totals.operativos;
            totalTaller += totals.enTaller;
            totalDanados += totals.danados;
        }
    });
    const grandTotal = totalOperativos + totalTaller + totalDanados;
    const rate = grandTotal > 0 ? Math.round((totalOperativos / grandTotal) * 100) : 0;

    // Mini KPI Cards
    const startY = 38;
    const cardWidth = 43;
    const cardHeight = 16;

    const cards = [
        { label: 'OPERATIVOS', val: totalOperativos, color: [16, 185, 129] }, // emerald
        { label: 'EN TALLER', val: totalTaller, color: [245, 158, 11] },     // amber
        { label: 'DAÑADOS', val: totalDanados, color: [239, 68, 68] },       // red
        { label: 'TOTAL EQUIPOS', val: `${grandTotal} (${rate}%)`, color: [59, 130, 246] } // blue
    ];

    cards.forEach((c, idx) => {
        const x = 14 + (idx * (cardWidth + 4));
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, x + 3, startY + 6);

        doc.setFontSize(11);
        doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        doc.text(String(c.val), x + 3, startY + 12);
    });

    let currentY = startY + cardHeight + 8;

    // Tabla 1: PESOS
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('1. CONSOLIDADO DE PESOS (PD 2, PD 1, OTRO)', 14, currentY);

    const pesosBody: any[] = [];
    FIXED_BRANCHES.forEach(b => {
        const rep = reports[b.id];
        FIXED_PESOS_MODELS.forEach((m, mIdx) => {
            const item = rep?.pesos?.[m] || { operativos: 0, enTaller: 0, danados: 0 };
            const mTotal = Number(item.operativos) + Number(item.enTaller) + Number(item.danados);
            pesosBody.push([
                mIdx === 0 ? b.name.toUpperCase() : '',
                m,
                item.operativos,
                item.enTaller,
                item.danados,
                mTotal
            ]);
        });
        const catTotals = calculateCategoryTotals(rep?.pesos || {});
        pesosBody.push([
            { content: `SUBTOTAL ${b.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.operativos, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.enTaller, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.danados, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.total, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
        ]);
    });

    autoTable(doc, {
        startY: currentY + 3,
        head: [['Sucursal', 'Modelo', 'Operativos', 'En Taller', 'Dañados', 'Total']],
        body: pesosBody,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontSize: 9,
            halign: 'center'
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 },
            1: { halign: 'left', cellWidth: 35 }
        }
    });

    // Tabla 2: BALANZAS
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Verificar si cabe en la página o agregar nueva página
    if (currentY > 210) {
        doc.addPage();
        currentY = 18;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('2. CONSOLIDADO DE BALANZAS (CAS CL5200, CL 5000, CL 5000H, N1, OTRAS)', 14, currentY);

    const balanzasBody: any[] = [];
    FIXED_BRANCHES.forEach(b => {
        const rep = reports[b.id];
        FIXED_BALANZAS_MODELS.forEach((m, mIdx) => {
            const item = rep?.balanzas?.[m] || { operativos: 0, enTaller: 0, danados: 0 };
            const mTotal = Number(item.operativos) + Number(item.enTaller) + Number(item.danados);
            balanzasBody.push([
                mIdx === 0 ? b.name.toUpperCase() : '',
                m,
                item.operativos,
                item.enTaller,
                item.danados,
                mTotal
            ]);
        });
        const catTotals = calculateCategoryTotals(rep?.balanzas || {});
        balanzasBody.push([
            { content: `SUBTOTAL ${b.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.operativos, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.enTaller, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.danados, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: catTotals.total, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
        ]);
    });

    autoTable(doc, {
        startY: currentY + 3,
        head: [['Sucursal', 'Modelo', 'Operativos', 'En Taller', 'Dañados', 'Total']],
        body: balanzasBody,
        theme: 'grid',
        headStyles: {
            fillColor: [14, 116, 144], // cyan-700
            textColor: 255,
            fontSize: 9,
            halign: 'center'
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 },
            1: { halign: 'left', cellWidth: 40 }
        }
    });

    // Firmas de Conformidad
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY > 250) {
        doc.addPage();
        finalY = 25;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(20, finalY + 15, 80, finalY + 15);
    doc.line(130, finalY + 15, 190, finalY + 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Responsable de Sucursal / Operaciones', 25, finalY + 20);
    doc.text('Supervisor de Taller / Auditor SISDEPE', 135, finalY + 20);

    // Guardar documento
    const filename = `SISDEPE_Reporte_Sucursales_${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
};

export const exportReportsToCSV = (
    reports: Record<BranchId, BranchReportData>
) => {
    const rows: string[][] = [
        ['SISDEPE - REPORTE DE EQUIPOS POR SUCURSAL'],
        ['Fecha de Exportación', new Date().toLocaleString('es-VE')],
        [],
        ['SUCURSAL', 'CATEGORÍA', 'MODELO', 'OPERATIVOS EN TIENDA', 'EN TALLER', 'DAÑADOS EN TIENDA', 'TOTAL EQUIPOS', 'OBSERVACIONES']
    ];

    FIXED_BRANCHES.forEach(b => {
        const rep = reports[b.id];

        // Pesos
        FIXED_PESOS_MODELS.forEach(m => {
            const item = rep?.pesos?.[m] || { operativos: 0, enTaller: 0, danados: 0, notas: '' };
            const total = Number(item.operativos) + Number(item.enTaller) + Number(item.danados);
            rows.push([
                b.name,
                'PESOS',
                m,
                String(item.operativos),
                String(item.enTaller),
                String(item.danados),
                String(total),
                item.notas ? `"${item.notas.replace(/"/g, '""')}"` : ''
            ]);
        });

        // Balanzas
        FIXED_BALANZAS_MODELS.forEach(m => {
            const item = rep?.balanzas?.[m] || { operativos: 0, enTaller: 0, danados: 0, notas: '' };
            const total = Number(item.operativos) + Number(item.enTaller) + Number(item.danados);
            rows.push([
                b.name,
                'BALANZAS',
                m,
                String(item.operativos),
                String(item.enTaller),
                String(item.danados),
                String(total),
                item.notas ? `"${item.notas.replace(/"/g, '""')}"` : ''
            ]);
        });

        // Subtotal de sucursal
        if (rep) {
            const t = calculateBranchTotals(rep);
            rows.push([
                `TOTAL ${b.name}`,
                'CONSOLIDADO',
                'TODOS',
                String(t.operativos),
                String(t.enTaller),
                String(t.danados),
                String(t.total),
                `${t.operativityRate}% Operatividad`
            ]);
        }
        rows.push([]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SISDEPE_Inventario_Sucursales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
