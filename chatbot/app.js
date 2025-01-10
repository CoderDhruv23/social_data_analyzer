class LangflowClient {
  constructor(baseURL, applicationToken) {
      this.baseURL = baseURL;
      this.applicationToken = applicationToken;
  }

  // POST request to API
  async post(endpoint, body, headers = { "Content-Type": "application/json" }) {
      headers["Authorization"] = `Bearer ${this.applicationToken}`;
      headers["Content-Type"] = "application/json";
      const url = `${this.baseURL}${endpoint}`;
      try {
          const response = await fetch(url, {
              method: "POST",
              headers: headers,
              body: JSON.stringify(body),
          });

          const responseMessage = await response.json();
          if (!response.ok) {
              throw new Error(`${response.status} ${response.statusText} - ${JSON.stringify(responseMessage)}`);
          }
          return responseMessage;
      } catch (error) {
          console.error("Request Error:", error.message);
          throw error;
      }
  }

  // Initiate a new session for flow
  async initiateSession(flowId, langflowId, inputValue, inputType = "chat", outputType = "chat", stream = false, tweaks = {}) {
      const endpoint = `/lf/${langflowId}/api/v1/run/${flowId}?stream=${stream}`;
      return this.post(endpoint, { input_value: inputValue, input_type: inputType, output_type: outputType, tweaks: tweaks });
  }

  // Handle stream of data
  handleStream(streamUrl, onUpdate, onClose, onError) {
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          onUpdate(data);
      };

      eventSource.onerror = (event) => {
          console.error("Stream Error:", event);
          onError(event);
          eventSource.close();
      };

      eventSource.addEventListener("close", () => {
          onClose("Stream closed");
          eventSource.close();
      });

      return eventSource;
  }

  // Run a specific flow, handle streaming if required
  async runFlow(flowIdOrName, langflowId, inputValue, inputType = "chat", outputType = "chat", tweaks = {}, stream = false, onUpdate, onClose, onError) {
      try {
          const initResponse = await this.initiateSession(flowIdOrName, langflowId, inputValue, inputType, outputType, stream, tweaks);
          console.log("Init Response:", initResponse);
          if (stream && initResponse && initResponse.outputs && initResponse.outputs[0].outputs[0].artifacts.stream_url) {
              const streamUrl = initResponse.outputs[0].outputs[0].artifacts.stream_url;
              console.log(`Streaming from: ${streamUrl}`);
              this.handleStream(streamUrl, onUpdate, onClose, onError);
          }
          return initResponse;
      } catch (error) {
          console.error("Error running flow:", error);
          onError("Error initiating session");
      }
  }
}

// Using a proxy to handle CORS error (Proxy URL for development)
const API_URL = "https://cors-anywhere.herokuapp.com/https://api.langflow.astra.datastax.com";
const applicationToken = "API_TOKEN";
const langflowClient = new LangflowClient(API_URL, applicationToken);

async function main(inputValue, inputType = "chat", outputType = "chat", stream = false) {
  const flowIdOrName = "a6871b67-1e4c-4bd7-a322-a7496752d9b8";
  const langflowId = "dcffe78c-dec2-43b2-8220-487c640f7692";

  try {
      const tweaks = {
          "ChatInput-Dhb6i": {},
          "ParseData-nziuH": {},
          "Prompt-zQosl": {},
          "SplitText-22kmC": {},
          "ChatOutput-vFDBQ": {},
          "AstraDB-teXhc": {},
          "AstraDB-BXiK0": {},
          "File-SnlG6": {},
          "GoogleGenerativeAIModel-pxKoq": {},
          "Google Generative AI Embeddings-zxqzU": {},
          "Google Generative AI Embeddings-VvbEA": {},
      };
      
      const response = await langflowClient.runFlow(
          flowIdOrName,
          langflowId,
          inputValue,
          inputType,
          outputType,
          tweaks,
          stream,
          (data) => {
              updateChat("bot", data.chunk);
          },
          (message) => {
              console.log("Stream Closed:", message);
          },
          (error) => {
              console.error("Stream Error:", error);
          }
      );

      // Handle non-streaming response
      if (!stream && response && response.outputs) {
          const flowOutputs = response.outputs[0];
          const firstComponentOutputs = flowOutputs.outputs[0];
          const output = firstComponentOutputs.outputs.message;
          updateChat("bot", output.message.text);
      }
  } catch (error) {
      console.error("Main Error", error.message);
  }
}

// Update chat UI
function updateChat(sender, message) {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender === "user" ? "user-message" : "bot-message");
  messageElement.textContent = message;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Event listener for send button
document.getElementById("send-btn").addEventListener("click", () => {
  const userInput = document.getElementById("user-input").value;
  if (userInput.trim()) {
      updateChat("user", userInput);
      document.getElementById("user-input").value = "";
      main(userInput);
  }
});

// Event listener for Enter key to send message
document.getElementById("user-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("send-btn").click();
  }
});

// Clear the chat box before starting a new conversation
function clearChat() {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = ""; // Clear existing messages
}

// Set chat background to white
document.getElementById("chat-box").style.backgroundColor = "white";
