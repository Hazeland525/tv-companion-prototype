# Development Plan
Because it is a bit complicated to handle different hardware, in order to test the basic functions of watching content together with AI, I decided to fulfill all the functions using laptop instead. The plan is as follows:

## VD-Companion Prototype Concept Plan (Laptop-based)

### Prototype Description
Laptop-based prototype:
* Open YouTube in browser (e.g., Chrome).
* ChatGPT can “see” what’s on screen (via screen capture).
* ChatGPT chats with you about what you’re watching.
* It can also interact with YouTube by:
* Hovering on recommended content
* Clicking into videos
* Going back or forward

MVP Flow
	1.	Open YouTube
	2.	Activate your Chrome Extension
	3.	It captures the screen → sends to GPT Vision
	4.	You chat with the assistant
	5.	Assistant can:
	•	Tell you what’s on screen
	•	Suggest videos
	•	Hover, click, or go back

### Step 1: Create a Chrome Extension or Local Web App
Using Chrome Extension
	•	Access the screen or tab content
	•	Send screenshots to GPT-4 Vision
	•	Overlay a chatbot interface
	•	Simulate user actions (hover, click, back)

### Step2: Screen Capture + ChatGPT Vision
OpenAI Vision API: gpt-o1-mini
	•	Capture a screenshot of the browser tab (YouTube).
	•	Send it to OpenAI Vision API.
	•	Get the result (e.g. “This is a video titled ‘Top 10 Sci-Fi Movies’ with recommendations below”).
	•	Use this to start a conversational thread.

### Step3: Build a Floating Chat UI
Overlay a floating chat window inside the YouTube tab (like a mini ChatGPT).
	•	You can talk to ChatGPT via text/voice
	•	It can respond with suggestions like:
	•	“How about watching this one?” → And hover on the recommended video.
	•	“Click into it” → And simulate a click.
	•	“Go back” → Trigger browser back.

Use: content.js inside the Chrome Extension to inject and control DOM.


### Step 4: DOM Interaction (Hover / Click)

YouTube’s UI is mostly standard. You can:
	•	Find all video thumbnail elements on the page.
	•	Hover using element.dispatchEvent(new MouseEvent(...))
	•	Click using element.click()
	•	Go back with history.back()

### Step 5: Link Vision + ChatGPT + Actions
	•	Capture YouTube screen
	•	Send to OpenAI
	•	Add your message (e.g. “What should I watch next?”)
	•	Get structured response like:
