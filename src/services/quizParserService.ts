import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { QuestionOption } from '../types';

export interface ParsedQuestion {
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice';
  difficulty?: 'easy' | 'medium' | 'hard';
  options: QuestionOption[];
  correct_answers: string[];
  selected?: boolean;
}

/**
 * Trích xuất toàn bộ văn bản từ file (Word .docx, Excel .xlsx/.csv, Text .txt)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. Xử lý File Word (.docx, .doc)
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Thử dùng mammoth giải mã trước
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }

      // Fallback: Nếu mammoth trả về rỗng, tự đọc thẻ <w:t> trong XML của file .docx
      const xmlFallbackText = extractXmlTextFallback(arrayBuffer);
      if (xmlFallbackText && xmlFallbackText.trim().length > 0) {
        return xmlFallbackText;
      }
    } catch (e: any) {
      console.warn('Mammoth exception, switching to XML fallback parser:', e);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const xmlFallbackText = extractXmlTextFallback(arrayBuffer);
        if (xmlFallbackText && xmlFallbackText.trim().length > 0) {
          return xmlFallbackText;
        }
      } catch (err) {}
    }
  }

  // 2. Xử lý File Excel (.xlsx, .xls, .csv)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Thử đọc dạng JSON rows trước
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);
      if (jsonRows && jsonRows.length > 0) {
        const parsedFromSheet = parseExcelRowsToQuestions(jsonRows);
        if (parsedFromSheet.length > 0) {
          return '__EXCEL_JSON__' + JSON.stringify(parsedFromSheet);
        }
      }

      // Fallback: Chuyển sheet sang dạng plain text
      const textContent = XLSX.utils.sheet_to_txt(worksheet);
      if (textContent && textContent.trim().length > 0) {
        return textContent;
      }
    } catch (e: any) {
      console.warn('Lỗi đọc file Excel qua XLSX:', e);
    }
  }

  // 3. Xử lý File Văn bản thuần (.txt, .md, .json) hoặc fallback đọc FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve((event.target?.result as string) || '');
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

/**
 * Trích xuất các đoạn văn bản trong thẻ <w:t> từ file .docx nếu mammoth bị lỗi
 */
function extractXmlTextFallback(buffer: ArrayBuffer): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const matches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/gi);
    if (matches && matches.length > 0) {
      const extracted = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      return extracted;
    }
  } catch (e) {}
  return '';
}

/**
 * Phân tích các hàng dữ liệu từ Excel thành danh sách câu hỏi chuẩn
 */
function parseExcelRowsToQuestions(rows: any[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const qKey = keys.find(k => /câu\s*hỏi|question|đề\s*bài|nội\s*dung/i.test(k)) || keys[0];
    const optAKey = keys.find(k => /^a$|đáp\s*án\s*a|phương\s*án\s*a/i.test(k));
    const optBKey = keys.find(k => /^b$|đáp\s*án\s*b|phương\s*án\s*b/i.test(k));
    const optCKey = keys.find(k => /^c$|đáp\s*án\s*c|phương\s*án\s*c/i.test(k));
    const optDKey = keys.find(k => /^d$|đáp\s*án\s*d|phương\s*án\s*d/i.test(k));
    const correctKey = keys.find(k => /đáp\s*án\s*đúng|correct|đáp\s*án/i.test(k));

    const qText = String(row[qKey] || '').trim();
    if (!qText) return;

    const optA = optAKey ? String(row[optAKey] || '').trim() : '';
    const optB = optBKey ? String(row[optBKey] || '').trim() : '';
    const optC = optCKey ? String(row[optCKey] || '').trim() : '';
    const optD = optDKey ? String(row[optDKey] || '').trim() : '';

    let correctOpt = correctKey ? String(row[correctKey] || '').trim().toUpperCase() : 'A';
    if (!['A', 'B', 'C', 'D'].includes(correctOpt)) {
      if (correctOpt.includes('A')) correctOpt = 'A';
      else if (correctOpt.includes('B')) correctOpt = 'B';
      else if (correctOpt.includes('C')) correctOpt = 'C';
      else if (correctOpt.includes('D')) correctOpt = 'D';
      else correctOpt = 'A';
    }

    const options: QuestionOption[] = [
      { id: 'A', text: optA || 'Đáp án A' },
      { id: 'B', text: optB || 'Đáp án B' },
      { id: 'C', text: optC || 'Đáp án C' },
      { id: 'D', text: optD || 'Đáp án D' },
    ];

    questions.push({
      question_text: qText.replace(/^câu\s*\d+\s*:\s*/i, ''),
      question_type: 'single_choice',
      difficulty: 'medium',
      options,
      correct_answers: [correctOpt],
      selected: true
    });
  });

  return questions;
}

/**
 * Hàm phân tích cú pháp thông minh chuyển văn bản thô thành danh sách câu hỏi & đáp án thực tế
 */
export function parseQuestionsFromRawText(rawText: string): ParsedQuestion[] {
  if (!rawText || rawText.trim().length === 0) return [];

  // Nếu là dữ liệu JSON Excel đã phân tích trước
  if (rawText.startsWith('__EXCEL_JSON__')) {
    try {
      const jsonStr = rawText.replace('__EXCEL_JSON__', '');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  const questions: ParsedQuestion[] = [];
  let currentQText = '';
  let currentOptionsMap: Record<string, string> = {};
  let currentCorrectAnswer = 'A';
  let hasFoundFirstQuestionMarker = false;

  const finalizeCurrentQuestion = () => {
    if (!currentQText.trim()) return;

    let cleanQHeading = currentQText.trim();

    // Làm sạch đầu dòng (xóa nhãn "Câu 1:", "Bài 1:" nếu có)
    cleanQHeading = cleanQHeading.replace(/^(?:câu|bài|câu\s*hỏi|question)\s*\d+[\:\.]?\s*/i, '');

    // Chuẩn hóa 4 lựa chọn A, B, C, D
    const options: QuestionOption[] = [
      { id: 'A', text: currentOptionsMap['A'] || '' },
      { id: 'B', text: currentOptionsMap['B'] || '' },
      { id: 'C', text: currentOptionsMap['C'] || '' },
      { id: 'D', text: currentOptionsMap['D'] || '' }
    ];

    // Kiểm tra xem câu hỏi có đáp án được bóc tách từ file hay không
    const hasOptionsFromDocument = options.some(o => o.text.trim().length > 0);

    if (!hasOptionsFromDocument) {
      // Nếu không tìm thấy phương án A, B, C, D trong câu hỏi, thử tự tính toán phép toán nếu là toán Lớp 2
      const mathMatch = cleanQHeading.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
      if (mathMatch) {
        const num1 = parseInt(mathMatch[1], 10);
        const op = mathMatch[2];
        const num2 = parseInt(mathMatch[3], 10);
        let ans = 0;
        if (op === '+') ans = num1 + num2;
        else if (op === '-') ans = num1 - num2;
        else if (op === '*') ans = num1 * num2;
        else if (op === '/') ans = Math.floor(num1 / num2);

        options[0] = { id: 'A', text: String(ans) };
        options[1] = { id: 'B', text: String(ans + 2) };
        options[2] = { id: 'C', text: String(Math.max(0, ans - 3)) };
        options[3] = { id: 'D', text: String(ans + 5) };
        currentCorrectAnswer = 'A';
      } else {
        options[0] = { id: 'A', text: 'Đáp án A' };
        options[1] = { id: 'B', text: 'Đáp án B' };
        options[2] = { id: 'C', text: 'Đáp án C' };
        options[3] = { id: 'D', text: 'Đáp án D' };
      }
    } else {
      // Đảm bảo các lựa chọn trống được điền thông tin hợp lý
      options.forEach(opt => {
        if (!opt.text.trim()) opt.text = `Phương án ${opt.id}`;
      });
    }

    questions.push({
      question_text: cleanQHeading,
      question_type: 'single_choice',
      difficulty: 'medium',
      options,
      correct_answers: [currentCorrectAnswer],
      selected: true
    });

    // Reset state cho câu hỏi tiếp theo
    currentQText = '';
    currentOptionsMap = {};
    currentCorrectAnswer = 'A';
  };

  // Pattern nhận diện bắt đầu câu hỏi mới: "Câu 1:", "Câu 2.", "Bài 1:", "Bài 2.", "1.", "2." ở đầu dòng
  const questionMarkerRegex = /^(?:câu|bài|câu\s*hỏi|question)\s*(\d+)[\:\.]?|^\b(\d+)[\.\)]\s+/i;
  // Pattern nhận diện đáp án đơn: "A. 23", "B) 18", "C: 28", "D/ 12", "*A. 23"
  const singleOptionRegex = /^[\*✓\s]*([A-D])[\.\)\/\:]\s*(.+)/i;
  // Pattern nhận diện đáp án đúng: "Đáp án: A", "ĐÁP ÁN ĐÚNG: B"
  const answerKeyRegex = /^(?:đáp\s*án|đáp\s*án\s*đúng|kết\s*quả|key)[\:\s]*([A-D])/i;

  lines.forEach(line => {
    // 1. Kiểm tra dòng đáp án đúng (ví dụ: "Đáp án: A")
    const ansMatch = line.match(answerKeyRegex);
    if (ansMatch) {
      currentCorrectAnswer = ansMatch[1].toUpperCase();
      return;
    }

    // 2. Kiểm tra các phương án nằm chung 1 dòng (ví dụ: "A. 23   B. 18   C. 28   D. 12")
    const inlineMatches = Array.from(line.matchAll(/([A-D])[\.\)\/\:]\s*([^\n\rABCD\.\)\/\:]+?)(?=\s+[A-D][\.\)\/\:]|$)/gi));
    if (inlineMatches && inlineMatches.length >= 2) {
      inlineMatches.forEach(m => {
        const letter = m[1].toUpperCase();
        const text = m[2].trim();
        if (text) {
          currentOptionsMap[letter] = text;
        }
      });
      return;
    }

    // 3. Kiểm tra dòng phương án đơn (ví dụ: "A. 23" hoặc "B) 18")
    const optMatch = line.match(singleOptionRegex);
    if (optMatch) {
      const optLetter = optMatch[1].toUpperCase();
      const optText = optMatch[2].trim();
      currentOptionsMap[optLetter] = optText;

      if (line.startsWith('*') || line.includes('✓')) {
        currentCorrectAnswer = optLetter;
      }
      return;
    }

    // 4. Kiểm tra dòng bắt đầu câu hỏi mới (ví dụ: "Câu 1: ...")
    const qMatch = line.match(questionMarkerRegex);
    if (qMatch) {
      hasFoundFirstQuestionMarker = true;
      if (currentQText) {
        finalizeCurrentQuestion();
      }
      currentQText = line;
      return;
    }

    // 5. Nếu chưa gặp nhãn "Câu 1:" đầu tiên mà là tiêu đề file (ví dụ "BÀI TẬP CUỐI TUẦN 2"), bỏ qua không tạo thành câu hỏi
    if (!hasFoundFirstQuestionMarker) {
      // Bỏ qua dòng tiêu đề tài liệu ở đầu file
      return;
    }

    // 6. Nối nội dung câu hỏi nhiều dòng
    if (!currentQText) {
      currentQText = line;
    } else {
      currentQText += ' ' + line;
    }
  });

  // Chốt câu hỏi cuối cùng trong file
  if (currentQText) {
    finalizeCurrentQuestion();
  }

  return questions;
}
