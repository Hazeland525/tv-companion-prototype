// Elements for screen capture and analysis
const startButton = document.getElementById("startCapture");
const endButton = document.getElementById("endCapture"); // End Screen Capture button
// const analyzeButton = document.getElementById("analyze");
const video = document.getElementById("screenVideo");
const canvas = document.getElementById("canvas");
const responseBox = document.getElementById("responseBox");

// Global variables for screen analysis, viewing history, and conversation
let mediaStream = null;
let analysisInterval = null; // To store our setInterval ID
let latestScreenAnalysis = ""; 
let viewingHistory = [];
const conversation = [];

// Move updateScreenAnalysis to global scope
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

// DOMContentLoaded event for chat interface and viewing history UI setup
document.addEventListener('DOMContentLoaded', function () {
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

  // Function to update the viewing history UI in the right section
  window.updateViewingHistoryUI = function() {
    const historyContainer = document.getElementById("viewingHistory");
    if (!historyContainer) return;
    
    let html = "";
   // Reverse the viewingHistory so that the latest entry appears at the top
    viewingHistory.slice().reverse().forEach(entry => {
      html += `<p>[${entry.timestamp}]: ${entry.analysis}</p>`;
    });
    historyContainer.innerHTML = html;
  };

  // Function to send a chat message, injecting screen analysis and viewing history as system context
  async function sendChatMessage() {
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
    
    // Create system context that includes the current screen analysis and viewing history
    const systemContext = `Current Screen: ${latestScreenAnalysis}\n${buildViewingHistoryContext()}`;
    
    // Update or insert system message in the conversation array
    if (conversation.length === 0 || conversation[0].role !== "system") {
      conversation.unshift({ role: "system", content: systemContext });
    } else {
      conversation[0].content = systemContext;
    }
    
    // Append the user's new message to the conversation history
    conversation.push({ role: "user", content: text });

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation })
      });
      const data = await response.json();
      const reply = data.choices[0]?.message?.content || "No response.";
      appendMessage('assistant', reply);
      conversation.push({ role: "assistant", content: reply });
    } catch (error) {
      console.error("Error during chat API call:", error);
      appendMessage('assistant', "Error: " + error.message);
    }
  }

  // Listen for send button clicks and Enter key on chat input
  sendButton.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  });
});

// Handle screen capture start (outside DOMContentLoaded so it's available immediately)
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
