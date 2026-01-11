'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Shield, Users, DollarSign, AlertTriangle, 
  Search, CheckCircle, Lock, TrendingUp, Package,
  Unlock, UserMinus, ShieldAlert, ShieldCheck, 
  RefreshCcw, MessageCircle, Building, HardHat, XCircle
} from 'lucide-react';

export default function AdminDashboardMaster() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'finance'>('overview');
  const [userFilter, setUserFilter] = useState<'ALL' | 'CONTRATANTE' | 'PRESTADOR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de Dados
  const [stats, setStats] = useState({ users: 0, orders: 0, reports: 0, revenue: 0 });
  const [userList, setUserList] = useState<any[]>([]);
  const [reportList, setReportList] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      toast.error('Acesso Negado.');
      router.push('/dashboard');
      return;
    }

    loadMasterData();
  };

  const loadMasterData = async () => {
    setLoading(true);
    try {
      // 1. KPIs Master
      const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      const { count: rCount } = await supabase.from('reports').select('*', { count: 'exact', head: true });
      
      // 2. Financeiro (LÓGICA ESTRITA - BASEADA NO PIX)
      const { data: payData } = await supabase
        .from('orders')
        .select('id, status, is_paid_fee, updated_at, client:profiles!client_id(nome_razao, telefone)')
        .order('updated_at', { ascending: false });

      // SÓ SOMA SE TIVER A ETIQUETA 'is_paid_fee' = TRUE
      const realRevenueTransactions = payData?.filter(p => p.is_paid_fee === true) || [];
      const revenueCalc = realRevenueTransactions.length * 4.99;

      setStats({
        users: uCount || 0,
        orders: oCount || 0,
        reports: rCount || 0,
        revenue: revenueCalc
      });
      
      if (payData) setPayments(payData);

      // 3. Usuários e Reports
      const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (users) setUserList(users);

      const { data: reports } = await supabase
        .from('reports')
        .select('*, accuser:profiles!accuser_id(nome_razao, telefone), accused:profiles!accused_id(nome_razao, telefone)')
        .order('created_at', { ascending: false });
      if (reports) setReportList(reports);

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES MASTER ---
  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if(!confirm(`Alterar status de bloqueio?`)) return;
    await supabase.from('profiles').update({ is_blocked: !currentStatus }).eq('id', userId);
    toast.success("Status de bloqueio atualizado.");
    loadMasterData();
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    if(!confirm("Alterar privilégios de Admin?")) return;
    await supabase.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
    toast.success("Privilégios atualizados.");
    loadMasterData();
  };

  const handleDeleteUserRecord = async (userId: string) => {
    if(!confirm("CUIDADO: Remover perfil do banco?")) return;
    await supabase.from('profiles').delete().eq('id', userId);
    toast.success("Perfil removido.");
    loadMasterData();
  };

  // --- NOVA FUNÇÃO: ARQUIVAR DENÚNCIA ---
  const handleDismissReport = async (reportId: string) => {
    if(!confirm("Deseja arquivar esta denúncia e removê-la da lista?")) return;
    
    // Removemos a denúncia do banco
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    
    if(error) {
      toast.error("Erro ao arquivar.");
    } else {
      toast.success("Denúncia arquivada/ignorada com sucesso.");
      loadMasterData(); // Recarrega a lista para sumir com o card
    }
  };

  const getWhatsAppLink = (phone: string) => `https://wa.me/55${phone?.replace(/\D/g, '') || ''}`;

  const filteredUsers = userList.filter(u => {
    const matchesSearch = (u.nome_razao?.toLowerCase().includes(searchTerm.toLowerCase()) || u.telefone?.includes(searchTerm));
    const matchesType = userFilter === 'ALL' || u.tipo_usuario === userFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-900 text-white"><Shield className="animate-spin text-blue-500"/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      
      {/* HEADER */}
      <header className="bg-gray-900 text-white p-5 sticky top-0 z-50 shadow-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/40">
              <ShieldCheck size={28}/>
            </div>
            <div>
              <h1 className="text-xl font-black italic">Master Console</h1>
              <p className="text-[10px] font-bold text-blue-400 uppercase">Sistema Operacional</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadMasterData} className="p-2.5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white border border-white/10">
              <RefreshCcw size={20}/>
            </button>
            <button onClick={() => router.push('/')} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg">
              SAIR
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Receita Pix Real', val: `R$ ${stats.revenue.toFixed(2)}`, icon: <DollarSign size={20}/>, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
            { label: 'Total Usuários', val: stats.users, icon: <Users size={20}/>, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Pedidos Criados', val: stats.orders, icon: <Package size={20}/>, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
            { label: 'Denúncias', val: stats.reports, icon: <AlertTriangle size={20}/>, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
          ].map((kpi, i) => (
            <div key={i} className={`bg-white p-6 rounded-[2.5rem] border-2 ${kpi.border} shadow-sm flex items-center justify-between`}>
              <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">{kpi.label}</p><h3 className={`text-3xl font-black ${kpi.color}`}>{kpi.val}</h3></div>
              <div className={`${kpi.bg} ${kpi.color} p-4 rounded-2xl`}>{kpi.icon}</div>
            </div>
          ))}
        </div>

        {/* MENU */}
        <div className="flex flex-wrap gap-3 mb-10 bg-white p-2 rounded-[2rem] w-fit border border-gray-200 shadow-sm">
          {[
            { id: 'overview', label: 'Dashboard', icon: <TrendingUp size={18}/> },
            { id: 'users', label: 'Gerenciar Usuários', icon: <Users size={18}/> },
            { id: 'finance', label: 'Financeiro Real', icon: <DollarSign size={18}/> },
            { id: 'reports', label: 'Moderação', icon: <AlertTriangle size={18}/> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-[1.5rem] text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl scale-105' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {tab.icon} {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* --- FINANCEIRO REAL --- */}
        {activeTab === 'finance' && (
          <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-10 border-b border-gray-50 flex justify-between items-end bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Auditoria Financeira</h2>
                <p className="text-sm text-gray-500 font-medium">Lista baseada na confirmação técnica do PIX (is_paid_fee = true).</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Confirmado</p>
                <p className="text-5xl font-black text-green-600">R$ {stats.revenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100">
                  <tr>
                    <th className="p-6">Pagador</th>
                    <th className="p-6">Status Pedido</th>
                    <th className="p-6">Pagamento Taxa</th>
                    <th className="p-6 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(pay => {
                    const isPaidReal = pay.is_paid_fee === true;
                    
                    return (
                      <tr key={pay.id} className={`hover:bg-gray-50 transition-colors ${!isPaidReal ? 'opacity-50 grayscale' : ''}`}>
                        <td className="p-6 font-bold text-gray-900 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isPaidReal ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{isPaidReal ? 'OK' : '?'}</div>
                          {pay.client?.nome_razao || 'Desconhecido'}
                        </td>
                        <td className="p-6 text-xs font-mono uppercase font-bold text-gray-500">{pay.status}</td>
                        <td className="p-6">
                          {isPaidReal ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-fit border border-green-200">
                              <CheckCircle size={12}/> Taxa Paga (Pix)
                            </span>
                          ) : (
                            <span className="bg-red-50 text-red-400 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-fit border border-red-100">
                              <XCircle size={12}/> Não Pagou Taxa
                            </span>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          {isPaidReal ? <span className="text-green-600 font-black">+ R$ 4,99</span> : <span className="text-gray-300 font-bold line-through">R$ 0,00</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- USUÁRIOS --- */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500" size={22}/>
                <input 
                  type="text" 
                  placeholder="Pesquisar..."
                  className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-[2rem] outline-none focus:border-blue-400 font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 p-2 bg-white rounded-[2rem] border-2 border-gray-100 shadow-sm">
                <button onClick={() => setUserFilter('ALL')} className={`px-6 py-3 rounded-2xl text-[11px] font-black ${userFilter === 'ALL' ? 'bg-gray-900 text-white' : 'text-gray-400'}`}>TODOS</button>
                <button onClick={() => setUserFilter('CONTRATANTE')} className={`px-6 py-3 rounded-2xl text-[11px] font-black ${userFilter === 'CONTRATANTE' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>CONTRATANTES</button>
                <button onClick={() => setUserFilter('PRESTADOR')} className={`px-6 py-3 rounded-2xl text-[11px] font-black ${userFilter === 'PRESTADOR' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}>PRESTADORES</button>
              </div>
            </div>
            <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <tr>
                    <th className="p-6 text-center">Status</th>
                    <th className="p-6">Informações</th>
                    <th className="p-6">Categoria</th>
                    <th className="p-6">Nível</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className={`${user.is_blocked ? 'bg-red-50/50' : ''} hover:bg-gray-50/80`}>
                      <td className="p-6 text-center">
                        {user.is_blocked ? 
                          <div className="bg-red-100 text-red-600 p-2.5 rounded-2xl inline-block shadow-sm"><Lock size={18}/></div> :
                          <div className="bg-green-100 text-green-600 p-2.5 rounded-2xl inline-block shadow-sm"><CheckCircle size={18}/></div>
                        }
                      </td>
                      <td className="p-6">
                        <p className="font-black text-gray-900 text-base">{user.nome_razao}</p>
                        <p className="text-xs text-blue-500 font-bold font-mono">{user.telefone}</p>
                      </td>
                      <td className="p-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase ${user.tipo_usuario === 'PRESTADOR' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {user.tipo_usuario}
                        </span>
                      </td>
                      <td className="p-6">
                        {user.is_admin ? <span className="text-purple-600 font-black text-[10px]">ADMIN</span> : <span className="text-gray-400 text-[10px]">USER</span>}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-3">
                          <a href={getWhatsAppLink(user.telefone)} target="_blank" className="p-3.5 bg-green-500 text-white rounded-2xl shadow-lg"><MessageCircle size={20}/></a>
                          <button onClick={() => handleToggleBlock(user.id, user.is_blocked)} className="p-3.5 bg-gray-100 text-gray-600 rounded-2xl hover:bg-red-500 hover:text-white"><Lock size={20}/></button>
                          <button onClick={() => handleToggleAdmin(user.id, user.is_admin)} className="p-3.5 bg-gray-100 text-purple-600 rounded-2xl hover:bg-purple-600 hover:text-white"><ShieldAlert size={20}/></button>
                          <button onClick={() => handleDeleteUserRecord(user.id)} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white"><UserMinus size={20}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- REPORTS (ATUALIZADO) --- */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-6">
            {reportList.length === 0 && <div className="col-span-2 text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-200 text-gray-400 font-bold uppercase tracking-[0.2em]">Nenhum incidente na fila</div>}
            {reportList.map(rep => (
              <div key={rep.id} className="bg-white p-8 rounded-[3.5rem] border-2 border-red-50 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-8">
                  <span className="bg-red-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase">#{rep.id.slice(0,5)}</span>
                  <p className="text-[10px] text-gray-400 font-black uppercase">{new Date(rep.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-3xl border border-blue-100">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black">A</div>
                    <div>
                        <p className="text-[9px] font-black text-blue-400 uppercase">Acusador</p>
                        <p className="text-sm font-black text-blue-900">{rep.accuser?.nome_razao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-red-50 p-4 rounded-3xl border border-red-100">
                    <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white font-black">R</div>
                    <div>
                        <p className="text-[9px] font-black text-red-400 uppercase">Réu</p>
                        <p className="text-sm font-black text-red-900 underline">{rep.accused?.nome_razao}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-900 text-white p-6 rounded-[2rem] mb-8">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Relato:</p>
                  <p className="text-sm italic">"{rep.reason}"</p>
                </div>
                
                {/* BOTÕES DE AÇÃO DUPLOS */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleToggleBlock(rep.accused_id, false)} 
                        className="flex-1 bg-red-600 text-white font-black text-[11px] py-4 rounded-2xl hover:bg-red-700 transition-all uppercase tracking-widest shadow-lg shadow-red-200"
                    >
                        Bloquear Réu
                    </button>
                    <button 
                        onClick={() => handleDismissReport(rep.id)} 
                        className="flex-1 bg-gray-100 text-gray-500 font-black text-[11px] py-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest border border-gray-200"
                    >
                        Ignorar / Arquivar
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="bg-white p-16 rounded-[4.5rem] text-center border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="bg-blue-600 w-28 h-28 rounded-[3rem] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl"><TrendingUp size={55}/></div>
            <h2 className="text-4xl font-black text-gray-900 mb-6 italic uppercase">Master Central</h2>
            <p className="text-gray-500 font-bold text-lg">Controle total sobre a plataforma.</p>
          </div>
        )}

      </main>
    </div>
  );
}