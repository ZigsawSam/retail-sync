"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useApp } from "../../context/AppContext";
const PeoplePage = dynamic(() => import("../../components/PeoplePage"), { ssr: false });

export default function PeoplePageRoute() {
  const context = useApp();

  return (
    <PeoplePage 
      staff={context.staff}
      expenses={context.expenses}
      currency={context.currency}
      onOnboardStaff={(newStaff) => context.handleAddStaff(newStaff)}
      onLogAttendance={(staffId, date, present, hoursWorked) => context.handleMarkAttendance(staffId, date, present, hoursWorked)}
      onAddExpense={context.handleAddExpense}
      settings={context.settings}
      onUpdateSettings={context.handleUpdateSettings}
    />
  );
}
