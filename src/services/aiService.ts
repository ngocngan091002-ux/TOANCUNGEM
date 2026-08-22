import { AIWeaknessSummary } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// 1. Trợ lý AI cho Học sinh
export async function askAIMathAssistant(userQuestion: string, conversationHistory: { role: 'user' | 'model'; content: string }[] = []): Promise<string> {
  if (!GEMINI_API_KEY) {
    return getFallbackStudentResponse(userQuestion);
  }

  try {
    const systemPrompt = `Bạn là Trợ lý Toán học thông minh, thân thiện dành riêng cho Học sinh lớp 2 (khoảng 7-8 tuổi).
Quy tắc trả lời:
- Luôn xưng "Thầy/Cô AI" hoặc "Anh/Chị Toán Học" và gọi học sinh là "Em" hoặc "Bạn nhỏ".
- Dùng ngôn ngữ đơn giản, vui tươi, sử dụng biểu tượng cảm xúc (🌟, ✏️, 🍎, 🐻, 🎈).
- Hướng dẫn phương pháp giải từng bước một, đặt câu hỏi gợi mở.
- KHÔNG làm bài hộ hoặc cho ngay đáp án bài kiểm tra, mà hãy gợi ý học sinh tự tư duy.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...conversationHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
          { role: 'user', parts: [{ text: userQuestion }] }
        ]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return getFallbackStudentResponse(userQuestion);
  } catch (error) {
    console.error('AI Student Assistant Error:', error);
    return getFallbackStudentResponse(userQuestion);
  }
}

// Fallback Trợ lý Học sinh thông minh khi chưa nhập Gemini Key
function getFallbackStudentResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('cộng') || q.includes('+')) {
    return '🌟 Chào em! Để thực hiện phép cộng số có hai chữ số, em hãy nhớ đặt tính thẳng cột: hàng đơn vị cộng với hàng đơn vị, hàng chục cộng với hàng chục nhé! Em thử tự tính xem ra bao nhiêu nào? ✏️';
  }
  if (q.includes('trừ') || q.includes('-')) {
    return '🎈 Phép trừ rất dễ nè! Em lấy số lớn trừ số nhỏ ở hàng đơn vị trước, sau đó trừ tiếp hàng chục nhé. Có chỗ nào em chưa rõ không nè? 🐻';
  }
  if (q.includes('nhân') || q.includes('x') || q.includes('*')) {
    return '🍎 Trong chương trình Toán lớp 2, chúng mình bắt đầu học Bảng nhân 2 và Bảng nhân 5 đó! Ví dụ: 2 x 3 nghĩa là số 2 được lấy 3 lần (2 + 2 + 2 = 6). Em hãy đọc thuộc bảng nhân nhé! 🚀';
  }
  return `🤖 Chào em! Trợ lý Toán rất vui được đồng hành cùng em. Với câu hỏi "${question}", em hãy nhớ đọc kỹ đề bài, xác định xem bài toán hỏi gì và cho biết điều gì nhé! Em hãy bấm thử phép tính cho thầy/cô xem nào! ✨`;
}

// 2. Giáo viên: Gợi ý tạo bài tập Toán lớp 2
export async function suggestGrade2Questions(topic: string, count: number = 3): Promise<any[]> {
  if (!GEMINI_API_KEY) {
    return getFallbackGrade2Questions(topic, count);
  }

  try {
    const prompt = `Hãy tạo ${count} câu hỏi trắc nghiệm Toán lớp 2 theo chủ đề "${topic}".
Trả về định dạng JSON array chuẩn:
[
  {
    "question_text": "Nội dung câu hỏi",
    "options": [
      {"id": "a", "text": "Đáp án A"},
      {"id": "b", "text": "Đáp án B"},
      {"id": "c", "text": "Đáp án C"},
      {"id": "d", "text": "Đáp án D"}
    ],
    "correct_answers": ["a"],
    "points": 10
  }
]
Chỉ trả về JSON thuần túy, không kèm Markdown hay chú thích.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return getFallbackGrade2Questions(topic, count);
  }
}

function getFallbackGrade2Questions(topic: string, count: number): any[] {
  return [
    {
      question_text: `Tính kết quả của phép tính: 35 + 24 = ? (Chủ đề: ${topic})`,
      options: [
        { id: 'a', text: '59' },
        { id: 'b', text: '58' },
        { id: 'c', text: '69' },
        { id: 'd', text: '60' }
      ],
      correct_answers: ['a'],
      points: 10
    },
    {
      question_text: 'Mẹ mua 15 quả cam, bé ăn 4 quả. Hỏi mẹ còn lại bao nhiêu quả cam?',
      options: [
        { id: 'a', text: '10 quả' },
        { id: 'b', text: '11 quả' },
        { id: 'c', text: '12 quả' },
        { id: 'd', text: '9 quả' }
      ],
      correct_answers: ['b'],
      points: 10
    },
    {
      question_text: 'Số lớn nhất có 2 chữ số khác nhau là số nào?',
      options: [
        { id: 'a', text: '99' },
        { id: 'b', text: '98' },
        { id: 'c', text: '90' },
        { id: 'd', text: '10' }
      ],
      correct_answers: ['b'],
      points: 10
    }
  ].slice(0, count);
}

// 3. Giáo viên: Gợi ý Chấm bài & Nhận xét phù hợp với kết quả thực tế
export async function suggestGradingAndRemark(score: number, totalQuestions: number, wrongCount: number): Promise<{ suggestedScore: number; remark: string }> {
  let remark = '';
  if (score >= 90) {
    remark = '🌟 Em làm bài rất xuất sắc! Đạt điểm tối đa, kiến thức rất vững vàng. Tiếp tục phát huy nhé!';
  } else if (score >= 70) {
    remark = `👍 Em làm bài khá tốt (sai ${wrongCount} câu). Cần cẩn thận hơn ở các phép tính có nhớ để đạt điểm 10 tuyệt đối nhé!`;
  } else if (score >= 50) {
    remark = `✏️ Em đã cố gắng hoàn thành bài tập (đúng ${totalQuestions - wrongCount}/${totalQuestions} câu). Em nên xem lại bài giảng và nhờ giáo viên hướng dẫn thêm phần làm sai nhé!`;
  } else {
    remark = `💪 Em chưa đạt kết quả tốt bài này (sai ${wrongCount} câu). Đừng nản lòng, em hãy ôn lại bảng cộng trừ và nhờ Trợ lý AI hỗ trợ giải thích lại các câu sai nhé!`;
  }

  return {
    suggestedScore: score,
    remark
  };
}

// 4. Giáo viên: AI Tổng hợp những nội dung học sinh còn yếu dựa trên dữ liệu làm sai thực tế
export async function analyzeStudentWeaknesses(wrongQuestions: { questionText: string; studentAnswer: string; correctAnswer: string }[]): Promise<AIWeaknessSummary> {
  if (wrongQuestions.length === 0) {
    return {
      student_id: '',
      student_name: '',
      weak_topics: ['Không có'],
      summary_notes: 'Học sinh nắm chắc toàn bộ kiến thức trong các câu hỏi đã làm!',
      wrong_count: 0
    };
  }

  const topics: string[] = [];
  wrongQuestions.forEach(w => {
    const q = w.questionText.toLowerCase();
    if (q.includes('cộng') || q.includes('+')) topics.push('Phép cộng có nhớ trong phạm vi 100');
    if (q.includes('trừ') || q.includes('-')) topics.push('Phép trừ có nhớ trong phạm vi 100');
    if (q.includes('nhân') || q.includes('x')) topics.push('Bảng nhân 2 và Bảng nhân 5');
    if (q.includes('hình') || q.includes('tam giác') || q.includes('chữ nhật')) topics.push('Nhận biết các hình phẳng & Đo độ dài');
    if (q.includes('lớn nhất') || q.includes('nhỏ nhất') || q.includes('chữ số')) topics.push('So sánh và lập số có 2 chữ số');
  });

  const uniqueTopics = Array.from(new Set(topics));
  if (uniqueTopics.length === 0) uniqueTopics.push('Tính toán cơ bản & Bài toán có lời văn');

  return {
    student_id: '',
    student_name: '',
    weak_topics: uniqueTopics,
    summary_notes: `Dựa trên thực tế ${wrongQuestions.length} câu học sinh đã làm sai: Cần tập trung luyện lại: ${uniqueTopics.join(', ')}.`,
    wrong_count: wrongQuestions.length
  };
}
