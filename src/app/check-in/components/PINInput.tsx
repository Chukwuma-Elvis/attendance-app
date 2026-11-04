"use client";

import { memo, useCallback, useMemo } from "react";

type PINInputProps = {
  pinInput: string;
  showPinInput: boolean;
  setShowPinInput: (show: boolean) => void;
  setPinInput: (pin: string) => void;
  setResultMessage: (msg: { type: "success" | "error" | "warning"; title: string; detail: string } | null) => void;
};

const STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

const PINInput = memo(function PINInput({
  pinInput,
  showPinInput,
  setShowPinInput,
  setPinInput,
  setResultMessage,
}: PINInputProps) {
  const isValidPin = useMemo(() => /^\d{6}$/.test(pinInput), [pinInput]);

  const handlePinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPinInput(val);
  }, [setPinInput]);

  const handleToggleShow = useCallback(() => {
    setShowPinInput(!showPinInput);
    setResultMessage(null);
  }, [showPinInput, setShowPinInput, setResultMessage]);

  const handleClear = useCallback(() => {
    setPinInput("");
  }, [setPinInput]);

  return (
    <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
          <span>🔢</span> Enter 6-Digit PIN
        </label>
        {pinInput.length > 0 && (
          <button
            type="button"
            onClick={handleToggleShow}
            className="text-[11px] text-indigo-700 hover:underline font-medium"
          >
            {showPinInput ? "Hide PIN" : "Show PIN"}
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type={showPinInput ? "text" : "password"}
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="••••••"
          value={pinInput}
          onChange={handlePinChange}
          className="input w-full text-center tracking-[0.45em] sm:tracking-[0.55em] text-2xl font-mono font-bold bg-white border-indigo-300 focus:border-indigo-500 shadow-2xs h-13 sm:h-14"
          autoComplete="one-time-code"
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-indigo-800 px-1">
        <span>
          {pinInput.length === 6
            ? "✓ Ready to check in or out"
            : `Enter your 6 digits (${pinInput.length}/6)`}
        </span>
        {pinInput.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-600 transition font-medium"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
});

export default PINInput;