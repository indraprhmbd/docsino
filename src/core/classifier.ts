import { tokenize, diceCoefficient } from '../utils/tokenizer';
import type { RepositoryIndex } from './indexer';
import { scanMarkdownFiles, readFileContent } from './scanner';

export interface ClassificationResult {
  filename: string;
  relativePath: string;
  feature: string;
  confidence: number;
  ranking: Array<{ feature: string; score: number }>;
  evidence: Array<{ token: string; weight: number }>;
}

const DICE_THRESHOLD = 0.3;

function dicePreClassify(
  filename: string,
  features: string[],
): { feature: string; dice: number } | null {
  const nameNoExt = filename.replace(/\.\w+$/, '');
  const lowerName = nameNoExt.toLowerCase();
  let best: { feature: string; dice: number; pos: number } | null = null;

  for (const feature of features) {
    const d = diceCoefficient(nameNoExt, feature);
    if (d >= DICE_THRESHOLD) {
      const pos = lowerName.indexOf(feature.toLowerCase());
      const absPos = pos !== -1 ? pos : Infinity;
      if (
        !best
        || d > best.dice
        || (d === best.dice && (absPos < best.pos || (absPos === best.pos && feature.length > best.feature.length)))
      ) {
        best = { feature, dice: d, pos: absPos };
      }
    }
  }

  return best;
}

function naiveBayesScore(
  docTokens: string[],
  feature: string,
  featureFreq: Map<string, Map<string, number>>,
  featureTotal: Map<string, number>,
  vocabSize: number,
  numFeatures: number,
): number {
  const freq = featureFreq.get(feature);
  const total = featureTotal.get(feature);

  if (!freq || !total || vocabSize === 0) return 0;

  let logProb = Math.log(1 / numFeatures);

  for (const token of docTokens) {
    const count = freq.get(token) ?? 0;
    const prob = (count + 1) / (total + vocabSize);
    logProb += Math.log(prob);
  }

  return logProb;
}

interface RankedFeature {
  feature: string;
  score: number;
  matchCount: number;
}

function countMatches(docTokens: string[], feature: string, featureFreq: Map<string, Map<string, number>>): number {
  const freq = featureFreq.get(feature);
  if (!freq) return 0;
  let matches = 0;
  for (const token of docTokens) {
    if (freq.has(token)) matches++;
  }
  return matches;
}

export function classifyFile(
  filepath: string,
  filename: string,
  index: RepositoryIndex,
  relativePath?: string,
): ClassificationResult {
  const rp = relativePath ?? filename;

  // Pass 1: Dice coefficient on filename tokens vs feature names
  const diceResult = dicePreClassify(filename, index.features);
  if (diceResult) {
    const ranking = [
      { feature: diceResult.feature, score: Math.round(diceResult.dice * 100) },
      ...index.features
        .filter(f => f !== diceResult.feature)
        .slice(0, 3)
        .map(f => ({ feature: f, score: 0 })),
    ];

    return {
      filename,
      relativePath: rp,
      feature: diceResult.feature,
      confidence: 100,
      ranking,
      evidence: [{ token: 'filename-dice', weight: Math.round(diceResult.dice * 100) }],
    };
  }

  // Pass 2: Naive Bayes content classification
  const content = readFileContent(filepath);
  const docTokens = tokenize(content);

  const hasFreq = index.featureFreq && index.vocabSize > 0;
  const numFeatures = index.features.length;
  const ranked: Array<RankedFeature> = [];

  for (const feature of index.features) {
    let logProb: number;
    let matchCount: number;

    if (hasFreq) {
      logProb = naiveBayesScore(
        docTokens, feature,
        index.featureFreq, index.featureTotal, index.vocabSize, numFeatures,
      );
      matchCount = countMatches(docTokens, feature, index.featureFreq);
    } else {
      // Fallback: simple token overlap count
      const ft = index.featureTokens?.get(feature) ?? [];
      const ftSet = new Set(ft);
      matchCount = docTokens.filter(t => ftSet.has(t)).length;
      logProb = matchCount; // use match count as score for sorting
    }

    ranked.push({ feature, score: logProb, matchCount });
  }

  // Sort by Naive Bayes log-probability (or match count in fallback)
  ranked.sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const feature = winner?.feature ?? 'uncategorized';
  const topMatches = winner?.matchCount ?? 0;
  const secondMatches = ranked[1]?.matchCount ?? 0;

  // Confidence based on raw match count ratio, not log-prob
  // This avoids the add-1 smoothing swamp that makes log-probs nearly identical
  let confidence = 0;
  if (topMatches > 0) {
    confidence = Math.min(100, Math.max(0, Math.round((topMatches - secondMatches) / topMatches * 100)));
  }

  // Build evidence
  const evidence: Array<{ token: string; weight: number }> = [];
  if (winner && hasFreq) {
    // Show match count as primary evidence
    evidence.push({ token: 'token-match-count', weight: topMatches });

    // Show top matched tokens by frequency in winning feature's corpus
    const freq = index.featureFreq.get(winner.feature);
    if (freq) {
      const matchedTokens: Array<{ token: string; count: number }> = [];
      for (const token of docTokens) {
        const count = freq.get(token);
        if (count && count > 0) {
          matchedTokens.push({ token, count });
        }
      }
      matchedTokens.sort((a, b) => b.count - a.count);
      for (const m of matchedTokens.slice(0, 4)) {
        evidence.push({ token: m.token, weight: m.count });
      }
    }
  } else if (winner) {
    // Fallback evidence from token overlap
    const ft = index.featureTokens?.get(winner.feature) ?? [];
    const ftSet = new Set(ft);
    for (const token of docTokens) {
      if (ftSet.has(token)) {
        evidence.push({ token, weight: 1 });
        if (evidence.length >= 5) break;
      }
    }
  }

  return {
    filename,
    relativePath: rp,
    feature,
    confidence,
    ranking: ranked.map(r => ({ feature: r.feature, score: r.score })),
    evidence,
  };
}

export function classifyDocs(
  docsDir: string,
  index: RepositoryIndex,
): ClassificationResult[] {
  const files = scanMarkdownFiles(docsDir);
  const rootFiles = files.filter(
    (f) => !f.relativePath.includes('/') && !f.relativePath.includes('\\'),
  );
  return rootFiles.map((f) => classifyFile(f.path, f.name, index, f.relativePath));
}

export function classifyAllDocs(
  docsDir: string,
  index: RepositoryIndex,
): ClassificationResult[] {
  const files = scanMarkdownFiles(docsDir);
  return files.map((f) => classifyFile(f.path, f.name, index, f.relativePath));
}
