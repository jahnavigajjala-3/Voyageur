export const RISK_COLORS = {
  LOW: { 
    bg: "rgba(34,197,94,0.08)", 
    border: "rgba(34,197,94,0.22)", 
    text: "#86efac", 
    accent: "#22c55e", 
    glow: "rgba(34,197,94,0.25)" 
  },
  MEDIUM: { 
    bg: "rgba(234,179,8,0.08)", 
    border: "rgba(234,179,8,0.22)", 
    text: "#fde68a", 
    accent: "#eab308", 
    glow: "rgba(234,179,8,0.25)" 
  },
  HIGH: { 
    bg: "rgba(239,68,68,0.08)", 
    border: "rgba(239,68,68,0.22)", 
    text: "#fca5a5", 
    accent: "#ef4444", 
    glow: "rgba(239,68,68,0.25)" 
  },
  UNKNOWN: { 
    bg: "rgba(100,116,139,0.08)", 
    border: "rgba(100,116,139,0.22)", 
    text: "#94a3b8", 
    accent: "#64748b", 
    glow: "rgba(100,116,139,0.15)" 
  },
};

export const getRiskLevel = (score) => {
  if (score == null) return "UNKNOWN";
  // 1-10 risk scale: 1 = low risk, 10 = high risk
  if (score <= 3.5) return "LOW";
  if (score <= 6.5) return "MEDIUM";
  return "HIGH";
};

export const getRiskColor = (score) => {
  const level = getRiskLevel(score);
  return RISK_COLORS[level].accent;
};

export const getRiskColorsByLevel = (level) => {
  const key = (level || "UNKNOWN").toUpperCase();
  return RISK_COLORS[key] || RISK_COLORS.UNKNOWN;
};
