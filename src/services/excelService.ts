import * as XLSX from 'xlsx';
import { UserProfile, LeaderboardEntry } from '../types';

export function exportClassToExcel(className: string, students: UserProfile[], leaderboard: LeaderboardEntry[] = []) {
  let data: any[] = [];

  if (!students || students.length === 0) {
    // Nếu lớp chưa có học sinh, tự động tạo Tiêu đề cột và Dữ liệu mẫu để Giáo viên xem/nhập liệu
    data = [
      {
        'STT': 1,
        'Mã Học Sinh': 'HS2026_01',
        'Họ và Tên': 'Nguyễn Văn An (Mẫu)',
        'Email / Tên đăng nhập': 'an.nguyen@toancungem.edu.vn',
        'Số điện thoại': '0901234567',
        'Nhiệm vụ hoàn thành': 0,
        'Điểm Bài tập': 0,
        'Điểm Kiểm tra': 0,
        'Tổng điểm tích lũy': 0,
        'Xếp hạng': 'N/A'
      },
      {
        'STT': 2,
        'Mã Học Sinh': 'HS2026_02',
        'Họ và Tên': 'Trần Thị Bình (Mẫu)',
        'Email / Tên đăng nhập': 'binh.tran@toancungem.edu.vn',
        'Số điện thoại': '0907654321',
        'Nhiệm vụ hoàn thành': 0,
        'Điểm Bài tập': 0,
        'Điểm Kiểm tra': 0,
        'Tổng điểm tích lũy': 0,
        'Xếp hạng': 'N/A'
      }
    ];
  } else {
    data = students.map((s, index) => {
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
  }

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

  XLSX.writeFile(workbook, `Danh_Sach_Lop_${(className || 'Moi').replace(/\s+/g, '_')}.xlsx`);
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
        
        // Nhận diện cột chuẩn xác
        let nameIdx = headers.findIndex(h => h === 'họ và tên' || h === 'họ tên' || h === 'tên học sinh' || h === 'ho va ten' || h === 'name' || h === 'full_name');
        if (nameIdx === -1) {
          nameIdx = headers.findIndex(h => (h.includes('họ') && h.includes('tên')) || (h.includes('tên') && !h.includes('đăng nhập') && !h.includes('mã')));
        }
        if (nameIdx === -1) {
          nameIdx = 2; // Default to Column C (Họ và Tên)
        }

        let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('thư') || h.includes('tài khoản'));
        if (emailIdx === -1) emailIdx = 3; // Default to Column D

        let phoneIdx = headers.findIndex(h => h.includes('điện thoại') || h.includes('sđt') || h.includes('phone'));
        if (phoneIdx === -1) phoneIdx = 4; // Default to Column E

        let codeIdx = headers.findIndex(h => h === 'mã học sinh' || h === 'mã hs' || h === 'ma hoc sinh' || (h.includes('mã') && !h.includes('tên')));
        if (codeIdx === -1) codeIdx = 1; // Default to Column B

        const parsedStudents: { full_name: string; email: string; phone?: string; student_code?: string }[] = [];

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          let rawName = String(row[nameIdx] || '').trim();
          let rawEmail = String(row[emailIdx] || '').trim();
          let rawPhone = String(row[phoneIdx] || '').trim();
          let rawCode = String(row[codeIdx] || '').trim();

          // Nếu name bị nhầm với mã học sinh (VD: HS2026_01), fallback sang cột C
          if (!rawName || rawName.startsWith('HS2026_') || rawName.match(/^HS\d+/i)) {
            rawName = String(row[2] || row[1] || '').trim();
          }

          if (!rawName) continue;

          if (!rawEmail) {
            // Tự tạo email giả lập chuẩn nếu không có email
            const unsignedName = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
            rawEmail = `${unsignedName}${Math.floor(100 + Math.random() * 900)}@toancungem.edu.vn`;
          }

          parsedStudents.push({
            full_name: rawName,
            email: rawEmail,
            phone: rawPhone,
            student_code: rawCode || `HS2026_${i}`
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
