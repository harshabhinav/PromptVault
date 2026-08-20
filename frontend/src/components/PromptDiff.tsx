import React from "react";

interface PromptDiffProps {
  original: string;
  modified: string;
}

export const PromptDiff: React.FC<PromptDiffProps> = ({ original, modified }) => {
  const diffLines = (orig: string, mod: string) => {
    const one = orig.split("\n");
    const two = mod.split("\n");

    const dp: number[][] = Array(one.length + 1)
      .fill(null)
      .map(() => Array(two.length + 1).fill(0));

    for (let idx1 = 1; idx1 <= one.length; idx1++) {
      for (let idx2 = 1; idx2 <= two.length; idx2++) {
        if (one[idx1 - 1] === two[idx2 - 1]) {
          dp[idx1][idx2] = dp[idx1 - 1][idx2 - 1] + 1;
        } else {
          dp[idx1][idx2] = Math.max(dp[idx1 - 1][idx2], dp[idx1][idx2 - 1]);
        }
      }
    }

    let i = one.length;
    let j = two.length;
    const result: Array<{ type: "added" | "removed" | "unchanged"; value: string; lineOrig?: number; lineMod?: number }> = [];

    let lineO = one.length;
    let lineM = two.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && one[i - 1] === two[j - 1]) {
        result.unshift({ type: "unchanged", value: one[i - 1], lineOrig: lineO, lineMod: lineM });
        i--;
        j--;
        lineO--;
        lineM--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: "added", value: two[j - 1], lineMod: lineM });
        j--;
        lineM--;
      } else {
        result.unshift({ type: "removed", value: one[i - 1], lineOrig: lineO });
        i--;
        lineO--;
      }
    }

    return result;
  };

  const diffWords = (orig: string, mod: string) => {
    // Split by words and whitespace to keep formatting
    const one = orig.split(/(\s+)/);
    const two = mod.split(/(\s+)/);

    const dp: number[][] = Array(one.length + 1)
      .fill(null)
      .map(() => Array(two.length + 1).fill(0));

    for (let idx1 = 1; idx1 <= one.length; idx1++) {
      for (let idx2 = 1; idx2 <= two.length; idx2++) {
        if (one[idx1 - 1] === two[idx2 - 1]) {
          dp[idx1][idx2] = dp[idx1 - 1][idx2 - 1] + 1;
        } else {
          dp[idx1][idx2] = Math.max(dp[idx1 - 1][idx2], dp[idx1][idx2 - 1]);
        }
      }
    }

    let i = one.length;
    let j = two.length;
    const result: Array<{ type: "added" | "removed" | "unchanged"; value: string }> = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && one[i - 1] === two[j - 1]) {
        result.unshift({ type: "unchanged", value: one[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: "added", value: two[j - 1] });
        j--;
      } else {
        result.unshift({ type: "removed", value: one[i - 1] });
        i--;
      }
    }
    return result;
  };

  const diffs = diffLines(original, modified);

  return (
    <div className="w-full rounded-xl border border-border bg-black/40 overflow-hidden font-mono text-xs select-text flex flex-col">
      {/* Diff Table Headers - Sticky */}
      <div className="flex bg-secondary/35 border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground select-none px-4 py-2 sticky top-0 z-10 backdrop-blur-md">
        <div className="w-10 text-right pr-2 shrink-0">Line</div>
        <div className="flex-1 pl-4">Content changes</div>
      </div>
      
      {/* Diff Output Scrollbox */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/10">
        {diffs.map((diff, index) => {
          const isAdded = diff.type === "added";
          const isRemoved = diff.type === "removed";
          
          // Determine if we should perform word-level highlighting
          let pairedLine: string | null = null;
          if (isRemoved && diffs[index + 1]?.type === "added") {
            pairedLine = diffs[index + 1].value;
          } else if (isAdded && diffs[index - 1]?.type === "removed") {
            pairedLine = diffs[index - 1].value;
          }

          const renderContent = () => {
            if (pairedLine === null) {
              return diff.value || " ";
            }

            const originalVal = isRemoved ? diff.value : pairedLine;
            const modifiedVal = isAdded ? diff.value : pairedLine;
            const wordDiffs = diffWords(originalVal, modifiedVal);

            return (
              <>
                {wordDiffs.map((w, wIdx) => {
                  if (w.type === "unchanged") {
                    return <span key={wIdx}>{w.value}</span>;
                  }
                  if (isAdded && w.type === "added") {
                    return (
                      <span key={wIdx} className="bg-emerald-500/25 px-1 py-0.5 rounded text-emerald-300 font-bold border border-emerald-500/20">
                        {w.value}
                      </span>
                    );
                  }
                  if (isRemoved && w.type === "removed") {
                    return (
                      <span key={wIdx} className="bg-rose-500/25 px-1 py-0.5 rounded text-rose-300 font-bold line-through border border-rose-500/20">
                        {w.value}
                      </span>
                    );
                  }
                  if (isRemoved && w.type === "added") return null;
                  if (isAdded && w.type === "removed") return null;
                  return <span key={wIdx}>{w.value}</span>;
                })}
              </>
            );
          };
          
          return (
            <div
              key={index}
              className={`flex items-start px-4 py-1 leading-relaxed ${
                isAdded 
                  ? "bg-emerald-500/10 text-emerald-400 dark:bg-emerald-950/20" 
                  : isRemoved 
                  ? "bg-rose-500/10 text-rose-400 dark:bg-rose-950/20" 
                  : "text-muted-foreground/90 hover:bg-secondary/10"
              }`}
            >
              {/* Line indicator numbers */}
              <div className="w-10 text-right pr-2 shrink-0 text-muted-foreground/40 select-none text-[10px]">
                {isAdded ? "" : diff.lineOrig}
                {isRemoved ? "" : (isAdded ? "" : "/")}
                {isRemoved ? "" : diff.lineMod}
              </div>

              {/* Prefix sign +/- */}
              <div className="w-6 text-center select-none shrink-0 font-bold">
                {isAdded ? "+" : isRemoved ? "-" : " "}
              </div>

              {/* Line contents */}
              <pre className="flex-1 whitespace-pre-wrap pl-2 font-mono">
                {renderContent()}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};
