'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, Truck, Check, Phone, ArrowRight, Users, ChevronLeft, ShieldCheck, Building2, FileText, X } from 'lucide-react';
import Link from 'next/link';

// --- VALIDADORES ---
const isValidCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
};

const isValidCNPJ = (cnpj: string) => {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    return true;
};

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Estado do formulário
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', document: '' });
  const [selectedRole, setSelectedRole] = useState<'CONTRATANTE' | 'PRESTADOR' | null>(null);
  const [docType, setDocType] = useState<'CPF' | 'CNPJ'>('CPF');
  const [loading, setLoading] = useState(false);
  
  // NOVOS ESTADOS PARA OS TERMOS
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'contratante') setSelectedRole('CONTRATANTE');
    if (type === 'prestador') setSelectedRole('PRESTADOR');
  }, [searchParams]);

  // Máscaras
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length > 10) v = `${v.substring(0, 10)}-${v.substring(10)}`;
    setForm(prev => ({ ...prev, phone: v }));
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (docType === 'CPF') {
        if (v.length > 11) v = v.slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        if (v.length > 14) v = v.slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    setForm(prev => ({ ...prev, document: v }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) { toast.warning('Selecione seu perfil.'); return; }
    if (!acceptedTerms) { toast.error('Você precisa aceitar os Termos de Uso.'); return; } // Validação do Termo
    if (form.password.length < 6) { toast.error('Senha deve ter mínimo 6 dígitos.'); return; }
    
    const cleanPhone = form.phone.replace(/\D/g, '');
    const cleanDoc = form.document.replace(/\D/g, '');

    if (cleanPhone.length < 10) { toast.error('Telefone inválido.'); return; }
    if (docType === 'CPF' && !isValidCPF(cleanDoc)) { toast.error('CPF inválido.'); return; }
    if (docType === 'CNPJ' && !isValidCNPJ(cleanDoc)) { toast.error('CNPJ inválido.'); return; }

    setLoading(true);

    try {
      // 1. Cria usuário Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { 
              full_name: form.name, 
              phone: cleanPhone, 
              cpf: cleanDoc,
              role: selectedRole,
              doc_type: docType 
          }
        }
      });

      if (authError) throw authError;

      // 2. Cria Perfil no Banco
      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          nome_razao: form.name,
          telefone: cleanPhone,
          tipo_usuario: selectedRole,
          updated_at: new Date().toISOString(),
          cpf: cleanDoc
        });

        if (profileError) throw profileError;

        toast.success(`Bem-vindo!`);
        
        setTimeout(() => {
          if (selectedRole === 'PRESTADOR') router.push('/feed');
          else router.push('/dashboard');
        }, 1000);
      }

    } catch (err: any) {
      if (err.message?.includes('already registered')) {
          toast.info('E-mail já existe. Login...');
          setTimeout(() => router.push('/login'), 2000);
      } else {
          toast.error(err.message || 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-50">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Link href="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors text-sm font-bold"><ChevronLeft size={16} /> Voltar</Link>

        <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Criar Conta</h1>
            <p className="text-gray-500 text-sm">Cadastre-se como Pessoa Física ou MEI/Empresa.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            
            {/* SELEÇÃO DE PERFIL */}
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setSelectedRole('CONTRATANTE')} className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${selectedRole === 'CONTRATANTE' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md ring-1 ring-blue-500' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300 hover:bg-gray-50'}`}>
                <Truck size={28} className={selectedRole === 'CONTRATANTE' ? 'text-blue-600' : 'text-gray-300'}/> 
                <span className="font-bold text-xs">Contratar</span>
                {selectedRole === 'CONTRATANTE' && <div className="absolute top-2 right-2"><Check size={14} className="text-blue-600"/></div>}
              </button>

              <button type="button" onClick={() => setSelectedRole('PRESTADOR')} className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${selectedRole === 'PRESTADOR' ? 'bg-green-50 border-green-500 text-green-700 shadow-md ring-1 ring-green-500' : 'bg-white border-gray-200 text-gray-400 hover:border-green-300 hover:bg-gray-50'}`}>
                <Users size={28} className={selectedRole === 'PRESTADOR' ? 'text-green-600' : 'text-gray-300'}/> 
                <span className="font-bold text-xs">Trabalhar</span>
                {selectedRole === 'PRESTADOR' && <div className="absolute top-2 right-2"><Check size={14} className="text-green-600"/></div>}
              </button>
            </div>

            <div className="space-y-4">
              {/* NOME */}
              <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><User size={20} /></div>
                  <input type="text" placeholder="Nome Completo / Razão Social" className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              
              {/* TIPO DE DOCUMENTO */}
              <div className="bg-gray-50 p-1.5 rounded-xl flex gap-1 border border-gray-200">
                  <button type="button" onClick={() => { setDocType('CPF'); setForm(prev => ({...prev, document: ''})) }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${docType === 'CPF' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>Pessoa Física (CPF)</button>
                  <button type="button" onClick={() => { setDocType('CNPJ'); setForm(prev => ({...prev, document: ''})) }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${docType === 'CNPJ' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>MEI / Empresa (CNPJ)</button>
              </div>

              {/* INPUT DOCUMENTO */}
              <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {docType === 'CPF' ? <ShieldCheck size={20} /> : <Building2 size={20}/>}
                  </div>
                  <input type="text" inputMode="numeric" placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium font-mono" value={form.document} onChange={handleDocumentChange} required />
              </div>

              {/* TELEFONE */}
              <div className="relative group"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Phone size={20} /></div><input type="tel" inputMode="numeric" placeholder="WhatsApp (DDD + Número)" className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium" value={form.phone} onChange={handlePhoneChange} required /></div>

              {/* EMAIL & SENHA */}
              <div className="relative group"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={20} /></div><input type="email" inputMode="email" placeholder="E-mail" className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
              <div className="relative group"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={20} /></div><input type="password" placeholder="Senha (Mín. 6 dígitos)" className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
            </div>

            {/* CHECKBOX TERMOS */}
            <div className="flex items-start gap-3 px-1">
                <div className="relative flex items-center">
                    <input 
                        type="checkbox" 
                        id="terms" 
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-white transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400"
                    />
                    <Check size={12} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                </div>
                <label htmlFor="terms" className="text-xs text-gray-500 cursor-pointer select-none leading-relaxed">
                    Li e aceito os <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 font-bold hover:underline">Termos de Uso</button> e a <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 font-bold hover:underline">Política de Privacidade</button>.
                </label>
            </div>

            <button type="submit" disabled={loading} className={`w-full text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 shadow-lg ${selectedRole === 'PRESTADOR' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} disabled:opacity-70 disabled:cursor-not-allowed`}>
              {loading ? <Loader2 className="animate-spin" /> : <>{selectedRole ? 'Finalizar Cadastro' : 'Selecione um Perfil'} <ArrowRight size={18}/></>}
            </button>
          </form>
          
          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-gray-500 text-sm">Já tem conta? <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">Entrar</Link></p>
          </div>
        </div>
      </div>

      {/* MODAL DE TERMOS */}
      {showTermsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText className="text-blue-600"/> Termos de Uso</h2>
                      <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500"/></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-4">
                      <p><strong>Última atualização: {new Date().toLocaleDateString()}</strong></p>
                      
                      <h3 className="text-gray-900 font-bold text-lg">1. O Serviço</h3>
                      <p>O ChapaCerto é uma plataforma tecnológica que conecta prestadores de serviços autônomos ("Chapas") a pessoas ou empresas que necessitam de serviços de carga e descarga ("Contratantes"). <strong>Nós não somos uma transportadora nem empregamos os Chapas.</strong> Atuamos apenas como intermediadores.</p>

                      <h3 className="text-gray-900 font-bold text-lg">2. Responsabilidades</h3>
                      <ul className="list-disc pl-5 space-y-2">
                          <li><strong>Do Prestador (Chapa):</strong> É responsável por realizar o serviço com segurança, pontualidade e profissionalismo. Deve possuir saúde física adequada para o trabalho pesado.</li>
                          <li><strong>Do Contratante:</strong> É responsável por descrever o serviço com precisão e garantir que o local seja seguro para o trabalho.</li>
                      </ul>

                      <h3 className="text-gray-900 font-bold text-lg">3. Pagamentos e Taxas</h3>
                      <p>O ChapaCerto cobra uma taxa fixa de conveniência (R$ 4,99) para liberar o contato direto entre as partes. O valor do serviço (mão de obra) é negociado livremente e pago diretamente do Contratante para o Chapa (via Pix, dinheiro, etc). A plataforma não retém valores de mão de obra.</p>

                      <h3 className="text-gray-900 font-bold text-lg">4. Segurança</h3>
                      <p>Recomendamos que todos os pagamentos de mão de obra sejam feitos apenas <strong>após</strong> a realização do serviço ou mediante acordo seguro entre as partes. O ChapaCerto não se responsabiliza por calotes ou descumprimentos de acordos verbais.</p>

                      <h3 className="text-gray-900 font-bold text-lg">5. Dados e Privacidade</h3>
                      <p>Seus dados (Nome, Telefone, CPF) são utilizados apenas para a operação da plataforma e segurança dos usuários. Não vendemos seus dados para terceiros.</p>
                  </div>

                  <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end">
                      <button 
                          onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }} 
                          className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                      >
                          Li e Aceito os Termos
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>}><RegisterContent /></Suspense>;
}