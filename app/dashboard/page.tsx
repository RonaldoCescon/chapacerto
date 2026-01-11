'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
// 1. IMPORT DO NEXT DYNAMIC
import dynamic from 'next/dynamic'; 
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Plus, Package, LogOut, CheckCircle, X, DollarSign, 
  Phone, Copy, Clock, MessageCircle, Loader2, Trash2, 
  MessageSquare, Star, Calendar, ShieldCheck, UserCircle, 
  Edit3, Box, Truck, Armchair, AlertTriangle, 
  Search, List, History, ThumbsUp, Lock, FileText, MapPin, Zap, Navigation,
  Users, Map, Briefcase, Hammer
} from 'lucide-react';
import ChatModal from '@/components/ChatModal';
import jsPDF from 'jspdf';

// 2. DEFINIÇÃO DO COMPONENTE MAPA (IMPORTAÇÃO DINÂMICA)
// Isso impede que o Leaflet tente carregar no servidor (o que quebraria o app)
const MapRadar = dynamic(() => import('../components/MapRadar'), { 
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-gray-100 rounded-3xl animate-pulse flex flex-col items-center justify-center text-gray-400 gap-2">
      <Map size={32} className="opacity-20"/>
      <span className="text-xs font-medium">Carregando Mapa...</span>
    </div>
  )
});

// ... (O resto do código: Interfaces, Constantes, Componente Principal continuam abaixo)
// --- INTERFACES E TIPAGENS ---

interface Order { 
  id: string; 
  origin: string; 
  destination: string;
  description: string; 
  status: string; 
  updated_at: string;
  created_at: string; 
  scheduled_date?: string; 
  scheduled_time?: string; 
  agreed_price?: number; 
  proposal_count?: number; 
  cargo_type?: string; 
  clean_description?: string; 
  user_has_reviewed?: boolean;
  lat?: number; 
  lng?: number; 
}

interface Proposal { 
  id: string; 
  amount: number; 
  message: string; 
  driver_id: string; 
  driver: { nome_razao: string; telefone: string; id: string; cpf?: string } | null; 
  is_accepted: boolean; 
  order_id: string; 
  unread_count?: number; 
  driver_rating?: number; 
  proposed_date?: string; 
  proposed_time?: string;
  created_at: string; 
  userHasReviewed?: boolean; 
}

// Interface para Chapas Online (Radar)
interface OnlineDriver {
    id: string;
    nome_razao: string;
    telefone: string;
    last_lat?: number;
    last_lng?: number;
    skills?: string[];
    bio?: string;
    distance?: number; // Calculado no front
}

const CARGO_TYPES = [
  { id: 'carga', label: 'Carga/Descarga', icon: <Truck size={20}/> },
  { id: 'mudanca', label: 'Mudança', icon: <Armchair size={20}/> },
  { id: 'ajudante', label: 'Ajudante Geral', icon: <UserCircle size={20}/> },
  { id: 'marido', label: 'Marido de Aluguel', icon: <Hammer size={20}/> }, // <--- NOVO
  { id: 'freelance', label: 'Free Lance', icon: <Briefcase size={20}/> },
];

const getCargoIcon = (type: string | undefined) => {
    switch(type?.toLowerCase()) {
        case 'carga': return <Truck size={14} />;
        case 'mudanca': return <Armchair size={14} />;
        case 'ajudante': return <UserCircle size={14} />;
        case 'marido': return <Hammer size={14} />; // <--- NOVO ICONE
        case 'freelance': return <Briefcase size={14} />;
        // Mantidos apenas para compatibilidade de histórico, se necessário:
        case 'sacaria': return <Package size={14} />; 
        default: return <Truck size={14} />;
    }
};

// Helper para pegar o Nome da Habilidade pelo ID
const getSkillLabel = (id: string) => {
    const type = CARGO_TYPES.find(t => t.id === id);
    return type ? type.label : id.replace('_', ' ');
};

// Fórmula de Distância (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export default function ClientDashboard() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // --- ESTADOS DE DADOS ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
 // Abas de Navegação
  const [activeTab, setActiveTab] = useState<'active' | 'review' | 'history' | 'online'>('active');

  // --- ADICIONE ESTES NOVOS ESTADOS AQUI: ---
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); 
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  // --- MODAIS ---
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // --- FORMULÁRIO DE PEDIDO ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({ 
    origin: '', description: '', date: '', time: '', cargoType: 'sacaria', price: '', 
    lat: null as number | null, lng: null as number | null 
  });

  // --- MAPA E GEOLOCALIZAÇÃO ---
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isGettingGPS, setIsGettingGPS] = useState(false);

  // --- RADAR DE CHAPAS ONLINE ---
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
  const [selectedDirectDriver, setSelectedDirectDriver] = useState<OnlineDriver | null>(null);

  // --- PROPOSTAS ---
  const [selectedOrderProposals, setSelectedOrderProposals] = useState<Proposal[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [currentOrderIdForProposals, setCurrentOrderIdForProposals] = useState<string | null>(null);
  
  // --- AVALIAÇÃO ---
  const [ratingTarget, setRatingTarget] = useState<{name: string, id: string, orderId: string} | null>(null);
  const [stars, setStars] = useState(5);

  // --- PAGAMENTO E CANCELAMENTO ---
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [sending, setSending] = useState(false);
  const [fee, setFee] = useState(4.99); 
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; id: number } | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'generating' | 'waiting' | 'processing' | 'success'>('idle');

  // --- HELPERS ---
  const formatDate = (dateStr: string | undefined) => { if (!dateStr) return 'A combinar'; const [year, month, day] = dateStr.split('-'); return `${day}/${month}/${year}`; };
  const formatProposalTime = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';
  const getWhatsAppLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`;
  const parseOrderData = (order: any) => { const match = order.description ? order.description.match(/^\[(.*?)\]/) : null; const cargo = match ? match[1] : 'sacaria'; const cleanDesc = match ? order.description.replace(/^\[.*?\]\s*/, '') : order.description; return { ...order, cargo_type: cargo, clean_description: cleanDesc }; };
  
  const playSound = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } };
  const notifyUser = (msg: string) => { playSound(); toast.info(msg, { duration: 5000, icon: <Zap className="text-yellow-500"/> }); };
  const checkChatExpired = (order: Order) => { if (order.status !== 'completed') return false; const finishDate = new Date(order.updated_at).getTime(); const now = new Date().getTime(); return (now - finishDate) / (1000 * 3600 * 24) > 5; };

  // --- FUNÇÕES DE BUSCA DE ENDEREÇO ---
  const handleAddressSearch = async (query: string) => {
    setOrderForm({ ...orderForm, origin: query });
    if (query.length < 4) { setAddressSuggestions([]); return; }
    setIsSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=5`);
      const data = await res.json();
      setAddressSuggestions(data);
    } catch (err) { console.error("Erro mapa", err); } 
    finally { setIsSearchingAddress(false); }
  };

  const fillWithGPS = () => {
    if (!navigator.geolocation) return toast.error("GPS não suportado.");
    setIsGettingGPS(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        setOrderForm({ ...orderForm, origin: data.display_name, lat: latitude, lng: longitude });
        toast.success("Localização capturada!");
      } catch { toast.error("Erro ao converter GPS."); } 
      finally { setIsGettingGPS(false); }
    }, () => { toast.error("Permissão de GPS negada."); setIsGettingGPS(false); });
  };

 // --- FUNÇÃO PARA BUSCAR CHAPAS ONLINE ---
  const fetchOnlineDrivers = async () => {
    setIsSearchingDrivers(true);
    if (!navigator.geolocation) {
        toast.error("Ative o GPS para ver chapas próximos.");
        setIsSearchingDrivers(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        // --- ADICIONE ESTAS DUAS LINHAS AQUI: ---
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        // ----------------------------------------

        try {
            // Busca apenas prestadores DISPONÍVEIS
            const { data: drivers } = await supabase
                .from('profiles')
                .select('id, nome_razao, telefone, last_lat, last_lng, skills, bio')
                .eq('is_available', true)
                .neq('id', currentUser?.id);

            if (drivers) {
                const driversWithDist = drivers.map((d: any) => {
                    let dist = 9999;
                    if (d.last_lat && d.last_lng) {
                        dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, d.last_lat, d.last_lng);
                    }
                    return { ...d, distance: dist };
                }).sort((a, b) => a.distance - b.distance); // Ordena por proximidade
                
                setOnlineDrivers(driversWithDist);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao buscar chapas.");
        } finally {
            setIsSearchingDrivers(false);
        }
    }, (err) => {
        toast.error("Permissão de localização negada.");
        setIsSearchingDrivers(false);
    });
  };

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

  // --- POLLING DE PAGAMENTO (HÍBRIDO) ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showPaymentModal && paymentStep === 'waiting' && pixData?.id) {
        interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/pix?id=${pixData.id}`);
                const data = await res.json();
                
                if (data.status === 'approved') {
                    // Caso 1: Pagamento de Proposta (Vinculado a um Pedido)
                    if (currentProposal) {
                        await supabase.from('orders').update({ status: 'paid', is_paid_fee: true }).eq('id', currentProposal.order_id);                        setPaymentStep('success'); 
                        playSound(); 
                        toast.success("Pagamento confirmado!");
                        if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
                    } 
                    // Caso 2: Pagamento Direto para Chapa Online
                    else if (selectedDirectDriver) {
                        setPaymentStep('success');
                        playSound();
                        toast.success("Contato liberado!");
                    }
                }
            } catch (e) { console.error("Polling error", e); }
        }, 3000); 
    }
    return () => clearInterval(interval);
  }, [showPaymentModal, paymentStep, pixData, currentProposal, selectedDirectDriver, currentOrderIdForProposals]);

  // --- REALTIME ---
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel(`client_dashboard_${currentUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            fetchOrders(currentUser.id);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proposals' }, () => {
            notifyUser('Nova proposta recebida! 🚚');
            fetchOrders(currentUser.id);
            if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            if (payload.new.sender_id !== currentUser.id) { 
                notifyUser('Nova mensagem 💬'); 
                fetchOrders(currentUser.id); 
                if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, currentOrderIdForProposals]);

  // --- CARREGAR PEDIDOS ---
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
    const reason = prompt("Qual o motivo da denúncia?");
    if (!reason) return;
    try {
        const { error } = await supabase.from('reports').insert({
            accuser_id: currentUser.id, 
            accused_id: targetId, 
            order_id: orderId, 
            reason: reason
        });
        if (error) throw error;
        toast.success("Denúncia enviada.");
    } catch { 
        toast.error("Erro ao enviar denúncia."); 
    }
  };

  const handleFinishOrder = async (orderId: string) => {
      if(!confirm('O serviço foi realizado?')) return;
      const { error } = await supabase.from('orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if(!error) { 
          toast.success('Serviço finalizado!'); 
          fetchOrders(currentUser.id); 
          setActiveTab('review'); 
      }
  };

  const generateReceipt = async (order: any) => {
    if (order.status !== 'completed') { 
        toast.error("O serviço precisa ser finalizado."); 
        return; 
    }
    
    const toastId = toast.loading('Gerando recibo...');
    try {
        const { data: proposal, error } = await supabase.from('proposals')
            .select('amount, driver:profiles(nome_razao, cpf)')
            .eq('order_id', order.id)
            .eq('is_accepted', true)
            .single();

        if (error || !proposal) { 
            toast.error('Dados não encontrados.'); 
            return; 
        }

        const driverData: any = Array.isArray(proposal.driver) ? proposal.driver[0] : proposal.driver;
        const doc = new jsPDF();
        
        doc.setFontSize(18); doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇO", 105, 20, { align: "center" });
        doc.setLineWidth(0.5); doc.line(20, 25, 190, 25);
        
        doc.setFontSize(10); 
        doc.text("PRESTADOR:", 20, 40); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text((driverData?.nome_razao || 'CHAPA').toUpperCase(), 20, 46);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); 
        doc.text(`CPF/CNPJ: ${driverData?.cpf || '***'}`, 20, 52);
        
        doc.text("TOMADOR:", 20, 65); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text((currentProfile?.nome_razao || 'CLIENTE').toUpperCase(), 20, 71);
        
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); 
        doc.text(`DESCRIÇÃO: ${order.clean_description}`, 20, 85);
        doc.text(`LOCAL: ${order.origin}`, 20, 95);
        
        doc.setFillColor(240, 240, 240); doc.rect(20, 110, 170, 15, 'F');
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        const val = proposal.amount ? proposal.amount.toFixed(2) : '0.00';
        doc.text(`VALOR TOTAL: R$ ${val}`, 180, 120, { align: "right" });
        
        doc.save(`Recibo_${order.id.slice(0,6)}.pdf`);
        toast.dismiss(toastId); 
        toast.success("Recibo baixado!");
    } catch { 
        toast.dismiss(toastId); 
        toast.error("Erro ao gerar PDF."); 
    }
  };

  const openNewOrderModal = () => { 
      setIsEditing(false); 
      setEditingOrderId(null);
      setOrderForm({ origin: '', description: '', date: '', time: '', cargoType: 'sacaria', price: '', lat: null, lng: null }); 
      setAddressSuggestions([]); 
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
          price: order.agreed_price ? order.agreed_price.toString() : '',
          lat: order.lat || null, 
          lng: order.lng || null
      });
      setIsEditing(true); 
      setEditingOrderId(order.id); 
      setShowNewOrderModal(true); 
  };
  
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault(); 
    
    if (!orderForm.lat || !orderForm.lng) {
        toast.error("Selecione um endereço da lista para calcularmos a distância.");
        return;
    }

    setLoading(true);
    const payload = { 
        origin: orderForm.origin, 
        description: `[${orderForm.cargoType.toUpperCase()}] ${orderForm.description}`, 
        scheduled_date: orderForm.date || null, 
        scheduled_time: orderForm.time || null,
        agreed_price: orderForm.price ? parseFloat(orderForm.price) : null,
        lat: orderForm.lat, 
        lng: orderForm.lng
    };
    
    if (isEditing && editingOrderId) {
        await supabase.from('orders').update(payload).eq('id', editingOrderId);
        toast.success('Pedido atualizado!');
    } else {
        await supabase.from('orders').insert({ client_id: currentUser.id, status: 'open', destination: 'Local', ...payload });
        toast.success('Vaga publicada com sucesso!');
    }
    
    setShowNewOrderModal(false); 
    fetchOrders(currentUser.id); 
    setLoading(false); 
  };

  const handleDeleteOrder = async (id: string) => { 
      if(confirm('Excluir este pedido?')) { 
          await supabase.from('proposals').delete().eq('order_id', id); 
          await supabase.from('orders').delete().eq('id', id);
          fetchOrders(currentUser.id); 
          toast.success('Pedido excluído.'); 
      } 
  };

  const initiateCancel = (orderId: string) => { 
      setCancelOrderId(orderId); 
      setCancelReason(''); 
      setShowCancelModal(true); 
  };
  
  const confirmCancel = async () => {
      if (!cancelOrderId || !cancelReason.trim()) { 
          toast.error('Diga o motivo do cancelamento.'); 
          return; 
      }
      setSending(true);
      await supabase.from('orders').update({ status: 'open', agreed_price: null }).eq('id', cancelOrderId);
      await supabase.from('proposals').delete().eq('order_id', cancelOrderId).eq('is_accepted', true);
      
      toast.success('Cancelado com sucesso.'); 
      setShowCancelModal(false); 
      fetchOrders(currentUser.id); 
      setSending(false);
  };

  const handleViewProposals = async (orderId: string, openModal = true) => {
    setCurrentOrderIdForProposals(orderId);
    if (openModal) { 
        setShowProposalsModal(true); 
        setProposalsLoading(true); 
        setSelectedOrderProposals([]); 
    }
    
    const { data: proposals } = await supabase.from('proposals')
        .select('*, driver:profiles(nome_razao, telefone, id)')
        .eq('order_id', orderId)
        .order('is_accepted', { ascending: false });
        
    if (proposals) {
      const enhanced = await Promise.all(proposals.map(async (p: any) => {
        const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true })
            .eq('proposal_id', p.id).eq('is_read', false).neq('sender_id', currentUser.id);
        
        const { count: revC } = await supabase.from('reviews').select('*', { count: 'exact', head: true })
            .eq('order_id', orderId).eq('reviewer_id', currentUser.id);
        
        const { data: r } = await supabase.from('reviews').select('stars').eq('target_id', p.driver?.id);
        const avg = r?.length ? r.reduce((a,b)=>a+b.stars,0)/r.length : 5;
        
        return { 
            ...p, 
            unread_count: msgCount || 0, 
            driver_rating: avg, 
            userHasReviewed: (revC || 0) > 0 
        };
      }));
      setSelectedOrderProposals(enhanced as any);
    }
    setProposalsLoading(false);
  };

  const handleRejectProposal = async (proposalId: string) => { 
    if (!confirm('Deseja realmente recusar esta oferta?')) return;
    await supabase.from('proposals').delete().eq('id', proposalId); 
    if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false);
    fetchOrders(currentUser.id); 
    toast.success('Proposta recusada.');
  };

const handleAcceptProposalFree = async (proposal: Proposal) => { 
    // 1. VERIFICAÇÃO DE SEGURANÇA
    // Verifica se JÁ existe alguma proposta aceita para este pedido
    const { data: existing } = await supabase
        .from('proposals')
        .select('id')
        .eq('order_id', proposal.order_id)
        .eq('is_accepted', true)
        .single();

    if (existing) {
        toast.error("Você já contratou um chapa para este serviço! Cancele o anterior se quiser trocar.");
        return;
    }

    if(!confirm(`Confirmar contratação por R$ ${proposal.amount}?`)) return;

    // 2. SEGUE O FLUXO NORMAL
    await supabase.from('proposals').update({ is_accepted: true }).eq('id', proposal.id); 
    
    // Atualiza o pedido com o ID do motorista e o preço combinado
    await supabase.from('orders').update({ 
        status: 'accepted', 
        agreed_price: proposal.amount,
        prestador_id: proposal.driver_id // Garante que vinculamos o prestador ao pedido
    }).eq('id', proposal.order_id); 
    
    if (currentOrderIdForProposals) handleViewProposals(currentOrderIdForProposals, false); 
    fetchOrders(currentUser.id);
    toast.success('Proposta aceita! Combine o pagamento.'); 
  };
  
  // --- FUNÇÕES DE INÍCIO DE PAGAMENTO ---
  
  // Opção 1: Pagar por uma proposta (Vinculada a um pedido)
  const startUnlockProcess = (proposal: Proposal) => { 
      setCurrentProposal(proposal); 
      setSelectedDirectDriver(null); // Reseta o outro tipo
      setFee(4.99); 
      setPixData(null); 
      setPaymentStep('idle'); 
      setShowPaymentModal(true); 
  };

  // Opção 2: Pagar por um Chapa Online (Contato direto)
  const handleDirectPayment = (driver: OnlineDriver) => {
      setSelectedDirectDriver(driver);
      setCurrentProposal(null); // Reseta o outro tipo
      setFee(4.99); 
      setPixData(null); 
      setPaymentStep('idle'); 
      setShowPaymentModal(true);
  };
  
  const handleGeneratePix = async () => { 
      setPaymentStep('generating');
      try { 
          const res = await fetch('/api/pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fee, description: 'Taxa ChapaCerto', email: currentUser.email }) });
          const data = await res.json(); 
          if (res.ok) { 
              setPixData(data); 
              setPaymentStep('waiting'); 
          } else { 
              toast.error(`Erro: ${data.details}`); 
              setPaymentStep('idle'); 
          } 
      } catch { 
          toast.error('Erro de conexão.'); 
          setPaymentStep('idle'); 
      } 
  };

  const handleOpenChat = (p: Proposal) => { 
      const order = orders.find(o => o.id === p.order_id);
      if (order && checkChatExpired(order)) {
          toast.error('Chat expirado.');
          return;
      }
      setCurrentProposal(p); 
      setShowChatModal(true); 
  };
  
  const submitReview = async () => { 
      if (ratingTarget && currentUser) { 
          await supabase.from('reviews').insert({ 
              order_id: ratingTarget.orderId, 
              reviewer_id: currentUser.id, 
              target_id: ratingTarget.id, 
              stars: stars 
          });
          toast.success('Avaliação enviada com sucesso!'); 
          setShowRatingModal(false); 
          fetchOrders(currentUser.id); 
      } 
  };
  
  const handleLogout = async () => { 
      await supabase.auth.signOut(); 
      router.push('/'); 
  };

  const filteredOrders = orders.filter(order => {
      if (activeTab === 'active') return ['open', 'accepted', 'paid'].includes(order.status);
      if (activeTab === 'review') return order.status === 'completed' && !order.user_has_reviewed;
      return order.status === 'completed' && order.user_has_reviewed;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none fixed"></div>

{/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
              <div className="bg-blue-600/10 p-2 rounded-xl border border-blue-500/30">
                <UserCircle size={20} className="text-blue-600"/>
              </div>
              <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-none">
                    Olá, {currentProfile?.nome_razao ? currentProfile.nome_razao.split(' ')[0] : 'Cliente'}
                  </h1>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Contratante Pro</p>
              </div>
          </div>
          <div className="flex gap-3">
              <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors"><UserCircle size={18} className="text-gray-600"/></button>
              <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors"><LogOut size={18} className="text-red-500"/></button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-4xl mx-auto p-4 relative z-10 animate-in fade-in slide-in-from-bottom-4">
        
        {/* NAVEGAÇÃO DE ABAS (4 ITENS) */}
        <div className="grid grid-cols-4 gap-1 mb-6 bg-gray-200 p-1 rounded-2xl border border-gray-300">
            <button onClick={() => setActiveTab('active')} className={`py-3 text-[10px] font-bold rounded-xl uppercase transition-all ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Meus Pedidos</button>
            <button onClick={() => { setActiveTab('online'); fetchOnlineDrivers(); }} className={`py-3 text-[10px] font-bold rounded-xl uppercase transition-all flex items-center justify-center gap-1 ${activeTab === 'online' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}><Users size={12}/>Prestadores ON</button>
            <button onClick={() => setActiveTab('review')} className={`py-3 text-[10px] font-bold rounded-xl uppercase transition-all ${activeTab === 'review' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Avaliar</button>
            <button onClick={() => setActiveTab('history')} className={`py-3 text-[10px] font-bold rounded-xl uppercase transition-all ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
        </div>

{/* --- ABA PRESTADORES ONLINE (COM MAPA E LISTA) --- */}
        {activeTab === 'online' && (
            <div className="space-y-4 animate-in fade-in">
                
                {/* HEADER DA ABA + BOTÕES DE TROCA (LISTA vs MAPA) */}
                <div className="bg-white p-2 rounded-3xl border border-gray-200 flex justify-between items-center shadow-sm mb-4">
                    <div className="flex-1 text-center pl-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-left">Modo de Visualização</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-2xl">
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Lista
                        </button>
                        <button 
                            onClick={() => setViewMode('map')} 
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'map' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Map size={14}/> Mapa
                        </button>
                    </div>
                </div>

                {isSearchingDrivers && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>}

                {!isSearchingDrivers && onlineDrivers.length === 0 && (
                    <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl">
                        <Users size={32} className="mx-auto mb-2 opacity-30"/>
                        <p className="text-sm">Nenhum prestador online no momento.</p>
                        <p className="text-[10px]">Tente criar um pedido na aba "Meus Pedidos".</p>
                    </div>
                )}

                {/* --- VISÃO MAPA --- */}
                {!isSearchingDrivers && onlineDrivers.length > 0 && viewMode === 'map' && (
                    <MapRadar 
                        userLat={userLat} 
                        userLng={userLng} 
                        drivers={onlineDrivers} 
                        onSelectDriver={handleDirectPayment}
                    />
                )}

                {/* --- VISÃO LISTA --- */}
                {!isSearchingDrivers && onlineDrivers.length > 0 && viewMode === 'list' && (
                    <div className="space-y-4">
                        {onlineDrivers.map(driver => (
                            <div key={driver.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-green-300 transition-all">
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-sm animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 bg-white rounded-full"></span> ONLINE</div>
                                
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-lg border border-gray-200">{driver.nome_razao.charAt(0)}</div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{driver.nome_razao}</h3>
                                        
                                        {driver.distance !== undefined && (
                                            <p className="text-xs text-green-600 font-bold flex items-center gap-1 mb-1">
                                                <MapPin size={12}/> {driver.distance < 0.1 ? 'Muito perto' : `A ${driver.distance.toFixed(1)} km`}
                                            </p>
                                        )}
                                        
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {driver.skills && driver.skills.length > 0 ? (
                                                driver.skills.slice(0, 4).map((skillId: string) => (
                                                    <span key={skillId} className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] px-2 py-1 rounded-md uppercase font-bold flex items-center gap-1">
                                                        {getCargoIcon(skillId)}
                                                        {getSkillLabel(skillId)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">Geral</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {driver.bio && <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-xl line-clamp-2 border border-gray-100">"{driver.bio}"</p>}

                                <button onClick={() => handleDirectPayment(driver)} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-transform active:scale-95 text-xs uppercase tracking-wide">
                                    <Lock size={14}/> Liberar Contato (R$ 4,99)
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* BOTÃO NOVO PEDIDO (SÓ APARECE NA ABA MEUS PEDIDOS) */}
        {activeTab === 'active' && (
            <button onClick={openNewOrderModal} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 mb-8 active:scale-[0.98] transition-all border border-blue-400/20">
                <Plus size={22} /> Solicitar Novo Serviço
            </button>
        )}

{/* LISTA DE PEDIDOS CLÁSSICA */}
        {!loading && activeTab !== 'online' && filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6 hover:shadow-md transition-shadow">
                <div className={`px-6 py-4 border-b flex justify-between items-center ${activeTab === 'review' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex gap-3 text-xs font-bold text-gray-500 uppercase items-center">
                        <span className="flex items-center gap-2 text-gray-700">{getCargoIcon(order.cargo_type)} {order.cargo_type?.toUpperCase()}</span>
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
                    {/* --- ALERT LOGIC HERE --- */}
                    {(() => {
                        if (order.status !== 'open') return null;

                        const now = new Date();
                        const created = new Date(order.created_at);
                        const scheduled = order.scheduled_date ? new Date(order.scheduled_date) : null;
                        let showWarning = false;
                        let msg = "";

                        // Rule 1: Has scheduled date (Warn if date is today or passed)
                        if (scheduled) {
                            // Reset time to compare dates only
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const sched = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate());
                            const diffTime = sched.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                            
                            // If date has passed (negative) or is today (0)
                            if (diffDays <= 0) {
                                showWarning = true;
                                msg = "Data limite atingida (Expira em breve)";
                            }
                        } 
                        // Rule 2: No date (Warn if created more than 2 days ago)
                        else {
                            const diffTime = now.getTime() - created.getTime();
                            const diffDays = diffTime / (1000 * 60 * 60 * 24);
                            // Deletes after 3 days, so warn if passed 2 days
                            if (diffDays > 2) {
                                showWarning = true;
                                msg = "Sem atividade há 2 dias (Expira em 24h)";
                            }
                        }

                        if (showWarning) {
                            return (
                            <div className="bg-red-50 text-red-600 text-[10px] font-bold px-3 py-2 rounded-lg mb-4 flex items-center gap-2 border border-red-100 animate-pulse">
                                <AlertTriangle size={14} /> ⚠️ {msg}. O pedido será removido automaticamente.
                            </div>
                            );
                        }
                    })()}
                    {/* --- END ALERT LOGIC --- */}

                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-4">{order.clean_description}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Local</p>
                            <p className="text-sm text-gray-700 truncate flex items-center gap-1.5"><MapPin size={14} className="text-blue-500 shrink-0"/> {order.origin}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Data</p>
                            <p className="text-sm text-gray-700 flex items-center gap-1.5"><Calendar size={14} className="text-blue-500 shrink-0"/> {formatDate(order.scheduled_date)}</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 flex-wrap">
                        {/* BOTÃO PRINCIPAL: VER OFERTAS / CHAT */}
                        <button onClick={() => handleViewProposals(order.id)} className="flex-[2] bg-gray-900 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 relative shadow-md hover:bg-black transition-colors">
                            {order.status === 'open' ? <><DollarSign size={16}/> Ver Ofertas ({order.proposal_count})</> : <><MessageSquare size={16}/> Ver Chapa / Chat</>}
                            {(order as any).unread_total > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full animate-bounce border-2 border-white">{(order as any).unread_total}</span>}
                        </button>

                        {/* BOTÃO FINALIZAR (Se aceito ou pago) */}
                        {['accepted', 'paid'].includes(order.status) && (
                            <button onClick={() => handleFinishOrder(order.id)} className="flex-1 bg-white border border-green-200 text-green-600 font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-green-50">
                                <CheckCircle size={16}/> Finalizar
                            </button>
                        )}

                        {/* BOTÃO AVALIAR (Se concluído e não avaliado) */}
                        {(order.status === 'completed' || order.status === 'paid') && !order.user_has_reviewed && (
                             <button 
                                onClick={async () => {
                                    // Busca rápida para saber quem avaliar
                                    const { data } = await supabase.from('proposals').select('driver_id, driver:profiles(nome_razao)').eq('order_id', order.id).eq('is_accepted', true).single();
                                    
                                    if(data) {
                                        // Tratamos driver como 'any' para evitar erro de array vs objeto
                                        const driverData: any = data.driver;
                                        const driverName = Array.isArray(driverData) ? driverData[0]?.nome_razao : driverData?.nome_razao;
                                        
                                        setRatingTarget({ name: driverName || 'Chapa', id: data.driver_id, orderId: order.id });
                                        setShowRatingModal(true);
                                    } else {
                                        toast.error("Erro ao encontrar prestador.");
                                    }
                                }} 
                                className="flex-1 bg-yellow-400 text-yellow-900 font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-yellow-500 shadow-sm"
                             >
                                <Star size={16} fill="currentColor"/> Avaliar
                             </button>
                        )}

                        {/* BOTÃO RECIBO (Se concluído) */}
                        {order.status === 'completed' && (
                            <button onClick={() => generateReceipt(order)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 border hover:bg-gray-200">
                                <FileText size={18}/> Recibo
                            </button>
                        )}

                        {/* AÇÕES DE EDIÇÃO (Se aberto) */}
                        {order.status === 'open' && (
                            <>
                                <button onClick={() => openEditOrderModal(order)} className="w-12 h-12 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit3 size={18}/></button>
                                <button onClick={() => handleDeleteOrder(order.id)} className="w-12 h-12 flex items-center justify-center rounded-xl border border-gray-200 text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={18}/></button>
                            </>
                        )}

                        {/* CANCELAR (Se em andamento) */}
                        {order.status !== 'open' && order.status !== 'completed' && (
                            <button onClick={() => initiateCancel(order.id)} className="w-12 h-12 border border-red-200 bg-red-50 text-red-500 font-bold rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors" title="Cancelar Pedido">
                                <Trash2 size={18}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        ))}        </main>

      {/* --- MODAL 1: CANCELAMENTO --- */}
      {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 text-center">
                  <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><AlertTriangle size={32}/></div>
                  <h3 className="text-xl font-bold text-gray-900">Cancelar Serviço?</h3>
                  <textarea placeholder="Diga o motivo..." className="w-full bg-gray-50 text-gray-900 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 ring-red-200 min-h-[100px] mb-4 resize-none border border-gray-200" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                  <button onClick={confirmCancel} disabled={sending} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all">{sending ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar Cancelamento'}</button>
                  <button onClick={() => setShowCancelModal(false)} className="w-full mt-4 text-gray-400 text-sm font-bold hover:text-gray-600">Voltar</button>
              </div>
          </div>
      )}

      {/* --- MODAL 2: PROPOSTAS --- */}
      {showProposalsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div><h2 className="text-xl font-bold text-gray-900">Propostas</h2><p className="text-xs text-gray-500">Escolha o melhor chapa</p></div>
                    <button onClick={() => setShowProposalsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} className="text-gray-400"/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-gray-50">
                    {selectedOrderProposals.map(prop => (
                        <div key={prop.id} className={`border rounded-2xl p-5 bg-white shadow-sm ${prop.is_accepted ? 'border-green-500 ring-1 ring-green-100' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                            {prop.driver?.nome_razao || 'Chapa'}
                                            {prop.is_accepted && <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-green-200">Contratado</span>}
                                        </h3>
                                        {/* BOTÃO DE DENÚNCIA ADICIONADO AQUI */}
                                        <button onClick={() => handleReport(prop.driver?.id || '', prop.order_id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Denunciar este prestador">                                            <AlertTriangle size={16}/>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-xs"><div className="flex text-yellow-500"><Star size={14} fill="currentColor" /></div><span className="font-bold text-gray-500">{prop.driver_rating?.toFixed(1)}</span></div>
                                </div>
                                <div className="text-right">
                                    <span className="text-green-600 font-black text-xl block">R$ {prop.amount.toFixed(2)}</span>
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Enviada: {formatProposalTime(prop.created_at)}</span>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl mb-5 border border-blue-100 text-sm text-blue-900 italic relative">"{prop.message}"</div>
                            
                            {/* Se não pago, mostra botão de liberar contato */}
                            {currentOrder?.status !== 'paid' && (
                                <div className="mb-4">
                                    <button onClick={() => startUnlockProcess(prop)} className="w-full bg-blue-50 text-blue-600 border border-blue-100 py-3.5 rounded-xl text-xs font-bold flex justify-center gap-2 items-center hover:bg-blue-100 transition-colors">
                                        <Lock size={14}/> Liberar WhatsApp Agora (R$ 4,99)
                                    </button>
                                </div>
                            )}

                            {/* Se PAGO e aceito, mostra WhatsApp */}
                            {currentOrder?.status === 'paid' && prop.is_accepted && (
                                <div className="mt-3 bg-green-50 border border-green-200 p-4 rounded-xl flex justify-between items-center mb-4 animate-in fade-in">
                                    <div>
                                        <p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Contato do Chapa</p>
                                        <p className="font-mono font-bold text-green-800 text-lg">{prop.driver?.telefone}</p>
                                    </div>
                                    <a href={`https://wa.me/55${prop.driver?.telefone}`} target="_blank" className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors">
                                        <MessageCircle size={20}/>
                                    </a>
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
                                    <button onClick={() => handleOpenChat(prop)} className="bg-blue-600 col-span-2 text-white font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md transition-colors">
                                        <MessageCircle size={20}/> Chat
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 3: NOVO PEDIDO --- */}
      {showNewOrderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Pedido' : 'Solicitar Chapa'}</h2>
                      <button onClick={() => setShowNewOrderModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-500"/></button>
                  </div>
                  <form onSubmit={handleSaveOrder} className="space-y-6">
                      
                      {/* TIPO DE CARGA */}
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2 block">Tipo de Carga</label>
                          <div className="grid grid-cols-4 gap-2">
                              {CARGO_TYPES.map(v => (
                                  <button key={v.id} type="button" onClick={() => setOrderForm({...orderForm, cargoType: v.id})} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${orderForm.cargoType === v.id ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                      {v.icon} <span className="text-[10px] font-bold mt-2">{v.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* LOCALIZAÇÃO (GPS + MAPA) */}
                      <div className="relative">
                          <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Localização</label>
                              <button type="button" onClick={fillWithGPS} disabled={isGettingGPS} className="text-[10px] font-black text-blue-600 flex items-center gap-1 hover:underline active:scale-95 disabled:opacity-50">{isGettingGPS ? <Loader2 className="animate-spin" size={10}/> : <Navigation size={10}/>} USAR GPS ATUAL</button>
                          </div>
                          <div className="relative">
                            <input placeholder="Digite a rua, bairro ou local..." className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium outline-none focus:border-blue-500 transition-all pr-10 text-gray-900" value={orderForm.origin} onChange={e => handleAddressSearch(e.target.value)} required />
                            {isSearchingAddress && <Loader2 className="absolute right-4 top-4 animate-spin text-blue-500" size={18}/>}
                          </div>
                          {addressSuggestions.length > 0 && (
                            <div className="absolute z-[100] w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                              {addressSuggestions.map((item, idx) => (
                                <button key={idx} type="button" onClick={() => { setOrderForm({...orderForm, origin: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon)}); setAddressSuggestions([]); }} className="w-full p-4 text-left text-xs hover:bg-blue-50 border-b border-gray-50 flex items-center gap-3 transition-colors text-gray-700"><MapPin size={16} className="text-blue-500 shrink-0"/><span className="truncate font-medium">{item.display_name}</span></button>
                              ))}
                            </div>
                          )}
                          {orderForm.lat && <p className="text-[9px] text-green-600 font-bold mt-1 flex items-center gap-1 animate-pulse"><ShieldCheck size={10}/> Coordenadas confirmadas via satélite</p>}
                      </div>

                      {/* OUTROS CAMPOS */}
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Detalhes (Qtd, Peso, etc)</label>
                          <textarea placeholder="Ex: 50 sacos de cimento, 2º andar..." className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium focus:border-blue-500 outline-none text-gray-900 min-h-[100px] mt-1 resize-none placeholder:text-gray-400" value={orderForm.description} onChange={e => setOrderForm({...orderForm, description: e.target.value})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Dia (Opcional)</label><input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-bold text-gray-900 outline-none mt-1" value={orderForm.date} onChange={e => setOrderForm({...orderForm, date: e.target.value})} /></div>
                          <div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Hora (Opcional)</label><input type="time" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-bold text-gray-900 outline-none mt-1" value={orderForm.time} onChange={e => setOrderForm({...orderForm, time: e.target.value})} /></div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Valor Sugerido (R$)</label>
                          <div className="relative mt-1">
                              <span className="absolute left-4 top-4 text-gray-400 font-bold text-sm">R$</span>
                              <input type="number" step="0.01" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-sm font-bold focus:border-green-500 text-green-600 placeholder:text-gray-400" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: e.target.value})} />
                          </div>
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-black py-4 rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 uppercase tracking-widest text-xs">{loading ? <Loader2 className="animate-spin mx-auto"/> : (isEditing ? 'Salvar Alterações' : 'Solicitar Agora')}</button>
                  </form>
              </div>
          </div>
      )}

      {/* --- MODAL 4: PAGAMENTO PIX (HÍBRIDO: PROPOSTA OU DIRETO) --- */}
      {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative animate-in zoom-in-95">
                  <button onClick={() => { setShowPaymentModal(false); setSelectedDirectDriver(null); }} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"><X size={24}/></button>
                  {paymentStep === 'idle' && (
                      <>
                          <div className="text-center mb-8">
                              <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border border-blue-100"><ShieldCheck size={40} className="text-blue-600"/></div>
                              <h2 className="text-2xl font-bold text-gray-900">Revelar Contato</h2>
                              <p className="text-gray-500 text-sm mt-3 px-4 leading-relaxed">Pague a taxa única para ver o WhatsApp e falar direto com o prestador.</p>
                          </div>
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 flex justify-between items-center"><span className="text-gray-500 font-bold">Taxa de Serviço</span><span className="font-black text-3xl text-green-600 tracking-tight">R$ {fee.toFixed(2)}</span></div>
                          <button onClick={handleGeneratePix} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 flex justify-center gap-2 transition-transform active:scale-95"><DollarSign/> Gerar PIX</button>
                      </>
                  )}
                  {paymentStep === 'waiting' && pixData && (
                      <div className="text-center">
                          <h3 className="text-xl font-bold mb-2 text-gray-900">Escaneie o QR Code</h3>
                          <div className="bg-white p-3 rounded-2xl inline-block mb-6 shadow-lg border border-gray-100"><img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code" className="w-52 h-52 mx-auto" /></div>
                          <div className="flex gap-2 mb-6">
                              <input readOnly value={pixData.qr_code} className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 font-mono"/>
                              <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast.success('Copiado!'); }} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Copy size={18} /></button>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 animate-pulse"><Loader2 className="animate-spin" size={14}/> Aguardando pagamento...</div>
                      </div>
                  )}
                  {paymentStep === 'success' && (
                      <div className="text-center py-4 animate-in zoom-in">
                          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100"><CheckCircle size={56} className="text-green-600" /></div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h3>
                          
                          {/* Exibe o telefone do Prestador (Proposta ou Direto) */}
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8"><p className="text-xs text-blue-600 uppercase font-bold mb-2">WhatsApp do Prestador</p><p className="text-2xl font-mono font-bold text-gray-900 select-all">{currentProposal?.driver?.telefone || selectedDirectDriver?.telefone}</p></div>
                          
                          <a href={getWhatsAppLink(currentProposal?.driver?.telefone || selectedDirectDriver?.telefone || '')} target="_blank" className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex justify-center gap-2 hover:bg-green-700 shadow-lg transition-colors"><MessageCircle/> Chamar no WhatsApp</a>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- MODAL 5: AVALIAÇÃO --- */}
      {showRatingModal && ratingTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
                  <h3 className="font-bold text-lg mb-6 text-gray-900">Avaliar Serviço</h3>
                  <div className="flex justify-center gap-2 mb-8">{[1,2,3,4,5].map(s => (<button key={s} onClick={() => setStars(s)} className={`p-1 ${s <= stars ? 'text-yellow-400' : 'text-gray-200'}`}><Star size={36} fill="currentColor" /></button>))}</div>
                  <button onClick={submitReview} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors">Enviar</button>
              </div>
          </div>
      )}

      {/* --- MODAL 6: CHAT --- */}
      {showChatModal && currentProposal && currentUser && (
          <ChatModal proposalId={currentProposal.id} driverName={currentProposal.driver?.nome_razao || 'Chapa'} currentUserId={currentUser.id} onClose={() => setShowChatModal(false)} onMessagesRead={() => fetchOrders(currentUser.id)} />
      )}
    </div>
  );
}