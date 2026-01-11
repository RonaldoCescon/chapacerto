'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Truck, DollarSign, LogOut, MessageCircle, CheckCircle, 
  Star, Loader2, Copy, X, ShieldCheck, User, Lock, 
  Calendar, UserCircle, Search, List, History, 
  Package, Box, Armchair, Filter, AlertTriangle, Trash2, Clock, 
  Wallet, TrendingUp, Zap, MessageSquare, MapPin, Edit3, Navigation, Compass, Power, Briefcase, Hammer // <--- ADICIONE AQUI
} from 'lucide-react';
import ChatModal from '@/components/ChatModal';
import jsPDF from 'jspdf';

// --- TIPAGENS ---
interface Order {
  id: string; origin: string; destination: string; description: string;
  created_at: string; status: string; updated_at: string;
  scheduled_date?: string; scheduled_time?: string; 
  agreed_price?: number; 
  client: { nome_razao: string; id: string; telefone?: string; cpf?: string }; 
  client_rating?: number;
  cargo_type?: string; 
  clean_description?: string;
  lat?: number; 
  lng?: number;
  distance?: number; 
}

interface MyProposal {
  id: string; amount: number; message: string; proposed_date?: string; proposed_time?: string;
  is_accepted: boolean;
  unread_count?: number; driver_id: string; created_at: string; userHasReviewed?: boolean;
  order: Order;
}

const CARGO_FILTERS = [
  { id: 'all', label: 'Tudo', icon: null },
  { id: 'carga', label: 'Carga/Descarga', icon: <Truck size={14}/> },
  { id: 'mudanca', label: 'Mudança', icon: <Armchair size={14}/> },
  { id: 'ajudante', label: 'Ajudante', icon: <UserCircle size={14}/> },
  { id: 'marido', label: 'Marido Aluguel', icon: <Hammer size={14}/> }, // <--- NOVO
  { id: 'freelance', label: 'Free Lance', icon: <Briefcase size={14}/> },
];

const RADIUS_OPTIONS = [
    { val: 10, label: '10 km' },
    { val: 30, label: '30 km' },
    { val: 50, label: '50 km' },
    { val: 100, label: '100 km' },
    { val: 99999, label: 'Sem Limite' },
];

const getCargoIcon = (type: string | undefined) => {
    switch(type?.toLowerCase()) {
        case 'carga': return <Truck size={14} />;
        case 'mudanca': return <Armchair size={14} />;
        case 'ajudante': return <UserCircle size={14} />;
        case 'marido': return <Hammer size={14} />; // <--- NOVO
        case 'freelance': return <Briefcase size={14} />;
        case 'sacaria': return <Package size={14} />;
        default: return <Truck size={14} />;
    }
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export default function DriverFeed() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileName, setProfileName] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [myProposals, setMyProposals] = useState<MyProposal[]>([]);
  const [loading, setLoading] = useState(true);

  // ESTADOS DE DISPONIBILIDADE (NOVO)
  const [isAvailable, setIsAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);

  // ABAS e FILTROS
  const [activeTab, setActiveTab] = useState<'feed' | 'active' | 'review' | 'history'>('feed');
  const [cargoFilter, setCargoFilter] = useState('all');
  
  // GEO
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [searchRadius, setSearchRadius] = useState(50); 
  const [gpsLoading, setGpsLoading] = useState(false);

  // MODAIS
  const [showChatModal, setShowChatModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  
  // ESTADOS GERAIS
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentChatProposal, setCurrentChatProposal] = useState<MyProposal | null>(null);
  const [currentPaymentProposal, setCurrentPaymentProposal] = useState<MyProposal | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{name: string, id: string, orderId: string} | null>(null);
  
  // FORMULÁRIO 
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [stars, setStars] = useState(5);

  // PAGAMENTO
  const [fee, setFee] = useState(4.99); 
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; id: number } | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'generating' | 'waiting' | 'processing' | 'success'>('idle');

  // DASHBOARD FINANCEIRO
  const totalEarnings = myProposals
    .filter(p => p.order.status === 'completed' && p.is_accepted)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const completedJobsCount = myProposals.filter(p => p.order.status === 'completed').length;

  const playSound = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } };
  const notifyUser = (msg: string) => { playSound(); toast.info(msg, { icon: <Zap className="text-yellow-500"/> }); };
  
  const formatDate = (dateStr: string | undefined) => { if (!dateStr) return 'A combinar'; const [year, month, day] = dateStr.split('-'); return `${day}/${month}`; };
  const isUrgent = (dateStr: string | undefined) => { if (!dateStr) return false; return dateStr === new Date().toISOString().split('T')[0]; }
  const checkChatExpired = (order: Order) => { if (order.status !== 'completed') return false; const finishDate = new Date(order.updated_at).getTime(); const now = new Date().getTime(); return (now - finishDate) / (1000 * 3600 * 24) > 5; };

  // --- ATUALIZA GPS E DISPONIBILIDADE ---
  const updateLocation = (silent = false) => {
      if (!navigator.geolocation) return;
      if (!silent) setGpsLoading(true);
      
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              if (!silent) {
                  setGpsLoading(false);
                  toast.success("Localização atualizada!");
              }
              // Se estiver disponível, atualiza no banco
              if (isAvailable && currentUser) {
                  supabase.from('profiles').update({ 
                      last_lat: pos.coords.latitude, 
                      last_lng: pos.coords.longitude 
                  }).eq('id', currentUser.id).then();
              }
          },
          (err) => {
              console.error(err);
              if (!silent) { setGpsLoading(false); toast.error("Ative o GPS."); }
          }
      );
  };

  const toggleAvailability = async () => {
      if (!currentUser) return;
      setToggling(true);
      const newStatus = !isAvailable;
      
      try {
          // Se for ficar disponível, precisa do GPS
          if (newStatus) {
              navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                      const { error } = await supabase.from('profiles').update({ 
                          is_available: true, 
                          last_lat: pos.coords.latitude, 
                          last_lng: pos.coords.longitude 
                      }).eq('id', currentUser.id);
                      
                      if (error) throw error;
                      setIsAvailable(true);
                      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      toast.success("Você está VISÍVEL para contratantes!", { icon: <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/> });
                  },
                  () => {
                      toast.error("Para ficar disponível, ative o GPS.");
                      setToggling(false);
                  }
              );
          } else {
              // Ficar indisponível
              const { error } = await supabase.from('profiles').update({ is_available: false }).eq('id', currentUser.id);
              if (error) throw error;
              setIsAvailable(false);
              toast.info("Você está OCULTO.");
          }
      } catch (err) {
          toast.error("Erro ao mudar status.");
      } finally {
          setToggling(false);
      }
  };

  useEffect(() => { 
    if (typeof window !== 'undefined') audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }
        setCurrentUser(user);
        
        const { data: profile } = await supabase.from('profiles').select('nome_razao, is_available').eq('id', user.id).single();
        if (profile) {
            setProfileName(profile.nome_razao);
            setIsAvailable(profile.is_available || false);
        }

        fetchOrders(user.id);
        loadMyProposals(user.id);
        updateLocation(true);
    };
    init();
  }, [router]);

  // Polling Pagamento
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showPaymentModal && paymentStep === 'waiting' && pixData?.id) {
        interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/pix?id=${pixData.id}`);
                const data = await res.json();
                if (data.status === 'approved') {
                    if(currentPaymentProposal) {
                        await supabase.from('orders').update({ status: 'paid' }).eq('id', currentPaymentProposal.order.id);
                        setPaymentStep('success'); 
                        playSound(); 
                        toast.success("Pagamento confirmado!");
                        loadMyProposals(currentUser.id);
                    }
                }
            } catch (e) { console.error("Polling error", e); }
        }, 3000); 
    }
    return () => clearInterval(interval);
  }, [showPaymentModal, paymentStep, pixData, currentPaymentProposal, currentUser]);

  // Realtime
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase.channel(`driver_realtime_${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `driver_id=eq.${currentUser.id}` }, (payload) => {
         loadMyProposals(currentUser.id);
         if (payload.eventType === 'UPDATE' && (payload.new as any).is_accepted === true) {
            playSound();
            toast.success('Sua proposta foi ACEITA!', { icon: <CheckCircle className="text-green-500" /> });
         }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
         if (payload.new.sender_id !== currentUser.id) {
             const { data: proposal } = await supabase.from('proposals').select('driver_id').eq('id', payload.new.proposal_id).single();
             if (proposal && proposal.driver_id === currentUser.id) {
                 notifyUser('Nova mensagem 💬');
                 loadMyProposals(currentUser.id);
             }
         }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
         if (payload.eventType === 'INSERT' && (payload.new as any).status === 'open') {
            playSound();
            toast.info('Nova Vaga Disponível!');
         }
         fetchOrders(currentUser.id);
         loadMyProposals(currentUser.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const parseOrderData = (order: any) => {
      const match = order.description ? order.description.match(/^\[(.*?)\]/) : null;
      const cargo = match ? match[1] : 'geral'; 
      const cleanDesc = match ? order.description.replace(/^\[.*?\]\s*/, '') : order.description;
      return { ...order, cargo_type: cargo, clean_description: cleanDesc };
  };

  const fetchOrders = async (userId: string) => {
    const { data: ordersData } = await supabase.from('orders').select('*, client:profiles(nome_razao, id)').eq('status', 'open').order('created_at', { ascending: false });
    if (ordersData) {
      const enhanced = await Promise.all(ordersData.map(async (order: any) => {
        const { data: reviews } = await supabase.from('reviews').select('stars').eq('target_id', order.client?.id);
        const avg = reviews?.length ? reviews.reduce((acc, curr) => acc + curr.stars, 0) / reviews.length : 5; 
        if (!order.client) order.client = { nome_razao: 'Cliente', id: '0' };
        return parseOrderData({ ...order, client_rating: avg });
      }));
      setOrders(enhanced);
    }
    setLoading(false);
  };

  const loadMyProposals = async (userIdOverride?: string) => {
    const uid = userIdOverride || currentUser?.id;
    if (!uid) return;
    const { data: proposals } = await supabase.from('proposals').select('*, order:order_id(*, client:profiles(nome_razao, id, telefone, cpf))').eq('driver_id', uid).order('created_at', { ascending: false });
    if (proposals) {
      const enhanced = await Promise.all(proposals.map(async (p: any) => {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('proposal_id', p.id).eq('is_read', false).neq('sender_id', uid);
        const { count: reviewCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('order_id', p.order_id).eq('reviewer_id', uid);
        if (!p.order.client) p.order.client = { nome_razao: 'Cliente', id: '0', telefone: '' };
        p.order = parseOrderData(p.order);
        return { ...p, unread_count: count || 0, userHasReviewed: (reviewCount || 0) > 0 };
      }));
      setMyProposals(enhanced);
    }
  };

  const filteredFeed = orders
    .map(order => {
        let dist: number | undefined = undefined; 
        if (userCoords && order.lat && order.lng) {
            dist = calculateDistance(userCoords.lat, userCoords.lng, order.lat, order.lng);
        }
        return { ...order, distance: dist };
    })
    .filter(o => {
        const matchesCargo = cargoFilter === 'all' || o.cargo_type?.toLowerCase() === cargoFilter;
        const matchesRadius = o.distance !== undefined ? o.distance <= searchRadius : true;
        return matchesCargo && matchesRadius;
    })
    .sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
        return 0; 
    });

  const filteredProposals = myProposals.filter(p => {
      if (activeTab === 'active') return (!p.is_accepted && p.order.status === 'open') || (p.is_accepted && p.order.status !== 'completed');
      if (activeTab === 'review') return p.order.status === 'completed' && !p.userHasReviewed;
      if (activeTab === 'history') return p.order.status === 'completed' && p.userHasReviewed;
      return false;
  });

  // AÇÕES
  const openProposal = (order: Order) => {
      const existing = myProposals.find(p => p.order.id === order.id);
      if (existing) { toast.info("Você já tem uma proposta aqui."); openEditProposal(existing); return; }
      setSelectedOrder(order); setEditingProposalId(null); setPrice(order.agreed_price ? order.agreed_price.toString() : ''); setMessage(''); setShowProposalModal(true);
  };

  const openEditProposal = (prop: MyProposal) => {
      setSelectedOrder(prop.order); setEditingProposalId(prop.id); setPrice(prop.amount.toString()); setMessage(prop.message); setShowProposalModal(true);
  };

  const sendProposal = async (e: React.FormEvent) => {
      e.preventDefault(); setSending(true);
      const payload = { order_id: selectedOrder?.id, driver_id: currentUser.id, amount: parseFloat(price), message: message };
      if (editingProposalId) { await supabase.from('proposals').update(payload).eq('id', editingProposalId); toast.success('Atualizado!'); } 
      else { await supabase.from('proposals').insert(payload); toast.success('Enviado!'); }
      setShowProposalModal(false); loadMyProposals(currentUser.id); setActiveTab('active'); setSending(false);
  };

  const handleDeleteProposal = async (proposalId: string) => {
      if(!confirm('Cancelar oferta?')) return;
      await supabase.from('proposals').delete().eq('id', proposalId); toast.success('Cancelada.'); loadMyProposals(currentUser.id);
  };

  const handleReport = async (targetId: string, orderId: string) => {
    const reason = prompt("Motivo da denúncia?"); if (!reason) return;
    await supabase.from('reports').insert({ accuser_id: currentUser.id, accused_id: targetId, order_id: orderId, reason: reason });
    toast.success("Denúncia enviada.");
  };

  const handleFinish = async (orderId: string) => {
      if(!confirm('Finalizar serviço?')) return;
      try {
          const { error } = await supabase.rpc('finish_order', { p_order_id: orderId });
          if (error) throw error;
          toast.success('Finalizado! 🏁'); loadMyProposals(currentUser.id); setActiveTab('review');
      } catch { toast.error("Erro ao finalizar."); }
  };

  const handleReview = async () => {
      if (ratingTarget && currentUser) {
          await supabase.from('reviews').insert({ order_id: ratingTarget.orderId, reviewer_id: currentUser.id, target_id: ratingTarget.id, stars });
          toast.success('Avaliado!'); setShowRatingModal(false); loadMyProposals(currentUser.id);
      }
  };

  const generateReceipt = async (prop: MyProposal) => {
    const toastId = toast.loading('Baixando...');
    try {
        const { data: driverData } = await supabase.from('profiles').select('cpf').eq('id', currentUser.id).single();
        const myName = (profileName || 'PRESTADOR').toUpperCase(); const myCpf = driverData?.cpf || '***';
        const clientName = prop.order.client.nome_razao.toUpperCase(); const clientCpf = (prop.order.client as any).cpf || '***';
        const doc = new jsPDF();
        doc.setFontSize(18); doc.text("RECIBO", 105, 20, { align: "center" });
        doc.setFontSize(10); doc.text(`PRESTADOR: ${myName} (${myCpf})`, 20, 40);
        doc.text(`TOMADOR: ${clientName} (${clientCpf})`, 20, 55);
        doc.text(`SERVIÇO: ${prop.order.clean_description}`, 20, 70);
        doc.text(`VALOR: R$ ${prop.amount.toFixed(2)}`, 20, 85);
        doc.save(`Recibo_${prop.id.slice(0,6)}.pdf`);
        toast.dismiss(toastId); toast.success('Sucesso!');
    } catch { toast.dismiss(toastId); toast.error('Erro.'); }
  };

  const startPayment = (p: MyProposal) => { setCurrentPaymentProposal(p); setFee(4.99); setPixData(null); setPaymentStep('idle'); setShowPaymentModal(true); };
  const handlePix = async () => { setPaymentStep('generating'); try { const res = await fetch('/api/pix', { method: 'POST', body: JSON.stringify({ amount: fee, email: currentUser.email }) }); const data = await res.json(); setPixData(data); setPaymentStep('waiting'); } catch { setPaymentStep('idle'); } };
  const handleOpenChat = (p: MyProposal) => { if (checkChatExpired(p.order)) { toast.error('Expirado.'); return; } setCurrentChatProposal(p); setShowChatModal(true); };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans relative">
      {/* HEADER + DISPONIBILIDADE */}
      <div className="bg-white pt-6 pb-8 px-4 rounded-b-[2.5rem] shadow-sm relative overflow-hidden border-b border-gray-100 z-10">
         <div className="max-w-md mx-auto relative z-10">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/profile')} className="bg-gray-100 p-2 rounded-full border border-gray-200"><UserCircle className="text-gray-600" size={24}/></button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-none">{profileName.split(' ')[0]}</h1>
                        <p className="text-xs text-gray-500">Chapa Profissional</p>
                    </div>
                </div>
                {/* BOTÃO TOGGLE DE DISPONIBILIDADE */}
                <button 
                    onClick={toggleAvailability} 
                    disabled={toggling}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shadow-md ${isAvailable ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                >
                    {toggling ? <Loader2 size={14} className="animate-spin"/> : <Power size={14} />}
                    {isAvailable ? 'DISPONÍVEL' : 'OFFLINE'}
                </button>
            </div>

            {/* DASHBOARD CARD */}
            <div className={`rounded-3xl p-6 shadow-lg text-white flex justify-between items-center relative overflow-hidden transition-all ${isAvailable ? 'bg-gradient-to-br from-green-600 to-emerald-800' : 'bg-gradient-to-br from-gray-600 to-gray-800 grayscale'}`}>
                <div className="relative z-10">
                    <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Saldo Atual</p>
                    <h2 className="text-4xl font-black tracking-tight drop-shadow-sm">R$ {totalEarnings.toFixed(2)}</h2>
                </div>
                <div className="text-right relative z-10">
                    <div className="bg-white/20 p-2.5 rounded-xl mb-1 inline-flex backdrop-blur-md border border-white/10"><TrendingUp size={24}/></div>
                    <p className="text-[10px] font-bold opacity-90">{completedJobsCount} jobs</p>
                </div>
            </div>
         </div>
      </div>

      <main className="max-w-md mx-auto px-4 -mt-6 relative z-20">
        <div className="bg-white p-1.5 rounded-2xl shadow-lg border border-gray-100 flex justify-between mb-8">
            <button onClick={() => {setActiveTab('feed'); fetchOrders(currentUser?.id)}} className={`flex-1 py-3 text-[10px] font-bold rounded-xl uppercase transition-all tracking-wide ${activeTab === 'feed' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>🔍 Vagas</button>
            <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-[10px] font-bold rounded-xl uppercase transition-all tracking-wide ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>🚀 Ativos</button>
            <button onClick={() => setActiveTab('review')} className={`flex-1 py-3 text-[10px] font-bold rounded-xl uppercase transition-all tracking-wide ${activeTab === 'review' ? 'bg-yellow-500 text-black shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>⭐ Avaliar</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[10px] font-bold rounded-xl uppercase transition-all tracking-wide ${activeTab === 'history' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>📜 Hist.</button>
        </div>

        {activeTab === 'feed' && (
            <>
                <div className="flex justify-between items-center mb-3 px-1">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase mr-1 flex items-center gap-1"><Compass size={12}/> Raio:</span>
                        {RADIUS_OPTIONS.map(r => (<button key={r.val} onClick={() => setSearchRadius(r.val)} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors border ${searchRadius === r.val ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-400 border-gray-200'}`}>{r.label}</button>))}
                    </div>
                    <button onClick={() => updateLocation()} className="text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors" disabled={gpsLoading}>{gpsLoading ? <Loader2 size={16} className="animate-spin"/> : <Navigation size={16}/>}</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
                    {CARGO_FILTERS.map(c => (<button key={c.id} onClick={() => setCargoFilter(c.id)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all active:scale-95 ${cargoFilter === c.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}>{c.icon} {c.label}</button>))}
                </div>
            </>
        )}

        {!loading && activeTab === 'feed' && (
            <div className="space-y-5">
                {filteredFeed.length === 0 && <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200"><p className="text-gray-400 text-sm font-medium">Sem vagas no raio.</p><button onClick={() => setSearchRadius(99999)} className="text-blue-600 font-bold text-xs mt-2 hover:underline">Ver todas</button></div>}
                {filteredFeed.map(order => (
                    <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:border-green-300 transition-all relative group">
                        {isUrgent(order.scheduled_date) && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-3 py-1.5 rounded-bl-2xl shadow-md z-10 flex items-center gap-1"><Zap size={10} fill="currentColor"/> URGENTE</div>}
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">{getCargoIcon(order.cargo_type)} {order.cargo_type}</span>
                                {order.distance !== undefined && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 flex items-center gap-1"><Navigation size={10}/> {order.distance.toFixed(1)} km</span>}
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-5 leading-tight">{order.clean_description}</h3>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100"><p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Quando</p><div className="flex items-center gap-1.5 text-sm font-bold text-blue-600"><Calendar size={14}/> {formatDate(order.scheduled_date)}</div></div>
                                <div className="bg-green-50 p-3 rounded-2xl border border-green-100"><p className="text-[9px] text-green-600 font-bold uppercase mb-1">Valor</p><div className="flex items-center gap-1.5 text-xl font-black text-green-600"><span className="text-sm font-medium">R$</span> {order.agreed_price || '?'}</div></div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-5 pl-1"><MapPin size={14}/><p className="truncate font-medium">{order.origin}</p></div>
                            <button onClick={() => openProposal(order)} className="w-full bg-gray-900 text-white py-4 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-black"><DollarSign size={16}/> Enviar Proposta</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* LISTAS PROPOSTAS */}
        {!loading && activeTab !== 'feed' && (
            <div className="space-y-5">
                {filteredProposals.length === 0 && <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 text-sm">Lista vazia.</div>}
                {filteredProposals.map(prop => (
                    <div key={prop.id} className={`bg-white rounded-3xl border p-6 shadow-sm transition-all ${prop.is_accepted ? 'border-green-500 ring-1 ring-green-50 shadow-md' : 'border-gray-100'}`}>
                        <div className="flex justify-between mb-4">
                            <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-500 tracking-wider font-mono">#{prop.order.id.slice(0,5)}</span>
                            <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5 border ${prop.is_accepted ? 'bg-green-50 text-green-600 border-green-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>{prop.is_accepted ? <><CheckCircle size={10}/> Aceito</> : 'Pendente'}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2 text-sm">{prop.order.clean_description}</h3>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4"><span className="text-gray-400 text-xs">Sua oferta:</span><span className="font-black text-green-600 text-lg">R$ {prop.amount}</span></div>
                        
                        {/* BOTÕES DE AÇÃO */}
                        <div className="mt-2">
                            <button onClick={() => handleOpenChat(prop)} className={`w-full font-bold py-3.5 rounded-xl text-xs flex justify-center gap-2 items-center relative transition-colors ${prop.is_accepted ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                <MessageSquare size={16}/> {checkChatExpired(prop.order) ? 'Chat Expirado' : 'Abrir Chat'} 
                                {(prop.unread_count || 0) > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-bold animate-bounce shadow-md border border-white">{prop.unread_count}</span>}
                            </button>
                        </div>

                        {/* PAGAMENTO SEMPRE VISÍVEL SE AINDA NÃO PAGO */}
                        {prop.order.status !== 'paid' && (
                            <div className="mt-3">
                                <button onClick={() => startPayment(prop)} className="w-full bg-blue-50 text-blue-600 border border-blue-100 py-3.5 rounded-xl text-xs font-bold flex justify-center gap-2 items-center hover:bg-blue-100 transition-colors">
                                    <Lock size={14}/> Liberar Contato Agora (R$ 4,99)
                                </button>
                            </div>
                        )}

                        {prop.order.status === 'paid' && (
                            <div className="mt-3 bg-green-50 border border-green-200 p-4 rounded-xl flex justify-between items-center">
                                <div><p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Contato do Cliente</p><p className="font-mono font-bold text-green-800 text-lg">{prop.order.client.telefone}</p></div>
                                <a href={`https://wa.me/55${prop.order.client.telefone}`} className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"><MessageCircle size={20}/></a>
                            </div>
                        )}

                        {!prop.is_accepted && (
                            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                                <button onClick={() => handleDeleteProposal(prop.id)} className="border border-red-200 bg-red-50 text-red-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors text-xs"><Trash2 size={16}/> Cancelar</button>
                                <button onClick={() => openEditProposal(prop)} className="bg-gray-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors text-xs"><Edit3 size={16}/> Editar</button>
                            </div>
                        )}
                        
                        {prop.is_accepted && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-3">
                                    {prop.order.status === 'completed' ? (
                                        <button onClick={() => generateReceipt(prop)} className="col-span-2 bg-gray-100 text-gray-600 border border-gray-200 font-bold py-3.5 rounded-xl text-xs flex justify-center gap-2 items-center hover:bg-gray-200 transition-colors"><CheckCircle size={14} className="text-green-500"/> Gerar Recibo</button>
                                    ) : (
                                        <button onClick={() => handleFinish(prop.order.id)} className="col-span-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl text-xs flex justify-center gap-2 items-center shadow-lg active:scale-95 hover:bg-black"><CheckCircle size={16}/> Finalizar Serviço</button>
                                    )}
                                </div>
                                {prop.order.status === 'completed' && !prop.userHasReviewed && (
                                    <button onClick={() => { setRatingTarget({name: prop.order.client.nome_razao, id: prop.order.client.id, orderId: prop.order.id}); setShowRatingModal(true); }} className="w-full bg-yellow-400 text-black font-bold py-3.5 rounded-xl text-xs flex justify-center gap-2 shadow-lg hover:bg-yellow-500"><Star size={16}/> Avaliar Cliente</button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </main>

      {/* MODAL PROPOSTA INTELIGENTE */}
      {showProposalModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl animate-in zoom-in-95">
                  <h3 className="font-bold text-lg mb-1 text-center text-gray-900">{editingProposalId ? 'Editar Proposta' : 'Enviar Proposta'}</h3>
                  <p className="text-xs text-gray-400 mb-6 text-center">Para: {selectedOrder.clean_description}</p>
                  <form onSubmit={sendProposal} className="space-y-6">
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Seu Valor (R$)</label>
                          <input type="number" step="0.01" className="w-full text-5xl font-black text-center bg-transparent border-b border-gray-200 focus:border-gray-900 outline-none py-4 text-gray-900" value={price} onChange={e => setPrice(e.target.value)} required />
                          <div className="flex gap-2 mt-4 justify-center">
                              <button type="button" onClick={() => setPrice((parseFloat(price || '0') + 10).toString())} className="bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-200 border border-gray-200">+10</button>
                              <button type="button" onClick={() => setPrice((parseFloat(price || '0') + 50).toString())} className="bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-200 border border-gray-200">+50</button>
                              {selectedOrder.agreed_price && <button type="button" onClick={() => setPrice(selectedOrder.agreed_price?.toString() || '')} className="bg-green-50 text-green-600 text-xs font-bold px-4 py-2 rounded-full border border-green-200 hover:bg-green-100">Aceitar R$ {selectedOrder.agreed_price}</button>}
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Mensagem</label>
                          <textarea placeholder="Ex: Chego em 30 min, tenho carrinho..." className="w-full bg-gray-50 text-gray-900 rounded-xl p-4 text-sm min-h-[100px] resize-none focus:ring-1 ring-gray-200 outline-none border border-gray-100" value={message} onChange={e => setMessage(e.target.value)} />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setShowProposalModal(false)} className="flex-1 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors">Cancelar</button>
                          <button disabled={sending} className="flex-[2] bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center active:scale-95 transition-transform hover:bg-black">{sending ? <Loader2 className="animate-spin"/> : (editingProposalId ? 'Salvar' : 'Enviar Agora')}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL PAGAMENTO (PARA LIBERAR CONTATO) */}
      {showPaymentModal && currentPaymentProposal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white w-full max-w-sm p-8 rounded-3xl text-center shadow-2xl relative">
                    <button onClick={() => setShowPaymentModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border border-blue-100"><ShieldCheck size={40} className="text-blue-600"/></div>
                    <h3 className="font-bold text-xl mb-2 text-gray-900">Liberar Contato</h3>
                    <p className="text-gray-500 text-sm mb-6">Pague a taxa única para ver o WhatsApp e falar direto com o contratante.</p>
                    
                    {paymentStep === 'idle' && <button onClick={handlePix} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-colors">Gerar Pix (R$ 4,99)</button>}
                    
                    {paymentStep === 'waiting' && pixData && (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-4">
                            <p className="text-xs text-gray-500 mb-4">Copie e cole no seu banco:</p>
                            <input readOnly value={pixData.qr_code} className="w-full text-[10px] mb-4 p-3 bg-white border border-gray-200 rounded-lg font-mono text-gray-600"/>
                            <button onClick={() => {navigator.clipboard.writeText(pixData.qr_code); toast.success('Copiado!')}} className="text-blue-600 font-bold text-xs mb-6 flex items-center justify-center gap-1 hover:text-blue-800"><Copy size={12}/> Copiar Código</button>
                            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 animate-pulse"><Loader2 className="animate-spin" size={14}/> Aguardando pagamento...</div>
                        </div>
                    )}
                </div>
            </div>
      )}

      {/* OUTROS MODAIS MANTIDOS */}
      {showRatingModal && ratingTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
                  <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500 border border-yellow-100"><Star size={32} fill="currentColor"/></div>
                  <h3 className="font-bold text-xl mb-1 text-gray-900">Avaliar Cliente</h3>
                  <div className="flex justify-center gap-2 my-8">
                      {[1,2,3,4,5].map(s => (<button key={s} onClick={() => setStars(s)} className={`p-1 transition-transform hover:scale-125 ${s <= stars ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`}><Star size={36} fill="currentColor"/></button>))}
                  </div>
                  <button onClick={handleReview} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform hover:bg-black">Enviar Avaliação</button>
              </div>
          </div>
      )}

      {showChatModal && currentChatProposal && currentUser && (
          <ChatModal proposalId={currentChatProposal.id} driverName={currentChatProposal.order.client.nome_razao} currentUserId={currentUser.id} onClose={() => setShowChatModal(false)} onMessagesRead={() => loadMyProposals(currentUser.id)} />
      )}
    </div>
  );
}