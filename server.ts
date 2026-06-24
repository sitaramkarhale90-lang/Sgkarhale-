import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Lazy initialize Gemini client to avoid crashes if GEMINI_API_KEY is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will be in fallback mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_DEV",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());

  // API Routes for AI assistance
  app.post("/api/ai/suggest-comment", async (req, res) => {
    try {
      const { postContent } = req.body;
      if (!postContent) {
        return res.status(400).json({ error: "postContent is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Fallback response for offline development
        return res.json({
          comments: [
            "बिलकुल सही कहा! 👏",
            "Great thoughts! Keep sharing.",
            "मजा आ गया पढ़ कर! 😊"
          ]
        });
      }

      try {
        const client = getGeminiClient();
        const prompt = `You are a helpful and engaging social network assistant. Suggest 3 short, friendly, and natural comments for a post containing this text: "${postContent}". Provide some in Hindi/Hinglish and some in English, representing how real people comment on social media (short, friendly, with relevant emojis). Return the output in raw JSON format matching this schema: { "comments": ["comment 1", "comment 2", "comment 3"] }. Do not include markdown codeblocks, just the JSON string.`;

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const responseText = response.text || '{"comments": []}';
        return res.json(JSON.parse(responseText));
      } catch (geminiError: any) {
        console.warn("Gemini API suggestion failed (503 or limit), using robust local fallback:", geminiError);
        // Robust 503/unavailability fallback
        return res.json({
          comments: [
            `बहुत सुंदर! ✨`,
            `Amazing thought! Thanks for sharing. 👍`,
            `सत्य वचन, बिलकुल सही कहा! 😊`
          ]
        });
      }
    } catch (error: any) {
      console.error("AI comment suggestion root error:", error);
      res.status(200).json({ 
        comments: [
          "बिलकुल सही कहा! 👏",
          "Great thoughts! Keep sharing.",
          "मजा आ गया पढ़ कर! 😊"
        ] 
      });
    }
  });

  app.post("/api/ai/generate-post-idea", async (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) {
        return res.status(400).json({ error: "topic is required" });
      }

      const getFallbackIdeas = (t: string) => [
        `Today's inspiration on ${t}: Consistency is the key to mastering anything! 🚀`,
        `आज का विचार: ${t} के बारे में कुछ नया सीखें और आगे बढ़ें! ✨`,
        `Top 3 simple steps to level up your daily routine in ${t}. Let's do this! 💪`
      ];

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ ideas: getFallbackIdeas(topic) });
      }

      try {
        const client = getGeminiClient();
        const prompt = `Generate 3 catchy, high-engagement social media post ideas about this topic: "${topic}". Make them inspiring, creative, and relatable, combining Hindi/Hinglish and English. Output as a JSON object of this structure: { "ideas": ["idea 1", "idea 2", "idea 3"] }. Do not wrap in markdown backticks.`;

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const responseText = response.text || '{"ideas": []}';
        return res.json(JSON.parse(responseText));
      } catch (geminiError: any) {
        console.warn("Gemini API post idea failed (503 or limit), using robust local fallback:", geminiError);
        return res.json({ ideas: getFallbackIdeas(topic) });
      }
    } catch (error: any) {
      console.error("AI post idea generation root error:", error);
      res.status(200).json({ 
        ideas: [
          `Amazing thoughts on "${req.body?.topic || 'this topic'}"! ✨`,
          `आज की ताज़ा पोस्ट: अपने विचार हमारे साथ साझा करें। 😊`,
          `Let's talk about ${req.body?.topic || 'life'}! 🚀`
        ] 
      });
    }
  });

  app.post("/api/ai/translate", async (req, res) => {
    try {
      const { text, targetLang } = req.body; // targetLang: 'Hindi' | 'English' etc.
      if (!text || !targetLang) {
        return res.status(400).json({ error: "text and targetLang are required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          translatedText: `[Translated to ${targetLang}] ${text}`
        });
      }

      try {
        const client = getGeminiClient();
        const prompt = `Translate this social media text into natural, colloquial ${targetLang} while keeping the emojis and general tone. Text: "${text}". Output only the translated text and nothing else.`;

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });

        return res.json({ translatedText: response.text?.trim() });
      } catch (geminiError: any) {
        console.warn("Gemini API translation failed (503 or limit), returning original text:", geminiError);
        return res.json({ translatedText: text }); // Gracefully fall back to original text so user experience is smooth
      }
    } catch (error: any) {
      console.error("AI translation root error:", error);
      res.status(200).json({ translatedText: req.body?.text || "" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Social Network backend running successfully" });
  });

  // Vite middleware for asset serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Server running on http://localhost:${PORT}`);
  });
}

startServer();
