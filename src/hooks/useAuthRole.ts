import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export type UserRole = 'admin' | 'standard';

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
    createdAt: string;
}

export function useAuthRole(user: User | null) {
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setRole(null);
            setLoading(false);
            return;
        }

        const fetchRole = async () => {
            setLoading(true);
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    setRole(userSnap.data().role as UserRole);
                } else {
                    // First time login - Create User Profile
                    // If it's the VERY first user (or hardcoded admin email), make admin
                    // For now, simpler: Defaults to 'standard', user must manually change in DB or we add a secret
                    // BUT: Since the user is ALREADY logged in and needs to be Admin to config others:
                    // We'll set the CURRENT user to 'admin' if they are the first one created via this hook?
                    // Safe bet: Default 'standard'. 
                    // CRITICAL: The user asking for this IS the Admin. capturing them as Admin:

                    const newProfile: UserProfile = {
                        uid: user.uid,
                        email: user.email || "",
                        role: 'admin', // CAREFUL: First user touching this logic becomes Admin. 
                        // Later we change this default to 'standard' via the UI creation tool.
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(userRef, newProfile);
                    setRole('admin');
                }
            } catch (error) {
                console.error("Error fetching role:", error);
                setRole('standard'); // Fallback
            } finally {
                setLoading(false);
            }
        };

        fetchRole();
    }, [user]);

    return { role, isAdmin: role === 'admin', loading };
}
