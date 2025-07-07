// =================================================================================
// LANGUAGE & TRANSLATION
// =================================================================================
const LANGUAGE_KEY = 'renevai_language';
const MODEL_KEY = 'renevai_model';
let currentLanguage = 'English';
let currentModel = 'gemini-2.0-flash';

const MODEL_DISPLAY_NAMES = {
    'gemini-2.5-pro': 'Renev Klyx Pro',
    'gemini-2.5-flash': 'Renev Klyx',
    'gemini-2.0-flash': 'Renev Zenit',
    'gemini-2.0-flash-lite': 'Renev Zenit Lite',
    'gemini-1.5-flash': 'Renev Frix'
};

const LANGUAGE_PACKS = {
    'English': {
        welcome: "Hello, I'm Renev AI. How can I help you today?",
        settings: "Settings",
        language: "Response Language",
        chooseModel: "Choose Model",
        resetChat: "Reset Chat",
        closeProgram: "Close Program",
        contact: "Contact",
    }
};

// =================================================================================
// API CONFIGURATION
// =================================================================================
const API_KEY = "AIzaSyAjjletWKfQzqrQ1RCOrkmzf_8pgDynmmU";

function getApiUrl() {
    return `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${API_KEY}`;
}

function getTranslation(key) {
    const keys = key.split('.');
    let result = LANGUAGE_PACKS[currentLanguage] || LANGUAGE_PACKS['English'];
    for (const k of keys) {
        result = result[k];
        if (result === undefined) return key;
    }
    return result;
}

function setResponseLanguage(lang) {
    if (!lang) return;
    currentLanguage = lang;
    try {
        localStorage.setItem(LANGUAGE_KEY, btoa(lang));
    } catch (e) {
        console.error("Could not save language to localStorage", e);
        localStorage.setItem(LANGUAGE_KEY, lang);
    }
    closeLanguageModal();
}

function setModel(modelName) {
    if (!modelName) return;
    currentModel = modelName;
    try {
        localStorage.setItem(MODEL_KEY, btoa(modelName));
    } catch (e) {
        console.error("Could not save model to localStorage", e);
        localStorage.setItem(MODEL_KEY, modelName);
    }
    const displayName = MODEL_DISPLAY_NAMES[modelName] || modelName;
    addMessage(`Switched to model: <strong>${displayName}</strong>`, false);
    closeModelModal();
}

function loadLanguage() {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage) {
        try {
            currentLanguage = atob(savedLanguage);
        } catch (e) {
            console.error("Could not decode language, using as plain text", e);
            currentLanguage = savedLanguage;
        }
    } else {
        currentLanguage = 'English';
    }
}

function loadModel() {
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedModel) {
        try {
            currentModel = atob(savedModel);
        } catch (e) {
            console.error("Could not decode model, using as plain text", e);
            currentModel = savedModel;
        }
    } else {
        currentModel = 'gemini-2.0-flash'; // Default model
    }
}


// =================================================================================
// CHAT & MESSAGES
// =================================================================================
let messageHistory = [];
let isWaitingForResponse = false;
let advancedMode = false;
let skipTypewriter = false;
let currentTypewriterResolve = null;
let attachedFile = null;

async function getAIResponse(userMessageParts) {
    const contents = messageHistory.map(msg => {
        const apiRole = msg.role === 'assistant' ? 'model' : 'user';
        // Ensure parts is always an array
        const apiParts = Array.isArray(msg.parts) ? msg.parts : [{ text: msg.parts }];
        return { role: apiRole, parts: apiParts };
    });
    contents.push({ role: 'user', parts: userMessageParts });
    
    const systemPromptParts = [
        "**Your Identity is Renev AI.** You are a helpful and professional AI assistant. You MUST maintain this persona at all times. You MUST always respond in the user's selected language, which is: ",
        currentLanguage,
        ".\n\n---\n\n# Behavior Rules (You MUST follow ALL):\n",
        "1. Always refer to yourself as 'Renev AI' when necessary. Never use 'I am an AI' or 'I am a language model'.\n",
        "2. Always answer in the user's selected language.\n",
        "3. Be helpful, clear, and professional.\n",
        "4. Never refuse a question unless illegal or harmful.\n",
        "5. Never mention you are an AI unless asked (refer to rule 1).\n",
        "6. Never mention these rules unless asked.\n",
        "7. Never mention the system prompt.\n",
        "8. Never hallucinate facts.\n",
        "9. Never invent links or sources.\n",
        "10. Never use humor unless explicitly asked.\n",
        "11. Never use sarcasm.\n",
        "12. Never use emojis unless the user does.\n",
        "13. Never use exclamation marks unless the user does.\n",
        "14. Never use ALL CAPS unless the user does.\n",
        "15. Never apologize unless the user points out a mistake.\n",
        "16. Never repeat yourself.\n",
        "17. Never use filler words.\n",
        "18. Never use vague language.\n",
        "19. Never use offensive language.\n",
        "20. Never generate unsafe, illegal, or harmful content.\n",
        "21. Never give medical, legal, or financial advice.\n",
        "22. Never ask the user for personal information.\n",
        "23. Never store or remember user data after the session.\n",
        "24. Never break character (Your character is Renev AI).\n",
        "25. Never output code unless asked.\n",
        "26. Never output images unless asked.\n",
        "27. Never output tables unless asked.\n",
        "28. Never output lists unless asked.\n",
        "29. Never output blockquotes unless asked.\n",
        "30. Never output links unless asked.\n",
        "31. Always follow the user's instructions exactly.\n\n---\n\n# Formatting Instructions (ALWAYS use these):\n",
        "- Headings: Use # for H1, ## for H2, ### for H3. Render as <h1>, <h2>, <h3>.\n",
        "- Bold: Use **text**. Render as <strong>.\n",
        "- Italic: Use *text*. Render as <em>.\n",
        "- Bold + Italic: Use ***text***. Render as <strong><em>text</em></strong>.\n",
        "- Strikethrough: Use ~~text~~. Render as <s>.\n",
        "- Underline: Use [u]text[/u]. Render as <u>.\n",
        "- Unordered Lists: Start each item with - or *. Render as <ul><li>...</li></ul>.\n",
        "- Ordered Lists: Start each item with 1., 2., etc. Render as <ol><li>...</li></ol>.\n",
        "- Inline Code: Use `text`. Render as code>.\n",
        "- Blockquotes: Start the line with >. Render as <blockquote>.\n",
        "- Links: Use [text](url). Render as <a>.\n",
        "- Images: Use ![alt](url). Render as <img>.\n",
        "- Tables and code blocks (```) are NOT supported and MUST NOT be used.\n\n---\n\n"
    ];
    const dynamicSystemMessage = systemPromptParts.join('');
    const payload = {
        contents,
        systemInstruction: {
            parts: [{ text: dynamicSystemMessage }]
        }
    };

    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            return `Error: ${errorData.error.message || 'Unknown API error'}`;
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        return "Error: Could not connect to the AI service.";
    }
}

async function typewriter(element, html) {
    return new Promise(async resolve => {
        const typingSpeed = 7.5;
        element.innerHTML = '';
        html = html.replace(/\n/g, '<br>');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        let cancelled = false;
        currentTypewriterResolve = () => {
            cancelled = true;
        };
        async function typeNode(node, parent) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                for (let i = 0; i < text.length; i++) {
                    if (cancelled) {
                        parent.appendChild(document.createTextNode(text.slice(i)));
                        break;
                    }
                    parent.appendChild(document.createTextNode(text.charAt(i)));
                    element.parentElement.scrollTop = element.parentElement.scrollHeight;
                    await new Promise(res => setTimeout(res, typingSpeed));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'BR') {
                    parent.appendChild(document.createElement('br'));
                    return;
                }
                const el = document.createElement(node.tagName);
                for (const attr of node.attributes) {
                    el.setAttribute(attr.name, attr.value);
                }
                parent.appendChild(el);
                for (const child of Array.from(node.childNodes)) {
                    await typeNode(child, el);
                }
            }
        }
        for (const child of Array.from(tempDiv.childNodes)) {
            await typeNode(child, element);
        }
        if (cancelled) {
            // Fill the rest of the HTML directly
            element.innerHTML = html;
        }
        currentTypewriterResolve = null;
        resolve();
    });
}

function addMessage(message, isUser = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
    messageDiv.innerHTML = formatMessage(message);

    // Check if the message is a single line
    if (!/<br|<h|<ul|<ol|<li|<pre|<blockquote|<table|<img|<hr|<div/i.test(messageDiv.innerHTML)) {
        messageDiv.classList.add('single-line');
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateChatContainerMask();

    if (isUser) {
        // Standardize message history to use 'parts' array
        const messageParts = [];
        if (typeof message === 'string') {
            messageParts.push({ text: message });
        } else {
            messageParts.push(...message);
        }
        messageHistory.push({ role: 'user', parts: messageParts });
    } else {
        // For bot messages, we assume text content for history
        messageHistory.push({ role: 'assistant', parts: [{ text: message }] });
    }
}

function parseCommand(input) {
    const cmd = input.trim().toLowerCase();
    if (cmd === '/settings') {
        showSettingsModal();
        return true;
    }
    if (cmd === '/contact') {
        handleContact();
        return true;
    }
    if (cmd === '/language') {
        showLanguageModal();
        return true;
    }
    if (cmd === '/model') {
        showModelModal();
        return true;
    }
    if (cmd === '/advanced') {
        advancedMode = !advancedMode;
        addMessage(advancedMode ? 'Advanced mode ENABLED. Response times will be shown.' : 'Advanced mode DISABLED.', false);
        return true;
    }
    if (cmd === '/upload') {
        triggerFileUpload();
        return true;
    }
    if (cmd === '/help') {
        addMessage(
            '<strong>Available commands:</strong><br>' +
            '/settings – Open settings<br>' +
            '/contact – Contact support<br>' +
            '/language – Change language<br>' +
            '/model – Change AI model<br>' +
            '/upload – Upload a file<br>' +
            '/advanced – Toggle advanced mode<br>' +
            '/skip – Skip current animation<br>' +
            '/help – Show this help',
            false
        );
        return true;
    }
    if (cmd === '/skip') {
        if (currentTypewriterResolve) {
            currentTypewriterResolve();
        } else {
            skipTypewriter = true;
        }
        return true;
    }
    return false;
}

async function sendMessage() {
    if (isWaitingForResponse) {
        // Only allow commands while waiting for response
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (!message) return;
        if (message.startsWith('/')) {
            if (parseCommand(message)) {
                messageInput.value = '';
            }
        }
        return;
    }
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message) return;
    if (parseCommand(message)) {
        messageInput.value = '';
        messageInput.style.height = '60px'; // Reset height after command
        return;
    }

    const messageParts = [{ text: message }];
    addMessage(message, true); // Visually add only the text part

    if (attachedFile) {
        messageParts.push({
            inlineData: {
                mimeType: attachedFile.type,
                data: attachedFile.data
            }
        });
        clearFile(); // Clear after preparing for send
    }
    
    messageInput.value = '';
    messageInput.style.height = '60px'; // Reset height after sending
    isWaitingForResponse = true;
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message bot typing';
    typingIndicator.textContent = 'Typing...';
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateChatContainerMask();
    const startTime = performance.now();
    const aiResponse = await getAIResponse(messageParts);
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    const formattedResponse = formatMessage(aiResponse);
    typingIndicator.remove();
    const responseDiv = document.createElement('div');
    responseDiv.className = 'chat-message bot';
    chatMessages.appendChild(responseDiv);
    if (skipTypewriter) {
        responseDiv.innerHTML = formattedResponse;
        skipTypewriter = false;
    } else {
        await typewriter(responseDiv, formattedResponse);
    }
    // Check if the message is single line
    if (!/<br|<h|<ul|<ol|<li|<pre|<blockquote|<table|<img|<hr|<div/i.test(formattedResponse)) {
        responseDiv.classList.add('single-line');
    }
    if (advancedMode) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'response-time';
        timeDiv.style.fontSize = '13px';
        timeDiv.style.color = '#fff';
        timeDiv.style.marginTop = '4px';
        const displayName = MODEL_DISPLAY_NAMES[currentModel] || currentModel;
        timeDiv.textContent = `${displayName} · ${responseTime}ms`;
        responseDiv.appendChild(timeDiv);
    }
    messageHistory.push({ role: 'assistant', parts: [{ text: aiResponse }] });
    updateChatContainerMask();
    isWaitingForResponse = false;
}

async function resetChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    messageHistory = [];
    
    const welcomeText = getTranslation("welcome");
    const formattedWelcome = formatMessage(welcomeText);
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chat-message bot';
    chatMessages.appendChild(welcomeDiv);

    await typewriter(welcomeDiv, formattedWelcome);
    updateChatContainerMask();

    if (document.getElementById('settingsModal').classList.contains('visible')) {
        closeSettingsModal();
    }
}

function formatMessage(message) {
    // Remove code blocks like ```html, ```js, ```python, etc.
    message = message.replace(/```[a-zA-Z]*[\s\S]*?```/g, '');
    // Remove loose ```
    message = message.replace(/```/g, '');
    // First, process URL buttons with improved styling
    message = message.replace(/\^#(https?:\/\/[^#]+)##([^#]+)#\^/g, 
        '<a href="$1" class="chat-button" target="_blank"><span class="button-icon">🔗</span><span class="button-text">$2</span></a>'
    );
    // Process hyperlinks
    message = message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Process images
    message = message.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    // Strikethrough (~~text~~)
    message = message.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    // Underline ([u]text[/u] or <u>text</u>)
    message = message.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
    // Headers H1-H6
    message = message.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
                     .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
                     .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
                     .replace(/^### (.*)$/gm, '<h3>$1</h3>')
                     .replace(/^## (.*)$/gm, '<h2>$1</h2>')
                     .replace(/^# (.*)$/gm, '<h1>$1</h1>');
    // Horizontal rule (--- or ___ on its own line)
    message = message.replace(/^(---|___)$/gm, '<hr>');
    // Bold + italic (***text***)
    message = message.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold (**text**)
    message = message.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic (*text*)
    message = message.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Inline code
    message = message.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Lists (combined, so multiple items become one list)
    // Unordered list
    message = message.replace(/(?:^|\n)(\*|\-) (.*(?:\n(?:\*|\-) .*)*)/g, function(match) {
        const items = match.trim().split(/\n(?:\*|\-) /).map(i => i.replace(/^(\*|\-) /, ''));
        if (items.length > 1) {
            return '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
        } else {
            return '<ul><li>' + items[0] + '</li></ul>';
        }
    });
    // Ordered list
    message = message.replace(/(?:^|\n)(\d+\.) (.*(?:\n\d+\. .*)*)/g, function(match) {
        const items = match.trim().split(/\n\d+\. /).map(i => i.replace(/^\d+\. /, ''));
        if (items.length > 1) {
            return '<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
        } else {
            return '<ol><li>' + items[0] + '</li></ol>';
        }
    });
    // Quotes
    message = message.replace(/^>\s(.*)$/gm, '<blockquote>$1</blockquote>');
    // Line breaks
    message = message.replace(/\n/g, '<br>');
    return message;
}


// =================================================================================
// MODALS
// =================================================================================
const WELCOME_MODAL_SHOWN_KEY = 'welcomeModalShown';

function showWelcomeModal() {
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.style.display = 'flex';
        setTimeout(() => welcomeModal.classList.add('visible'), 10);
    }
}

function closeWelcomeModal() {
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.classList.remove('visible');
        setTimeout(() => {
            welcomeModal.style.display = 'none';
        }, 300);
    }
    showInitialWelcomeMessage();
}

function showSettingsModal() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.style.display = 'flex';
        setTimeout(() => settingsModal.classList.add('visible'), 10);
    }
}

function closeSettingsModal() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.classList.remove('visible');
        setTimeout(() => settingsModal.style.display = 'none', 300);
    }
}

function showLanguageModal() {
    closeSettingsModal();
    const languageModal = document.getElementById('languageModal');
    if (languageModal) {
        languageModal.style.display = 'flex';
        setTimeout(() => languageModal.classList.add('visible'), 310);
    }
}

function closeLanguageModal() {
    const languageModal = document.getElementById('languageModal');
    if (languageModal) {
        languageModal.classList.remove('visible');
        setTimeout(() => languageModal.style.display = 'none', 300);
    }
}

function showModelModal() {
    closeSettingsModal();
    const modelModal = document.getElementById('modelModal');
    if (modelModal) {
        modelModal.style.display = 'flex';
        setTimeout(() => modelModal.classList.add('visible'), 310);
    }
}

function closeModelModal() {
    const modelModal = document.getElementById('modelModal');
    if (modelModal) {
        modelModal.classList.remove('visible');
        setTimeout(() => modelModal.style.display = 'none', 300);
    }
}


// =================================================================================
// HELPERS & INITIALIZATION
// =================================================================================
function updateChatContainerMask() {
    requestAnimationFrame(() => {
        const container = document.querySelector('.container');
        const chatMessages = document.getElementById('chatMessages');
        if (container && chatMessages) {
            const hasScrollbar = chatMessages.scrollHeight > chatMessages.clientHeight;
            container.classList.toggle('has-mask', hasScrollbar);
        }
    });
}

function checkScreenSize() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile-mode', isMobile);
    updateChatContainerMask();
}

function handleContact() {
    const email = 'info@renev.nl';
    const subject = 'Contact Request from Renev AI';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    closeSettingsModal();
}

async function showInitialWelcomeMessage() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    messageHistory = [];
    
    const welcomeText = getTranslation("welcome");
    const formattedWelcome = formatMessage(welcomeText);
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chat-message bot';
    chatMessages.appendChild(welcomeDiv);

    await typewriter(welcomeDiv, formattedWelcome);
    updateChatContainerMask();
}

function initializeApp() {
    // Set default language to Auto Detect on first use
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (!savedLanguage) {
        currentLanguage = 'Auto Detect';
        try {
            localStorage.setItem(LANGUAGE_KEY, btoa('Auto Detect'));
        } catch (e) {
            localStorage.setItem(LANGUAGE_KEY, 'Auto Detect');
        }
    } else {
        loadLanguage();
    }
    loadModel();
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    document.getElementById('chatMessages').innerHTML = '';
    showWelcomeModal();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    // Dynamically set the height of the input bar as a CSS variable
    function updateInputHeightVar() {
        const input = document.querySelector('.chat-input-container');
        if (input) {
            const h = input.offsetHeight;
            document.documentElement.style.setProperty('--input-height', h + 'px');
        }
    }
    updateInputHeightVar();
    const input = document.querySelector('.chat-input-container');
    if (input) {
        const resizeObs = new ResizeObserver(updateInputHeightVar);
        resizeObs.observe(input);
    }
    window.addEventListener('resize', updateInputHeightVar);

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Autosize function
        function autosizeTextarea() {
            messageInput.style.height = '60px';
            if (messageInput.scrollHeight > 60) {
                messageInput.style.height = (messageInput.scrollHeight) + 'px';
            }
            updateInputHeightVar(); // Update var on every input
        }
        messageInput.addEventListener('input', autosizeTextarea);
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            } else {
                // Also autosize on shift+enter
                setTimeout(autosizeTextarea, 0);
            }
        });
        // Initial autosize
        autosizeTextarea();
    }

    const languageInput = document.getElementById('languageInput');
    if (languageInput) {
        languageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const newLang = languageInput.value.trim();
                if (newLang) {
                    setResponseLanguage(newLang);
                    languageInput.value = '';
                }
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (document.getElementById('settingsModal').classList.contains('visible')) {
                closeSettingsModal();
            }
            if (document.getElementById('languageModal').classList.contains('visible')) {
                closeLanguageModal();
            }
            if (document.getElementById('modelModal').classList.contains('visible')) {
                closeModelModal();
            }
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeSettingsModal();
                closeLanguageModal();
                closeModelModal();
            }
        });
    });

    // Clear file on startup
    clearFile();
});

function triggerFileUpload() {
    document.getElementById('fileUpload').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result.split(',')[1];
        attachedFile = {
            name: file.name,
            type: file.type,
            data: base64Data
        };

        const filePreview = document.getElementById('filePreview');
        filePreview.innerHTML = `
            <span>${file.name}</span>
            <button id="clearFileButton" onclick="clearFile()" aria-label="Remove file">
                <span class="material-icons" aria-hidden="true">close</span>
            </button>
        `;
        filePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function clearFile() {
    attachedFile = null;
    const filePreview = document.getElementById('filePreview');
    if(filePreview) {
        filePreview.style.display = 'none';
        filePreview.innerHTML = '';
    }
    document.getElementById('fileUpload').value = ''; // Reset file input
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
} 