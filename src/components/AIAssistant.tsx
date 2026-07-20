import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  Lightbulb, 
  MessageSquare, 
  Percent, 
  Smartphone,
  Bot,
  User,
  RotateCcw
} from "lucide-react";
import { Product, Customer, Sale } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AIAssistantProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  shopName: string;
}

export default function AIAssistant({
  products,
  customers,
  sales,
  shopName
}: AIAssistantProps) {
  const [chatHistory, setChatHistory] = useState<{ sender: "user" | "bot"; text: string }[]>([
    { 
      sender: "bot", 
      text: `Hello! I am your **Gemini AI Retail Assistant**. I have scanned your active store catalog, loyalty registry, and sales history. \n\nHow can I optimize your operations today? You can type custom instructions or try one-click operations below!` 
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  // General Prompt contextual builder based on actual store data
  const buildContextPrompt = () => {
    let ctx = `Store name: ${shopName}\n\n`;
    ctx += `Current Products Inventory:\n`;
    products.forEach(p => {
      ctx += `- Name: ${p.name}, Category: ${p.category}, Cost Price: $${p.purchasePrice}, MRP: $${p.sellingPrice}, Qty left: ${p.quantity}, Low Alert threshold: ${p.lowStockLimit}, Overstock threshold: ${p.overstockLimit}\n`;
    });

    ctx += `\nLoyalty Registry customers:\n`;
    customers.forEach(c => {
      ctx += `- Name: ${c.name}, Tier: ${c.tier}, Points: ${c.points}, Total Spent: $${c.totalSpent}\n`;
    });

    ctx += `\nRecent Transactions:\n`;
    sales.slice(-5).forEach(s => {
      ctx += `- Bill ID: ${s.id}, Customer: ${s.customerName}, Total Bill: $${s.totalAmount}, Items: ${s.items.map(i => `${i.quantity}x ${i.name}`).join(", ")}, Date: ${s.timestamp}\n`;
    });

    return ctx;
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || userInput;
    if (!textToSubmit.trim() || isLoading) return;

    // Add user message to chat
    setChatHistory(prev => [...prev, { sender: "user", text: textToSubmit }]);
    setUserInput("");
    setIsLoading(true);

    const storeContext = buildContextPrompt();
    const systemPrompt = `You are an expert AI Retail Shop Operations and Business Consultant. You are analyzing data for ${shopName}. Answer questions objectively, give precise mathematical stock insights, suggest smart marketing actions, and write high-conversion copy. Be concise and practical, using bullet points and markdown formatting.`;

    const compositePrompt = `${storeContext}\n\nUser Request: ${textToSubmit}`;

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          userPrompt: compositePrompt
        })
      });

      const data = await res.json();
      if (res.ok) {
        setChatHistory(prev => [...prev, { sender: "bot", text: data.text }]);
      } else {
        setChatHistory(prev => [...prev, { sender: "bot", text: `Error: ${data.error || "Failed to parse AI advice"}` }]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      setChatHistory(prev => [...prev, { sender: "bot", text: "Connection error. Please make sure the backend server is online." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Preset operations
  const triggerStockRecommendation = () => {
    const prompt = "Analyze my current product inventory levels. Highlight any products running low and provide a detailed restocking replenishment plan. Also point out any overstocked items and recommend clearance tactics.";
    handleSendMessage(prompt);
  };

  const triggerPriceOptimization = () => {
    const prompt = "Look at my purchase prices and selling MRPs. Suggest dynamic pricing tweaks or bundle discount ideas to maximize gross margins without hurting customer satisfaction, especially for my top-tier loyalty members.";
    handleSendMessage(prompt);
  };

  const triggerDraftLoyaltySms = () => {
    const prompt = "Draft 3 variations of highly-engaging promotional SMS text messages targeting Silver or Gold loyalty members. Offer an exclusive incentive (like redeeming points or a weekend discount) to drive repeat footfall. Include placeholders and characters counts.";
    handleSendMessage(prompt);
  };

  const resetChat = () => {
    setChatHistory([
      { 
        sender: "bot", 
        text: `Hello! I am your **Gemini AI Retail Assistant**. I have scanned your active store catalog, loyalty registry, and sales history. \n\nHow can I optimize your operations today? You can type custom instructions or try one-click operations below!` 
      }
    ]);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none flex flex-col h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-3 border-black pb-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
            <Bot className="w-6 h-6 text-black animate-pulse" />
            <span>Gemini AI Retail Operations Center</span>
          </h2>
          <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Intelligent inventory recommendation engines, margin optimizers, and SMS copy compilers.</p>
        </div>
        <button 
          onClick={resetChat}
          className="px-3.5 py-2 bg-white border-2 border-black text-black hover:bg-zinc-100 rounded-none text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET SESSION</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden min-h-0">
        
        {/* Left Side: Preset Prompts triggers (Col Span 1) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white p-5 rounded-none border-3 border-black space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-black text-black text-xs uppercase tracking-wider font-mono border-b-2 border-black pb-2">One-Click AI Engines</h3>
            
            <button
              onClick={triggerStockRecommendation}
              className="w-full text-left p-3.5 bg-white hover:bg-[#F5F2EB] border-2 border-black rounded-none transition-all flex gap-3 group cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Lightbulb className="w-5 h-5 text-black shrink-0 group-hover:scale-105" />
              <div>
                <p className="text-xs font-black text-black uppercase">Stocking Analysis</p>
                <p className="text-[10px] text-zinc-700 font-bold font-mono mt-1 leading-normal">Suggest items to purchase & overstock clearance strategies.</p>
              </div>
            </button>

            <button
              onClick={triggerPriceOptimization}
              className="w-full text-left p-3.5 bg-white hover:bg-[#F5F2EB] border-2 border-black rounded-none transition-all flex gap-3 group cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Percent className="w-5 h-5 text-black shrink-0 group-hover:scale-105" />
              <div>
                <p className="text-xs font-black text-black uppercase">MRP Margin Guide</p>
                <p className="text-[10px] text-zinc-700 font-bold font-mono mt-1 leading-normal">Identify high margin items and suggest bundle pricing.</p>
              </div>
            </button>

            <button
              onClick={triggerDraftLoyaltySms}
              className="w-full text-left p-3.5 bg-white hover:bg-[#F5F2EB] border-2 border-black rounded-none transition-all flex gap-3 group cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Smartphone className="w-5 h-5 text-black shrink-0 group-hover:scale-105" />
              <div>
                <p className="text-xs font-black text-black uppercase">SMS Copy Compiler</p>
                <p className="text-[10px] text-zinc-700 font-bold font-mono mt-1 leading-normal">Compose promotional SMS copy for Silver & Gold members.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Right Side: Chat Arena (Col Span 3) */}
        <div className="lg:col-span-3 bg-white border-3 border-black rounded-none flex flex-col h-full overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          
          {/* Chat header status */}
          <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between bg-[#F5F2EB]">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-none bg-[#D63031] animate-pulse border border-black" />
              <span className="text-[10px] font-black text-black font-mono">GEMINI AI CORE SYSTEM ONLINE</span>
            </div>
            <span className="text-[9px] text-zinc-600 font-black font-mono uppercase">Context-Aware Core</span>
          </div>

          {/* Messages stream */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {chatHistory.map((msg, i) => {
              const isBot = msg.sender === "bot";
              return (
                <div key={i} className={`flex gap-3.5 max-w-[85%] ${isBot ? "" : "ml-auto flex-row-reverse"}`}>
                  <div className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 border-2 border-black ${
                    isBot ? "bg-[#FFC300] text-black" : "bg-[#0055A5] text-white"
                  }`}>
                    {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  
                  <div className={`p-4 rounded-none text-sm leading-relaxed border-2 border-black ${
                    isBot 
                      ? "bg-white text-black" 
                      : "bg-[#F5F2EB] text-black"
                  }`}>
                    {isBot ? (
                      <div className="space-y-2 whitespace-pre-wrap font-sans">
                        {/* Custom minimal parsing of markdown titles for elegant look */}
                        {msg.text.split("\n").map((line, idx) => {
                          if (line.startsWith("##")) {
                            return <h3 key={idx} className="font-black uppercase text-black text-sm mt-3 mb-1">{line.replace("##", "")}</h3>;
                          } else if (line.startsWith("#")) {
                            return <h2 key={idx} className="font-black uppercase text-black text-base mt-4 mb-1.5">{line.replace("#", "")}</h2>;
                          } else if (line.startsWith("-") || line.startsWith("*")) {
                            return <li key={idx} className="list-square ml-4 text-zinc-800 font-bold font-mono text-xs">{line.substring(2)}</li>;
                          }
                          return <p key={idx} className="text-zinc-800 text-xs mt-1 leading-relaxed">{line}</p>;
                        })}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap font-mono text-xs font-bold">{msg.text}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3.5">
                <div className="w-8 h-8 rounded-none bg-[#FFC300] text-black flex items-center justify-center border-2 border-black animate-spin">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="p-4 bg-white border-2 border-black text-black rounded-none flex items-center gap-2">
                  <span className="w-2 h-2 bg-black animate-bounce rounded-none" />
                  <span className="w-2 h-2 bg-black animate-bounce rounded-none [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-black animate-bounce rounded-none [animation-delay:0.4s]" />
                  <span className="text-xs font-black font-mono text-black uppercase ml-1">GEMINI IS COMPILING DECISIONS...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Bottom input form */}
          <div className="p-4 border-t-2 border-black bg-[#F5F2EB]">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask assistant, e.g. Suggest a clearing strategy for overstock items..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 px-4 py-3 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500 font-mono"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={isLoading}
                className="px-5 bg-[#D63031] hover:bg-[#E54849] text-white border-2 border-black rounded-none flex items-center justify-center transition-all disabled:opacity-50 font-black text-xs cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
