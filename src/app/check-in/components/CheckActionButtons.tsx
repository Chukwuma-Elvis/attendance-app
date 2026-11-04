"use client";

import { memo, useCallback } from "react";

type CheckActionButtonsProps = {
  canCheckIn: boolean;
  canCheckOut: boolean;
  processing: boolean;
  authMode: "BIOMETRIC" | "PIN";
  handlePinCheckAction: (action: "CHECK_IN" | "CHECK_OUT") => Promise<void>;
  handleCheckAction: (action: "CHECK_IN" | "CHECK_OUT") => Promise<void>;
  isCheckInTimeActive: boolean;
  isCheckOutTimeActive: boolean;
  checkInTimeNotice: string;
  checkOutTimeNotice: string;
  hasConfirmedLocation: boolean;
  isInsideGeofence: boolean | null;
  distanceToVenue: number | null;
};

const CheckActionButtons = memo(function CheckActionButtons({
  canCheckIn,
  canCheckOut,
  processing,
  authMode,
  handlePinCheckAction,
  handleCheckAction,
  isCheckInTimeActive,
  isCheckOutTimeActive,
  checkInTimeNotice,
  checkOutTimeNotice,
  hasConfirmedLocation,
  isInsideGeofence,
  distanceToVenue,
}: CheckActionButtonsProps) {
  const isPinMode = authMode === "PIN";

  const getButtonLabel = useCallback((action: "CHECK_IN" | "CHECK_OUT") => {
    return processing ? "Verifying..." : action === "CHECK_IN" ? "Check In" : "Check Out";
  }, [processing]);

  const handleClick = useCallback((action: "CHECK_IN" | "CHECK_OUT") => {
    if (isPinMode) {
      handlePinCheckAction(action);
    } else {
      handleCheckAction(action);
    }
  }, [isPinMode, handlePinCheckAction, handleCheckAction]);

  const getCheckInDetail = useCallback(() => {
    if (!hasConfirmedLocation) return "Confirm Location";
    if (isInsideGeofence === false) return `${distanceToVenue}m away (Out of Range)`;
    return !isCheckInTimeActive ? checkInTimeNotice : "Arrival";
  }, [hasConfirmedLocation, isInsideGeofence, distanceToVenue, isCheckInTimeActive, checkInTimeNotice]);

  const getCheckOutDetail = useCallback(() => {
    if (!hasConfirmedLocation) return "Confirm Location";
    if (isInsideGeofence === false) return `${distanceToVenue}m away (Out of Range)`;
    return !isCheckOutTimeActive ? checkOutTimeNotice : "Departure";
  }, [hasConfirmedLocation, isInsideGeofence, distanceToVenue, isCheckOutTimeActive, checkOutTimeNotice]);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <button
        type="button"
        onClick={() => handleClick("CHECK_IN")}
        disabled={!canCheckIn}
        className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 active:!bg-emerald-800 !py-3 min-h-[74px] sm:min-h-[80px] text-xs font-bold flex flex-col items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <span className="text-xl">☀️</span>
        <span className="text-xs sm:text-sm font-bold">{getButtonLabel("CHECK_IN")}</span>
        <span className="text-[10px] font-normal opacity-90 truncate max-w-full px-1 text-center">
          {getCheckInDetail()}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleClick("CHECK_OUT")}
        disabled={!canCheckOut}
        className="btn-secondary !border-brand text-brand hover:bg-brand/5 active:bg-brand/10 !py-3 min-h-[74px] sm:min-h-[80px] text-xs font-bold flex flex-col items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <span className="text-xl">🌙</span>
        <span className="text-xs sm:text-sm font-bold">{getButtonLabel("CHECK_OUT")}</span>
        <span className="text-[10px] font-normal opacity-90 truncate max-w-full px-1 text-center">
          {getCheckOutDetail()}
        </span>
      </button>
    </div>
  );
});

export default CheckActionButtons;