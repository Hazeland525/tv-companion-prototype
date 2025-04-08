import express from 'express';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import OpenAI from 'openai';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware to parse JSON with a larger limit for image data
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files from the "public" folder
app.use(express.static('public'));

// API endpoint to analyze the image (you may leave this as is or update later)
app.post('/analyze', async (req, res) => {
  const { base64Image } = req.body;
  try {
    const apiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use your model name here
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What’s happening on this screen?" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });
    res.json(apiResponse);

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to handle chat messages
app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages must be provided as an array." });
  }
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Adjust model name as needed
      messages: messages,
      max_tokens: 500
    });
    res.json(completion);
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


// content: [
//   { type: "text", text: "What’s happening on this screen?" },
//   {
//     type: "image_url",
//     image_url: {
//       url: `data:image/jpeg;base64,${base64Image}`
//     }
//   }
// ]