'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Shield, Users, DollarSign, AlertTriangle, 
  Search, CheckCircle, X, Lock, TrendingUp, Package,
  Unlock, UserMinus, ShieldAlert, ShieldCheck, Mail,
  ArrowUpRight, History, Filter, RefreshCcw
} from 'lucide-react';

export default function AdminDashboardMaster() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'finance'>('overview');
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
      toast.error('Acesso Negado. Apenas para Super Admins.');
      router.push('/dashboard');
      return;
    }

    loadMasterData();
  };

  const loadMasterData = async () => {
    setLoading(true);
    try {
      // 1. KPIs de Performance
      const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      const { count: rCount } = await supabase.from('reports').select('*', { count: 'exact', head: true });
      
      // 2. Financeiro (Taxas de R$ 4,99)
      const { data: payData } = await supabase
        .from('orders')
        .select('id, status, updated_at, client:profiles!client_id(nome_razao)')
        .in('status', ['paid', 'completed'])
        .order('updated_at', { ascending: false });

      const totalRevenue = (payData?.length || 0) * 4.99;

      setStats({
        users: uCount || 0,
        orders: oCount || 0,
        reports: rCount || 0,
        revenue: totalRevenue
      });
      if (payData) setPayments(payData);

      // 3. Utilizadores
      const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (users) setUserList(users);

      // 4. Denúncias
      const { data: reports } = await supabase
        .from('reports')
        .select('*, accuser:profiles!accuser_id(nome_razao), accused:profiles!accused_id(nome_razao)')
        .order('created_at', { ascending: false });
      if (reports) setReportList(reports);

    } catch (error) {
      toast.error("Erro ao carregar dados mestres.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES MASTER ---
  
  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if(!confirm(`Deseja ${currentStatus ? 'DESBLOQUEAR' : 'BLOQUEAR'} este utilizador?`)) return;
    
    const { error } = await supabase.from('profiles').update({ is_blocked: !currentStatus }).eq('id', userId);
    if(error) toast.error("Erro ao atualizar status.");
    else {
      toast.success("Utilizador atualizado!");
      loadMasterData();
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    if(!confirm("Alterar privilégios administrativos?")) return;
    
    const { error } = await supabase.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
    if(error) toast.error("Erro ao alterar privilégios.");
    else {
      toast.success("Privilégios atualizados!");
      loadMasterData();
    }
  };

  const filteredUsers = userList.filter(u => 
    u.nome_razao?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.telefone?.includes(searchTerm)
  );

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <Shield className="animate-spin text-blue-500 mb-4" size={50}/>
      <p className="text-xs font-black uppercase tracking-[0.3em]">Autenticando Master...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      
      {/* BARRA SUPERIOR MASTER */}
      <header className="bg-gray-900 text-white p-5 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-2xl shadow-lg shadow-blue-500/30">
              <ShieldCheck size={24}/>
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter">ChapaCerto Master</h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Servidor Local v2.0.4</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={loadMasterData} className="p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
              <RefreshCcw size={20}/>
            </button>
            <button onClick={() => router.push('/')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all">
              SAIR
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* INDICADORES DE PERFORMANCE */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Receita Total', val: `R$ ${stats.revenue.toFixed(2)}`, icon: <DollarSign size={18}/>, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Utilizadores', val: stats.users, icon: <Users size={18}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Pedidos Ativos', val: stats.orders, icon: <Package size={18}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Incidentes', val: stats.reports, icon: <AlertTriangle size={18}/>, color: 'text-red-600', bg: 'bg-red-50' }
          ].map((kpi, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <h3 className={`text-2xl font-black ${kpi.color}`}>{kpi.val}</h3>
              </div>
              <div className={`${kpi.bg} ${kpi.color} p-4 rounded-2xl`}>{kpi.icon}</div>
            </div>
          ))}
        </div>

        {/* MENU DE NAVEGAÇÃO INTERNA */}
        <div className="flex gap-2 mb-8 bg-gray-200/50 p-1.5 rounded-[1.5rem] w-fit border border-gray-200">
          {[
            { id: 'overview', label: 'Dashboard', icon: <TrendingUp size={16}/> },
            { id: 'users', label: 'Utilizadores', icon: <Users size={16}/> },
            { id: 'finance', label: 'Financeiro', icon: <DollarSign size={16}/> },
            { id: 'reports', label: 'Moderação', icon: <AlertTriangle size={16}/> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.icon} {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* --- CONTEÚDO DINÂMICO --- */}

        {/* ABA: FINANCEIRO */}
        {activeTab === 'finance' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-gray-900">Extrato de Taxas</h2>
                <p className="text-xs text-gray-400">Listagem de comissões de R$ 4,99 por serviço finalizado.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase">Total Acumulado</p>
                <p className="text-3xl font-black text-green-600">R$ {stats.revenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="p-6">Utilizador</th>
                    <th className="p-6">Status Pedido</th>
                    <th className="p-6">Data/Hora</th>
                    <th className="p-6 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(pay => (
                    <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6 font-bold text-gray-900">{pay.client?.nome_razao || 'Utilizador'}</td>
                      <td className="p-6 text-xs italic text-gray-400">{pay.status}</td>
                      <td className="p-6 text-xs text-gray-500">{new Date(pay.updated_at).toLocaleString()}</td>
                      <td className="p-6 text-right text-green-600 font-black">+ R$ 4,99</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: UTILIZADORES */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20}/>
              <input 
                type="text" 
                placeholder="Pesquisar por nome, telefone ou tipo..."
                className="w-full bg-white border border-gray-200 p-5 pl-14 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <tr>
                    <th className="p-6">Status</th>
                    <th className="p-6">Perfil</th>
                    <th className="p-6">Tipo</th>
                    <th className="p-6">Acesso</th>
                    <th className="p-6 text-right">Ações Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className={`${user.is_blocked ? 'bg-red-50/50' : ''} hover:bg-gray-50/80 transition-all`}>
                      <td className="p-6">
                        {user.is_blocked ? 
                          <span className="bg-red-100 text-red-600 p-2 rounded-xl inline-block"><Lock size={16}/></span> :
                          <span className="bg-green-100 text-green-600 p-2 rounded-xl inline-block"><CheckCircle size={16}/></span>
                        }
                      </td>
                      <td className="p-6">
                        <p className="font-black text-gray-900">{user.nome_razao}</p>
                        <p className="text-xs text-gray-400">{user.telefone}</p>
                      </td>
                      <td className="p-6">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${user.tipo_usuario === 'PRESTADOR' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {user.tipo_usuario}
                        </span>
                      </td>
                      <td className="p-6">
                        {user.is_admin ? 
                          <span className="text-purple-600 font-black text-[10px] flex items-center gap-1"><Shield size={12}/> MASTER</span> :
                          <span className="text-gray-400 text-[10px]">PADRÃO</span>
                        }
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleToggleBlock(user.id, user.is_blocked)} title="Bloquear/Desbloquear" className={`p-3 rounded-2xl transition-all ${user.is_blocked ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-red-500 hover:text-white'}`}>
                            {user.is_blocked ? <Unlock size={18}/> : <Lock size={18}/>}
                          </button>
                          <button onClick={() => handleToggleAdmin(user.id, user.is_admin)} title="Permissão Admin" className={`p-3 rounded-2xl transition-all ${user.is_admin ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-purple-600 hover:text-white'}`}>
                            <ShieldAlert size={18}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: DENÚNCIAS */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
            {reportList.map(rep => (
              <div key={rep.id} className="bg-white p-8 rounded-[3rem] border border-red-50 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <AlertTriangle size={120}/>
                </div>
                
                <div className="flex justify-between items-start mb-6">
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Incidente Grave</span>
                  <p className="text-[10px] text-gray-400 font-bold">{new Date(rep.created_at).toLocaleString()}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs">A</div>
                    <p className="text-sm font-bold">Acusador: <span className="text-blue-600">{rep.accuser?.nome_razao}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 font-black text-xs">R</div>
                    <p className="text-sm font-bold">Réu: <span className="text-red-600">{rep.accused?.nome_razao}</span></p>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
                  <p className="text-xs text-gray-400 font-black uppercase mb-2">Relato:</p>
                  <p className="text-gray-700 italic text-sm">"{rep.reason}"</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleToggleBlock(rep.accused_id, false)} className="flex-1 bg-gray-900 text-white font-black text-xs py-4 rounded-2xl hover:bg-red-600 transition-all">BLOQUEAR RÉU</button>
                  <button className="flex-1 bg-gray-100 text-gray-500 font-black text-xs py-4 rounded-2xl hover:bg-gray-200 transition-all">ARQUIVAR</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ABA: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="bg-white p-16 rounded-[4rem] text-center border border-gray-100 shadow-sm">
            <div className="bg-blue-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-blue-600 mx-auto mb-8">
              <TrendingUp size={48}/>
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4">Saúde do Sistema: 100%</h2>
            <p className="text-gray-500 max-w-lg mx-auto leading-relaxed mb-10 font-medium">
              Todos os módulos estão operacionais. O faturamento está sendo processado via Pix e as taxas de conveniência estão sendo contabilizadas. Mantenha a moderação ativa para garantir a segurança da comunidade.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Status DB</p>
                <p className="text-sm font-bold text-green-600">Conectado</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Auth</p>
                <p className="text-sm font-bold text-green-600">Online</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Realtime</p>
                <p className="text-sm font-bold text-green-600">Ativo</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Storage</p>
                <p className="text-sm font-bold text-green-600">Operacional</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}