import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Paperclip, ChevronLeft } from 'lucide-react';
import { getAcademicAdvice } from '../services/aiService';
import { ChatMessage } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AIAdvisorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const displayName = user?.full_name || user?.username || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .slice(0, 2);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const aiResponse = await getAcademicAdvice(input, messages);
    
    setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    setIsTyping(false);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors hidden md:block">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Student Dashboard</h2>
            <p className="text-xs text-slate-500 font-medium">Academic Advisory System</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">{displayName}</p>
            <p className="text-[10px] text-slate-500">Student ID {user?.student_id || 'N/A'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
            {initials || 'ST'}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 select-none">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
              <Bot className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Welcome to AI Advisor</h3>
            <p className="text-slate-500 max-w-sm">Ask me any questions regarding your academics at Hawassa University. (e.g., How do I apply for a makeup exam?)</p>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex items-start gap-4",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                msg.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-primary text-white"
              )}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl max-w-[80%] shadow-sm",
                msg.role === 'user' 
                  ? "bg-slate-100 text-slate-800 rounded-tr-none" 
                  : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
              )}>
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 font-medium italic animate-pulse">
            <Bot className="w-4 h-4" />
            <span>AI Advisor is typing...</span>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-100">
        <div className="relative group">
          <div className="absolute left-4 inset-y-0 flex items-center">
            <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your question..."
            className="w-full bg-white border border-slate-200 pl-16 pr-16 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm group-hover:shadow-md"
          />
          <div className="absolute right-4 inset-y-0 flex items-center">
            <button
              id="send-ai-btn"
              onClick={handleSend}
              className="p-3 bg-[#004b7a] text-white rounded-xl hover:bg-[#003d66] transition-colors shadow-md active:scale-90 disabled:opacity-50"
              disabled={!input.trim() || isTyping}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
