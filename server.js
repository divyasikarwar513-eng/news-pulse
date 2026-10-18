require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// -------------------------------------------------------------
// Helper: Summarize Article with Auto-Fallback on 503 Spikes
// -------------------------------------------------------------
async function generateGeminiSummary(title, description, content) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not defined in .env!");
    return "Summary unavailable.";
  }

  const textToSummarize = [title, description, content]
    .filter(item => typeof item === 'string' && item.trim().length > 0)
    .join('\n\n')
    .trim();

  if (!textToSummarize) {
    console.warn("⚠️ No text provided to summarize.");
    return "Summary unavailable.";
  }

  // Model chain: if the primary hits high demand (503), it tries the fallback model
  const models = [
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite-tts",
    "gemini-3.1-flash-tts-preview"
  ];

  const promptText = "You are a professional news editor. Based on the provided headline and details, write exactly 3 complete, informative bullet points summarizing the news story. Every bullet MUST be a full, finished sentence with no abbreviations or cut-offs. Start each bullet point with '• ':\n\n" + textToSummarize;

  for (const modelName of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.3,
            thinkingConfig: {
              thinkingBudget: 0
            }
          }
        })
      });

      const data = await response.json();

      // If this model is experiencing 503 high demand, try the next one in the chain
      if (response.status === 503) {
        console.warn(`⚠️ ${modelName} returned 503 (high demand). Retrying with fallback model...`);
        continue;
      }

      if (!response.ok) {
        console.error(`❌ Gemini API Error with ${modelName} (${response.status}):`, JSON.stringify(data, null, 2));
        continue;
      }

      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (summary) {
        console.log(`✅ Summary generated using [${modelName}] for: "${title ? title.slice(0, 35) : 'Article'}..."`);
        return summary.trim();
      }
    } catch (err) {
      console.error(`❌ Fetch error on ${modelName}:`, err.message);
    }
  }

  return "Summary unavailable.";
}

// -------------------------------------------------------------
// 1. Route: Fetch News (Categories + Bollywood/Tollywood/Cricket)
// -------------------------------------------------------------
app.get('/api/news', async (req, res) => {
  try {
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      console.error("❌ GNEWS_API_KEY is missing in .env!");
      return res.status(500).json({ error: "GNEWS_API_KEY is not configured on the server." });
    }

    const { category, query, topic } = req.query;
    const lang = req.query.lang || 'en';
    const country = req.query.country || 'in';
    const max = req.query.max || 12;

    let gnewsUrl = '';
    if (query || topic) {
      const searchTerm = encodeURIComponent(query || topic);
      gnewsUrl = `https://gnews.io/api/v4/search?q=${searchTerm}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey}`;
    } else {
      const selectedCategory = encodeURIComponent(category || 'general');
      gnewsUrl = `https://gnews.io/api/v4/top-headlines?category=${selectedCategory}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey}`;
    }

    const response = await fetch(gnewsUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ GNews API Error:", data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Internal server error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news from server." });
  }
});

// -------------------------------------------------------------
// 2. Route: Summarize On Demand
// -------------------------------------------------------------
app.post('/api/summarize', async (req, res) => {
  try {
    const { title, description, content } = req.body;
    const summary = await generateGeminiSummary(title, description, content);
    res.json({ summary });
  } catch (error) {
    console.error("Server error summarizing:", error);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

// -------------------------------------------------------------
// Server Start
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`NewsPulse server running at http://localhost:${PORT}`);
  if (!process.env.GNEWS_API_KEY) {
    console.error("❌ GNEWS_API_KEY is missing in .env!");
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is missing in .env!");
  }
});
