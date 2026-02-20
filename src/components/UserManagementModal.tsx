import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Shield, User, X, CheckCircle, Loader2, UserPlus } from 'lucide-react';
import type { UserProfile } from '../hooks/useAuthRole';

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // New User Form State
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPass, setNewUserPass] = useState("");
    const [newUserRole, setNewUserRole] = useState<'admin' | 'standard'>('standard');
    const [createError, setCreateError] = useState("");
    const [createSuccess, setCreateSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            resetForm();
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const userList: UserProfile[] = [];
            querySnapshot.forEach((doc) => {
                userList.push(doc.data() as UserProfile);
            });
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setNewUserEmail("");
        setNewUserPass("");
        setNewUserRole('standard');
        setCreateError("");
        setCreateSuccess(false);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");
        setCreateSuccess(false);
        setActionLoading("create");

        let secondaryApp = null;

        try {
            // 1. Initialize secondary app to avoid logging out admin
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            // 2. Create User in Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass);
            const user = userCredential.user;

            // 3. Create User Profile in Firestore (Using MAIN app's db, as secondary might strictly be for auth)
            // Note: We use the 'db' from the main import because the Admin is authenticated there and has write permissions.
            const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || newUserEmail,
                role: newUserRole,
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'users', user.uid), newProfile);

            // 4. Cleanup
            await signOut(secondaryAuth);

            setCreateSuccess(true);
            setUsers([...users, newProfile]);
            resetForm();

        } catch (error: any) {
            console.error("Error creating user", error);
            setCreateError(error.message || "Error al crear usuario.");
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
            setActionLoading(null);
        }
    };

    const handleToggleRole = async (user: UserProfile) => {
        if (actionLoading) return;
        const newRole = user.role === 'admin' ? 'standard' : 'admin';
        setActionLoading(user.uid);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { role: newRole });

            setUsers(users.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error("Error updating role", error);
            alert("Error al actualizar rol.");
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-blue-900/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-500" />
                        Gestión de Usuarios (Admin)
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row h-full overflow-hidden">

                    {/* LEFT: Create User */}
                    <div className="w-full md:w-1/3 p-6 border-r border-white/10 bg-white/5 overflow-y-auto">
                        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Nuevo Usuario
                        </h3>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-white/40 text-xs font-bold mb-1">Email</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={e => setNewUserEmail(e.target.value)}
                                    required
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                                    placeholder="usuario@empresa.com"
                                />
                            </div>
                            <div>
                                <label className="block text-white/40 text-xs font-bold mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    value={newUserPass}
                                    onChange={e => setNewUserPass(e.target.value)}
                                    required
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                                    placeholder="Min. 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-white/40 text-xs font-bold mb-1">Rol Inicial</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewUserRole('standard')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${newUserRole === 'standard' ? 'bg-white/10 border-white/50 text-white' : 'border-white/10 text-white/30'}`}
                                    >
                                        Estándar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewUserRole('admin')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${newUserRole === 'admin' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-white/10 text-white/30'}`}
                                    >
                                        Admin
                                    </button>
                                </div>
                            </div>

                            {createError && <p className="text-red-400 text-xs">{createError}</p>}
                            {createSuccess && <p className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Usuario creado exitosamente.</p>}

                            <button
                                type="submit"
                                disabled={!!actionLoading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
                            >
                                {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Crear Usuario"}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT: User List */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">Usuarios Registrados</h3>

                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
                        ) : (
                            <div className="space-y-2">
                                {users.map(user => (
                                    <div key={user.uid} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/50'}`}>
                                                {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="text-white text-sm font-medium">{user.email}</div>
                                                <div className="text-white/30 text-xs font-mono">{user.role.toUpperCase()}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleRole(user)}
                                                disabled={!!actionLoading}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs font-bold border border-white/5 transition-colors"
                                            >
                                                {actionLoading === user.uid ? "..." : user.role === 'admin' ? "Bajar a Estándar" : "Hacer Admin"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
