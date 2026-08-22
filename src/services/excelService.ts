import * as XLSX from 'xlsx';
import { UserProfile, LeaderboardEntry } from '../types';

export function exportClassToExcel(className: string, students: UserProfile[], leaderboard: LeaderboardEntry[] = []) {
  const data = students.map((s, index) => {
    const lb = leaderboard.find(l => l.student_id === s.id);
    return {
      'STT': index + 1,
      'Mã Học Sinh': s.student_code || `HS2026_${index + 1}`,
      'Họ và Tên': s.full_name,
      'Email / Tên đăng nhập': s.email,
      'Số điện thoại': s.phone || 'Chưa cập nhật',
      'Nhiệm vụ hoàn thành': lb ? lb.tasks_completed : 0,
      'Điểm Bài tập': lb ? lb.assignment_score : 0,
      'Điểm Kiểm tra': lb ? lb.test_score : 0,
      'Tổng điểm tích lũy': lb ? lb.total_points : 0,
      'Xếp hạng': lb ? lb.rank : 'N/A'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách lớp');

  // Đặt độ rộng cột
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 10 }
  ];

  XLSX.writeFile(workbook, `Danh_Sach_Lop_${className.replace(/\s+/g, '_')}.xlsx`);
}

export function parseStudentExcel(file: File): Promise<{ full_name: string; email: string; phone?: string; student_code?: string }[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length <= 1) {
          resolve([]);
          return;
        }

        // Đọc header hàng 0
        const headers: string[] = json[0].map((h: any) => String(h).toLowerCase().trim());
        
        const nameIdx = headers.findIndex(h => h.includes('tên') || h.includes('họ') || h.includes('name'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('thư') || h.includes('tài khoản'));
        const phoneIdx = headers.findIndex(h => h.includes('thoại') || h.includes('sđt') || h.includes('phone'));
        const codeIdx = headers.findIndex(h => h.includes('mã') || h.includes('code') || h.includes('stt'));

        const parsedStudents: { full_name: string; email: string; phone?: string; student_code?: string }[] = [];

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : String(row[0] || '').trim();
          let email = emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '';

          if (!name) continue;

          if (!email) {
            // Tự tạo email giả lập chuẩn nếu chỉ có tên
            const unsignedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
            email = `${unsignedName}${Math.floor(100 + Math.random() * 900)}@toancungem.edu.vn`;
          }

          parsedStudents.push({
            full_name: name,
            email: email,
            phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
            student_code: codeIdx !== -1 ? String(row[codeIdx] || '').trim() : `HS2026_${i}`
          });
        }

        resolve(parsedStudents);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
