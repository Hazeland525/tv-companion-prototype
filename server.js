import express from 'express';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';


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
    const promptInstruction = "Analyze the screen image and produce a structured JSON summary. " +
      "The JSON should include:\n" +
      "  - overallAnalysis: a concise summary of the page,\n" +
      "  - page: the name or URL of the page,\n" +
      "  - categories: an array of main categories on the screen,\n" +
      "  - contents: an array of objects where each object has keys: title, author, length, views, uploadDate, and thumbnailDescription.\n" +
      "Keep each description under 50 words and ensure the output is valid JSON.";
      
    const apiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use your model name here
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptInstruction },
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


const upload = multer();

app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file provided." });
    }

    // Create a temporary file path
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.webm`);

    // Write the uploaded file buffer to the temporary file
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Create a read stream from the temporary file
    const audioStream = fs.createReadStream(tempFilePath);

    // Call the transcription API
    const transcription = await client.audio.transcriptions.create({
      file: audioStream,
      model: "gpt-4o-transcribe"
    });

    // Delete the temporary file after transcription
    fs.unlinkSync(tempFilePath);

    res.json({ transcript: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error);
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
      max_tokens: 100
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


// TTS endpoint using ChatGPT's TTS JavaScript example
app.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text field is required." });
  }

  try {
    // Call the TTS API as per the JS example from documentation
    const mp3 = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",    // Use the specified TTS model
      voice: "nova",             // Specify desired voice
      
      input: text,                // The text to convert
      instructions: "Speak in a cheerful and positive tone."
    });

    // Convert the response (mp3) to a Buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Return the audio directly to the client
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: error.message });
  }
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