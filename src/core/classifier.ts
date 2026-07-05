import BM25 from 'okapibm25';

import { tokenize, tokenizeWithWeights } from '../utils/tokenizer';
import type { RepositoryIndex } from './indexer';
import { scanMarkdownFiles, readFileContent } from './scanner';

export interface ClassificationResult {
  filename: string;
  feature: string;
  confidence: number;
  ranking: Array<{ feature: string; score: number }>;
  evidence: Array<{ token: string; weight: number }>;
}

interface FeatureCorpus {
  feature: string;
  tokens: string[];
  documents: string[];
}

function buildFeatureCorpora(index: RepositoryIndex): FeatureCorpus[] {
  return index.features.map((feature) => {
    const tokens = tokenize(feature);
    const documents = [
      feature,
      ...tokens,
      ...index.routes.filter((r) => r.includes(feature)),
    ];
    return { feature, tokens, documents };
  });
}

function computeBM25Scores(
  docTokens: string[],
  corpora: FeatureCorpus[],
): Array<{ feature: string; score: number }> {
  const query = [...new Set(docTokens)];

  if (query.length === 0 || corpora.length === 0) {
    return corpora.map((c) => ({ feature: c.feature, score: 0 }));
  }

  const corpusTexts = corpora.map((c) => c.documents.join(' '));
  const featureTokens = corpora.map((c) => c.tokens.join(' '));
  const allDocs = [...corpusTexts, ...featureTokens];

  try {
    const scores = BM25(allDocs, query, { k1: 1.5, b: 0.75 }) as number[];
    const half = scores.length / 2;
    return corpora.map((c, i) => ({
      feature: c.feature,
      score: (scores[i] ?? 0) + (scores[i + half] ?? 0),
    }));
  } catch {
    return corpora.map((c) => ({ feature: c.feature, score: 0 }));
  }
}

function computeConfidence(ranking: Array<{ feature: string; score: number }>): number {
  if (ranking.length === 0) return 0;
  const top = ranking[0]?.score ?? 0;
  const second = ranking[1]?.score ?? 1;
  if (top === 0) return 0;
  const ratio = second > 0 ? top / second : top;
  return Math.min(100, Math.round(ratio * 35));
}

function extractEvidence(
  docTokens: string[],
  winnerFeature: string,
  index: RepositoryIndex,
): Array<{ token: string; weight: number }> {
  const featureTokens = tokenize(winnerFeature);
  const matched: Array<{ token: string; weight: number }> = [];

  for (const token of docTokens) {
    let weight = 0;

    if (featureTokens.includes(token)) {
      weight += 10;
    }

    if (index.routes.some((r) => r.includes(token))) {
      weight += 5;
    }

    for (const [, symPath] of index.symbols) {
      if (symPath.includes(token)) {
        weight += 3;
        break;
      }
    }

    if (weight > 0) {
      matched.push({ token, weight });
    }
  }

  return matched
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);
}

export function classifyFile(
  filepath: string,
  filename: string,
  index: RepositoryIndex,
): ClassificationResult {
  const content = readFileContent(filepath);
  const docTokens = tokenizeWithWeights(content);

  const filenameTokens = tokenize(filename);
  docTokens.push(...filenameTokens);

  const corpora = buildFeatureCorpora(index);
  const ranking = computeBM25Scores(docTokens, corpora);

  ranking.sort((a, b) => b.score - a.score);

  const winner = ranking[0];
  const feature = winner?.feature ?? 'uncategorized';
  const confidence = computeConfidence(ranking);

  const evidence = extractEvidence(docTokens, feature, index);

  return {
    filename,
    feature,
    confidence,
    ranking,
    evidence,
  };
}

export function classifyDocs(
  docsDir: string,
  index: RepositoryIndex,
): ClassificationResult[] {
  const files = scanMarkdownFiles(docsDir);
  const rootFiles = files.filter((f) => !f.relativePath.includes('/') && !f.relativePath.includes('\\'));

  return rootFiles.map((f) => classifyFile(f.path, f.name, index));
}
