import { db } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';

// Sucursales fijas especificadas
export const FIXED_BRANCHES = [
    { id: 'TUCACAS', name: 'Tucacas', code: 'TUC' },
    { id: 'SAN_DIEGO', name: 'San Diego', code: 'SD' },
    { id: 'SAN_JUAN', name: 'San Juan', code: 'SJ' }
] as const;

export type BranchId = typeof FIXED_BRANCHES[number]['id'];

// Modelos fijos de Pesos
export const FIXED_PESOS_MODELS = ['PD 2', 'PD 1', 'OTRO'] as const;
export type PesoModel = typeof FIXED_PESOS_MODELS[number];

// Modelos fijos de Balanzas
export const FIXED_BALANZAS_MODELS = ['CAS CL5200', 'CL 5000', 'CL 5000H', 'N1', 'OTRAS'] as const;
export type BalanzaModel = typeof FIXED_BALANZAS_MODELS[number];

export interface ModelEquipmentData {
    operativos: number;  // Cantidad Operativos en Tienda
    enTaller: number;    // Cantidad en Taller
    danados: number;     // Cantidad Dañados en Tienda
    notas?: string;      // Observaciones específicas
}

export interface BranchReportData {
    branchId: BranchId;
    branchName: string;
    pesos: Record<PesoModel, ModelEquipmentData>;
    balanzas: Record<BalanzaModel, ModelEquipmentData>;
    generalNotes?: string;
    updatedAt?: any;
    updatedBy?: string;
}

export interface AuditLogItem {
    id?: string;
    branchId: BranchId;
    branchName: string;
    updatedBy: string;
    timestamp: any;
    summary: string;
    details?: string;
}

export interface TotalsSummary {
    operativos: number;
    enTaller: number;
    danados: number;
    total: number;
    operativityRate: number; // Porcentaje de operatividad 0-100%
}

export const createDefaultModelData = (): ModelEquipmentData => ({
    operativos: 0,
    enTaller: 0,
    danados: 0,
    notas: ''
});

export const createDefaultBranchReport = (branchId: BranchId, branchName: string): BranchReportData => {
    const pesos = FIXED_PESOS_MODELS.reduce((acc, model) => {
        acc[model] = createDefaultModelData();
        return acc;
    }, {} as Record<PesoModel, ModelEquipmentData>);

    const balanzas = FIXED_BALANZAS_MODELS.reduce((acc, model) => {
        acc[model] = createDefaultModelData();
        return acc;
    }, {} as Record<BalanzaModel, ModelEquipmentData>);

    return {
        branchId,
        branchName,
        pesos,
        balanzas,
        generalNotes: ''
    };
};

export const calculateModelTotal = (data?: ModelEquipmentData): number => {
    if (!data) return 0;
    return (Number(data.operativos) || 0) + (Number(data.enTaller) || 0) + (Number(data.danados) || 0);
};

export const calculateCategoryTotals = (
    categoryData: Record<string, ModelEquipmentData>
): TotalsSummary => {
    let operativos = 0;
    let enTaller = 0;
    let danados = 0;

    Object.values(categoryData || {}).forEach((item) => {
        operativos += Number(item.operativos) || 0;
        enTaller += Number(item.enTaller) || 0;
        danados += Number(item.danados) || 0;
    });

    const total = operativos + enTaller + danados;
    const operativityRate = total > 0 ? Math.round((operativos / total) * 100) : 0;

    return { operativos, enTaller, danados, total, operativityRate };
};

export const calculateBranchTotals = (report: BranchReportData): TotalsSummary => {
    const pesosTotals = calculateCategoryTotals(report.pesos);
    const balanzasTotals = calculateCategoryTotals(report.balanzas);

    const operativos = pesosTotals.operativos + balanzasTotals.operativos;
    const enTaller = pesosTotals.enTaller + balanzasTotals.enTaller;
    const danados = pesosTotals.danados + balanzasTotals.danados;
    const total = operativos + enTaller + danados;
    const operativityRate = total > 0 ? Math.round((operativos / total) * 100) : 0;

    return { operativos, enTaller, danados, total, operativityRate };
};

const REPORTS_COLLECTION = 'branch_equipment_reports';
const AUDIT_COLLECTION = 'branch_reports_audit_log';

export const branchReportService = {
    // Escucha en tiempo real todos los reportes de sucursales
    subscribeAllReports: (callback: (reports: Record<BranchId, BranchReportData>) => void) => {
        const colRef = collection(db, REPORTS_COLLECTION);
        return onSnapshot(colRef, (snapshot) => {
            const reportMap = FIXED_BRANCHES.reduce((acc, b) => {
                acc[b.id] = createDefaultBranchReport(b.id, b.name);
                return acc;
            }, {} as Record<BranchId, BranchReportData>);

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as BranchReportData;
                const branchId = docSnap.id as BranchId;
                if (reportMap[branchId]) {
                    // Combinar respetando modelos fijos
                    reportMap[branchId] = {
                        ...reportMap[branchId],
                        ...data,
                        branchId,
                        pesos: {
                            ...reportMap[branchId].pesos,
                            ...(data.pesos || {})
                        },
                        balanzas: {
                            ...reportMap[branchId].balanzas,
                            ...(data.balanzas || {})
                        }
                    };
                }
            });

            callback(reportMap);
        }, (error) => {
            console.error('Error suscribiendo a reportes de sucursal:', error);
        });
    },

    // Guardar o actualizar reporte de una sucursal específica
    saveReport: async (
        branchId: BranchId,
        reportData: Partial<BranchReportData>,
        userEmail: string
    ): Promise<void> => {
        const branchInfo = FIXED_BRANCHES.find(b => b.id === branchId);
        const branchName = branchInfo ? branchInfo.name : branchId;

        const docRef = doc(db, REPORTS_COLLECTION, branchId);

        // Sanitize numbers
        const sanitizedPesos = FIXED_PESOS_MODELS.reduce((acc, m) => {
            const current = reportData.pesos?.[m] || createDefaultModelData();
            acc[m] = {
                operativos: Math.max(0, Math.floor(Number(current.operativos) || 0)),
                enTaller: Math.max(0, Math.floor(Number(current.enTaller) || 0)),
                danados: Math.max(0, Math.floor(Number(current.danados) || 0)),
                notas: (current.notas || '').trim()
            };
            return acc;
        }, {} as Record<PesoModel, ModelEquipmentData>);

        const sanitizedBalanzas = FIXED_BALANZAS_MODELS.reduce((acc, m) => {
            const current = reportData.balanzas?.[m] || createDefaultModelData();
            acc[m] = {
                operativos: Math.max(0, Math.floor(Number(current.operativos) || 0)),
                enTaller: Math.max(0, Math.floor(Number(current.enTaller) || 0)),
                danados: Math.max(0, Math.floor(Number(current.danados) || 0)),
                notas: (current.notas || '').trim()
            };
            return acc;
        }, {} as Record<BalanzaModel, ModelEquipmentData>);

        const cleanData: BranchReportData = {
            branchId,
            branchName,
            pesos: sanitizedPesos,
            balanzas: sanitizedBalanzas,
            generalNotes: (reportData.generalNotes || '').trim(),
            updatedAt: serverTimestamp(),
            updatedBy: userEmail
        };

        await setDoc(docRef, cleanData, { merge: true });

        // Registrar en bitácora de auditoría
        try {
            const totals = calculateBranchTotals(cleanData);
            await addDoc(collection(db, AUDIT_COLLECTION), {
                branchId,
                branchName,
                updatedBy: userEmail,
                timestamp: serverTimestamp(),
                summary: `Actualizado reporte de ${branchName}: ${totals.operativos} Operativos, ${totals.enTaller} Taller, ${totals.danados} Dañados (Total: ${totals.total})`,
                details: JSON.stringify({
                    pesos: sanitizedPesos,
                    balanzas: sanitizedBalanzas
                })
            });
        } catch (auditErr) {
            console.warn('No se pudo registrar bitácora de auditoría:', auditErr);
        }
    },

    // Suscripción a historial de auditoría
    subscribeAuditLog: (callback: (logs: AuditLogItem[]) => void) => {
        const q = query(collection(db, AUDIT_COLLECTION), orderBy('timestamp', 'desc'), limit(30));
        return onSnapshot(q, (snapshot) => {
            const logs: AuditLogItem[] = [];
            snapshot.forEach((d) => {
                logs.push({ id: d.id, ...d.data() } as AuditLogItem);
            });
            callback(logs);
        }, (err) => {
            console.warn('Error suscribiendo a auditoría:', err);
        });
    }
};
