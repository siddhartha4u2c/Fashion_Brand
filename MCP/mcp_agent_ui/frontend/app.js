// App Configuration
const API_BASE = "http://127.0.0.1:8000";

// App State
let connectedServers = {};

// DOM Elements
const modal = document.getElementById("add-server-modal");
const addServerBtn = document.getElementById("add-server-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelBtn = document.getElementById("cancel-btn");
const addServerForm = document.getElementById("add-server-form");
const serversList = document.getElementById("servers-list");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages-container");
const modelSelect = document.getElementById("model-select");

// Modal Controls
function openModal() {
    modal.classList.add("active");
    document.getElementById("modal-error").classList.add("hidden");
    document.getElementById("server-name").focus();
}

function closeModal() {
    modal.classList.remove("active");
    addServerForm.reset();
    // Keep default inputs populated
    document.getElementById("server-url").value = "https://salary-mcp-prediction.fastmcp.app/mcp";
    document.getElementById("server-key").value = "fmcp_F4FROEZkJmNN70pr5OcOg0i-l7VO_J_zAtnzLyMfHhY";
}

addServerBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

// Fetch currently registered servers on load
async function fetchServers() {
    try {
        const res = await fetch(`${API_BASE}/api/mcp/list`);
        if (res.ok) {
            const data = await res.json();
            connectedServers = data.servers;
            updateServersUI();
        }
    } catch (e) {
        console.error("Failed to load servers list:", e);
    }
}

// Update servers in sidebar and send button state
function updateServersUI() {
    serversList.innerHTML = "";
    const serverKeys = Object.keys(connectedServers);
    
    if (serverKeys.length === 0) {
        serversList.innerHTML = `<div class="no-servers-msg">No servers connected. Click the "+" button to add one.</div>`;
        sendBtn.disabled = true;
        userInput.placeholder = "Connect an MCP server in the sidebar to begin...";
        userInput.disabled = true;
        return;
    }
    
    userInput.disabled = false;
    userInput.placeholder = "Ask about salary prediction or gap analysis...";
    enableSendButton();
    
    serverKeys.forEach(name => {
        const config = connectedServers[name];
        const card = document.createElement("div");
        card.className = "server-card";
        
        card.innerHTML = `
            <div class="server-card-header">
                <div class="server-name-group">
                    <span class="status-dot green"></span>
                    <span class="server-name" title="${name}">${name}</span>
                </div>
                <button class="btn-disconnect" data-name="${name}" title="Disconnect Server">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="server-url" title="${config.url}">${config.url}</div>
            <div class="server-tools">
                <span class="tool-tag">predict</span>
                <span class="tool-tag">explain</span>
                <span class="tool-tag">gap_analysis</span>
            </div>
        `;
        
        // Handle disconnect action
        card.querySelector(".btn-disconnect").addEventListener("click", async (e) => {
            e.stopPropagation();
            const serverName = e.currentTarget.getAttribute("data-name");
            await disconnectServer(serverName);
        });
        
        serversList.appendChild(card);
    });
}

// Disconnect MCP server
async function disconnectServer(name) {
    try {
        const res = await fetch(`${API_BASE}/api/mcp/disconnect/${name}`, { method: "DELETE" });
        if (res.ok) {
            delete connectedServers[name];
            updateServersUI();
        } else {
            alert(`Failed to disconnect server ${name}`);
        }
    } catch (e) {
        console.error("Disconnect error:", e);
    }
}

// Connect server via form submission
addServerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const name = document.getElementById("server-name").value.trim();
    const url = document.getElementById("server-url").value.trim();
    const transport = document.getElementById("server-transport").value;
    const key = document.getElementById("server-key").value.trim();
    
    const errorBox = document.getElementById("modal-error");
    const connBtn = document.getElementById("connect-btn");
    const btnText = document.getElementById("btn-text");
    const btnSpinner = document.getElementById("btn-spinner");
    
    // Set UI to loading state
    errorBox.classList.add("hidden");
    connBtn.disabled = true;
    btnText.textContent = "Connecting...";
    btnSpinner.classList.remove("hidden");
    
    const headers = key ? { "Authorization": `Bearer ${key}` } : null;
    
    try {
        const res = await fetch(`${API_BASE}/api/mcp/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, url, transport, headers })
        });
        
        const data = await res.json();
        if (res.ok) {
            connectedServers[name] = { url, transport, headers };
            updateServersUI();
            closeModal();
        } else {
            errorBox.textContent = data.detail || "Failed to establish connection. Verify endpoint and credentials.";
            errorBox.classList.remove("hidden");
        }
    } catch (err) {
        errorBox.textContent = "Network error. Make sure the backend server is running.";
        errorBox.classList.remove("hidden");
    } finally {
        connBtn.disabled = false;
        btnText.textContent = "Connect Server";
        btnSpinner.classList.add("hidden");
    }
});

// Auto-grow textarea input
userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = (userInput.scrollHeight) + "px";
    enableSendButton();
});

// Enable/disable send button
function enableSendButton() {
    const hasServers = Object.keys(connectedServers).length > 0;
    const hasText = userInput.value.trim().length > 0;
    sendBtn.disabled = !(hasServers && hasText);
}

// Convert markdown-style characters to HTML
function renderMarkdown(text) {
    if (!text) return "";
    
    // Bold text (**text**)
    let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Bullet points (* point)
    html = html.replace(/^\*\s+(.*?)$/gm, "<li>$1</li>");
    
    // Wrap lists
    html = html.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");
    
    // Headers (### Header)
    html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
    
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    
    return html;
}

// Create collapsible tool card element
function createToolCard(toolName, input, runId) {
    const cardId = "tool-card-" + runId;
    const card = document.createElement("div");
    card.id = cardId;
    card.className = "tool-call-card";
    
    card.innerHTML = `
        <div class="tool-call-header">
            <div class="tool-title-group">
                <i class="fa-solid fa-gears"></i>
                <span>Calling Tool: ${toolName}</span>
                <i class="fa-solid fa-circle-notch fa-spin tool-spinner text-muted"></i>
            </div>
            <i class="fa-solid fa-chevron-down tool-collapse-icon"></i>
        </div>
        <div class="tool-details">
            <div class="tool-details-label">Inputs</div>
            <div class="tool-code-block">${JSON.stringify(input, null, 2)}</div>
        </div>
    `;
    
    // Toggle collapse on header click
    card.querySelector(".tool-call-header").addEventListener("click", () => {
        card.classList.toggle("collapsed");
    });
    
    return card;
}

function updateToolCardEnd(runId, output) {
    const card = document.getElementById("tool-card-" + runId);
    if (!card) return;
    
    // Stop spinner, show checkmark
    const titleGroup = card.querySelector(".tool-title-group");
    const spinner = titleGroup.querySelector(".tool-spinner");
    if (spinner) spinner.remove();
    
    const checkIcon = document.createElement("i");
    checkIcon.className = "fa-solid fa-check text-success";
    checkIcon.style.color = "var(--green-success)";
    titleGroup.prepend(checkIcon);
    
    // Add outputs block
    const detailsContainer = card.querySelector(".tool-details");
    
    // Format JSON output nicely if possible
    let formattedOutput = output;
    try {
        const jsonMatch = output.match(/content=\[\{'type': 'text', 'text': '(.*?)'/);
        if (jsonMatch) {
            const innerStr = jsonMatch[1].replace(/\\"/g, '"');
            const parsed = JSON.parse(innerStr);
            formattedOutput = JSON.stringify(parsed, null, 2);
        } else {
            const parsed = JSON.parse(output);
            formattedOutput = JSON.stringify(parsed, null, 2);
        }
    } catch(e) {
        // Fallback to raw string
    }
    
    const outputDiv = document.createElement("div");
    outputDiv.innerHTML = `
        <div class="tool-details-label" style="margin-top: 10px;">Output Result</div>
        <div class="tool-code-block" style="color: #60a5fa;">${formattedOutput}</div>
    `;
    detailsContainer.appendChild(outputDiv);
    
    // Collapse card by default after finishing to keep view clean
    card.classList.add("collapsed");
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Append general message bubble (for user)
function appendUserMessage(text) {
    const welcome = document.querySelector(".welcome-card");
    if (welcome) welcome.remove();
    
    const row = document.createElement("div");
    row.className = "message-row user";
    
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = text;
    
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    scrollToBottom();
}

// Chat form submission & SSE Reader
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const text = userInput.value.trim();
    if (!text) return;
    
    // Reset textarea size
    userInput.value = "";
    userInput.style.height = "auto";
    enableSendButton();
    
    // Append user message
    appendUserMessage(text);
    
    // Create the Turn Wrapper to hold this turn's assets
    const turnWrapper = document.createElement("div");
    turnWrapper.className = "assistant-turn-wrapper";
    
    // Create inline status indicator
    const inlineStatus = document.createElement("div");
    inlineStatus.className = "inline-status-indicator";
    inlineStatus.innerHTML = `<span class="status-dot pulsing violet"></span><span class="status-text">Thinking...</span>`;
    turnWrapper.appendChild(inlineStatus);
    
    // Create tool calls container
    const toolCallsContainer = document.createElement("div");
    toolCallsContainer.className = "tool-calls-container";
    turnWrapper.appendChild(toolCallsContainer);
    
    // Create assistant response container
    const assistantResponseContainer = document.createElement("div");
    assistantResponseContainer.className = "assistant-response-container";
    turnWrapper.appendChild(assistantResponseContainer);
    
    messagesContainer.appendChild(turnWrapper);
    scrollToBottom();
    
    // Helper to update inline status
    function setInlineStatus(statusText, dotColor = "violet") {
        inlineStatus.querySelector(".status-dot").className = `status-dot pulsing ${dotColor}`;
        inlineStatus.querySelector(".status-text").textContent = statusText;
        inlineStatus.classList.remove("hidden");
    }
    
    // Helper to hide inline status
    function hideInlineStatus() {
        inlineStatus.classList.add("hidden");
    }
    
    let assistantBubble = null;
    let assistantText = "";
    
    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                model: modelSelect.value
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Server error occurred");
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep partial line in buffer
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ")) {
                    const dataStr = trimmed.slice(6);
                    try {
                        const payload = JSON.parse(dataStr);
                        
                        if (payload.event === "tool_start") {
                            setInlineStatus(`Calling Tool: ${payload.name}`, "green");
                            
                            // Create and append tool card to turn wrapper's tool container
                            const card = createToolCard(payload.name, payload.input, payload.run_id);
                            toolCallsContainer.appendChild(card);
                            scrollToBottom();
                            
                        } else if (payload.event === "tool_end") {
                            setInlineStatus("Thinking...", "violet");
                            updateToolCardEnd(payload.run_id, payload.output);
                            
                        } else if (payload.event === "chunk") {
                            // Hide the thinking spinner once text chunks start streaming
                            hideInlineStatus();
                            
                            if (!assistantBubble) {
                                const row = document.createElement("div");
                                row.className = "message-row assistant";
                                assistantBubble = document.createElement("div");
                                assistantBubble.className = "message-bubble";
                                row.appendChild(assistantBubble);
                                assistantResponseContainer.appendChild(row);
                            }
                            assistantText += payload.text;
                            assistantBubble.innerHTML = renderMarkdown(assistantText);
                            scrollToBottom();
                            
                        } else if (payload.event === "error") {
                            throw new Error(payload.message);
                        }
                    } catch (e) {
                        console.error("Failed to parse stream event:", e);
                    }
                }
            }
        }
    } catch (err) {
        hideInlineStatus();
        const errorCard = document.createElement("div");
        errorCard.className = "modal-error-box";
        errorCard.style.margin = "12px 0";
        errorCard.textContent = `Error: ${err.message}`;
        assistantResponseContainer.appendChild(errorCard);
        scrollToBottom();
    } finally {
        hideInlineStatus();
    }
});

// Load servers on startup
fetchServers();
userInput.focus();
