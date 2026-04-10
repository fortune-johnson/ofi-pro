export type PairBias = "Bullish" | "Bearish" | "Neutral";

export type AnalysisFactor = {
  label: string;
  score: number;
  note: string;
};

export type AnalysisSummary = {
  bias: PairBias;
  biasLabel: string;
  confidencePercent: number;
  confidenceScore: number;
  grade: string;
  price: number;
  drivers: string[];
  factors: AnalysisFactor[];
  stats?: {
    buyPercent?: number;
    sellPercent?: number;
    imbalance?: number;
    delta?: number;
    cvd?: number;
    priceChangePercent?: number;
    volumeRatio?: number;
    rangePips?: number;
  };
};

export type AnalyzeResponse = {
  pair: string;
  timeframe: string;
  detailed: boolean;
  messages: string[];
  summary?: AnalysisSummary;
};

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function normalizeConfidencePercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function formatConfidenceScore(value: number) {
  return `${(normalizeConfidencePercent(value) / 10).toFixed(1)}/10`;
}

export function extractConfidence(messages: string[], summary?: AnalysisSummary) {
  if (summary?.confidencePercent !== undefined) {
    return normalizeConfidencePercent(summary.confidencePercent);
  }

  const joined = messages.map(stripHtml).join(" ");
  const scoreMatch = joined.match(/confidence(?: score)?[:\s]*([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/i);
  if (scoreMatch) {
    return normalizeConfidencePercent(Number(scoreMatch[1]) * 10);
  }

  const percentMatch = joined.match(/confidence(?: score)?[:\s]*([0-9]{1,3})\s?%/i);
  if (percentMatch) {
    return normalizeConfidencePercent(Number(percentMatch[1]));
  }

  return 50;
}

export function extractBias(messages: string[], summary?: AnalysisSummary) {
  if (summary?.bias) {
    const tone = summary.bias.toLowerCase() as "bullish" | "bearish" | "neutral";
    return {
      label: summary.biasLabel || `${summary.bias} Bias`,
      tone,
      compact: summary.bias,
    };
  }

  const joined = messages.map(stripHtml).join(" ").toLowerCase();
  if (/(strong buy|bullish|buy bias|long bias|long setup)/.test(joined)) {
    return { label: "Bullish Bias", tone: "bullish" as const, compact: "Bullish" as PairBias };
  }
  if (/(strong sell|bearish|sell bias|short bias|short setup)/.test(joined)) {
    return { label: "Bearish Bias", tone: "bearish" as const, compact: "Bearish" as PairBias };
  }
  return { label: "Neutral Bias", tone: "neutral" as const, compact: "Neutral" as PairBias };
}

export function extractDrivers(messages: string[], summary?: AnalysisSummary) {
  if (summary?.drivers?.length) {
    return summary.drivers;
  }

  const lines = messages.flatMap((message) =>
    stripHtml(message)
      .split("\n")
      .map((line) => line.replace(/^[\s\-*â€¢]+/, "").trim())
      .filter(Boolean)
  );

  const preferred = lines.filter((line) =>
    /(absorption|divergence|momentum|bias|order flow|volume|book|signal|risk|liquidity|delta|imbalance)/i.test(
      line
    )
  );

  return (preferred.length ? preferred : lines).slice(0, 5);
}

export function extractPrice(messages: string[], summary?: AnalysisSummary) {
  if (summary?.price !== undefined) {
    return String(summary.price);
  }

  const joined = messages.map(stripHtml).join(" ");
  const match = joined.match(/price:\s*([0-9.]+)/i);
  return match?.[1] ?? "Live";
}

export function inferFactorScores(messages: string[], summary?: AnalysisSummary) {
  if (summary?.factors?.length) {
    return summary.factors.map((factor) => ({
      label: factor.label,
      score: normalizeConfidencePercent(factor.score),
      note: factor.note,
    }));
  }

  const confidence = extractConfidence(messages, summary);
  const bias = extractBias(messages, summary);

  return [
    {
      label: "Order Flow",
      score: confidence,
      note:
        bias.compact === "Bullish"
          ? "Aggressive buyers are leading"
          : bias.compact === "Bearish"
            ? "Aggressive sellers are leading"
            : "Participation is balanced",
    },
    {
      label: "Volume Profile",
      score: Math.max(45, confidence - 8),
      note: "Business is clustering around active decision zones.",
    },
    {
      label: "Absorption",
      score: Math.max(40, confidence - 12),
      note: "Resting liquidity interaction is visible in the current rotation.",
    },
    {
      label: "Divergence",
      score: Math.max(35, confidence - 16),
      note: "Momentum confirmation is being monitored against price action.",
    },
  ];
}
