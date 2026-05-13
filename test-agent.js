const path = require('path');
// Khi nằm cùng thư mục, ta dùng require trực tiếp
const { createConsultantAgent } = require('./consultant-agent.js');
const brain = require('./brain.db.json');

const agent = createConsultantAgent(brain);

const testCases = [
    // Batch 1: Cơ bản
    { name: "Giá cả", input: "Sản phẩm giá bao nhiêu?" },
    { name: "Vệ sinh", input: "Cách vệ sinh máy như thế nào?" },
    { name: "Trẻ sơ sinh", input: "Bé 1 tháng tuổi dùng được không?" },
    { name: "Rác (Gibberish)", input: "asdfghjkl" },
    { name: "Rỗng", input: "" },
    
    // Batch 2: Phức tạp
    { name: "Lỗi chính tả", input: "Sản phẩn có rễ sử dụng không?" },
    { name: "Độ tuổi cụ thể", input: "Bé nhà mình 10 tháng, nên dùng đầu hút nào?" },
    { name: "Tiệt trùng", input: "Dùng nước sôi luộc đầu silicone được không?" },
    { name: "Xuất xứ (Ngoài tri thức)", input: "Sản phẩm của nước nào?" },
    
    // Batch 3: Từ khóa ngắn & Lóng
    { name: "Từ khóa ngắn", input: "hút mũi" },
    { name: "Giá (Tiếng lóng)", input: "mấy tiền" },
    { name: "Lời chào", input: "tư vấn giúp mình" }
];

console.log("🚀 Bắt đầu kiểm thử tự động Agent...\n");

const results = testCases.map((tc, index) => {
    console.log(`--- Test #${index + 1}: ${tc.name} ---`);
    console.log(`Input: "${tc.input}"`);
    try {
        const res = agent.reply(tc.input, { isExternal: true, style: 'detailed' });
        
        console.log(`[Phản hồi]: ${res.answer.substring(0, 100).replace(/\n/g, ' ')}...`);
        console.log(`Độ tin cậy: ${res.confidence}`);
        console.log("-----------------------------------\n");
        
        return { "Tên Test": tc.name, "Trạng thái": "SUCCESS", "Tin cậy": res.confidence };
    } catch (error) {
        console.error(`❌ LỖI tại Test #${index + 1}:`, error.message);
        return { "Tên Test": tc.name, "Trạng thái": "ERROR", "Lỗi": error.message };
    }
});

console.log("📊 TỔNG KẾT KIỂM THỬ:");
console.table(results);
console.log("\n✅ Bạn có thể thêm các trường hợp mới vào mảng testCases trong file này để mở rộng bộ test.");
