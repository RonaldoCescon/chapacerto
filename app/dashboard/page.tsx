'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Plus, Package, LogOut, CheckCircle, X, DollarSign, 
  Phone, Copy, Clock, MessageCircle, Loader2, Trash2, 
  MessageSquare, Star, Calendar, ShieldCheck, UserCircle, 
  Edit3, Box, Truck, Armchair, AlertTriangle, 
  Search, List, History, ThumbsUp, Lock, FileText, MapPin, Zap
} from 'lucide-react';
import ChatModal from '@/components/ChatModal';
import jsPDF from 'jspdf';

// --- TIPAGENS ---
interface Order { 
  id: string; origin: string; destination: string;
  description: string; status: string; updated_at: string;
  created_at: string; scheduled_date?: string; scheduled_time?: string; 
  agreed_price?: number; proposal_count?: number; cargo_type?: string; 
  clean_description?: string; user_has_reviewed?: boolean;
}

interface Proposal { 
  id: string; amount: number; message: string; driver_id: string; 
  driver: { nome_razao: string; telefone: string; id: string } | null; 
  is_accepted: boolean; order_id: string; unread_count?: number; driver_rating?: number; 
  proposed_date?: string; proposed_time?: string;
  created_at: string; userHasReviewed?: boolean; 
}

const CARGO_TYPES = [
  { id: 'sacaria', label: 'Sacaria', icon: <Package size={20}/> },
  { id: 'caixas', label: 'Caixas', icon: <Box size={20}/> },
  { id: 'moveis', label: 'Móveis', icon: <Armchair size={20}/> },
  { id: 'ajudante', label: 'Ajudante Geral', icon: <UserCircle size={20}/> },
];

const getCargoIcon = (type: string | undefined) => {
    switch(type?.toLowerCase()) {
        case 'sacaria': return <Package size={14} />;
        case 'caixas': return <Box size={14} />;
        case 'moveis': return <Armchair size={14} />;
        case 'ajudante': return <UserCircle size={14} />;
        default: return <Truck size={14} />;
    }
};

export default function ClientDashboard() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'review' | 'history'>('active');

  // Modais
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Edição e Forms
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({ origin: '', description: '', date: '', time: '', cargoType: 'sacaria', price: '' });

  // Dados Auxiliares
  const [selectedOrderProposals, setSelectedOrderProposals] = useState<Proposal[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [currentOrderIdForProposals, setCurrentOrderIdForProposals] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{name: string, id: string, orderId: string} | null>(null);
  const [stars, setStars] = useState(5);

  // Cancelamento e Pagamento
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [sending, setSending] = useState(false);
  const [fee, setFee] = useState(4.99); 
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; id: number } | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'generating' | 'waiting' | 'processing' | 'success'>('idle');

  // Helpers
  const formatDate = (dateStr: string | undefined) => { if (!dateStr) return 'A combinar'; const [year, month, day] = dateStr.split('-'); return `${day}/${month}/${year}`; };
  const formatProposalTime = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';
  const getWhatsAppLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`;
  const parseOrderData = (order: any) => { const match = order.description ? order.description.match(/^\[(.*?)\]/) : null; const cargo = match ? match[1] : 'sacaria'; const cleanDesc = match ? order.description.replace(/^\[.*?\]\s*/, '') : order.description; return { ...order, cargo_type: cargo, clean_description: cleanDesc }; };
  
  const playSound = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } };
  const notifyUser = (msg: string) => { playSound(); toast.info(msg, { duration: 5000, icon: <Zap className="text-yellow-500"/> }); };
  const checkChatExpired = (order: Order) => { if (order.status !== 'completed') return false; const finishDate = new Date(order.updated_at).getTime(); const now = new Date().getTime(); return (now - finishDate) / (1000 * 3600 * 24) > 5; };

  // --- INIT ---
  useEffect(() => { 
    if (typeof window !== 'undefined') audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser(); 
        if (!user) { router.push('/login'); return; } 
        setCurrentUser(user); 
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setCurrentProfile(profile);

        fetchOrders(user.id); 
    };
    init();
  }, [router]);

  // --- POLLING PAGAMENTO ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showPaymentModal && paymentStep === 'waiting' && pixData?.id) {
        interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/pix?id=${pixData.id}`);
                const data = await res.json();
                if (data.status === 'approved') {
                    if(currentProposal) {
                        await supabase.from('orders').update({ status: 'paid' }).eq('id', currentProposal.order_id);
                        setPaymentStep('success'); 
                        playSound(); 
                        toast.success("Pagamento confirmado!");
                    }
                }
            } catch (e) { console.error("Polling error", e); }
        }, 3000); 
    }
    return () => clearInterval(interval);
  }, [showPaymentModal, paymentStep, pixData, currentProposal]);

  // --- REALTIME (COM DEBUG) ---
  useEffect(() => {
    // Só conecta se tiver usuário
    if (!currentUser?.id) {
        console.log("⏳ Realtime aguardando usuário logar...");
        return;
    }

    console.log("🔌 Iniciando conexão Realtime para usuário:", currentUser.id);

    const channel = supabase.channel(`client_dashboard_${currentUser.id}`)
        // Escuta TUDO da tabela orders (seja insert, update ou delete)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            console.log("⚡ [Realtime] Mudança em Pedido:", payload);
            fetchOrders(currentUser.id);
            
            // Notificações Específicas
            if (payload.eventType === 'UPDATE') {
                const newOrder = payload.new as Order;
                if (newOrder.status === 'paid') toast.success('Contato liberado!', { icon: <CheckCircle className="text-green-500"/> });
                if (newOrder.status === 'completed') {
                     toast.success('Serviço finalizado pelo Chapa!', { icon: <Star className="text-yellow-500"/> });
                     setActiveTab('review');
                }
            }
        })
        // Escuta Novas Propostas
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proposals' }, (payload) => {
            console.log("⚡ [Realtime] Nova Proposta:", payload);
            notifyUser('Nova proposta recebida! 🚚');
            fetchOrders(currentUser.id);
            if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
        })
        // Escuta Novas Mensagens
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            console.log("⚡ [Realtime] Nova Mensagem:", payload);
            if (payload.new.sender_id !== currentUser.id) { 
                notifyUser('Nova mensagem 💬'); 
                fetchOrders(currentUser.id); 
                if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log("✅ Realtime CONECTADO com Sucesso!");
            if (status === 'CHANNEL_ERROR') console.error("❌ Erro no canal Realtime.");
            if (status === 'TIMED_OUT') console.error("⚠️ Timeout no Realtime.");
        });

    return () => { 
        console.log("🔌 Desconectando Realtime...");
        supabase.removeChannel(channel); 
    };
  }, [currentUser, currentOrderIdForProposals]);

  const fetchOrders = async (userId: string) => {
    const { data: ordersData } = await supabase.from('orders').select('*').eq('client_id', userId).order('created_at', { ascending: false });
    
    if (ordersData) {
      const ordersWithCounts = await Promise.all(ordersData.map(async (order) => {
        const [propRes, reviewRes] = await Promise.all([
            supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('order_id', order.id),
            supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('order_id', order.id).eq('reviewer_id', userId)
        ]);

        let unread = 0;
        const { data: props } = await supabase.from('proposals').select('id').eq('order_id', order.id);
        if(props?.length) {
            const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true })
                .in('proposal_id', props.map(p => p.id)).eq('is_read', false).neq('sender_id', userId);
            unread = msgCount || 0;
        }

        const parsed = parseOrderData(order);
        return { 
            ...parsed, 
            proposal_count: propRes.count || 0, 
            user_has_reviewed: (reviewRes.count || 0) > 0, 
            unread_total: unread 
        };
      }));
      setOrders(ordersWithCounts as any);
      
      if (currentOrderIdForProposals) {
          const found = ordersWithCounts.find(o => o.id === currentOrderIdForProposals);
          if (found) setCurrentOrder(found);
      }
    }
    setLoading(false);
  };

  // --- ACTIONS ---
  
  const handleReport = async (targetId: string, orderId: string) => {
    const reason = prompt("Qual o motivo da denúncia? (Assédio, Golpe, Não compareceu)");
    if (!reason) return;
    try {
        const { error } = await supabase.from('reports').insert({
            accuser_id: currentUser.id,
            accused_id: targetId,
            order_id: orderId,
            reason: reason,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        toast.success("Denúncia enviada.", { icon: <ShieldCheck className="text-green-500"/> });
    } catch {
        toast.error("Erro ao enviar denúncia.");
    }
  };

  const handleFinishOrder = async (orderId: string) => {
      if(!confirm('O serviço foi realizado? Ao confirmar, você finaliza o chamado.')) return;
      const { error } = await supabase.from('orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if(!error) { 
          toast.success('Serviço finalizado!'); 
          fetchOrders(currentUser.id); 
          setActiveTab('review'); 
      } else { 
          toast.error('Erro ao finalizar.'); 
      }
  };

  const generateReceipt = async (order: any) => {
    if (order.status !== 'completed') { 
        toast.error("O serviço precisa ser finalizado."); 
        return; 
    }

    const toastId = toast.loading('Gerando recibo...');

    try {
        const { data: proposal, error } = await supabase
            .from('proposals')
            .select('amount, driver:profiles(nome_razao, cpf)')
            .eq('order_id', order.id)
            .eq('is_accepted', true)
            .single();

        if (error || !proposal || !proposal.driver) {
            toast.error('Erro ao encontrar dados do prestador.');
            return;
        }

        // --- CORREÇÃO: Tratamento do tipo de dado do driver (Array ou Objeto) ---
        const driverData = Array.isArray(proposal.driver) ? proposal.driver[0] : proposal.driver;
        const driverName = driverData?.nome_razao || 'PRESTADOR CHAPA';
        const driverCpf = driverData?.cpf || '***.***.***-**';
        // ------------------------------------------------------------------------

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇO", 105, 20, { align: "center" });
        doc.setLineWidth(0.5);
        doc.line(20, 25, 190, 25);

        doc.setFontSize(10);
        doc.text("PRESTADOR DO SERVIÇO (QUEM RECEBEU):", 20, 40);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(driverName.toUpperCase(), 20, 46);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        doc.text(`CPF/CNPJ: ${driverCpf}`, 20, 52);

        doc.text("TOMADOR DO SERVIÇO (QUEM PAGOU):", 20, 65);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text((currentProfile?.nome_razao || 'CLIENTE').toUpperCase(), 20, 71);
        doc.setFont("helvetica", "normal");

        doc.setFontSize(10);
        doc.text("DESCRIÇÃO DO SERVIÇO:", 20, 85);
        doc.setFontSize(12);
        doc.text(`${order.clean_description}`, 20, 91);
        doc.setFontSize(10);
        doc.text("LOCAL:", 20, 100);
        doc.setFontSize(12);
        doc.text(`${order.origin}`, 20, 106);

        doc.setDrawColor(0);
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 115, 170, 15, 'F');
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`VALOR TOTAL: R$ ${proposal.amount.toFixed(2)}`, 180, 125, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Data do Serviço: ${formatDate(order.scheduled_date)}`, 20, 140);
        
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Documento gerado eletronicamente pela plataforma ChapaCerto.", 105, 280, { align: "center" });

        doc.save(`Recibo_Servico_${order.id.slice(0,6)}.pdf`);
        toast.dismiss(toastId);
        toast.success("Recibo baixado!");

    } catch (err) {
        console.error(err);
        toast.dismiss(toastId);
        toast.error("Erro ao gerar PDF.");
    }
  };

  const openNewOrderModal = () => { 
      setIsEditing(false); setEditingOrderId(null);
      setOrderForm({ origin: '', description: '', date: '', time: '', cargoType: 'sacaria', price: '' }); 
      setShowNewOrderModal(true); 
  };

  const openEditOrderModal = (order: Order) => { 
      const match = order.description.match(/^\[(.*?)\]/);
      setOrderForm({ 
          origin: order.origin, 
          description: match ? order.description.replace(/^\[.*?\]\s*/, '') : order.description, 
          date: order.scheduled_date || '', 
          time: order.scheduled_time || '', 
          cargoType: match ? match[1].toLowerCase() : 'sacaria',
          price: order.agreed_price ? order.agreed_price.toString() : '' 
      });
      setIsEditing(true); setEditingOrderId(order.id); setShowNewOrderModal(true); 
  };
  
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const payload = { 
        origin: orderForm.origin, 
        description: `[${orderForm.cargoType.toUpperCase()}] ${orderForm.description}`, 
        scheduled_date: orderForm.date || null, 
        scheduled_time: orderForm.time || null,
        agreed_price: orderForm.price ? parseFloat(orderForm.price) : null 
    };
    
    if (isEditing && editingOrderId) await supabase.from('orders').update(payload).eq('id', editingOrderId);
    else await supabase.from('orders').insert({ client_id: currentUser.id, status: 'open', destination: 'Local', ...payload });
    
    setShowNewOrderModal(false); fetchOrders(currentUser.id); setLoading(false); toast.success(isEditing ? 'Atualizado!' : 'Criado!');
  };

  const handleDeleteOrder = async (id: string) => { 
      if(confirm('Excluir este pedido?')) { 
          await supabase.from('proposals').delete().eq('order_id', id); 
          await supabase.from('orders').delete().eq('id', id);
          setOrders(prev => prev.filter(o => o.id !== id)); toast.success('Excluído.'); 
      } 
  };

  const initiateCancel = (orderId: string) => { setCancelOrderId(orderId); setCancelReason(''); setShowCancelModal(true); };
  
  const confirmCancel = async () => {
      if (!cancelOrderId || !cancelReason.trim()) { toast.error('Diga o motivo.'); return; }
      setSending(true);
      await supabase.from('orders').update({ status: 'open', agreed_price: null }).eq('id', cancelOrderId);
      await supabase.from('proposals').delete().eq('order_id', cancelOrderId).eq('is_accepted', true);
      toast.success('Cancelado. Pedido voltou para a fila.'); setShowCancelModal(false); fetchOrders(currentUser.id); setSending(false);
  };

  const handleViewProposals = async (orderId: string, openModal = true) => {
    setCurrentOrderIdForProposals(orderId);
    if (openModal) { setShowProposalsModal(true); setProposalsLoading(true); setSelectedOrderProposals([]); }
    
    const { data: proposals } = await supabase.from('proposals').select('*, driver:profiles(nome_razao, telefone, id)').eq('order_id', orderId).order('is_accepted', { ascending: false });
    
    if (proposals) {
      const enhanced = await Promise.all(proposals.map(async (p: any) => {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('proposal_id', p.id).eq('is_read', false).neq('sender_id', currentUser.id);
        const { count: reviewCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('order_id', orderId).eq('reviewer_id', currentUser.id);
        let avg = 5; 
        if (p.driver?.id) { 
            const { data: r } = await supabase.from('reviews').select('stars').eq('target_id', p.driver.id); 
            if(r?.length) avg = r.reduce((a,b)=>a+b.stars,0)/r.length; 
        }
        return { ...p, unread_count: count || 0, driver_rating: avg, userHasReviewed: (reviewCount || 0) > 0 };
      }));
      setSelectedOrderProposals(enhanced as any);
    }
    setProposalsLoading(false);
  };

  const handleRejectProposal = async (proposalId: string) => { 
    if (!confirm('Recusar esta proposta?')) return;
    await supabase.from('proposals').delete().eq('id', proposalId); 
    setSelectedOrderProposals(prev => prev.filter(p => p.id !== proposalId)); 
    fetchOrders(currentUser.id); 
    toast.success('Proposta recusada.');
  };

  const handleAcceptProposalFree = async (proposal: Proposal) => { 
    if(!confirm(`Aceitar proposta de R$ ${proposal.amount}?`)) return;
    await supabase.from('proposals').update({ is_accepted: true }).eq('id', proposal.id); 
    await supabase.from('orders').update({ status: 'accepted', agreed_price: proposal.amount }).eq('id', proposal.order_id); 
    if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false); 
    fetchOrders(currentUser.id);
    toast.success('Proposta aceita!'); 
  };

  const startUnlockProcess = (proposal: Proposal) => { setCurrentProposal(proposal); setFee(4.99); setPixData(null); setPaymentStep('idle'); setShowPaymentModal(true); };
  
  const handleGeneratePix = async () => { 
      setPaymentStep('generating');
      try { 
          const res = await fetch('/api/pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fee, description: 'Taxa ChapaCerto', email: currentUser.email }) });
          const data = await res.json(); 
          if (res.ok) { setPixData(data); setPaymentStep('waiting'); } 
          else { toast.error(`Erro: ${data.details}`); setPaymentStep('idle'); } 
      } catch { toast.error('Erro conexão.'); setPaymentStep('idle'); } 
  };

  const handleOpenChat = (p: Proposal) => { 
      const order = orders.find(o => o.id === p.order_id);
      if (order && checkChatExpired(order)) {
          toast.error('O chat expirou (5 dias após conclusão).');
          return;
      }
      setCurrentProposal(p); 
      setShowChatModal(true); 
  };
  
  const submitReview = async () => { 
      if (ratingTarget && currentUser) { 
          await supabase.from('reviews').insert({ order_id: ratingTarget.orderId, reviewer_id: currentUser.id, target_id: ratingTarget.id, stars: stars });
          toast.success('Avaliação enviada!'); setShowRatingModal(false); fetchOrders(currentUser.id); 
      } 
  };
  
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  const filteredOrders = orders.filter(order => {
      if (activeTab === 'active') { return ['open', 'accepted', 'paid'].includes(order.status); } 
      else if (activeTab === 'review') { return order.status === 'completed' && !order.user_has_reviewed; } 
      else { return order.status === 'completed' && order.user_has_reviewed; }
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none fixed"></div>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
              <div className="bg-blue-600/10 p-2 rounded-xl border border-blue-500/30"><Package size={20} className="text-blue-600"/></div>
              <div><h1 className="text-lg font-bold tracking-tight leading-none text-gray-900">Contratante<span className="text-blue-600">Pro</span></h1></div>
          </div>
          <div className="flex gap-3">
              <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors"><UserCircle size={18} className="text-gray-600"/></button>
              <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors"><LogOut size={18} className="text-red-500"/></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
        <div className="grid grid-cols-3 gap-2 mb-6 bg-gray-200 p-1 rounded-2xl border border-gray-300">
            <button onClick={() => setActiveTab('active')} className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wide ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Ativos</button>
            <button onClick={() => setActiveTab('review')} className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wide ${activeTab === 'review' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Avaliar</button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wide ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
        </div>

        {activeTab === 'active' && (
            <button onClick={openNewOrderModal} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 mb-8 hover:-translate-y-0.5 active:scale-[0.98] border border-blue-400/20">
                <Plus size={22} /> Solicitar Novo Serviço
            </button>
        )}

        {!loading && filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-gray-300 overflow-hidden mb-6">
                
                <div className={`px-6 py-4 border-b flex justify-between items-center ${activeTab === 'review' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex gap-3 text-xs font-bold text-gray-500 uppercase tracking-wide items-center">
                        <span className="flex items-center gap-2 text-gray-700">{getCargoIcon(order.cargo_type)} {order.cargo_type}</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-mono text-gray-400">#{order.id.slice(0,5)}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase border ${
                        order.status === 'open' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                        order.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : 
                        'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                        {activeTab === 'review' ? 'Aguardando Avaliação' : order.status === 'open' ? 'Procurando...' : order.status === 'completed' ? 'Finalizado' : 'Em Andamento'}
                    </span>
                </div>

                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-4">{order.clean_description}</h3>
         
                    {activeTab === 'review' ? (
                        <div className="text-center py-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                            <p className="text-sm text-yellow-800 mb-4 font-medium">O serviço foi finalizado. Como foi sua experiência?</p>
                            <button onClick={() => { setRatingTarget({name: 'O Prestador', id: '', orderId: order.id}); handleViewProposals(order.id, true); }} className="bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold shadow-md hover:bg-yellow-300 transition-colors flex items-center gap-2 mx-auto active:scale-95">
                                <Star size={20}/> Avaliar Prestador
                            </button>
                        </div>
                    ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Local</p>
                                  <p className="text-sm text-gray-700 flex items-center gap-1.5"><MapPin size={14} className="text-blue-500"/> {order.origin}</p>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Data</p>
                                  <p className="text-sm text-gray-700 flex items-center gap-1.5"><Calendar size={14} className="text-blue-500"/> {formatDate(order.scheduled_date)}</p>
                              </div>
                          </div>
                          
                          {order.agreed_price && (
                              <div className="mb-6 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                                  <div className="bg-green-100 p-1.5 rounded-lg"><DollarSign size={16} className="text-green-600"/></div>
                                  <div>
                                      <p className="text-[10px] text-green-700 uppercase font-bold">Valor Combinado</p>
                                      <p className="text-lg font-bold text-green-800">R$ {order.agreed_price.toFixed(2)}</p>
                                  </div>
                              </div>
                          )}
                          
                          <div className="flex gap-3 flex-wrap">
                              <button onClick={() => handleViewProposals(order.id)} className="flex-[2] bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md relative">
                                  {order.status === 'open' ? <><DollarSign size={16} className="text-green-400"/> Ver Ofertas ({order.proposal_count})</> : <><MessageSquare size={16} className="text-blue-400"/> Chat e Detalhes</>}
                                  
                                  {(order as any).unread_total > 0 && (
                                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full animate-bounce border-2 border-white shadow-md">
                                          {(order as any).unread_total}
                                      </span>
                                  )}
                              </button>

                              {/* BOTÃO SAFETY: FINALIZAR SE O CHAPA ESQUECER */}
                              {['accepted', 'paid'].includes(order.status) && (
                                  <button onClick={() => handleFinishOrder(order.id)} className="flex-1 bg-white border border-green-200 text-green-600 font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-green-50 transition-colors" title="Clique aqui se o serviço já acabou">
                                      <CheckCircle size={16}/> Confirmar Conclusão
                                  </button>
                              )}

                              {order.status === 'completed' && (
                                  <button onClick={() => generateReceipt(order)} className="flex-1 bg-gray-100 text-gray-700 border border-gray-200 font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-200">
                                      <FileText size={18}/> Recibo
                                  </button>
                              )}

                              {order.status !== 'open' && order.status !== 'completed' && (
                                  <button onClick={() => initiateCancel(order.id)} className="w-14 border border-red-200 bg-red-50 text-red-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-1 text-sm hover:bg-red-100 transition-colors">
                                      <Trash2 size={18}/>
                                  </button>
                              )}

                              {order.status === 'open' && (
                                  <>
                                      <button onClick={() => openEditOrderModal(order)} className="w-14 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit3 size={18}/></button>
                                      <button onClick={() => handleDeleteOrder(order.id)} className="w-14 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={18}/></button>
                                  </>
                              )}
                          </div>
                        </>
                    )}
                </div>
              </div>
          ))}
      </main>

      {/* MODAL 1: CANCELAMENTO */}
      {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95">
                  <div className="text-center mb-6">
                      <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><AlertTriangle size={32}/></div>
                      <h3 className="text-xl font-bold text-gray-900">Cancelar Serviço?</h3>
                      <p className="text-gray-500 text-sm mt-2">O chapa atual será dispensado e o pedido voltará para a fila.</p>
                  </div>
                  <textarea placeholder="Motivo do cancelamento..." className="w-full bg-gray-50 text-gray-900 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 ring-red-200 min-h-[100px] mb-4 resize-none border border-gray-200" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                  <button onClick={confirmCancel} disabled={sending} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all">{sending ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar Cancelamento'}</button>
                  <button onClick={() => setShowCancelModal(false)} className="w-full mt-4 text-gray-400 text-sm font-bold hover:text-gray-600">Voltar</button>
              </div>
          </div>
      )}

      {/* MODAL 2: PROPOSTAS */}
      {showProposalsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div><h2 className="text-xl font-bold text-gray-900">Propostas</h2><p className="text-xs text-gray-500">Escolha o melhor chapa</p></div>
                    <button onClick={() => setShowProposalsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} className="text-gray-400"/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-gray-50">
                    {proposalsLoading ? (
                        <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-500" size={32}/></div>
                    ) : selectedOrderProposals.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center">
                            <div className="bg-gray-100 p-4 rounded-full mb-4"><Clock size={40} className="text-gray-400"/></div>
                            <p className="text-gray-500 font-medium">Aguardando ofertas dos chapas...</p>
                        </div>
                    ) : (
                        selectedOrderProposals.map(prop => (
                            <div key={prop.id} className={`border rounded-2xl p-5 bg-white shadow-sm ${prop.is_accepted ? 'border-green-500 ring-1 ring-green-100' : 'border-gray-200'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                            {prop.driver?.nome_razao || 'Chapa'}
                                            {prop.is_accepted && <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-green-200">Contratado</span>}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                                            <div className="flex text-yellow-500"><Star size={14} fill="currentColor" /></div>
                                            <span className="font-bold text-gray-500">{prop.driver_rating?.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-green-600 font-black text-xl block">R$ {prop.amount.toFixed(2)}</span>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Enviada: {formatProposalTime(prop.created_at)}</span>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50 p-4 rounded-xl mb-5 border border-blue-100 text-sm text-blue-900 italic relative">
                                    "{prop.message}"
                                </div>
      
                                {/* ÁREA DE PAGAMENTO / CONTATO */}
                                <div className="bg-gray-100 p-3 rounded-xl text-center mb-5 flex items-center justify-center gap-3 border border-gray-200 border-dashed">
                                    <div className="flex items-center gap-2 text-gray-400"><Phone size={16}/><span className="font-mono tracking-widest font-bold">(XX) 9****-****</span></div>
                                    <button onClick={() => startUnlockProcess(prop)} className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg ml-2 hover:bg-blue-50 transition-colors flex items-center gap-1"><Lock size={10}/> Ver Contato (R$ 4,99)</button>
                                </div>

                                {/* Botão Denunciar */}
                                <button onClick={() => handleReport(prop.driver_id, prop.order_id)} className="text-gray-400 hover:text-red-500 text-[10px] flex items-center gap-1 mt-1 mb-3 ml-auto transition-colors"><AlertTriangle size={10}/> Denunciar</button>

                                {prop.is_accepted && currentOrder?.status !== 'paid' && (
                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-4 text-center">
                                        <p className="text-yellow-800 font-bold text-xs mb-2 leading-relaxed">Aceito! Pague p/ liberar o zap do prestador ou combine pelo chat!</p>
                                        <button onClick={() => startUnlockProcess(prop)} className="w-full bg-yellow-400 text-yellow-900 text-xs font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors shadow-sm">Pagar Taxa Agora</button>
                                    </div>
                                )}

                                {prop.is_accepted && currentOrder?.status === 'paid' && (
                                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-4 flex justify-between items-center">
                                        <div><p className="text-[10px] font-bold text-green-600 uppercase">Contato Liberado</p><p className="text-lg font-mono font-bold text-green-800">{prop.driver?.telefone}</p></div>
                                        <a href={getWhatsAppLink(prop.driver?.telefone || '')} target="_blank" className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 shadow-md transition-colors"><MessageCircle size={20}/></a>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    {!prop.is_accepted && (
                                        <>
                                            <button onClick={() => handleRejectProposal(prop.id)} className="border border-red-200 bg-red-50 text-red-500 rounded-xl py-3 flex items-center justify-center hover:bg-red-100 transition-colors" title="Recusar"><Trash2 size={20}/></button>
                                            
                                            <button onClick={() => handleOpenChat(prop)} className="bg-white border border-gray-300 text-gray-700 font-bold rounded-xl py-3 flex items-center justify-center relative hover:bg-gray-50 transition-colors">
                                                <MessageCircle size={20}/>
                                                {(prop.unread_count || 0) > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md animate-bounce">{prop.unread_count}</span>}
                                            </button>

                                            <button onClick={() => handleAcceptProposalFree(prop)} className="col-span-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-black shadow-lg transition-transform active:scale-[0.98]">
                                                <CheckCircle size={18} /> Aceitar Proposta
                                            </button>
                                        </>
                                    )}
    
                                    {prop.is_accepted && (
                                        <>
                                            <button onClick={() => handleOpenChat(prop)} className="bg-blue-600 text-white font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md transition-colors"><MessageCircle size={20}/> Chat</button>
                                            {prop.userHasReviewed ? (
                                                <button disabled className="bg-gray-100 text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"><Star size={18}/> Avaliado</button>
                                            ) : (
                                                <button onClick={() => { setRatingTarget({name: prop.driver?.nome_razao || 'Prestador', id: prop.driver?.id || '', orderId: prop.order_id}); setShowRatingModal(true); }} className="bg-yellow-400 text-yellow-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 shadow-md transition-colors"><Star size={18}/> Avaliar</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
      
      {/* MODAL 3: NOVO PEDIDO */}
      {showNewOrderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Pedido' : 'Solicitar Chapa'}</h2>
                      <button onClick={() => setShowNewOrderModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-500"/></button>
                  </div>
                  <form onSubmit={handleSaveOrder} className="space-y-6">
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2 block">Tipo de Carga</label>
                          <div className="grid grid-cols-4 gap-2">
                              {CARGO_TYPES.map(v => (
                                  <button key={v.id} type="button" onClick={() => setOrderForm({...orderForm, cargoType: v.id})} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${orderForm.cargoType === v.id ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                      {v.icon}
                                      <span className="text-[10px] font-bold mt-2">{v.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="relative space-y-4">
                          <div className="relative"><input placeholder="Local / Endereço" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium focus:border-blue-500 outline-none text-gray-900 transition-all placeholder:text-gray-400" value={orderForm.origin} onChange={e => setOrderForm({...orderForm, origin: e.target.value})} required /></div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Detalhes (Qtd, Peso, etc)</label>
                          <textarea placeholder="Ex: 50 sacos de cimento, 2º andar..." className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium focus:border-blue-500 outline-none text-gray-900 min-h-[100px] mt-1 resize-none placeholder:text-gray-400" value={orderForm.description} onChange={e => setOrderForm({...orderForm, description: e.target.value})} required />
                      </div>
                      
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Valor Sugerido (R$)</label>
                          <div className="relative mt-1">
                              <span className="absolute left-4 top-4 text-gray-400 font-bold">R$</span>
                              <input type="number" step="0.01" placeholder="0,00 (Opcional)" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-sm font-bold focus:border-green-500 outline-none text-green-600 placeholder:text-gray-400" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: e.target.value})} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2 ml-1">Deixe em branco se preferir negociar.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Dia (Opcional)</label><input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-bold text-gray-900 outline-none mt-1" value={orderForm.date} onChange={e => setOrderForm({...orderForm, date: e.target.value})} /></div>
                          <div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Hora (Opcional)</label><input type="time" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-bold text-gray-900 outline-none mt-1" value={orderForm.time} onChange={e => setOrderForm({...orderForm, time: e.target.value})} /></div>
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                          {loading ? <Loader2 className="animate-spin"/> : isEditing ? 'Salvar Alterações' : 'Solicitar Agora'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL 4: PAGAMENTO PIX */}
      {showPaymentModal && currentProposal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95">
                  <button onClick={() => setShowPaymentModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"><X size={24}/></button>
                  
                  {paymentStep === 'idle' && (
                      <>
                          <div className="text-center mb-8">
                              <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border border-blue-100"><ShieldCheck size={40} className="text-blue-600"/></div>
                              <h2 className="text-2xl font-bold text-gray-900">Revelar Contato</h2>
                              <p className="text-gray-500 text-sm mt-3 px-4 leading-relaxed">Pague a taxa única para ver o WhatsApp e falar direto com o prestador.</p>
                          </div>
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 flex justify-between items-center">
                              <span className="text-gray-500 font-bold">Taxa de Serviço</span>
                              <span className="font-black text-3xl text-green-600 tracking-tight">R$ {fee.toFixed(2)}</span>
                          </div>
                          <button onClick={handleGeneratePix} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 flex justify-center gap-2 transition-transform active:scale-95">
                              <DollarSign/> Gerar PIX
                          </button>
                      </>
                  )}
                  
                  {paymentStep === 'generating' && (
                      <div className="text-center py-16">
                          <Loader2 size={64} className="animate-spin text-blue-500 mx-auto mb-6"/> 
                          <h3 className="text-xl font-bold text-gray-900">Gerando QR Code...</h3>
                      </div>
                  )}
                  
                  {paymentStep === 'waiting' && pixData && (
                      <div className="text-center">
                          <h3 className="text-xl font-bold mb-2 text-gray-900">Escaneie o QR Code</h3>
                          <p className="text-sm text-gray-500 mb-6">Pague R$ {fee.toFixed(2)} no app do seu banco.</p>
                          <div className="bg-white p-3 rounded-2xl inline-block mb-6 shadow-lg border border-gray-100">
                              <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code" className="w-52 h-52 mx-auto" />
                          </div>
                          <div className="flex gap-2 mb-6">
                              <input readOnly value={pixData.qr_code} className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 font-mono"/>
                              <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast.success('Copiado!'); }} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Copy size={18} /></button>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 animate-pulse">
                              <Loader2 className="animate-spin" size={14}/> Aguardando pagamento...
                          </div>
                      </div>
                  )}
                  
                  {paymentStep === 'success' && (
                      <div className="text-center py-4 animate-in zoom-in">
                          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                              <CheckCircle size={56} className="text-green-600" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h3>
                          <p className="text-sm text-gray-500 mb-6">O contato foi liberado com sucesso.</p>
                          
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8">
                             <p className="text-xs text-blue-600 uppercase font-bold mb-2">WhatsApp do Prestador</p>
                             <p className="text-2xl font-mono font-bold text-gray-900 select-all">{currentProposal?.driver?.telefone}</p>
                          </div>

                          <a href={getWhatsAppLink(currentProposal?.driver?.telefone || '')} target="_blank" className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex justify-center gap-2 hover:bg-green-700 shadow-lg transition-colors">
                              <MessageCircle/> Chamar no WhatsApp
                          </a>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* MODAL 5: AVALIAÇÃO */}
      {showRatingModal && ratingTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
                  <h3 className="font-bold text-xl text-gray-900">Avaliar Prestador</h3>
                  <p className="text-gray-500 text-sm mt-1">Como foi o serviço?</p>
                  <div className="flex justify-center gap-2 my-8">
                      {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setStars(s)} className={`transition-all duration-200 hover:scale-110 p-1 ${s <= stars ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`}>
                              <Star size={36} fill="currentColor" />
                          </button>
                      ))}
                  </div>
                  <button onClick={submitReview} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-colors">Enviar Avaliação</button>
                  <button onClick={() => setShowRatingModal(false)} className="mt-4 text-gray-400 text-sm hover:text-gray-600 font-medium transition-colors">Cancelar</button>
              </div>
          </div>
      )}

      {/* MODAL 6: CHAT */}
      {showChatModal && currentProposal && currentUser && (
          <ChatModal 
            proposalId={currentProposal.id} 
            driverName={currentProposal.driver?.nome_razao || 'Chapa'} 
            currentUserId={currentUser.id} 
            onClose={() => setShowChatModal(false)} 
            onMessagesRead={() => currentOrderIdForProposals && handleViewProposals(currentOrderIdForProposals, false)} 
          />
      )}
    </div>
  );
}