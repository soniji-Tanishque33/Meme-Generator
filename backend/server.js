// server.js - Express backend for Meme Generator (Gemini + Imgflip)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Imgflip credentials (use your own or demo)
const IMGFLIP_USERNAME = process.env.IMGFLIP_USERNAME || 'imgflip_hubot';
const IMGFLIP_PASSWORD = process.env.IMGFLIP_PASSWORD || 'imgflip_hubot';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Helper: Safe JSON parse with fallback
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// Template aliases for semantic duplicates and variety
const templateAliases = {
  "Drake Hotline Bling": ["Drakeposting", "Drake Format"],
  "Distracted Boyfriend": ["Guy Looking at Another Woman"],
  "Is This A Pigeon": ["Anime Guy Butterfly"],
  "Two Buttons": ["2 Buttons"],
  // Add more as needed
};

// Store last template used in memory (per server run)
let lastTemplate = null;

app.post('/api/meme', async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required.' });
  }

  try {
    // 1. Get Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not set.' });
    }

    // 2. Fetch meme templates from Imgflip
    let templates = [];
    try {
      const imgflipRes = await axios.get('https://api.imgflip.com/get_memes');
      templates = imgflipRes.data.data.memes;
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch meme templates from Imgflip.' });
    }

    // 3. Prepare a list of template names for Gemini
    const templateNames = templates.map(t => t.name);
    const trendingTemplates = [
      "Drake Hotline Bling", "Two Buttons", "Distracted Boyfriend", "Is This A Pigeon", "UNO Draw 25", "Expanding Brain", "Mocking SpongeBob", "Batman Slapping Robin"
    ];

    // 4. Build a punchy, meme-style prompt for Gemini
    const geminiPrompt = `You are a top-tier meme creator. Given a topic, respond strictly in JSON with:
"template": a trending meme template name from this list: [${templateNames.join(', ')}] that best matches the topic's emotional tone (e.g. 'Drake Hotline Bling', 'Two Buttons', etc.)
"caption": a short, funny, meme-style caption (max 15 words) that could appear on the image. Use irony, exaggeration, pop culture, and relatable humor. Avoid full sentences and explanations. Make it punchy and viral-ready.
Respond ONLY in this JSON format:
{
  "template": "template name here",
  "caption": "funny caption here"
}

Topic: ${topic}`;

    // 5. Call Gemini API for caption and template name
    let caption = '';
    let templateName = '';
    let geminiRaw = '';
    try {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      const geminiRes = await axios.post(
        geminiUrl,
        { contents: [{ parts: [{ text: geminiPrompt }] }] },
        { headers: { 'Content-Type': 'application/json', 'X-goog-api-key': geminiApiKey } }
      );
      geminiRaw = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Try to extract JSON from Gemini's response
      let jsonStart = geminiRaw.indexOf('{');
      let jsonEnd = geminiRaw.lastIndexOf('}');
      let jsonStr = (jsonStart !== -1 && jsonEnd !== -1) ? geminiRaw.slice(jsonStart, jsonEnd + 1) : '';
      let parsed = safeJsonParse(jsonStr);
      if (parsed && parsed.caption && parsed.template) {
        caption = parsed.caption.trim();
        templateName = parsed.template.trim();
      } else {
        // Fallback: try regex extraction
        const capMatch = geminiRaw.match(/"caption"\s*:\s*"([^"]+)"/i);
        const tempMatch = geminiRaw.match(/"template"\s*:\s*"([^"]+)"/i);
        caption = capMatch ? capMatch[1].trim() : '';
        templateName = tempMatch ? tempMatch[1].trim() : '';
      }
    } catch (err) {
      return res.status(500).json({ error: 'Gemini API error', details: err.message });
    }
    if (!caption || !templateName) {
      return res.status(500).json({ error: 'Failed to extract caption/template from Gemini', geminiRaw });
    }

    // 6. Template repeat-avoidance and aliasing
    let originalTemplate = templateName;
    // If Gemini returns the same template as last time, pick an alias or random alternative
    if (lastTemplate && templateName.toLowerCase() === lastTemplate.toLowerCase()) {
      const aliases = templateAliases[templateName] || [];
      // Try to pick a random alias or a random trending template
      if (aliases.length > 0) {
        templateName = aliases[Math.floor(Math.random() * aliases.length)];
      } else {
        // Pick a random trending template that's not the last one
        const altTemplates = trendingTemplates.filter(t => t.toLowerCase() !== lastTemplate.toLowerCase());
        templateName = altTemplates[Math.floor(Math.random() * altTemplates.length)];
      }
    }
    lastTemplate = templateName;

    // 7. Find the best matching template by name (case-insensitive, partial match)
    let template = templates.find(t => t.name.toLowerCase() === templateName.toLowerCase());
    if (!template) {
      // Try partial match
      template = templates.find(t => t.name.toLowerCase().includes(templateName.toLowerCase()));
    }
    if (!template) {
      // Fallback to a classic meme template
      template = templates.find(t => t.name.toLowerCase().includes('drake hotline bling'))
        || templates.find(t => t.name.toLowerCase().includes('distracted boyfriend'))
        || templates[0];
    }
    const template_id = template.id;
    const template_display = template.name;

    // 8. Generate meme using Imgflip caption_image API (caption only as bottom text)
    let memeUrl = '';
    try {
      const params = new URLSearchParams();
      params.append('template_id', template_id);
      params.append('username', IMGFLIP_USERNAME);
      params.append('password', IMGFLIP_PASSWORD);
      params.append('text0', ''); // No top text
      params.append('text1', caption); // All caption as bottom text
      const imgflipGen = await axios.post('https://api.imgflip.com/caption_image', params);
      if (imgflipGen.data.success) {
        memeUrl = imgflipGen.data.data.url;
      } else {
        return res.status(500).json({ error: 'Imgflip meme generation failed', details: imgflipGen.data.error_message });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Imgflip caption_image API error', details: err.message });
    }

    // 9. Send result to frontend
    res.json({
      topic,
      template: template_display,
      caption,
      imageUrl: memeUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate meme.', details: err.message });
  }
});

// Fallback: serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Meme Generator backend running at http://localhost:${PORT}`);
}); 