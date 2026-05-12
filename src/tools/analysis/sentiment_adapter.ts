import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const POSITIVE_WORDS = ['good', 'great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'beautiful', 'happy', 'love', 'perfect', 'outstanding', 'brilliant', 'success', 'innovative', 'efficient', 'powerful', 'impressive', 'delightful', 'inspiring', 'remarkable'];
const NEGATIVE_WORDS = ['bad', 'terrible', 'awful', 'horrible', 'poor', 'ugly', 'sad', 'hate', 'worst', 'failure', 'broken', 'wrong', 'damage', 'crisis', 'disaster', 'problem', 'error', 'fail', 'mistake', 'terrible'];
const INTENSIFIERS = ['very', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely', 'highly', 'deeply', 'severely', 'utterly'];

export const sentimentAdapterTool: ToolDefinition = {
  id: 'sentiment_adapter',
  name: 'Sentiment Adapter',
  description: 'Multi-dimensional sentiment and tone analysis. Evaluates text for emotional valence, intensity, sentiment distribution, and tonal qualities. Supports adaptive response calibration.',
  inputSchema: {
    text: { type: 'string', description: 'Text to analyze for sentiment and tone' },
    mode: { type: 'string', enum: ['sentiment', 'tone', 'emotion', 'full'], description: 'Analysis mode' },
    dimensions: { type: 'string', description: 'Comma-separated: valence, arousal, dominance, tone, emotion' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const text = String(params.text || '');
    const mode = String(params.mode || 'full');
    const dimensions = String(params.dimensions || 'valence,arousal,dominance,tone,emotion');

    if (!text) {
      return { success: false, data: null, error: 'Text is required for sentiment analysis' };
    }

    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const posCount = words.filter(w => POSITIVE_WORDS.includes(w)).length;
    const negCount = words.filter(w => NEGATIVE_WORDS.includes(w)).length;
    const intensifierCount = words.filter(w => INTENSIFIERS.includes(w)).length;

    const valence = computeValence(posCount, negCount, words.length);
    const arousal = computeArousal(intensifierCount, sentences.length, words.length);
    const dominance = computeDominance(posCount, negCount, sentences.length);

    const emotions = detectEmotions(words, posCount, negCount, sentences);
    const tones = detectTones(text, sentences, posCount, negCount);

    const dims = dimensions.split(',').map(d => d.trim());

    let analysis: any;

    switch (mode) {
      case 'sentiment': {
        analysis = {
          mode: 'sentiment_analysis',
          ...(dims.includes('valence') ? { valence } : {}),
          ...(dims.includes('arousal') ? { arousal } : {}),
          ...(dims.includes('dominance') ? { dominance } : {}),
          positiveWords: posCount,
          negativeWords: negCount,
          intensity: intensifierCount,
          overallSentiment: valence.score > 0.2 ? 'POSITIVE' : valence.score < -0.2 ? 'NEGATIVE' : 'NEUTRAL',
          sentimentDistribution: {
            positive: parseFloat((posCount / Math.max(1, words.length)).toFixed(3)),
            negative: parseFloat((negCount / Math.max(1, words.length)).toFixed(3)),
            neutral: parseFloat((1 - (posCount + negCount) / Math.max(1, words.length)).toFixed(3)),
          },
        };
        break;
      }

      case 'tone': {
        analysis = {
          mode: 'tone_analysis',
          tones,
          primaryTone: tones.length > 0 ? tones[0] : 'neutral',
          toneIntensity: parseFloat((intensifierCount / Math.max(1, sentences.length) * 0.5).toFixed(3)),
        };
        break;
      }

      case 'emotion': {
        analysis = {
          mode: 'emotion_analysis',
          emotions,
          primaryEmotion: emotions.length > 0 ? emotions[0] : 'neutral',
          emotionalValence: valence,
          emotionalArousal: arousal,
        };
        break;
      }

      default: {
        analysis = {
          mode: 'full_analysis',
          valence,
          arousal,
          dominance,
          emotions,
          tones,
          overallSentiment: valence.score > 0.2 ? 'POSITIVE' : valence.score < -0.2 ? 'NEGATIVE' : 'NEUTRAL',
          primaryTone: tones[0] ?? 'neutral',
          primaryEmotion: emotions[0] ?? 'neutral',
          summary: `${tones[0] ?? 'Neutral'} tone, ${emotions[0] ?? 'neutral'} emotion, ` +
            `valence ${valence.score > 0 ? 'positive' : valence.score < 0 ? 'negative' : 'neutral'} ` +
            `(${valence.level})`,
        };
      }
    }

    await ctx.memory.store('analysis', `sentiment-${Date.now()}`, {
      textLength: text.length,
      sentiment: analysis.overallSentiment,
      mode,
    });

    return {
      success: true,
      data: {
        ...analysis,
        textStats: {
          wordCount: words.length,
          sentenceCount: sentences.length,
          avgWordLength: parseFloat((words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length)).toFixed(2)),
          uniqueWords: [...new Set(words)].length,
        },
      },
      metadata: {
        wordCount: words.length,
        mode,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function computeValence(pos: number, neg: number, total: number): { score: number; level: string } {
  if (total === 0) return { score: 0, level: 'neutral' };
  const score = parseFloat(((pos - neg) / Math.max(1, pos + neg + (total * 0.1)) * 2).toFixed(3));
  const clamped = Math.max(-1, Math.min(1, score));
  const level = clamped > 0.5 ? 'strong-positive' : clamped > 0.15 ? 'positive' : clamped < -0.5 ? 'strong-negative' : clamped < -0.15 ? 'negative' : 'neutral';
  return { score: clamped, level };
}

function computeArousal(intensifiers: number, sentences: number, words: number): { score: number; level: string } {
  if (sentences === 0) return { score: 0.5, level: 'moderate' };
  const score = parseFloat(Math.min(1, (intensifiers * 0.15 + (sentences / Math.max(1, words)) * 0.5)).toFixed(3));
  const level = score > 0.6 ? 'high' : score > 0.3 ? 'moderate' : 'low';
  return { score, level };
}

function computeDominance(pos: number, neg: number, sentences: number): { score: number; level: string } {
  if (sentences === 0) return { score: 0.5, level: 'balanced' };
  const ratio = pos / Math.max(1, pos + neg);
  const score = parseFloat((ratio * 0.7 + (sentences > 5 ? 0.3 : sentences * 0.06)).toFixed(3));
  const level = score > 0.6 ? 'dominant' : score < 0.4 ? 'submissive' : 'balanced';
  return { score, level };
}

function detectEmotions(words: string[], pos: number, neg: number, sentences: string[]): string[] {
  const emotions: string[] = [];
  const total = words.length;

  if (pos > neg && total > 5) emotions.push('joy');
  if (neg > pos && total > 5) emotions.push('sadness');
  if (words.includes('angry') || words.includes('frustrated') || words.includes('outrage')) emotions.push('anger');
  if (words.includes('fear') || words.includes('afraid') || words.includes('worried')) emotions.push('fear');
  if (words.includes('surprise') || words.includes('shock') || words.includes('unexpected')) emotions.push('surprise');
  if (words.includes('trust') || words.includes('confident') || words.includes('faith')) emotions.push('trust');
  if (words.includes('disgust') || words.includes('revulsion') || words.includes('repulse')) emotions.push('disgust');
  if (sentences.length > 3 && words.some(w => w.endsWith('?'))) emotions.push('curiosity');

  return emotions.length > 0 ? emotions.slice(0, 3) : ['neutral'];
}

function detectTones(text: string, sentences: string[], pos: number, neg: number): string[] {
  const tones: string[] = [];
  const words = text.toLowerCase().split(/\s+/);

  if (pos > neg * 2 && pos > 2) tones.push('positive');
  if (neg > pos * 2 && neg > 2) tones.push('critical');
  if (words.some(w => w.endsWith('?')) && words.filter(w => w.endsWith('?')).length > sentences.length * 0.3) tones.push('inquisitive');
  if (words.filter(w => w === 'must' || w === 'should' || w === 'need' || w === 'required').length > 2) tones.push('assertive');
  if (words.filter(w => w === 'maybe' || w === 'perhaps' || w === 'possibly' || w === 'might').length > 2) tones.push('tentative');
  if (words.filter(w => w === '!').length > sentences.length * 0.3) tones.push('emphatic');
  if (text.length > 500 && sentences.length > 10) tones.push('analytical');
  if (words.some(w => ['thanks', 'please', 'appreciate', 'grateful'].includes(w))) tones.push('polite');

  return tones.length > 0 ? tones.slice(0, 4) : ['neutral'];
}
