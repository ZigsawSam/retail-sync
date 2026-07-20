import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  Users, 
  Award, 
  Gift, 
  Plus, 
  Search, 
  PlusCircle, 
  DollarSign, 
  Sparkles,
  ShoppingBag
} from "lucide-react";
import { Customer, Product, Sale } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { motion, AnimatePresence } from "motion/react";

interface InsightsPageProps {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  currency: string;
  onAddCustomer: (customer: Customer) => void;
}

export default function InsightsPage({
  customers,
  products,
  sales,
  currency,
  onAddCustomer
}: InsightsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // New customer onboarding form states
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");

  // Customer filter
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  // Calculations: Total Profit margin per product
  const productProfitabilityData = useMemo(() => {
    const profitMap: Record<string, { name: string; quantitySold: number; profit: number }> = {};
    
    // Initialize with all products
    products.forEach(p => {
      profitMap[p.id] = {
        name: p.name,
        quantitySold: 0,
        profit: 0
      };
    });

    // Accumulate from sales
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const costPrice = prod ? prod.purchasePrice : 0;
        const profitPerUnit = item.price - costPrice;
        const totalItemProfit = profitPerUnit * item.quantity;

        if (profitMap[item.productId]) {
          profitMap[item.productId].quantitySold += item.quantity;
          profitMap[item.productId].profit += totalItemProfit;
        } else {
          profitMap[item.productId] = {
            name: item.name,
            quantitySold: item.quantity,
            profit: totalItemProfit
          };
        }
      });
    });

    return Object.values(profitMap)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
      .map(item => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
        Profit: Math.round(item.profit),
        Sold: item.quantitySold
      }));
  }, [products, sales]);

  // Calculations: Loyalty Tier Distribution Pie Chart (Bauhaus Primary Colors)
  const tierDistributionData = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Bronze: 0 };
    customers.forEach(c => {
      counts[c.tier]++;
    });

    return [
      { name: "Gold Tier", value: counts.Gold, color: "#FFC300" }, // Bauhaus Yellow
      { name: "Silver Tier", value: counts.Silver, color: "#0055A5" }, // Bauhaus Blue
      { name: "Bronze Tier", value: counts.Bronze, color: "#D63031" } // Bauhaus Red
    ].filter(tier => tier.value > 0);
  }, [customers]);

  // Handle manual customer onboarding submission
  const handleOnboardCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;

    const newCust: Customer = {
      id: "cust-" + Date.now(),
      name: custName,
      phone: custPhone,
      email: custEmail || "",
      points: 50, // Starting balance bonus
      tier: "Bronze",
      totalSpent: 0
    };

    onAddCustomer(newCust);
    setCustName("");
    setCustPhone("");
    setCustEmail("");
    setShowAddCustomerModal(false);
    alert("New customer loyalty account created! Credited 50 points welcome bonus.");
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-3 border-black pb-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-black">Loyalty Accounts & Analytics</h2>
          <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Automate customer point systems, reward tiers, and track highest profit margins.</p>
        </div>
        <button 
          onClick={() => setShowAddCustomerModal(true)}
          className="px-4 py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ONBOARD LOYALTY CUSTOMER</span>
        </button>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Profitability Leaderboard Bar Chart */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-6">
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-black" />
              <span>Highest Grossing Profit Items</span>
            </h3>
            <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Inventory lines generating highest cumulative net income margin</p>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productProfitabilityData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" stroke="#000" fontSize={10} tickLine={false} axisLine={true} />
                <YAxis dataKey="name" type="category" stroke="#000" fontSize={9} tickLine={false} axisLine={true} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "white", borderRadius: "0px", border: "2px solid #000", color: "#000" }}
                  labelClassName="font-black text-xs"
                />
                <Bar dataKey="Profit" fill="#D63031" radius={[0, 0, 0, 0]} barSize={14} name="Profit Margin" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loyalty Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-none border-3 border-black flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-black" />
              <span>Loyalty Members Tier Breakdown</span>
            </h3>
            <p className="text-xs text-zinc-700 font-bold font-mono">Distribution ratio of Bronze, Silver, and Gold members</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            <div className="h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {tierDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#000" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-xs">
              {tierDistributionData.map((tier, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-none border-2 border-black" style={{ backgroundColor: tier.color }} />
                  <span className="font-black text-black uppercase font-mono">{tier.name}:</span>
                  <span className="font-mono text-zinc-600 font-bold">{tier.value} accounts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Loyalty Directory and Point Wallets */}
      <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
          <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-black" />
            <span>Active Loyalty Registry</span>
          </h3>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-black" />
            <input 
              type="text" 
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border-2 border-black rounded-none text-xs font-bold text-black focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-black font-black text-xs uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Phone No</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Reward Tier</th>
                <th className="py-3 px-4 text-center">Wallet Points</th>
                <th className="py-3 px-4 text-right">Cumulative Spending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-black font-bold">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500 font-mono text-sm">No accounts found matching filters.</td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[#F5F2EB]/40 transition-colors">
                    <td className="py-4 px-4 font-black text-black text-sm">{cust.name}</td>
                    <td className="py-4 px-4 font-mono text-sm">{cust.phone}</td>
                    <td className="py-4 px-4 text-sm text-zinc-600 font-mono">{cust.email || "N/A"}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-[10px] font-black font-mono uppercase border border-black ${
                        cust.tier === "Gold" ? "bg-[#FFC300] text-black" :
                        cust.tier === "Silver" ? "bg-[#0055A5] text-white" :
                        "bg-[#D63031] text-white"
                      }`}>
                        {cust.tier}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="font-black text-black font-mono text-sm">{cust.points} pts</span>
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-black text-black">
                      {currency}{cust.totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL ONBOARD CUSTOMER MODAL */}
      <AnimatePresence>
        {showAddCustomerModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border-3 border-black text-black w-full max-w-sm p-6 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <h3 className="font-black uppercase text-black text-lg">Onboard Loyalty Customer</h3>
                <button 
                  onClick={() => setShowAddCustomerModal(false)} 
                  className="p-1 border-2 border-black bg-white hover:bg-[#F5F2EB] text-black font-black cursor-pointer w-7 h-7 flex items-center justify-center rounded-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleOnboardCustomerSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                    placeholder="e.g. Rachel Green"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Mobile Phone No</label>
                  <input 
                    type="text" 
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500 font-mono"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Email Address (Optional)</label>
                  <input 
                    type="email" 
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                    placeholder="e.g. rgreen@example.com"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  ONBOARD CUSTOMER
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
