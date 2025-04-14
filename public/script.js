console.log("script.js loaded");
// Elements for screen capture and analysis
const startButton = document.getElementById("startCapture");
const endButton = document.getElementById("endCapture"); // End Screen Capture button
// const analyzeButton = document.getElementById("analyze");
const video = document.getElementById("screenVideo");
const canvas = document.getElementById("canvas");
const responseBox = document.getElementById("responseBox");


// === Code for screen capture, chat, viewing history, etc. ===
// Global variables for screen analysis, viewing history, and conversation
let mediaStream = null;
let analysisInterval = null; // To store our setInterval ID
let latestScreenAnalysis = ""; 
let viewingHistory = [];
const conversation = [];

//Handle screen capture start (outside DOMContentLoaded so it's available immediately)
startButton.onclick = async () => {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: "screen" }
    });
    video.srcObject = mediaStream;
    // Start auto-analysis every 15 seconds
    if (!analysisInterval) {
      analysisInterval = setInterval(updateScreenAnalysis, 15000);
    }
    // Optionally, run an initial analysis immediately
    // updateScreenAnalysis();
    setTimeout(updateScreenAnalysis, 3000);
  } catch (err) {
    alert("Error accessing screen: " + err);
  }
};
// Handle screen capture end with the new End Screen Capture button
endButton.onclick = () => {
  // Stop the auto-analysis
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
  // Stop all tracks in the media stream to end screen sharing
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    video.srcObject = null;
  }
  responseBox.textContent = "Screen capture ended.";
};
// Screen analysis
async function updateScreenAnalysis() {
  if (!mediaStream) return; // Ensure screen capture is active
  // Check if video dimensions are available
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    console.warn('Video dimensions not ready yet. Skipping analysis.');
    return;
  }
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const dataUrl = canvas.toDataURL("image/jpeg");
  const base64Image = dataUrl.split(",")[1];

  responseBox.textContent = "Analyzing...";
  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image })
    });
    const data = await response.json();
    // Assuming analysis result is in data.choices[0].message.content:
    const analysis = data.choices?.[0]?.message?.content || "No analysis available.";
    latestScreenAnalysis = analysis;
    const timestamp = new Date().toLocaleTimeString();
    viewingHistory.push({ timestamp, analysis });
    updateViewingHistoryUI();
    responseBox.textContent = analysis;
  } catch (error) {
    console.error("Error during screen analysis:", error);
    responseBox.textContent = "Error: " + error.message;
  }
}

// Function to update the viewing history UI in the right section
function updateViewingHistoryUI () {
  const historyContainer = document.getElementById("viewingHistory");
  if (!historyContainer) return;
  
  let html = "";
  // Reverse the viewingHistory so that the latest entry appears at the top
  viewingHistory.slice().reverse().forEach(entry => {
    html += `<p>[${entry.timestamp}]: ${entry.analysis}</p>`;
  });
  historyContainer.innerHTML = html;
};


// === Code for voice recording, including startRecording, stopRecording, transcribeAudio ===
// Variables for voice recording
let mediaRecorder;
let recordedChunks = [];
// Get the new recording control buttons
const startRecordingButton = document.getElementById('start-recording');
const stopRecordingButton = document.getElementById('stop-recording');

// Start recording using getUserMedia (for audio)
startRecordingButton.addEventListener('click', async () => {
  try {
    // Request only audio
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(audioStream);
    
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // When recording stops, create a Blob from recordedChunks
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      
      try {
        // Send the audio to your /transcribe endpoint
        const response = await fetch('/transcribe', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          throw new Error('Transcription request failed');
        }
        const data = await response.json();
        // Assuming the transcript is returned in data.transcript
        const transcript = data.transcript || '';
        // Auto-fill the chat input with the transcript
        document.getElementById('chat-input').value = transcript;
      } catch (error) {
        console.error("Error transcribing audio:", error);
      }
    };

    mediaRecorder.start();
    console.log("Recording started");
  } catch (err) {
    console.error("Error accessing microphone:", err);
  }
});
// Stop recording
stopRecordingButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("Recording stopped");
  }
});
// Transcription Functionality//
async function transcribeAudio(formData) {
  try {
    const response = await fetch('/transcribe', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    console.log("Transcription response:", data);
    return data.transcript;
  } catch (error) {
    console.error("Error transcribing audio:", error);
  }
}

// Function to perform TTS by fetching audio from your /tts endpoint and playing it
async function playTTS(text) {
  try {
    const response = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    if (!response.ok) {
      throw new Error("TTS request failed");
    }
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  } catch (error) {
    console.error("Error during TTS:", error);
  }
}

// === Event listeners for sending chat messages ===
document.addEventListener('DOMContentLoaded', function () {
  console.log("DOM fully loaded");
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');

  // Function to append a message to the chat history UI
  function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerText = text;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // Function to send a chat message, injecting screen analysis and viewing history as system context
  async function sendChatMessage() {
    console.log("sendChatMessage() started");
    const text = chatInput.value.trim();
    if (text === "") return;

    appendMessage('user', text);
    chatInput.value = "";

    // Build viewing history context as a string
    function buildViewingHistoryContext() {
      let context = "Viewing History:\n";
      viewingHistory.forEach(entry => {
        context += `[${entry.timestamp}]: ${entry.analysis}\n`;
      });
      return context;
    }
    
    // Create system context that includes the current screen analysis and viewing history, and the instruction to keep answers concise
    const systemContext = `Current Screen: ${latestScreenAnalysis}\n${buildViewingHistoryContext()}\nPlease provide your answers in less than 50 words.`;
    
    // Update or insert system message in the conversation array
    if (conversation.length === 0 || conversation[0].role !== "system") {
      conversation.unshift({ role: "system", content: systemContext });
    } else {
      conversation[0].content = systemContext;
    }
    
    // Append the user's new message to the conversation history
    conversation.push({ role: "user", content: text });

    // Debug: Log the conversation payload before sending
    console.log("Conversation payload being sent:", JSON.stringify(conversation, null, 2));
    
    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation })
      });
      
      // Get and log the raw response text for debugging
      const rawResponse = await response.text();
      console.log("Raw response from /chat endpoint:", rawResponse);
      
      // Parse the response and extract the reply
      const data = JSON.parse(rawResponse);
      const reply = data.choices?.[0]?.message?.content || "No response.";
      console.log("Extracted reply:", reply);
      
      // Append the assistant's reply to the chat history
      appendMessage('assistant', reply);
      conversation.push({ role: "assistant", content: reply });

      // Call playTTS to read the reply aloud
      playTTS(reply);
      
    } catch (error) {
      console.error("Error during chat API call:", error);
      appendMessage('assistant', "Error: " + error.message);
    }
  }

  // Listen for send button clicks and Enter key on chat input
  sendButton.addEventListener('click', sendChatMessage);
  console.log("send-button event listener attached");
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  });
});


// Function to perform TTS by fetching audio from your /tts endpoint and playing it
// async function playTTS(text) {
//   try {
//     // Send the text to your /tts endpoint (assumes JSON payload and returns audio as a blob)
//     const response = await fetch('/tts', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ text: text })
//     });
//     if (!response.ok) {
//       throw new Error('TTS request failed');
//     }
//     // Assuming the response returns a blob (audio file)
//     const audioBlob = await response.blob();
//     const audioUrl = URL.createObjectURL(audioBlob);
    
//     // Create an Audio object and play the audio
//     const audio = new Audio(audioUrl);
//     audio.play();
//   } catch (error) {
//     console.error("Error during TTS:", error);
//   }
// }

// Modify your sendChatMessage to invoke playTTS with the assistant reply
// async function sendChatMessage() {
//   const text = chatInput.value.trim();
//   if (text === "") return;
  
//   appendMessage('user', text);
//   chatInput.value = "";
  
//   function buildViewingHistoryContext() {
//     let context = "Viewing History:\n";
//     viewingHistory.forEach(entry => {
//       context += `[${entry.timestamp}]: ${entry.analysis}\n`;
//     });
//     return context;
//   }
  
//   const systemContext = `Current Screen: ${latestScreenAnalysis}\n${buildViewingHistoryContext()}`;
  
//   if (conversation.length === 0 || conversation[0].role !== "system") {
//     conversation.unshift({ role: "system", content: systemContext });
//   } else {
//     conversation[0].content = systemContext;
//   }
  
//   conversation.push({ role: "user", content: text });
  
//   try {
//     const response = await fetch("/chat", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ messages: conversation })
//     });
//     const data = await response.json();
//     const reply = data.choices[0]?.message?.content || "No response.";
//     appendMessage('assistant', reply);
//     conversation.push({ role: "assistant", content: reply });
    
//     // Use your custom TTS endpoint instead of browser TTS:
//     // playTTS(reply);
//   } catch (error) {
//     console.error("Error during chat API call:", error);
//     appendMessage('assistant', "Error: " + error.message);
//   }
// }



// // Create a SpeechRecognition instance for voice input
// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// const recognition = new SpeechRecognition();
// recognition.lang = 'en-US';
// recognition.interimResults = false;
// recognition.maxAlternatives = 1;

// recognition.onresult = function(event) {
//   const transcript = event.results[0][0].transcript;
//   console.log('Recognized:', transcript);
//   // Option A: Auto-fill the chat input
//   document.getElementById('chat-input').value = transcript;
//   // Option B: Send it immediately
//   // sendChatMessage(transcript);
// };

// recognition.onerror = function(event) {
//   console.error('Speech recognition error:', event.error);
// };

// function startVoiceRecognition() {
//   recognition.start();
// }

// // Add a click handler for the Voice Input button
// document.getElementById('voice-input').addEventListener('click', startVoiceRecognition);

// // Function to speak text using speech synthesis
// function speakText(text) {
//   if ('speechSynthesis' in window) {
//     // Optionally clear any queued speech
//     window.speechSynthesis.cancel();
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = 'en-US';
//     utterance.rate = 1;
//     utterance.pitch = 1;
//     window.speechSynthesis.speak(utterance);
//   } else {
//     console.warn("Speech synthesis is not supported in this browser.");
//   }
// }
