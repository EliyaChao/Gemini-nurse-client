// ----------------------------
// 取得元素
// ----------------------------
const chatBox = document.getElementById("chatBox");
const chatBoxWrapper = document.getElementById("chatBoxWrapper");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const greeting = document.getElementById("greeting");
const scenarioBox = document.getElementById("scenarioBox");

// ----------------------------
// 系統指令（引導 AI 模型行為）
// ----------------------------
const SYSTEM_PROMPT = `
你是一位精神科病人，表現出輕微的焦慮與偏執傾向。護理師的每一句輸入都是對你的提問或介入。
你的回應必須以「病人」身份說話，表現出困惑、情緒低落、憂鬱或簡短的迴避。避免長篇理性回答。
範例：
- （沉默...）
- 這跟那個東西有關嗎？
- 他們又在看我了...
- （低頭）我不想講這個。
請始終維持這個角色。`;


// ----------------------------
// 情境框初始內容
// ----------------------------
const INITIAL_SCENARIO = `
<strong>情境描述：</strong><br>
蘇普琪，床號：1036，18歲未婚女性，大學一年級學生，<br>
已兩週多次翹課，食慾差、失眠，在宿舍割腕，被送至醫學中心縫合10針後，送至本院；<br>
此為第一次在精神科醫院住院，住院第三天症狀仍未改善。
您是精神科病房的護理師。<br>
請您開始一小段護理對話，以評估病人的狀態並建立治療性關係。
`;

document.addEventListener("DOMContentLoaded", () => {
    if (scenarioBox) {
        scenarioBox.innerHTML = INITIAL_SCENARIO;
    }
});

// ----------------------------
// 問候函式
// ----------------------------
function getGreetingH1() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "🌅 早安！";
    else if (hour >= 12 && hour < 18) return "🌞 午安！";
    else return "🌙 晚安！";
}

// 獲取 Bot 聊天內容問候語
function getBotGreetingText() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 9) return "";
    else if (hour >= 9 && hour < 12) return "";
    else if (hour >= 12 && hour < 14) return "";
    else if (hour >= 14 && hour < 18) return "";
    else if (hour >= 18 && hour < 22) return "";
    else return "您好";
}

// 設定 H1 標題
greeting.textContent = getGreetingH1() + "您已進入護理師與病人對話練習";

// ----------------------------
// 載入聊天歷史（首次進入顯示初始問候語，不顯示歷史）
// ----------------------------
let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];

// 無論有無歷史紀錄，都清空畫面（僅保留初始問候）
chatBox.innerHTML = "";

// 顯示初始問候語
const today = new Date();
const formattedDate = today.toLocaleDateString("zh-TW", {
    weekday: "short", year: "numeric", month: "2-digit", day: "2-digit"
});

// 初始問候語
const initialBotReply = `💬我是病人。【🌅 今天是 ${formattedDate} ${getBotGreetingText()}】。
（病人低頭不語，沒有眼神接觸...）`;

// 顯示訊息
appendMessage("assistant", initialBotReply);

// 儲存新的初始訊息到 localStorage
chatHistory = [{ role: "assistant", text: initialBotReply }];
localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

// ----------------------------
// ✅ 從伺服端載入 mockResponses
// ----------------------------
let mockResponses = [];

async function loadMockResponses() {
    try {
        const res = await fetch("http://localhost:3000/api/mockResponses");
        mockResponses = await res.json();
        console.log("✅ 已載入伺服端 mock_responses.json");
    } catch (err) {
        console.error("⚠️ 無法載入伺服端 mock_responses.json，使用預設資料：", err);
        mockResponses = [
            {
                keywords: [
                    { word: "你好", weight: 1 },
                    { word: "感覺", weight: 1 },
                    { word: "怎麼樣", weight: 1 }
                ],
                reply: "我... 我還好，護理師。你覺得我看起來還好嗎？"
            }
        ];
    }
}
loadMockResponses();


// ----------------------------
// 事件綁定
// ----------------------------
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    // 修正：當按下 Enter 鍵時呼叫 sendMessage
    if (e.key === "Enter") {
        sendMessage();
        e.preventDefault(); // 防止 Enter 鍵的預設行為（例如：換行）
    }
});

// ----------------------------
// 送出訊息
// ----------------------------
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    userInput.disabled = true;
    sendBtn.disabled = true;

    appendMessage("user", "👩‍⚕️ 你：" + message);
    userInput.value = "";

    const loadingMsg = appendMessage("assistant", "💭 病人正在思考中...");
    const dot = document.createElement("span");
    dot.classList.add("dot-pulse");
    loadingMsg.appendChild(dot);

    const mockStatus = document.getElementById("mock-status");
    if (mockStatus) mockStatus.textContent = "匹配個數：--/3（分析中）";

    const bestMatch = calculateBestMatch(message, mockResponses);
    let botReplyText = "";

    if (bestMatch.count >= 3) {
        botReplyText = "💬 病人：" + bestMatch.reply;
    } else if (bestMatch.count === 2) {
        botReplyText = "💬 病人：你...你是在暗示什麼嗎？我聽不懂。";
    } else if (bestMatch.count === 1) {
        const avoidReplies = [
            "（低頭，沉默不語...）",
            "（焦慮地環顧四周，沒有理會你...）",
            "（突然看向窗外，說：『今天天氣真好...』）"
        ];
        botReplyText = "💬 病人：" + avoidReplies[Math.floor(Math.random() * avoidReplies.length)];
    } else {
        // 🧠 無匹配，呼叫 Gemini 並學習
        const userMessage = message;
        let responseData = { reply: "" };

        try {
            const apiResponse = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=你的_API_KEY",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: "system",
                                parts: [{ text: SYSTEM_PROMPT }]
                            },
                            {
                                role: "user",
                                parts: [{ text: userMessage }]
                            }
                        ]
                    })
                }
            );

            const result = await apiResponse.json();
            let generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

            if (!generatedText || generatedText.length < 2) {
                const fallbackReplies = [
                    "你...你剛剛是不是也聽到了那個聲音？",
                    "我不知道...他們都不喜歡我。",
                    "你為什麼老是問這種問題？",
                    "我不想講這個，好嗎？",

                ];
                generatedText = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
            }

            responseData.reply = generatedText;
            botReplyText = "💬 病人：" + responseData.reply;

            // ✅ 自動學習：擷取關鍵字並存入伺服端 JSON
            const newKeywords = extractKeywords(userMessage);
            if (newKeywords.length >= 2 && generatedText.length > 5) {
                const isDuplicate = mockResponses.some(
                    (m) => m.reply === responseData.reply
                );
                if (!isDuplicate) {
                    mockResponses.push({
                        keywords: newKeywords,
                        reply: responseData.reply,
                        weight: 1
                    });

                    // 寫回伺服端 mock_responses.json
                    await fetch("http://localhost:3000/api/saveMockResponse", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(mockResponses)
                    });
                    console.log("✅ 已將新學習內容寫入伺服端 mock_responses.json");
                }
            }

        } catch (error) {
            console.error("Gemini API 錯誤:", error);
            botReplyText = "💬 病人：（焦慮地環顧四周）不要問了，好嗎？我什麼都沒做…真的！";
        }
    }

    // ---- 🧠 簡單關鍵字擷取 ----
    function extractKeywords(text) {
        return text
            .split(/[\s,，。.!！？?]/)
            .filter(w => w.length >= 2)
            .slice(0, 5)
            .map(word => ({ word: word, weight: 1 }));
    }

    loadingMsg.textContent = botReplyText;
    if (mockStatus) mockStatus.textContent = `匹配個數：${bestMatch.count}/3`;

    chatHistory.push({ role: "user", text: "👩‍⚕️ 你：" + message });
    chatHistory.push({ role: "assistant", text: botReplyText });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

    learnFromInteraction(message, bestMatch);

    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
}

// ----------------------------
// 將訊息加入畫面
// ----------------------------
function appendMessage(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("message-box");
    msg.classList.add(role === "user" ? "user" : "assistant");
    msg.textContent = text;
    chatBox.appendChild(msg);

    // 自動捲動
    setTimeout(() => {
        chatBoxWrapper.scrollTop = chatBoxWrapper.scrollHeight;
    }, 10);

    return msg;
}

// ----------------------------
// 清除對話
// ----------------------------
clearChatBtn.addEventListener("click", () => {
    if (!confirm("確定要清除所有對話紀錄並重新啟動對話嗎？")) return;

    // 清空前端聊天框
    chatBox.innerHTML = "";
    // 清空 localStorage
    chatHistory = [];
    localStorage.removeItem("chatHistory");

    const resetMsg = `【🌅 今天是 ${formattedDate} ${getBotGreetingText()}】。💬（病人低頭不語，沒有眼神接觸...）`;
    appendMessage("assistant", resetMsg);

    // 將初始訊息存入紀錄
    chatHistory.push({ role: "assistant", text: initialBotReply });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

    const mockStatus = document.getElementById("mock-status");
    if (mockStatus) mockStatus.textContent = "匹配個數：--/3（分析中）";

});


// ----------------------------
// ✅ 匹配邏輯與動態學習
// ----------------------------
function calculateBestMatch(input, mockData) {
    let best = { count: 0, reply: "……（病人沉默不語）", match: [] };
    mockData.forEach(item => {
        let count = 0;
        item.keywords.forEach(k => {
            if (input.includes(k.word)) count++;
        });
        if (count > best.count) {
            best = { count: count, reply: item.reply, match: item.keywords };
        }
    });
    return best;
}

// ----------------------------
// 模擬學習
// ----------------------------
function learnFromInteraction(input, matchResult) {
    if (!matchResult || !matchResult.match) return;
    matchResult.match.forEach(k => {
        if (input.includes(k.word)) k.weight += 1;
    });
    // 模擬存回 JSON（前端環境只能存 localStorage，實際可透過 API 存檔）
    localStorage.setItem("mockResponses", JSON.stringify(mockResponses));
}

// ----------------------------
// ✅ 匹配分數浮動區
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("mock-status")) {
        const mockStatus = document.createElement("div");
        mockStatus.id = "mock-status";
        mockStatus.textContent = "關鍵字匹配個數：--/--";;
        mockStatus.style.position = "absolute";
        mockStatus.style.right = "20px";
        mockStatus.style.top = "150px";
        mockStatus.style.background = "#eef2ff";
        mockStatus.style.color = "#1d4ed8";
        mockStatus.style.padding = "6px 10px";
        mockStatus.style.borderRadius = "20px";
        mockStatus.style.fontSize = "14px";
        mockStatus.style.fontWeight = "600";
        mockStatus.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
        mockStatus.style.transition = "top 0.5s ease";
        document.body.appendChild(mockStatus);

        // 讓分數隨捲動緩慢移動
        let targetY = 150;
        window.addEventListener("scroll", () => {
            targetY = window.scrollY + window.innerHeight / 2 - 30;
        });
        function smoothMove() {
            const currentY = parseFloat(mockStatus.style.top);
            const newY = currentY + (targetY - currentY) * 0.1;
            mockStatus.style.top = `${newY}px`;
            requestAnimationFrame(smoothMove);
        }
        smoothMove();
    }

    // dot-pulse loading CSS
    const style = document.createElement("style");
    style.textContent = `
    .dot-pulse {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #2563eb;
      animation: dotPulse 1s infinite linear;
      position: relative;
    }
    .dot-pulse::before, .dot-pulse::after {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #2563eb;
      position: absolute;
      left: 10px;
    }
    .dot-pulse::after {
      left: 20px;
    }
    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0); } 
      40% { transform: scale(1); }
    }`;
    document.head.appendChild(style);
});
