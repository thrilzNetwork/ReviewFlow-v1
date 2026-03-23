/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged,
  doc, onSnapshot, handleFirestoreError, OperationType
} from './firebase';
import { 
  AlertCircle, 
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';
import { HotelSettings } from './types';
import { Button, Card } from './components/UI';
import GuestFlow from './components/GuestFlow';

import AdminDashboard from './components/AdminDashboard';

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'guest' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      return (params.get('hotelId') || hashParams.get('hotelId')) ? 'guest' : 'admin';
    }
    return 'admin';
  });
  const [hotelId, setHotelId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      return params.get('hotelId') || hashParams.get('hotelId');
    }
    return null;
  });
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const id = params.get('hotelId') || hashParams.get('hotelId');
      if (id) {
        setHotelId(id);
        setView('guest');
      } else {
        setView('admin');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      
      if (u && !hotelId && view === 'admin') {
        setHotelId(u.uid);
      }
      
      // If we are in admin view, we need auth to stop loading
      if (view === 'admin') {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [hotelId, view]);

  // Fetch settings (only if not in guest view, or let guest flow handle it)
  useEffect(() => {
    if (!hotelId || view === 'guest') {
      if (view === 'admin') setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, `hotels/${hotelId}/settings/config`), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as HotelSettings);
      }
      setLoading(false);
    }, (error) => {
      console.error("Settings fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hotelId, view]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  if (view === 'guest' && hotelId) {
    return <GuestFlow hotelId={hotelId} initialSettings={settings} />;
  }

  if (loading && !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-pink border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <AdminDashboard 
      user={user} 
      hotelId={hotelId} 
      settings={settings} 
      onSignIn={handleSignIn} 
      authError={authError} 
    />
  );
}

