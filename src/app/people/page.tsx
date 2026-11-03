"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useApp } from "../../context/AppContext";

const PeoplePage = dynamic(() => import("../../components/PeoplePage"), { ssr: false });

export default function PeoplePageRoute() {
  const context = useApp();

  const handleOnboardStaff = (newStaff: import("../../types").Staff) => {
    const { id: _temporaryId, attendance: _attendance, ...staffDetails } = newStaff;
    void context.handleAddStaff(staffDetails);
  };

  const handleLogAttendance = (
    staffId: string,
    date: string,
    present: boolean,
    hoursWorked?: number
  ) => {
    void context.handleMarkAttendance(staffId, date, present, hoursWorked);
  };

  return (
    <PeoplePage
      staff={context.staff}
      expenses={context.expenses}
      currency={context.currency}
      onOnboardStaff={handleOnboardStaff}
      onLogAttendance={handleLogAttendance}
      onAddExpense={context.handleAddExpense}
      onArchiveStaff={context.handleArchiveStaff}
      onRestoreStaff={context.handleRestoreStaff}
      onDeleteStaff={context.handleDeleteStaff}
    />
  );
}
