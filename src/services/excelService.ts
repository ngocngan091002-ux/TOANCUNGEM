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
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!json || json.length === 0) {
          resolve([]);
          return;
        }

        const parsedStudents: { full_name: string; email: string; phone?: string; student_code?: string }[] = [];

        // Bỏ qua hàng tiêu đề nếu có
        const firstRowStr = json[0] ? json[0].join(' ').toLowerCase() : '';
        const startRow = (firstRowStr.includes('tên') || firstRowStr.includes('email') || firstRowStr.includes('mã')) ? 1 : 0;

        for (let i = startRow; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          let full_name = '';
          let email = '';
          let phone = '';
          let student_code = '';

          // Quét thông minh từng ô trong hàng
          for (let j = 0; j < row.length; j++) {
            const cellVal = String(row[j] || '').trim();
            if (!cellVal) continue;

            if (cellVal.includes('@') && cellVal.includes('.')) {
              email = cellVal.toLowerCase();
            } else if (cellVal.match(/^0\d{8,10}$/)) {
              phone = cellVal;
            } else if (cellVal.startsWith('HS2026_') || cellVal.match(/^HS\d+/i)) {
              student_code = cellVal;
            } else if (!full_name && cellVal.length >= 2 && !cellVal.match(/^\d+$/) && !cellVal.toLowerCase().includes('tên') && cellVal !== '123456') {
              full_name = cellVal;
            }
          }

          // Fallback tên nếu ô chưa nhận diện được
          if (!full_name) {
            for (let j = 0; j < row.length; j++) {
              const cellVal = String(row[j] || '').trim();
              if (cellVal && !cellVal.includes('@') && cellVal !== '123456' && !cellVal.toLowerCase().includes('mã')) {
                full_name = cellVal;
                break;
              }
            }
          }

          if (!full_name || full_name.length < 2) continue;

          if (!email) {
            const unsignedName = full_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
            email = `${unsignedName}${Math.floor(100 + Math.random() * 900)}@toancungem.edu.vn`;
          }

          parsedStudents.push({
            full_name,
            email,
            phone,
            student_code: student_code || `HS2026_${parsedStudents.length + 1}`
          });
        }

        resolve(parsedStudents);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
