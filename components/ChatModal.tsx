'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Send, User, Check, CheckCheck, Lock, AlertTriangle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Message { 
  id: string; 
  content: string; 
  sender_id: string; 
  created_at: string; 
  is_read: boolean; 
}

interface ChatModalProps { 
  proposalId: string; 
  driverName: string; 
  currentUserId: string; 
  onClose: () => void; 
  onMessagesRead?: () => void; 
}

export default function ChatModal({ proposalId, driverName, currentUserId, onClose, onMessagesRead }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Formata hora (ex: 14:30)
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Lógica para mostrar etiquetas de data (Hoje, Ontem, etc)
  const shouldShowDate = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.created_at).toDateString();
    const prevDate = new Date(prevMsg.created_at).toDateString();
    return currentDate !== prevDate;
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR');
  };

  const markAsRead = async () => {
    const { error } = await supabase.from('messages')
      .update({ is_read: true })
      .eq('proposal_id', proposalId)
      .neq('sender_id', currentUserId)
      .eq('is_read', false);
      
    if (!error && onMessagesRead) onMessagesRead();
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
        
      if (data) setMessages(data);
      markAsRead();
    };
    fetchHistory();

    const channel = supabase.channel(`chat:${proposalId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `proposal_id=eq.${proposalId}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          if (payload.new.sender_id !== currentUserId) markAsRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `proposal_id=eq.${proposalId}` }, (payload) => {
           setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new as Message : msg));
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [proposalId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    // --- SECURITY LAYER: BLOQUEIO DE CONTATOS ---
    const forbiddenPattern = /((?:\d{2}\s?)?(?:9\s?)?\d{4}[-.\s]?\d{4})|(@|gmail|hotmail|outlook|yahoo)|(\b(zap|whats|insta|telegram|fone|ligar|chama|contato)\b)/i;
    const digitCount = (newMessage.match(/\d/g) || []).length;

    if (forbiddenPattern.test(newMessage) || digitCount >= 6) {
      toast.error('Conteúdo Bloqueado por Segurança', {
        description: 'A troca de contatos é liberada automaticamente após a confirmação. Proteja-se contra golpes.',
        icon: <Lock size={16} className="text-red-500"/>,
        duration: 4000,
      });
      return;
    }

    const msg = newMessage;
    setNewMessage(''); // Limpa input instantaneamente
    
    await supabase.from('messages').insert({ 
        proposal_id: proposalId, 
        sender_id: currentUserId, 
        content: msg 
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[650px] max-h-[90vh] animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-2.5 rounded-full relative">
                <User size={20} className="text-gray-500"/>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
                <h3 className="font-bold text-sm text-gray-900">{driverName}</h3>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Lock size={10} className="text-green-500"/> Chat Criptografado
                </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} className="text-gray-400"/>
          </button>
        </div>

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-2 relative">
            {/* Background Pattern Sutil */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
            
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3 opacity-50 relative z-10">
                    <MessageCircle size={48} />
                    <p className="text-xs font-medium">Inicie a conversa...</p>
                </div>
            )}

            {messages.map((msg, index) => {
                const isMe = msg.sender_id === currentUserId;
                const showDate = shouldShowDate(msg, index > 0 ? messages[index - 1] : null);

                return (
                <div key={msg.id} className="relative z-10">
                    {showDate && (
                        <div className="flex justify-center my-4">
                            <span className="bg-gray-200 text-gray-500 text-[10px] px-3 py-1 rounded-full font-bold shadow-sm">
                                {formatDateLabel(msg.created_at)}
                            </span>
                        </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                        <div 
                            className={`max-w-[80%] p-3 px-4 rounded-2xl text-sm relative shadow-sm ${
                                isMe 
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' 
                                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-gray-100'
                            }`}
                        >
                            {msg.content}
                            <div className={`flex justify-end items-center gap-1 mt-1 text-[10px] opacity-70 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                <span>{formatTime(msg.created_at)}</span>
                                {isMe && (
                                    msg.is_read ? <CheckCheck size={14} className="text-blue-200" /> : <Check size={14} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-3 bg-white border-t border-gray-100 z-10 shadow-lg">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
                <input 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="Digite sua mensagem..." 
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium" 
                />
                <button 
                    type="submit" 
                    disabled={!newMessage.trim()} 
                    className="bg-blue-600 text-white p-3.5 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-blue-200"
                >
                    <Send size={20} />
                </button>
            </form>
            <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1 font-medium">
                <AlertTriangle size={10}/> Não envie contatos antes do pagamento.
            </p>
        </div>
      </div>
    </div>
  );
}