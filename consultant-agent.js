/**
 * HikoBaby Consultant Agent
 * Flow: user question -> retrieval from brain.db.json -> answer with brand voice -> return result
 *
 * Usage example:
 * const brain = await fetch("./brain.db.json").then((r) => r.json());
 * const result = createConsultantAgent(brain).reply("Sản phẩm có đau không? Giá bao nhiêu?");
 * console.log(result.answer);
 */

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function computeRelevance(query, entry) {
  const q = normalizeText(query);
  const subject = normalizeText(entry["Câu hỏi/Chủ đề"]);
  const details = normalizeText(entry["Nội dung chi tiết"]);
  const notes = normalizeText(entry["Lưu ý khi tư vấn"]);

  const queryTokens = q.split(" ").filter((t) => t.length > 1);
  const uniqueTokens = [...new Set(queryTokens)];

  let score = 0;
  for (const token of uniqueTokens) {
    if (subject.includes(token)) score += 3;
    if (details.includes(token)) score += 2;
    if (notes.includes(token)) score += 1;
  }

  // Bonus when subject almost directly matches query intent.
  if (subject.includes(q) || q.includes(subject)) score += 5;
  return score;
}

function detectIntent(question) {
  const q = normalizeText(question);
  const buyIntentKeywords = [
    "gia",
    "bao nhieu",
    "mua",
    "chot",
    "dat hang",
    "ship",
    "uu dai",
    "giam gia",
    "voucher",
    "can gap",
    "ngay hom nay",
  ];
  return {
    isBuyingIntent: containsAny(q, buyIntentKeywords),
  };
}

function retrieveKnowledge(question, brain, topK = 3) {
  const knowledge = Array.isArray(brain?.knowledge) ? brain.knowledge : [];
  const scored = knowledge
    .map((entry) => ({ entry, score: computeRelevance(question, entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

function findSalesScriptByLeadLevel(brain, leadLevel) {
  const map = {
    hot: "Mẫu tin nhắn cho nhóm Hot",
    warm: "Mẫu tin nhắn cho nhóm Warm",
    cold: "Mẫu tin nhắn cho nhóm Cold",
  };
  const target = map[(leadLevel || "").toLowerCase()];
  if (!target) return null;

  return (brain.knowledge || []).find(
    (entry) =>
      normalizeText(entry["Câu hỏi/Chủ đề"]) === normalizeText(target)
  );
}

function findGeneralClosingScript(brain) {
  return (brain.knowledge || []).find((entry) =>
    normalizeText(entry["Câu hỏi/Chủ đề"]).includes(
      normalizeText("Kịch bản chốt tư vấn")
    )
  );
}

function buildBrandVoiceAnswer(question, hits, options = {}) {
  const { isBuyingIntent } = detectIntent(question);
  const isExternal = !!options.isExternal;
  const style = options.style || "detailed"; // "detailed" or "concise"

  if (!hits.length) {
    return {
      answer:
        "Mình chưa thấy thông tin này trong bộ tri thức hiện tại nên chưa dám trả lời để tránh sai. Bạn cho mình cập nhật thêm nội dung vào brain.db rồi mình sẽ tư vấn chính xác ngay.",
      usedKnowledge: [],
      confidence: "low",
    };
  }

  const leadLevel = options.leadLevel || (isBuyingIntent ? "hot" : "warm");
  const brain = options.brain;
  const salesScript =
    findSalesScriptByLeadLevel(brain, leadLevel) || findGeneralClosingScript(brain);

  const keyPoints = hits.map((h) => h.entry["Nội dung chi tiết"]);
  const consultNotes = hits.map((h) => h.entry["Lưu ý khi tư vấn"]);

  // Brand voice: practical, concise, professional, no fluffy language.
  let answer = "";
  
  if (isExternal) {
    if (style === "concise") {
      // Version 2: Super short (3 bullet points + 1 closing)
      const briefPoints = keyPoints.slice(0, 3).map(p => {
        // Simple heuristic to shorten: take first sentence or first 60 chars
        const firstSentence = p.split(/[.!?]/)[0];
        return `- ${firstSentence.trim()}`;
      });
      answer = briefPoints.join("\n");
      
      if (isBuyingIntent && salesScript) {
        // Shorten the closing script too for concise version
        const shortClosing = salesScript["Nội dung chi tiết"].split(/[.!?]/)[0];
        answer += `\n\n👉 ${shortClosing}. Em hỗ trợ mình luôn nhé?`;
      } else {
        answer += `\n\n👉 Anh/chị cần em tư vấn thêm gì không ạ?`;
      }
    } else {
      // Version 1: Detailed (Current)
      answer = keyPoints.join("\n\n");
      if (isBuyingIntent && salesScript) {
        answer += `\n\n${salesScript["Nội dung chi tiết"]}`;
      }
    }
    
    // Clean up placeholders
    answer = answer
      .replace(/anh\/chị \{\{ten_khach\}\}/g, "anh/chị")
      .replace(/\{\{ten_khach\}\}/g, "anh/chị")
      .replace(/\{\{van_de\}\}/g, "nhu cầu của mình");
  } else {
    // Internal version: includes labels and notes for Admin
    answer =
      `Mình trả lời nhanh theo đúng dữ liệu trong hệ thống HikoBaby:\n` +
      keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n");

    if (consultNotes.length) {
      answer += `\n\nLưu ý tư vấn:\n` + consultNotes.map((n) => `- ${n}`).join("\n");
    }

    if (isBuyingIntent && salesScript) {
      answer += `\n\nĐề xuất chốt đơn:\n${salesScript["Nội dung chi tiết"]}`;
    }
  }

  return {
    answer,
    usedKnowledge: hits.map((h) => ({
      topic: h.entry["Câu hỏi/Chủ đề"],
      score: h.score,
    })),
    confidence: hits[0].score >= 8 ? "high" : "medium",
  };
}

function createConsultantAgent(brain) {
  if (!brain || !Array.isArray(brain.knowledge)) {
    throw new Error("brain data is invalid. Expected object with knowledge[]");
  }

  return {
    /**
     * @param {string} question - Customer message/question
     * @param {{ leadLevel?: "hot"|"warm"|"cold", topK?: number }} options
     */
    reply(question, options = {}) {
      const topK = Number.isInteger(options.topK) ? options.topK : 3;
      const hits = retrieveKnowledge(question, brain, topK);
      return buildBrandVoiceAnswer(question, hits, {
        ...options,
        brain,
      });
    },
  };
}

// Support browser and Node usage.
if (typeof window !== "undefined") {
  window.createConsultantAgent = createConsultantAgent;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createConsultantAgent };
}

