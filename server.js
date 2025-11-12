import express from "express";
import fs from "fs";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ 提供前端靜態檔案
app.use(express.static("public"));

// ✅ Gemini API 金鑰（請自行設定環境變數）
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

// ✅ 模擬資料檔案路徑
const MOCK_FILE = "./data/mock_responses.json";

/* -------------------------------------------------
   1️⃣ 提供 mockResponses 給前端使用
--------------------------------------------------- */
app.get("/api/mockResponses", (req, res) => {
    try {
        if (fs.existsSync(MOCK_FILE)) {
            const data = fs.readFileSync(MOCK_FILE, "utf-8");
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error("讀取 mock_responses.json 失敗:", err);
        res.status(500).json({ error: "讀取 mock_responses.json 失敗" });
    }
});

/* -------------------------------------------------
   2️⃣ 接收前端學習後的 mockResponses，寫回 JSON
--------------------------------------------------- */
app.post("/api/saveMockResponse", (req, res) => {
    try {
        const mockResponses = req.body;
        fs.writeFileSync(MOCK_FILE, JSON.stringify(mockResponses, null, 2), "utf-8");
        console.log("✅ 已寫入 mock_responses.json");
        res.json({ success: true });
    } catch (err) {
        console.error("寫入 mock_responses.json 失敗:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* -------------------------------------------------
   3️⃣ Gemini 代理 API（AI 自動回覆病人角色）
--------------------------------------------------- */
app.post("/api/gemini", async (req, res) => {
    const { userMessage, systemPrompt } = req.body;

    const payload = {
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    try {
        const apiResponse = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await apiResponse.json();
        const generatedText =
            result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            "（沉默...）";

        res.json({ reply: generatedText });
    } catch (err) {
        console.error("Gemini API 錯誤:", err);
        res.status(500).json({
            reply: "（焦慮地環顧四周）那個聲音...又來了..."
        });
    }
});

/* -------------------------------------------------
   4️⃣ 備用的 CRUD API（可手動管理 mock）
--------------------------------------------------- */
app.get("/mocks", (req, res) => {
    if (fs.existsSync(MOCK_FILE)) {
        const data = fs.readFileSync(MOCK_FILE, "utf-8");
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

app.post("/mocks", (req, res) => {
    const { message, reply } = req.body;
    if (!message || !reply)
        return res.status(400).json({ success: false, message: "缺少 message 或 reply" });

    const keywords = message.split(",").map(w => ({ word: w.trim(), weight: 1 }));
    let mocks = fs.existsSync(MOCK_FILE)
        ? JSON.parse(fs.readFileSync(MOCK_FILE, "utf-8"))
        : [];

    mocks.push({ keywords, reply });
    fs.writeFileSync(MOCK_FILE, JSON.stringify(mocks, null, 2), "utf-8");
    res.json({ success: true });
});

// 🧩 2️⃣ 儲存 mock_responses.json
app.post("/api/saveMock", (req, res) => {
    const { mockResponses } = req.body;
    try {
        fs.writeFileSync(MOCK_FILE, JSON.stringify(mockResponses, null, 2), "utf-8");
        res.json({ status: "ok" });
    } catch (err) {
        console.error("寫入 mock_responses.json 失敗:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// 🧩 3️⃣ mock 管理 API（必須放在 app.listen 之前）
app.get("/mocks", (req, res) => {
    if (fs.existsSync(MOCK_FILE)) {
        const data = fs.readFileSync(MOCK_FILE, "utf-8");
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});


// 取得所有 mock
app.get("/mocks", (req, res) => {
    if (fs.existsSync(MOCK_FILE)) {
        const data = fs.readFileSync(MOCK_FILE, "utf-8");
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

// 新增 mock
app.post("/mocks", (req, res) => {
    const { message, reply } = req.body;
    if (!message || !reply) {
        return res.status(400).json({ success: false, message: "缺少 message 或 reply" });
    }

    const keywords = message.split(",").map(word => ({ word: word.trim(), weight: 1 }));
    let mocks = [];
    if (fs.existsSync(MOCK_FILE)) {
        mocks = JSON.parse(fs.readFileSync(MOCK_FILE, "utf-8"));
    }
    mocks.push({ keywords, reply });
    fs.writeFileSync(MOCK_FILE, JSON.stringify(mocks, null, 2), "utf-8");

    res.json({ success: true });
});

// 更新 mock
app.put("/mocks/:idx", (req, res) => {
    const { idx } = req.params;
    const { keywords, reply } = req.body;
    if (!keywords || !reply) {
        return res.status(400).json({ success: false, message: "缺少 keywords 或 reply" });
    }

    let mocks = [];
    if (fs.existsSync(MOCK_FILE)) {
        mocks = JSON.parse(fs.readFileSync(MOCK_FILE, "utf-8"));
    }

    if (!mocks[idx]) {
        return res.status(404).json({ success: false, message: "mock 不存在" });
    }

    mocks[idx] = { keywords, reply };
    fs.writeFileSync(MOCK_FILE, JSON.stringify(mocks, null, 2), "utf-8");

    res.json({ success: true });
});

// 刪除 mock
app.delete("/mocks/:idx", (req, res) => {
    const { idx } = req.params;
    let mocks = [];
    if (fs.existsSync(MOCK_FILE)) {
        mocks = JSON.parse(fs.readFileSync(MOCK_FILE, "utf-8"));
    }

    if (!mocks[idx]) {
        return res.status(404).json({ success: false, message: "mock 不存在" });
    }

    mocks.splice(idx, 1);
    fs.writeFileSync(MOCK_FILE, JSON.stringify(mocks, null, 2), "utf-8");

    res.json({ success: true });
});

/* -------------------------------------------------
   5️⃣ 啟動伺服器
--------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🌅 自殺評估會談練習已啟動成功：http://localhost:${PORT}`)
);
