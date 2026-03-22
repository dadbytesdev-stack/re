"use client";

import { Tier } from "@prisma/client";

interface UsageCounterProps {
  used: number;
  limit: number;
  tier: Tier;
}

const TIER_LABELS: Record<Tier, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  PRO: "Pro",
};

const TIER_COLORS: Record<Tier, string> = {
  FREE: "bg-gray-100 text-gray-600",
  PREMIUM: "bg-amber-50 text-amber-700",
  PRO: "bg-purple-50 text-purple-700",
};

export function UsageCounter({ used, limit, tier }: UsageCounterProps) {
  const isUnlimited = limit === Infinity || limit > 999;
  const pct = isUnlimited ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const remaining = isUnlimited ? "∞" : limit - used;

  const barColor =
    pct >= 90
      ? "bg-red-400"
      : pct >= 70
      ? "bg-amber-400"
      : "bg-brand-500";

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Monthly Extractions</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_COLORS[tier]}`}>
          {TIER_LABELS[tier]}
        </span>
      </div>

      {isUnlimited ? (
        <p className="text-sm text-gray-500">Unlimited extractions on your Pro plan.</p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-gray-900">{used}</span>
            <span className="text-sm text-gray-400 mb-1">of {limit} used</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {remaining} extraction{Number(remaining) !== 1 ? "s" : ""} remaining this month
          </p>
        </>
      )}
    </div>
  );
}
