import fetch from 'node-fetch';
import OpenAI from 'openai';

let visionClient = null;
async function getVisionClient() {
  if (visionClient) return visionClient;
  try {
    const vision = await import('@google-cloud/vision');
    const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    // Prefer explicit key file if provided to avoid ADC issues
    visionClient = keyFilename
      ? new vision.ImageAnnotatorClient({ keyFilename })
      : new vision.ImageAnnotatorClient();
    return visionClient;
  } catch (e) {
    throw new Error('Missing @google-cloud/vision. Please install it: npm i @google-cloud/vision');
  }
}

async function fetchArticleContent(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      // Some sources may have TLS quirks; keep defaults
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Naive extraction of paragraph text
    const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .map(m => m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(Boolean)
      .slice(0, 20);
    const content = paragraphs.join(' ');
    return content || null;
  } catch (e) {
    return null;
  }
}

async function getAiSummary(content, eventType) {
  try {
    if (!content) return null;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = [
      `Analyze this article content about a ${eventType} and provide a detailed summary including:`,
      '1. Key facts and timeline',
      '2. Important details',
      '3. Official statements or findings (if any)',
      '4. Context and background',
      '',
      'Provide a concise but comprehensive summary.'
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that analyzes news articles and provides accurate, factual summaries.' },
        { role: 'user', content: `${prompt}\n\nArticle content (truncated):\n${content.slice(0, 4000)}` }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    return completion.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    return null;
  }
}

function buildImageContext(results, providedText) {
  if (!results?.found) return 'No matching articles or related content found.';
  const lines = [];
  lines.push('📋 IMAGE VERIFICATION REPORT');
  lines.push('==================================================');
  if (results.best_guess_labels?.length) {
    lines.push('\n🔍 IMAGE IDENTIFICATION:');
    lines.push(`This image appears to be about: ${results.best_guess_labels.join(', ')}`);
  }
  lines.push('\n✅ VERIFICATION STATUS:');
  lines.push(`• Found in ${results.articles.length} online sources`);
  if (providedText) {
    lines.push('\n⚠️ FACT CHECK:');
    lines.push(`Comparing provided text: "${providedText}"`);
    if (results.best_guess_labels?.length) {
      const mismatch = !results.best_guess_labels.some(label => providedText.toLowerCase().includes(label.toLowerCase()));
      if (mismatch) lines.push('❌ WARNING: The provided text appears to describe a different event than what the image shows.');
    }
  }
  if (results.articles?.length) {
    lines.push('\n📰 DETAILED ANALYSIS:');
    results.articles.forEach((article, idx) => {
      lines.push(`\nSource ${idx + 1}:`);
      lines.push(`URL: ${article.url}`);
      if (article.ai_summary) {
        lines.push('\nAI Analysis:');
        lines.push(article.ai_summary);
      }
      lines.push('----------------------------------------');
    });
  }
  return lines.join('\n');
}

export async function analyzeImageWithClaim(imageBuffer, claimText = '') {
  try {
    const client = await getVisionClient();
    const [result] = await client.webDetection({ image: { content: imageBuffer } });
    const web = result.webDetection || {};

    const bestGuessLabels = (web.bestGuessLabels || []).map(l => l.label).filter(Boolean);
    const pages = web.pagesWithMatchingImages || [];

    const articles = [];
    for (const page of pages.slice(0, 5)) {
      if (!page?.url) continue;
      const content = await fetchArticleContent(page.url);
      const aiSummary = content ? await getAiSummary(content, bestGuessLabels[0] || 'news event') : null;
      articles.push({
        url: page.url,
        content: content ? (content.length > 1000 ? content.slice(0, 1000) + '...' : content) : null,
        ai_summary: aiSummary,
        matches_count: Array.isArray(page.fullMatchingImages) ? page.fullMatchingImages.length : 0
      });
    }

    const payload = {
      success: true,
      found: articles.length > 0,
      best_guess_labels: bestGuessLabels,
      articles,
    };
    const summary = buildImageContext(payload, claimText);
    return { ...payload, summary };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


