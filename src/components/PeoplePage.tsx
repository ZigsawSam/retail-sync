import React, { useState, useMemo } from "react";
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Clock, 
  Calendar, 
  DollarSign, 
  CreditCard,
  Phone,
  User,
  Shield,
  Briefcase
} from "lucide-react";
import { Staff, Expense } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getShopLocalISOString } from "../lib/dateUtils";

interface PeoplePageProps {
  staff: Staff[];
  expenses: Expense[];
  currency: string;
  onOnboardStaff: (newStaff: Staff) => void;
  onLogAttendance: (staffId: string, date: string, present: boolean, hoursWorked?: number, wageEarned?: number) => void;
  onAddExpense: (expense: Expense) => void;
  onArchiveStaff: (id: string) => Promise<void>;
  onRestoreStaff: (id: string) => Promise<void>;
  onDeleteStaff: (id: string) => Promise<void>;
  settings?: any;
  onUpdateSettings?: (settings: any) => void;
}

export default function PeoplePage({
  staff,
  expenses,
  currency,
  onOnboardStaff,
  onLogAttendance,
  onAddExpense,
  onArchiveStaff,
  onRestoreStaff,
  onDeleteStaff,
  settings,
  onUpdateSettings
}: PeoplePageProps) {
  const activeStaff = staff.filter((member) => !member.archived_at);
  const archivedStaff = staff.filter((member) => !!member.archived_at);
  const [staffActionMessage, setStaffActionMessage] = useState("");

  const archiveMember = async (member: Staff) => {
    if (!confirm(`Archive ${member.name}? They will leave the active staff list and any active terminal access will be terminated. Attendance and payroll history will be kept.`)) return;
    try { await onArchiveStaff(member.id); setStaffActionMessage(`${member.name} archived. History retained.`); }
    catch (error: any) { setStaffActionMessage(error?.message || "Unable to archive staff member."); }
  };

  const restoreMember = async (member: Staff) => {
    try { await onRestoreStaff(member.id); setStaffActionMessage(`${member.name} restored to active staff.`); }
    catch (error: any) { setStaffActionMessage(error?.message || "Unable to restore staff member."); }
  };

  const permanentlyDeleteMember = async (member: Staff) => {
    if (!confirm(`PERMANENTLY DELETE ${member.name}? This cannot be undone. Deletion is allowed only when no attendance or terminal-access history is linked.`)) return;
    try { await onDeleteStaff(member.id); setStaffActionMessage(`${member.name} permanently deleted.`); }
    catch (error: any) { setStaffActionMessage(error?.message || "Unable to permanently delete staff member."); }
  };

  // Current date
  const TODAY_STR = "2026-07-14";
  const [selectedDate, setSelectedDate] = useState(TODAY_STR);
  
  // Modals state
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Onboard staff form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Sales Associate");
  const [paymentType, setPaymentType] = useState<"Monthly fixed" | "Daily wage" | "Hourly">("Monthly fixed");
  const [rate, setRate] = useState("");


  // Payout form states
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  // Tracks hour-counter input for hourly staff during attendance taking
  // Keyed by staffId
  const [hourlyWorkState, setHourlyWorkState] = useState<Record<string, number>>({});

  // Dynamic label for onboarding amount field
  const amountHeaderLabel = useMemo(() => {
    if (paymentType === "Monthly fixed") return "monthly amount";
    if (paymentType === "Daily wage") return "daily rate";
    return "hourly rate";
  }, [paymentType]);

  // Placeholder for salary field based on type
  const amountPlaceholder = useMemo(() => {
    if (paymentType === "Monthly fixed") return "e.g., 3200";
    if (paymentType === "Daily wage") return "e.g., 120";
    return "e.g., 18";
  }, [paymentType]);

  // Employee records are separate from authenticated terminal access.
  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !rate || !Number.isFinite(Number(rate)) || Number(rate) < 0) return;
    const newStaff: Staff = { id: "staff-" + Date.now(), name: name.trim(), phone: phone.trim(), role: role.trim(), paymentType, rate: Number(rate), attendance: {} };
    onOnboardStaff(newStaff);
    setName(""); setPhone(""); setRole("Sales Associate"); setPaymentType("Monthly fixed"); setRate("");
    setShowOnboardModal(false);
    alert("Staff record created. To grant system access, send an invitation from Settings.");
  };
  // Log attendance for specific staff member
  const handleAttendanceChange = (member: Staff, present: boolean) => {
    let hoursWorked = undefined;
    let wageEarned = 0;

    if (present) {
      if (member.paymentType === "Hourly") {
        hoursWorked = hourlyWorkState[member.id] || 8; // default 8 hours if not set
        wageEarned = hoursWorked * member.rate;
      } else if (member.paymentType === "Daily wage") {
        wageEarned = member.rate;
      } else {
        // Monthly wage: daily proportional equivalent for calculations, e.g. monthly rate / 30
        wageEarned = member.rate / 30;
      }
    }

    onLogAttendance(member.id, selectedDate, present, hoursWorked, Math.round(wageEarned * 100) / 100);
  };

  const handleHourAdjust = (memberId: string, hours: number) => {
    const nextHours = Math.max(1, Math.min(24, hours));
    setHourlyWorkState(prev => ({
      ...prev,
      [memberId]: nextHours
    }));

    // Find if already marked present, if so, trigger re-evaluation of wages
    const member = staff.find(s => s.id === memberId);
    if (member && member.attendance[selectedDate]?.present) {
      const wageEarned = nextHours * member.rate;
      onLogAttendance(memberId, selectedDate, true, nextHours, Math.round(wageEarned * 100) / 100);
    }
  };

  // Financial summary of staff: wages accrued vs wages paid out
  const staffFinancials = useMemo(() => {
    return staff.map(member => {
      // Accrued: sum of wages earned across attendance history
      let accrued = 0;
      Object.values(member.attendance).forEach(record => {
        if (record.present && record.wageEarned) {
          accrued += record.wageEarned;
        }
      });

      // Paid: sum of Expenses where staffId or staff name is in description
      const paid = expenses
        .filter(e => e.category === "Staff Salary" && e.description.includes(member.name))
        .reduce((sum, e) => sum + e.amount, 0);

      const unpaidBalance = Math.max(0, accrued - paid);

      return {
        member,
        accrued,
        paid,
        unpaidBalance
      };
    });
  }, [staff, expenses]);

  // Handle Payroll payouts
  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !payoutAmount) return;

    const member = staff.find(s => s.id === selectedStaffId);
    if (!member) return;

    const amount = parseFloat(payoutAmount);
    const newExpense: Expense = {
      id: "exp-" + Date.now(),
      category: "Staff Salary",
      amount,
      description: `Wages paid to ${member.name} (${member.role}). Note: ${payoutNotes || "Wages Cleared"}`,
      timestamp: getShopLocalISOString()
    };

    onAddExpense(newExpense);
    
    // Reset payout form
    setSelectedStaffId("");
    setPayoutAmount("");
    setPayoutNotes("");
    setShowPayoutModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-3 border-black pb-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-black">Staff Management & Attendance</h2>
          <p className="text-xs text-zinc-700 font-bold font-mono">Onboard staff, log daily shifts/hours, and manage wage payout expenses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowPayoutModal(true)}
            className="px-4 py-2.5 bg-white border-2 border-black hover:bg-zinc-100 text-black rounded-none text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <DollarSign className="w-4 h-4 text-black" />
            <span>PROCESS WAGE PAYMENT</span>
          </button>
          
          <button 
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <UserPlus className="w-4 h-4" />
            <span>ONBOARD NEW STAFF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Attendance Logging Box (Col Span 2) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
              <h3 className="font-black uppercase text-black flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-black" />
                <span>Daily Attendance Register</span>
              </h3>
              
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-black font-mono">Duty Shift Date:</span>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border-2 border-black rounded-none text-sm text-black font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              {activeStaff.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 bg-[#F5F2EB] border-2 border-black rounded-none">
                  <p className="text-sm font-black font-mono">No staff members onboarded yet.</p>
                  <button 
                    onClick={() => setShowOnboardModal(true)}
                    className="mt-3 text-xs font-black text-[#0055A5] hover:underline cursor-pointer uppercase font-mono"
                  >
                    Click here to onboard staff
                  </button>
                </div>
              ) : (
                activeStaff.map((member) => {
                  const record = member.attendance[selectedDate];
                  const isPresent = record?.present === true;
                  const isAbsent = record?.present === false;
                  
                  // Hours state lookup
                  const hours = hourlyWorkState[member.id] || record?.hoursWorked || 8;

                  return (
                    <div 
                      key={member.id} 
                      className={`p-4 border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-none ${
                        isPresent ? "bg-[#E8F8F5] border-black text-black" :
                        isAbsent ? "bg-[#FCE8E6] border-black text-black" :
                        "bg-white border-black text-black"
                      }`}
                    >
                      {/* Left: Staff details */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-none border-2 border-black flex items-center justify-center font-black text-sm ${
                          isPresent ? "bg-[#FFC300] text-black" :
                          isAbsent ? "bg-[#D63031] text-white" :
                          "bg-white text-black"
                        }`}>
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-black text-sm">{member.name}</p>
                          <p className="text-xs text-zinc-700 font-bold font-mono">{member.role} | {member.paymentType} ({currency}{member.rate})</p>
                        </div>
                      </div>

                      {/* Staff actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
                        <button onClick={() => void archiveMember(member)} className="px-3 py-2 text-xs font-black border-2 border-black bg-white hover:bg-[#FCE8E6] text-black">
                          ARCHIVE STAFF
                        </button>
                      </div>
                      {/* Right-aligned Actions Group: Includes Hourly Tracker, Day's Pay, and Toggle Buttons unified */}
                      <div className="flex flex-wrap items-center gap-4 self-end md:self-auto shrink-0">
                        {/* Hourly Tracker (Only for Hourly Staff) */}
                        {member.paymentType === "Hourly" && (
                          <div className="flex items-center gap-2.5 bg-white border-2 border-black px-3 py-1 rounded-none">
                            <Clock className="w-3.5 h-3.5 text-black" />
                            <span className="text-xs font-black text-black font-mono">Hours:</span>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => handleHourAdjust(member.id, hours - 1)}
                                className="w-6 h-6 rounded-none bg-white hover:bg-[#F5F2EB] text-black text-xs font-black border border-black flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-black font-mono w-5 text-center text-black">{hours}h</span>
                              <button 
                                onClick={() => handleHourAdjust(member.id, hours + 1)}
                                className="w-6 h-6 rounded-none bg-white hover:bg-[#F5F2EB] text-black text-xs font-black border border-black flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Live calculated pay indicator */}
                        {isPresent && (
                          <div className="text-right">
                            <p className="text-[9px] text-zinc-600 font-bold font-mono uppercase tracking-wider">Day's Pay</p>
                            <p className="text-sm font-black text-[#0055A5] font-mono">
                              +{currency}{(record?.wageEarned || 0).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Attendance Toggle Buttons */}
                        <div className="flex border-2 border-black rounded-none overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <button
                            onClick={() => handleAttendanceChange(member, true)}
                            className={`px-4 py-2 text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                              isPresent 
                                ? "bg-[#0055A5] text-white" 
                                : "bg-white hover:bg-zinc-50 text-black border-r-2 border-black"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>
                          
                          <button
                            onClick={() => handleAttendanceChange(member, false)}
                            className={`px-4 py-2 text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                              isAbsent 
                                ? "bg-[#D63031] text-white" 
                                : "bg-white hover:bg-zinc-50 text-black"
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Staff Payout & Wage Balances Sidebar Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-black uppercase text-black flex items-center gap-2 mb-4 border-b-2 border-black pb-3 text-base">
              <CreditCard className="w-4 h-4 text-black" />
              <span>Outstanding Wages</span>
            </h3>

            <div className="space-y-4">
              {staffFinancials.map((fin) => (
                <div key={fin.member.id} className="p-3.5 bg-[#F5F2EB] rounded-none border-2 border-black flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-black">{fin.member.name}</p>
                    <p className="text-[10px] text-zinc-700 font-bold font-mono">{fin.member.role}</p>
                    <p className="text-[10px] text-zinc-600 font-bold font-mono mt-1">Accrued: {currency}{fin.accrued.toFixed(0)} | Paid: {currency}{fin.paid.toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold font-mono">Unpaid</p>
                    <p className={`text-sm font-black font-mono mt-0.5 ${fin.unpaidBalance > 0 ? "text-[#D63031]" : "text-[#0055A5]"}`}>
                      {currency}{fin.unpaidBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Archived staff records */}
      {staffActionMessage && <p className="mb-4 border-2 border-black bg-white p-3 text-sm font-bold">{staffActionMessage}</p>}
      {archivedStaff.length > 0 && (
        <section className="mt-8 bg-white p-6 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black uppercase text-base border-b-2 border-black pb-3 mb-4">Archived Staff · History Preserved</h3>
          <div className="space-y-3">
            {archivedStaff.map((member) => (
              <div key={member.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-2 border-black p-3">
                <div>
                  <p className="font-black text-sm">{member.name}</p>
                  <p className="text-xs text-zinc-700 font-mono">{member.role} · Archived {member.archived_at ? new Date(member.archived_at).toLocaleDateString() : ""}</p>
                  <p className="text-xs text-zinc-600">Attendance and payroll data retained</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void restoreMember(member)} className="px-3 py-2 text-xs font-black border-2 border-black bg-white hover:bg-zinc-100">RESTORE</button>
                  <button onClick={() => void permanentlyDeleteMember(member)} className="px-3 py-2 text-xs font-black border-2 border-black bg-[#FCE8E6] hover:bg-[#F5C6C6]">PERMANENT DELETE</button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-600">Permanent deletion is intentionally blocked when attendance or terminal-access history exists. Keep those records archived to preserve the audit trail.</p>
        </section>
      )}

      {/* STAFF ONBOARDING MODAL */}
      <AnimatePresence>
        {showOnboardModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <h3 className="font-black uppercase text-black text-lg">Onboard Store Staff</h3>
                <button 
                  onClick={() => setShowOnboardModal(false)} 
                  className="p-1 border-2 border-black bg-white hover:bg-[#F5F2EB] text-black font-black cursor-pointer w-7 h-7 flex items-center justify-center rounded-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <p className="text-xs text-zinc-600 font-mono">Create the employee record here. Invite cashier or inventory-manager access separately from Settings using the employee email address.</p>

                <p className="text-xs text-zinc-600 font-mono">Create the employee record here. Invite cashier or inventory-manager access separately from Settings using the employee email address.</p>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-black" />
                    <span>Staff Full Name</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                    placeholder="e.g. Rachel Green"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-black" />
                      <span>Phone Number</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5 flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-black" />
                      <span>Role / Designation</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white disabled:bg-zinc-100 border-2 border-black text-black disabled:text-zinc-500 rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                      placeholder="e.g. Cashier"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-black" />
                      <span>Wages Contract</span>
                    </label>
                    <select 
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="Monthly fixed">Monthly fixed</option>
                      <option value="Daily wage">Daily wage</option>
                      <option value="Hourly">Hourly rate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5 capitalize flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-black" />
                      <span>{amountHeaderLabel}</span>
                    </label>
                    <input 
                      type="number" 
                      required
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none"
                      placeholder={amountPlaceholder}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  ONBOARD STORE WORKER
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROCESS STAFF PAYOUT MODAL */}
      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <h3 className="font-black uppercase text-black text-lg">Process Payroll Payout</h3>
                <button 
                  onClick={() => setShowPayoutModal(false)} 
                  className="p-1 border-2 border-black bg-white hover:bg-[#F5F2EB] text-black font-black cursor-pointer w-7 h-7 flex items-center justify-center rounded-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handlePayoutSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Select Staff Recipient</label>
                  <select 
                    required
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose employee --</option>
                    {staffFinancials.filter((fin) => !fin.member.archived_at).map((fin) => (
                      <option key={fin.member.id} value={fin.member.id}>
                        {fin.member.name} (Unpaid: {currency}{fin.unpaidBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Payout Amount ({currency})</label>
                  <input 
                    type="number" 
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none"
                    placeholder="Wages cash amount to release"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Release Notes / Period</label>
                  <input 
                    type="text" 
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                    placeholder="e.g. Wages released for July 1-14"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-[#D63031] hover:bg-[#E54849] text-white border-2 border-black rounded-none text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  CONFIRM CASH RELEASE PAYOUT
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
