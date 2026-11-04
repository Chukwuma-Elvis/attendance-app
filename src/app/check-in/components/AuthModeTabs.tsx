"use client";

import { memo, useCallback } from "react";

type AuthModeTabsProps = {
  authMode: "BIOMETRIC" | "PIN";
  setAuthMode: (mode: "BIOMETRIC" | "PIN") => void;
  pinCheckInAllowed: boolean;
};

const AuthModeTabs = memo(function AuthModeTabs({
  authMode,
  setAuthMode,
  pinCheckInAllowed,
}: AuthModeTabsProps) {
  const handleBiometricClick = useCallback(() => {
    setAuthMode("BIOMETRIC");
  }, [setAuthMode]);

  const handlePinClick = useCallback(() => {
    setAuthMode("PIN");
  }, [setAuthMode]);

  if (!pinCheckInAllowed) {
    return null;
  }

  return (
    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
      <button
        type="button"
        onClick={handleBiometricClick}
        className={`px-2.5 py-1 rounded-md font-semibold transition ${
          authMode === "BIOMETRIC"
            ? "bg-white text-gray-900 shadow-2xs"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        🔐 Biometric
      </button>
      <button
        type="button"
        onClick={handlePinClick}
        className={`px-2.5 py-1 rounded-md font-semibold transition ${
          authMode === "PIN"
            ? "bg-white text-indigo-700 shadow-2xs"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        🔢 6-Digit PIN
      </button>
    </div>
  );
});

export default AuthModeTabs;