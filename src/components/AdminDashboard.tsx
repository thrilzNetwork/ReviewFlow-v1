import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Mail, Settings as SettingsIcon, Share2, QrCode, User, LogOut, 
  Download, ThumbsUp, ThumbsDown, Star, ChevronRight, Trash2, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  query, collection, orderBy, limit, onSnapshot, setDoc, doc, addDoc, updateDoc 
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError, signOut, deleteDoc } from '../firebase';
import { HotelSettings, Review, Feedback, Promo, NewsletterSignup, CustomQuestion } from '../types';
import { Button, Card, cn } from './UI';
import GuestFlow from './GuestFlow';

export default function AdminDashboard({ user, hotelId, settings, onSignIn, authError }: { 
  user: any, 
  hotelId: string | null, 
  settings: HotelSettings | null,
  onSignIn: () => void,
  authError: string | null
}) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'settings' | 'qr' | 'guests' | 'promos'>('inbox');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [signups, setSignups] = useState<NewsletterSignup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [previewKey, setPreviewKey] = useState(0);

  // Unified Guest List
  const guestList = useMemo(() => {
    const guests = new Map<string, { name: string, email: string, source?: string, timestamp: string, type: 'Review' | 'Feedback' | 'Newsletter' }>();
    
    reviews.forEach(r => {
      if (r.guestEmail) {
        guests.set(r.guestEmail, { 
          name: r.guestName || 'Anonymous', 
          email: r.guestEmail, 
          source: r.source,
          timestamp: r.timestamp,
          type: 'Review'
        });
      }
    });

    feedback.forEach(f => {
      if (f.guestEmail) {
        const existing = guests.get(f.guestEmail);
        if (!existing || new Date(f.timestamp) > new Date(existing.timestamp)) {
          guests.set(f.guestEmail, { 
            name: f.guestName || 'Anonymous', 
            email: f.guestEmail, 
            source: f.source,
            timestamp: f.timestamp,
            type: 'Feedback'
          });
        }
      }
    });

    signups.forEach(s => {
      const existing = guests.get(s.email);
      if (!existing || new Date(s.timestamp) > new Date(existing.timestamp)) {
        guests.set(s.email, { 
          name: s.name || 'Anonymous', 
          email: s.email, 
          timestamp: s.timestamp,
          type: 'Newsletter'
        });
      }
    });

    return Array.from(guests.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reviews, feedback, signups]);

  const exportToCSV = () => {
    if (guestList.length === 0) return;
    
    const headers = ['Name', 'Email', 'Source', 'Type', 'Date'];
    const rows = guestList.map(g => [
      g.name,
      g.email,
      g.source || 'N/A',
      g.type,
      new Date(g.timestamp).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `guests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Form state for settings
  const [form, setForm] = useState<HotelSettings>({
    hotelName: '',
    logoUrl: '',
    primaryColor: '#000000',
    welcomeLine: 'Welcome to our hotel',
    googleLink: '',
    tripAdvisorLink: '',
    yelpLink: '',
    facebookLink: '',
    adminEmail: user?.email || '',
    customQuestions: [],
    showPromos: true,
    showNewsletter: true
  });
  const [newQuestion, setNewQuestion] = useState<Partial<CustomQuestion>>({ text: '', type: 'text', required: false });

  // Promo form state
  const [promoForm, setPromoForm] = useState<Partial<Promo>>({
    title: '',
    description: '',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    type: 'promo',
    active: true
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  // Fetch reviews, feedback, promos, signups
  useEffect(() => {
    if (!hotelId || !user) return;

    const qReviews = query(collection(db, `hotels/${hotelId}/reviews`), orderBy('timestamp', 'desc'), limit(50));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/reviews`);
    });

    const qFeedback = query(collection(db, `hotels/${hotelId}/feedback`), orderBy('timestamp', 'desc'), limit(50));
    const unsubFeedback = onSnapshot(qFeedback, (snap) => {
      setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Feedback)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/feedback`);
    });

    const qPromos = query(collection(db, `hotels/${hotelId}/promos`), orderBy('active', 'desc'));
    const unsubPromos = onSnapshot(qPromos, (snap) => {
      setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/promos`);
    });

    const qSignups = query(collection(db, `hotels/${hotelId}/signups`), orderBy('timestamp', 'desc'));
    const unsubSignups = onSnapshot(qSignups, (snap) => {
      setSignups(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsletterSignup)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/signups`);
    });

    return () => {
      unsubReviews();
      unsubFeedback();
      unsubPromos();
      unsubSignups();
    };
  }, [hotelId, user]);

  const handleSaveSettings = async (overrideSettings?: HotelSettings) => {
    if (!hotelId) return;
    const settingsToSave = overrideSettings || form;
    if (!settingsToSave.hotelName.trim() || !settingsToSave.adminEmail.trim()) {
      alert('Hotel Name and Admin Email are required.');
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, `hotels/${hotelId}/settings/config`), settingsToSave);
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/settings/config`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateQR = async () => {
    const newId = Math.random().toString(36).substring(7);
    const newSettings = { ...form, qrCampaignId: newId };
    setForm(newSettings);
    await handleSaveSettings(newSettings);
  };

  const addQuestion = () => {
    if (!newQuestion.text) return;
    const q: CustomQuestion = { 
      id: Date.now().toString(), 
      text: newQuestion.text, 
      type: newQuestion.type as any || 'text', 
      required: !!newQuestion.required 
    };
    setForm({ ...form, customQuestions: [...(form.customQuestions || []), q] });
    setNewQuestion({ text: '', type: 'text', required: false });
  };

  const removeQuestion = (id: string) => {
    setForm({ ...form, customQuestions: (form.customQuestions || []).filter(q => q.id !== id) });
  };

  const handleAddPromo = async () => {
    if (!hotelId) return;
    try {
      await addDoc(collection(db, `hotels/${hotelId}/promos`), promoForm);
      setPromoForm({ title: '', description: '', imageUrl: '', buttonText: '', buttonLink: '', type: 'promo', active: true });
      alert('Promo added!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/promos`);
    }
  };

  const togglePromo = async (id: string, active: boolean) => {
    if (!hotelId) return;
    try {
      await updateDoc(doc(db, `hotels/${hotelId}/promos`, id), { active });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/promos/${id}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-soehne">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,131,218,0.1),transparent_70%)] pointer-events-none" />
        <Card className="max-w-md w-full text-center p-12 relative overflow-hidden">
          <div className="w-20 h-20 bg-pink rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-[0_0_30px_rgba(255,131,218,0.3)]">
            <LayoutDashboard className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">Review Flow</h1>
          <p className="text-supporting-grey mb-10 font-medium">Manage your hotel's reputation with privacy-first tools.</p>
          
          {authError && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-left">{authError}</p>
            </div>
          )}

          <Button onClick={onSignIn} variant="accent" className="w-full flex items-center justify-center gap-3 py-5 uppercase tracking-widest">
            <User size={20} />
            Sign in with Google
          </Button>
          
          <p className="mt-8 text-xs text-supporting-grey/50 uppercase tracking-widest font-bold">
            Privacy-first data ownership
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row pb-20 md:pb-0 font-soehne">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-charcoal border-r border-white/5 flex-col sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-pink rounded-xl flex items-center justify-center rotate-3">
            <LayoutDashboard className="text-black w-6 h-6" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase">Review Flow</span>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
          <NavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
          <NavItem active={activeTab === 'promos'} icon={<Share2 size={20} />} label="Slides" onClick={() => setActiveTab('promos')} />
          <NavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR Generator" onClick={() => setActiveTab('qr')} />
          <NavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
        </nav>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full p-4 text-supporting-grey hover:text-red-400 hover:bg-red-400/5 transition-all rounded-2xl font-bold uppercase tracking-widest text-xs"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-charcoal/80 backdrop-blur-xl border-t border-white/5 flex justify-around p-4 z-50">
        <MobileNavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
        <MobileNavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
        <MobileNavItem active={activeTab === 'promos'} icon={<Share2 size={20} />} label="Slides" onClick={() => setActiveTab('promos')} />
        <MobileNavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR" onClick={() => setActiveTab('qr')} />
        <MobileNavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">{activeTab}</h2>
            <p className="text-supporting-grey font-medium">Manage your hotel's guest experience.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto bg-charcoal p-4 rounded-3xl border border-white/5 shadow-xl">
            <div className="text-left md:text-right flex-1 md:flex-none">
              <p className="font-bold text-sm uppercase tracking-tight">{user.displayName}</p>
              <p className="text-xs text-supporting-grey uppercase tracking-widest">{user.email}</p>
            </div>
            {user.photoURL && <img src={user.photoURL} className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" referrerPolicy="no-referrer" />}
          </div>
        </header>

        {activeTab === 'inbox' && (
          <div className="space-y-12">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Total Reviews</p>
                <p className="text-4xl font-black tracking-tighter text-emerald-400">{reviews.length}</p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Avg Rating</p>
                <p className="text-4xl font-black tracking-tighter text-yellow">
                  {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
                </p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Private Feedback</p>
                <p className="text-4xl font-black tracking-tighter text-red-400">{feedback.length}</p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Guest List</p>
                <p className="text-4xl font-black tracking-tighter text-pink">{guestList.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <ThumbsUp className="text-emerald-400 w-8 h-8" />
                    Reviews
                  </h3>
                </div>
                <div className="space-y-6">
                  {reviews.length === 0 ? (
                    <EmptyState message="No reviews yet." />
                  ) : (
                    reviews.map(r => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={r.id} 
                        className="p-8 rounded-[40px] bg-charcoal/50 backdrop-blur-md border border-white/5 hover:border-white/20 transition-all shadow-lg group"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={18} fill="var(--color-yellow)" className={i < r.rating ? "text-yellow" : "text-white/5"} />
                            ))}
                          </div>
                          <span className="text-[10px] font-black text-supporting-grey uppercase tracking-widest opacity-50">{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-2xl font-black tracking-tight mb-4 leading-tight">"{r.oneWord}"</p>
                        <div className="space-y-3 mb-8">
                          {r.highlight && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-pink/50">Highlight</span>
                              <p className="text-sm font-bold text-white/80">{r.highlight}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {r.source && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                <Share2 size={10} className="text-supporting-grey" />
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">{r.source}</span>
                              </div>
                            )}
                            {r.recommend !== undefined && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                {r.recommend ? <ThumbsUp size={10} className="text-emerald-400" /> : <ThumbsDown size={10} className="text-red-400" />}
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">Recommend</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {r.guestName && (
                          <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-pink/10 rounded-xl flex items-center justify-center">
                                <User size={14} className="text-pink" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{r.guestName}</p>
                                <p className="text-[10px] text-supporting-grey font-bold lowercase tracking-tight leading-none">{r.guestEmail}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <ThumbsDown className="text-red-400 w-8 h-8" />
                    Feedback
                  </h3>
                </div>
                <div className="space-y-6">
                  {feedback.length === 0 ? (
                    <EmptyState message="No feedback yet." />
                  ) : (
                    feedback.map(f => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={f.id} 
                        className="p-8 rounded-[40px] bg-red-400/5 border border-red-400/10 hover:border-red-400/20 transition-all shadow-lg"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className="px-3 py-1 bg-red-400/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-400/20">{f.rating} Stars</span>
                          <span className="text-[10px] font-black text-supporting-grey uppercase tracking-widest opacity-50">{new Date(f.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xl font-bold text-white/90 mb-6 leading-relaxed">"{f.comment}"</p>
                        <div className="space-y-3 mb-8">
                          {f.highlight && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-red-400/50">Highlight</span>
                              <p className="text-sm font-bold text-white/80">{f.highlight}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {f.source && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                <Share2 size={10} className="text-supporting-grey" />
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">{f.source}</span>
                              </div>
                            )}
                            {f.recommend !== undefined && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                {f.recommend ? <ThumbsUp size={10} className="text-emerald-400" /> : <ThumbsDown size={10} className="text-red-400" />}
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">Recommend</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {f.guestName && (
                          <div className="mb-8 pt-6 border-t border-white/5 flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-400/10 rounded-xl flex items-center justify-center">
                              <User size={14} className="text-red-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{f.guestName}</p>
                              <p className="text-[10px] text-supporting-grey font-bold lowercase tracking-tight leading-none">{f.guestEmail}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-8">
                          <button className="text-[10px] font-black uppercase tracking-widest text-supporting-grey hover:text-white transition-colors">Reply</button>
                          <button className="text-[10px] font-black uppercase tracking-widest text-supporting-grey hover:text-emerald-400 transition-colors">Resolve</button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col xl:flex-row gap-8 items-start">
            <Card className="flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Branding</h3>
                  <Input label="Hotel Name" value={form.hotelName} onChange={v => setForm({...form, hotelName: v})} />
                  <Input label="Logo URL" value={form.logoUrl || ''} onChange={v => setForm({...form, logoUrl: v})} placeholder="https://..." />
                  <Input label="Primary Color" type="color" value={form.primaryColor} onChange={v => setForm({...form, primaryColor: v})} />
                  <Input label="Welcome Line" value={form.welcomeLine} onChange={v => setForm({...form, welcomeLine: v})} />
                  <Input label="Admin Email" value={form.adminEmail} onChange={v => setForm({...form, adminEmail: v})} />
                  
                  <div className="pt-8 space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Flow Conversion</h3>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-sm font-bold uppercase tracking-widest">Show Promotions</span>
                      <button 
                        onClick={() => setForm({...form, showPromos: !form.showPromos})}
                        className={cn("w-12 h-6 rounded-full relative transition-colors", form.showPromos ? "bg-pink" : "bg-white/10")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", form.showPromos ? "right-1" : "left-1")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-sm font-bold uppercase tracking-widest">Show Newsletter</span>
                      <button 
                        onClick={() => setForm({...form, showNewsletter: !form.showNewsletter})}
                        className={cn("w-12 h-6 rounded-full relative transition-colors", form.showNewsletter ? "bg-pink" : "bg-white/10")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", form.showNewsletter ? "right-1" : "left-1")} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Social Links</h3>
                  <Input label="Google Review Link" value={form.googleLink || ''} onChange={v => setForm({...form, googleLink: v})} />
                  <Input label="TripAdvisor Link" value={form.tripAdvisorLink || ''} onChange={v => setForm({...form, tripAdvisorLink: v})} />
                  <Input label="Yelp Link" value={form.yelpLink || ''} onChange={v => setForm({...form, yelpLink: v})} />
                  <Input label="Facebook Link" value={form.facebookLink || ''} onChange={v => setForm({...form, facebookLink: v})} />
                  
                  <div className="pt-8 space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Custom Questions</h3>
                    <div className="space-y-4">
                      {(form.customQuestions || []).map(q => (
                        <div key={q.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div>
                            <p className="text-sm font-bold">{q.text}</p>
                            <p className="text-[10px] text-supporting-grey uppercase tracking-widest">{q.type} • {q.required ? 'Required' : 'Optional'}</p>
                          </div>
                          <button onClick={() => removeQuestion(q.id)} className="text-supporting-grey hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                        <Input label="New Question" value={newQuestion.text || ''} onChange={v => setNewQuestion({...newQuestion, text: v})} placeholder="e.g. How was the breakfast?" />
                        <div className="grid grid-cols-2 gap-4">
                          <select 
                            value={newQuestion.type} 
                            onChange={(e) => setNewQuestion({...newQuestion, type: e.target.value as any})}
                            className="p-4 bg-white/5 rounded-2xl border border-white/5 text-white text-xs uppercase tracking-widest font-black"
                          >
                            <option value="text">Text</option>
                            <option value="boolean">Yes/No</option>
                            <option value="rating">Rating</option>
                          </select>
                          <button 
                            onClick={() => setNewQuestion({...newQuestion, required: !newQuestion.required})}
                            className={cn("p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all", newQuestion.required ? "bg-pink/10 border-pink text-pink" : "border-white/5 text-supporting-grey")}
                          >
                            {newQuestion.required ? 'Required' : 'Optional'}
                          </button>
                        </div>
                        <Button onClick={addQuestion} variant="outline" className="w-full py-3 text-[10px] uppercase tracking-widest">Add Question</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-16 pt-8 border-t border-white/5 flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving} variant="accent" className="w-full md:w-auto uppercase tracking-widest">
                  {isSaving ? 'Saving...' : 'Save All Changes'}
                </Button>
              </div>
            </Card>

            {/* Live Preview */}
            <div className="w-full xl:w-[400px] sticky top-8 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-supporting-grey">Live Preview</h3>
                <button 
                  onClick={() => setPreviewKey(prev => prev + 1)}
                  className="text-[10px] font-black uppercase tracking-widest text-pink hover:opacity-80 transition-opacity"
                >
                  Reset Preview
                </button>
              </div>
              <div className="aspect-[9/19] w-full bg-black border-[8px] border-charcoal rounded-[3rem] overflow-hidden shadow-2xl relative">
                {/* Mobile Status Bar */}
                <div className="absolute top-0 left-0 w-full h-8 bg-black/20 backdrop-blur-md z-50 flex items-center justify-between px-6">
                  <span className="text-[10px] font-bold">9:41</span>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-white/20" />
                    <div className="w-3 h-3 rounded-full border border-white/20" />
                  </div>
                </div>
                
                <div className="absolute inset-0 scale-[0.9] origin-center">
                  {hotelId && (
                    <GuestFlow 
                      key={previewKey} 
                      hotelId={hotelId} 
                      initialSettings={form} 
                      isPreview={true}
                    />
                  )}
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-50" />
              </div>
              <p className="text-[10px] text-center text-supporting-grey font-medium italic">
                Interactive preview. Changes reflect in real-time.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="flex flex-col items-center justify-center p-12 md:p-20">
              <div className="p-8 md:p-12 bg-white rounded-[40px] shadow-[0_0_60px_rgba(255,255,255,0.1)] mb-12">
                <QRCodeSVG 
                  value={`${window.location.origin}/?hotelId=${hotelId}${form.qrCampaignId ? `&cid=${form.qrCampaignId}` : ''}`} 
                  size={window.innerWidth < 768 ? 200 : 280}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">Scan to Rate</h3>
              <p className="text-supporting-grey font-medium mb-12 text-center">Point your camera to start the flow</p>
              <div className="flex flex-col gap-4 w-full md:w-auto">
                <Button variant="outline" className="flex items-center gap-3 justify-center uppercase tracking-widest text-sm">
                  <Download size={20} />
                  Download PNG
                </Button>
                <Button onClick={handleRegenerateQR} variant="outline" className="text-[10px] uppercase tracking-widest text-supporting-grey hover:text-white">
                  Regenerate QR Code
                </Button>
              </div>
            </Card>
            <div className="space-y-8">
              <Card>
                <h3 className="text-xl font-black uppercase tracking-tight mb-6">QR Customization</h3>
                <p className="text-supporting-grey font-medium mb-10 leading-relaxed">Print this QR code on keycards, menus, or lobby signs to capture real-time feedback.</p>
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-widest">Include Logo</span>
                    <div className="w-12 h-6 bg-pink rounded-full relative">
                      <div className="absolute right-1.5 top-1.5 w-3 h-3 bg-black rounded-full" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-widest">Custom Text</span>
                    <span className="text-xs text-supporting-grey font-bold uppercase tracking-widest">"How was your stay?"</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="space-y-8">
            <Card className="max-w-2xl">
              <h3 className="text-xl font-black uppercase tracking-tight mb-8">Add New Slide</h3>
              <div className="space-y-6">
                <Input label="Title" value={promoForm.title || ''} onChange={v => setPromoForm({...promoForm, title: v})} />
                <Input label="Description" value={promoForm.description || ''} onChange={v => setPromoForm({...promoForm, description: v})} />
                <Input label="Image URL" value={promoForm.imageUrl || ''} onChange={v => setPromoForm({...promoForm, imageUrl: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Button Text" value={promoForm.buttonText || ''} onChange={v => setPromoForm({...promoForm, buttonText: v})} />
                  <Input label="Button Link" value={promoForm.buttonLink || ''} onChange={v => setPromoForm({...promoForm, buttonLink: v})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey">Slide Type</label>
                  <select 
                    value={promoForm.type} 
                    onChange={(e) => setPromoForm({...promoForm, type: e.target.value as any})}
                    className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-pink"
                  >
                    <option value="promo" className="bg-charcoal">Promotion</option>
                    <option value="news" className="bg-charcoal">News/Update</option>
                    <option value="newsletter" className="bg-charcoal">Newsletter Signup</option>
                    <option value="blog" className="bg-charcoal">Blog Post</option>
                  </select>
                </div>
                <Button onClick={handleAddPromo} variant="accent" className="w-full uppercase tracking-widest">Add Slide</Button>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promos.map(p => (
                <Card key={p.id} className="relative group">
                  <div className="flex justify-between items-start mb-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      p.type === 'newsletter' ? "bg-blue/10 text-blue border-blue/20" : 
                      p.type === 'blog' ? "bg-pink/10 text-pink border-pink/20" :
                      "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                    )}>
                      {p.type}
                    </span>
                    <button 
                      onClick={() => togglePromo(p.id, !p.active)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        p.active ? "text-emerald-400" : "text-supporting-grey"
                      )}
                    >
                      {p.active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2">{p.title}</h4>
                  <p className="text-sm text-supporting-grey line-clamp-2 mb-6">{p.description}</p>
                  <Button 
                    variant="outline" 
                    className="w-full py-3 text-xs uppercase tracking-widest"
                    onClick={async () => {
                      if (confirm('Delete this slide?')) {
                        try {
                          await deleteDoc(doc(db, `hotels/${hotelId}/promos`, p.id));
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `hotels/${hotelId}/promos/${p.id}`);
                        }
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'guests' && (
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Guest Directory</h3>
                <p className="text-supporting-grey font-medium">All guests who have shared their information.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                className="flex items-center gap-3 w-full md:w-auto justify-center uppercase tracking-widest text-sm"
              >
                <Download size={20} />
                Export CSV
              </Button>
            </div>
            
            <div className="border border-white/5 rounded-3xl overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Guest Name</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Email</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Source</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Last Interaction</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Date</th>
                    <th className="p-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {guestList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-supporting-grey font-bold uppercase tracking-widest text-xs">No guests found.</td>
                    </tr>
                  ) : (
                    guestList.map(g => (
                      <tr key={g.email} className="hover:bg-white/5 transition-colors">
                        <td className="p-6 font-bold tracking-tight">{g.name}</td>
                        <td className="p-6 text-supporting-grey font-medium">{g.email}</td>
                        <td className="p-6 text-supporting-grey text-xs font-bold uppercase tracking-widest">{g.source || 'N/A'}</td>
                        <td className="p-6">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            g.type === 'Review' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : 
                            g.type === 'Feedback' ? "bg-red-400/10 text-red-400 border-red-400/20" : 
                            "bg-blue/10 text-blue border-blue/20"
                          )}>
                            {g.type}
                          </span>
                        </td>
                        <td className="p-6 text-supporting-grey text-xs font-bold uppercase tracking-widest">{new Date(g.timestamp).toLocaleDateString()}</td>
                        <td className="p-6 text-right">
                          <button 
                            onClick={() => setSelectedGuest(g)}
                            className="p-2 text-supporting-grey hover:text-white transition-colors"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Guest Details Modal */}
      <AnimatePresence>
        {selectedGuest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGuest(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-xl w-full bg-charcoal border border-white/10 rounded-[40px] p-12 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-pink" />
              <div className="flex justify-between items-start mb-12">
                <div className="w-20 h-20 bg-pink rounded-3xl flex items-center justify-center rotate-3">
                  <User size={40} className="text-black" />
                </div>
                <button onClick={() => setSelectedGuest(null)} className="p-2 text-supporting-grey hover:text-white">
                  <Trash2 size={24} />
                </button>
              </div>

              <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">{selectedGuest.name}</h3>
              <p className="text-pink font-bold uppercase tracking-widest text-sm mb-12">{selectedGuest.email}</p>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Source</label>
                  <p className="font-bold">{selectedGuest.source || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Last Interaction</label>
                  <p className="font-bold">{selectedGuest.type}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Date</label>
                  <p className="font-bold">{new Date(selectedGuest.timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              <Button onClick={() => setSelectedGuest(null)} variant="accent" className="w-full uppercase tracking-widest">
                Close Profile
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all flex-1",
        active ? "text-pink" : "text-supporting-grey"
      )}
    >
      <div className={cn("p-3 rounded-2xl transition-all", active && "bg-pink/10")}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full p-4 rounded-2xl transition-all font-bold uppercase tracking-widest text-xs",
        active ? "bg-pink text-black shadow-[0_0_30px_rgba(255,131,218,0.2)]" : "text-supporting-grey hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-pink transition-all placeholder:text-white/10 font-medium"
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
      <p className="text-supporting-grey font-bold uppercase tracking-widest text-xs">{message}</p>
    </div>
  );
}
