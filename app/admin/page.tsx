'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Shield, Users, DollarSign, AlertTriangle, 
  Search, CheckCircle, X, Lock, TrendingUp, Package,
  Unlock, UserMinus, ShieldAlert, ShieldCheck, Mail,
  ArrowUpRight, History, Filter, RefreshCcw, MessageCircle,
  Building, HardHat, UserPlus
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
      toast.error('Acesso Negado. Apenas para Super Admins.');
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
      
      // 2. Financeiro (Taxas de R$ 4,99)
      const { data: payData } = await supabase
        .from('orders')
        .select('id, status, updated_at, client:profiles!client_id(nome_razao, telefone)')
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

      // 3. Lista Completa de Utilizadores
      const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (users) setUserList(users);

      // 4. Centro de Denúncias
      const { data: reports } = await supabase
        .from('reports')
        .select('*, accuser:profiles!accuser_id(nome_razao, telefone), accused:profiles!accused_id(nome_razao, telefone)')
        .order('created_at', { ascending: false });
      if (reports) setReportList(reports);

    } catch (error) {
      console.error(error);
      toast.error("Erro crítico ao carregar central master.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES MASTER ADM ---
  
  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'DESBLOQUEAR' : 'BLOQUEAR';
    if(!confirm(`MASTER: Deseja realmente ${action} este utilizador?`)) return;
    
    const { error } = await supabase.from('profiles').update({ is_blocked: !currentStatus }).eq('id', userId);
    if(error) toast.error("Erro na operação.");
    else {
      toast.success(`Utilizador ${currentStatus ? 'liberado' : 'suspenso'}!`);
      loadMasterData();
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    if(!confirm("MASTER: Deseja alterar os privilégios administrativos deste perfil?")) return;
    
    const { error } = await supabase.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
    if(error) toast.error("Erro ao alterar nível de acesso.");
    else {
      toast.success("Privilégios master atualizados!");
      loadMasterData();
    }
  };

  const handleDeleteUserRecord = async (userId: string) => {
    if(!confirm("CUIDADO MASTER: Isso remove o PERFIL do banco. O login continuará existindo no Auth. Prosseguir?")) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if(error) toast.error("Erro ao remover registro.");
    else {
      toast.success("Registro removido do banco.");
      loadMasterData();
    }
  };

  const getWhatsAppLink = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${name}, aqui é o Administrador Master do ChapaCerto. Gostaria de tratar um assunto sobre sua conta.`);
    return `https://wa.me/55${cleanPhone}?text=${message}`;
  };

  // Filtro Combinado (Busca + Categoria)
  const filteredUsers = userList.filter(u => {
    const matchesSearch = (u.nome_razao?.toLowerCase().includes(searchTerm.toLowerCase()) || u.telefone?.includes(searchTerm));
    const matchesType = userFilter === 'ALL' || u.tipo_usuario === userFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <Shield className="animate-spin text-blue-500 mb-4" size={60}/>
      <p className="text-sm font-black uppercase tracking-[0.4em] animate-pulse">Autenticando Nível Master</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      
      {/* HEADER MASTER CONSOLE */}
      <header className="bg-gray-900 text-white p-5 sticky top-0 z-50 shadow-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/40">
              <ShieldCheck size={28}/>
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter italic">Master Console</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Sistema Operacional</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={loadMasterData} className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white border border-white/10">
              <RefreshCcw size={20}/>
            </button>
            <button onClick={() => router.push('/')} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-red-500/20 uppercase">
              Sair do Painel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Faturamento Bruto', val: `R$ ${stats.revenue.toFixed(2)}`, icon: <DollarSign size={20}/>, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
            { label: 'Usuários Registrados', val: stats.users, icon: <Users size={20}/>, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Vagas no Sistema', val: stats.orders, icon: <Package size={20}/>, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
            { label: 'Denúncias Ativas', val: stats.reports, icon: <AlertTriangle size={20}/>, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
          ].map((kpi, i) => (
            <div key={i} className={`bg-white p-6 rounded-[2.5rem] border-2 ${kpi.border} shadow-sm flex items-center justify-between transition-all hover:shadow-md`}>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <h3 className={`text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              </div>
              <div className={`${kpi.bg} ${kpi.color} p-4 rounded-2xl`}>{kpi.icon}</div>
            </div>
          ))}
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <div className="flex flex-wrap gap-3 mb-10 bg-white p-2 rounded-[2rem] w-fit border border-gray-200 shadow-sm">
          {[
            { id: 'overview', label: 'Dashboard', icon: <TrendingUp size={18}/> },
            { id: 'users', label: 'Gerenciar Usuários', icon: <Users size={18}/> },
            { id: 'finance', label: 'Financeiro / Taxas', icon: <DollarSign size={18}/> },
            { id: 'reports', label: 'Moderação / Reports', icon: <AlertTriangle size={18}/> },
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

        {/* --- ABA FINANCEIRA (COMPLETA) --- */}
        {activeTab === 'finance' && (
          <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-10 border-b border-gray-50 flex justify-between items-end bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Extrato de Recebíveis</h2>
                <p className="text-sm text-gray-500 font-medium">Relatório de taxas de R$ 4,99 geradas por serviços concluídos.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total em Caixa</p>
                <p className="text-5xl font-black text-green-600 tracking-tighter">R$ {stats.revenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-y border-gray-100">
                  <tr>
                    <th className="p-6">Cliente (Pagador)</th>
                    <th className="p-6">Status do Serviço</th>
                    <th className="p-6">Data da Transação</th>
                    <th className="p-6 text-right">Valor Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(pay => (
                    <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6 font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs font-black">C</div>
                        {pay.client?.nome_razao || 'Utilizador'}
                      </td>
                      <td className="p-6">
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">{pay.status}</span>
                      </td>
                      <td className="p-6 text-xs text-gray-500 font-medium">{new Date(pay.updated_at).toLocaleString()}</td>
                      <td className="p-6 text-right text-green-600 font-black">+ R$ 4,99</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- ABA UTILIZADORES (COM SEPARAÇÃO E WHATSAPP) --- */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Filtros Master */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={22}/>
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome ou celular..."
                  className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-[2rem] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 p-2 bg-white rounded-[2rem] border-2 border-gray-100 shadow-sm">
                <button onClick={() => setUserFilter('ALL')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${userFilter === 'ALL' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400'}`}>TODOS</button>
                <button onClick={() => setUserFilter('CONTRATANTE')} className={`px-6 py-3 rounded-2xl text-[11px] font-black flex items-center gap-2 transition-all ${userFilter === 'CONTRATANTE' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><Building size={14}/> CONTRATANTES</button>
                <button onClick={() => setUserFilter('PRESTADOR')} className={`px-6 py-3 rounded-2xl text-[11px] font-black flex items-center gap-2 transition-all ${userFilter === 'PRESTADOR' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400'}`}><HardHat size={14}/> PRESTADORES</button>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <tr>
                    <th className="p-6 text-center">Status</th>
                    <th className="p-6">Informações do Perfil</th>
                    <th className="p-6">Categoria</th>
                    <th className="p-6">Nível</th>
                    <th className="p-6 text-right">Controles Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className={`${user.is_blocked ? 'bg-red-50/50' : ''} hover:bg-gray-50/80 transition-all`}>
                      <td className="p-6 text-center">
                        {user.is_blocked ? 
                          <div className="bg-red-100 text-red-600 p-2.5 rounded-2xl inline-block shadow-sm"><Lock size={18}/></div> :
                          <div className="bg-green-100 text-green-600 p-2.5 rounded-2xl inline-block shadow-sm"><CheckCircle size={18}/></div>
                        }
                      </td>
                      <td className="p-6">
                        <p className="font-black text-gray-900 text-base">{user.nome_razao}</p>
                        <p className="text-xs text-blue-500 font-bold font-mono tracking-tighter">{user.telefone}</p>
                      </td>
                      <td className="p-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter ${user.tipo_usuario === 'PRESTADOR' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {user.tipo_usuario}
                        </span>
                      </td>
                      <td className="p-6">
                        {user.is_admin ? 
                          <span className="text-purple-600 font-black text-[10px] flex items-center gap-1.5 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100"><Shield size={14}/> SUPER MASTER</span> :
                          <span className="text-gray-400 text-[10px] font-bold">USUÁRIO COMUM</span>
                        }
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-3">
                          {/* BOTÃO ZAP PERSONALIZADO */}
                          <a href={getWhatsAppLink(user.telefone, user.nome_razao)} target="_blank" className="p-3.5 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/20" title="Chamar no WhatsApp Master">
                            <MessageCircle size={20}/>
                          </a>
                          
                          {/* BLOQUEIO */}
                          <button onClick={() => handleToggleBlock(user.id, user.is_blocked)} title="Suspender Acesso" className={`p-3.5 rounded-2xl transition-all ${user.is_blocked ? 'bg-green-100 text-green-600 hover:bg-green-600 hover:text-white' : 'bg-gray-100 text-gray-400 hover:bg-red-500 hover:text-white'}`}>
                            {user.is_blocked ? <Unlock size={20}/> : <Lock size={20}/>}
                          </button>
                          
                          {/* PROMOVER ADMIN */}
                          <button onClick={() => handleToggleAdmin(user.id, user.is_admin)} title="Nível Admin" className={`p-3.5 rounded-2xl transition-all ${user.is_admin ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-purple-100 hover:text-purple-600'}`}>
                            <ShieldAlert size={20}/>
                          </button>

                          {/* DELETAR REGISTRO */}
                          <button onClick={() => handleDeleteUserRecord(user.id)} title="Remover Perfil" className="p-3.5 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-2xl transition-all">
                            <UserMinus size={20}/>
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

        {/* --- ABA MODERAÇÃO (REPORTS) --- */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-6">
            {reportList.length === 0 && <div className="col-span-2 text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-200 text-gray-400 font-bold uppercase tracking-[0.2em]">Nenhum incidente na fila</div>}
            {reportList.map(rep => (
              <div key={rep.id} className="bg-white p-8 rounded-[3.5rem] border-2 border-red-50 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <AlertTriangle size={150}/>
                </div>
                
                <div className="flex justify-between items-start mb-8">
                  <span className="bg-red-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-red-200">Protocolo #{(rep.id).slice(0,5)}</span>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(rep.created_at).toLocaleString()}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-3xl border border-blue-100">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black">A</div>
                    <div>
                        <p className="text-[9px] font-black text-blue-400 uppercase">Acusador</p>
                        <p className="text-sm font-black text-blue-900">{rep.accuser?.nome_razao}</p>
                    </div>
                    <a href={getWhatsAppLink(rep.accuser?.telefone || '', rep.accuser?.nome_razao)} target="_blank" className="ml-auto bg-white p-2 rounded-xl text-green-500 shadow-sm hover:scale-110 transition-transform"><MessageCircle size={18}/></a>
                  </div>
                  <div className="flex items-center gap-4 bg-red-50 p-4 rounded-3xl border border-red-100">
                    <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white font-black">R</div>
                    <div>
                        <p className="text-[9px] font-black text-red-400 uppercase">Réu (Infrator)</p>
                        <p className="text-sm font-black text-red-900 font-italic underline">{rep.accused?.nome_razao}</p>
                    </div>
                    <a href={getWhatsAppLink(rep.accused?.telefone || '', rep.accused?.nome_razao)} target="_blank" className="ml-auto bg-white p-2 rounded-xl text-green-500 shadow-sm hover:scale-110 transition-transform"><MessageCircle size={18}/></a>
                  </div>
                </div>

                <div className="bg-gray-900 text-white p-6 rounded-[2rem] mb-8 relative">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Relato do Incidente:</p>
                  <p className="text-sm italic leading-relaxed font-medium">"{rep.reason}"</p>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => handleToggleBlock(rep.accused_id, false)} className="flex-[2] bg-red-600 text-white font-black text-[11px] py-4 rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 uppercase tracking-widest">Bloquear Imediatamente</button>
                  <button className="flex-1 bg-gray-100 text-gray-500 font-black text-[11px] py-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest">Arquivar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- ABA DASHBOARD (OVERVIEW) --- */}
        {activeTab === 'overview' && (
          <div className="bg-white p-16 rounded-[4.5rem] text-center border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent -z-10"></div>
            <div className="bg-blue-600 w-28 h-28 rounded-[3rem] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl shadow-blue-200">
              <TrendingUp size={55}/>
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tighter italic uppercase">Master Central Command</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed mb-12 font-bold text-lg">
              Painel Master Ativo. Você possui autonomia plena sobre usuários, fluxos financeiros e segurança da comunidade ChapaCerto.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { l: 'Status DB', s: 'Conectado', c: 'text-green-600' },
                { l: 'Serviço Auth', s: 'Online', c: 'text-green-600' },
                { l: 'Realtime Hub', s: 'Ativo', c: 'text-blue-600' },
                { l: 'Gatekeeper', s: 'Protegido', c: 'text-purple-600' }
              ].map((item, i) => (
                <div key={i} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{item.l}</p>
                  <p className={`text-sm font-black uppercase ${item.c}`}>{item.s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}