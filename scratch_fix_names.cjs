const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://pvhpxgczjmzwahidabzy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU');

// ROSTER MẪU HỌ THIỆN ĐẦY ĐỦ CHO TẤT CẢ 33 HỌC SINH LỚP HAI 4
const STUDENT_ROSTER = [
  { code: 'HS2026_01', name: 'Huỳnh Phương Bảo Anh', email: 'hs2026_01@gmail.com' },
  { code: 'HS2026_02', name: 'Nguyễn Lâm Lan Anh', email: 'hs2026_02@gmail.com' },
  { code: 'HS2026_03', name: 'Phạm Diệp Anh', email: 'hs2026_03@gmail.com' },
  { code: 'HS2026_04', name: 'Huỳnh Vũ Bảo Ân', email: 'hs2026_04@gmail.com' },
  { code: 'HS2026_05', name: 'Phạm Quốc Bình', email: 'hs2026_05@gmail.com' },
  { code: 'HS2026_06', name: 'Nguyễn Thị Mỹ Duyên', email: 'hs2026_06@gmail.com' },
  { code: 'HS2026_07', name: 'Lê Phạm Bảo Đăng', email: 'hs2026_07@gmail.com' },
  { code: 'HS2026_08', name: 'Vũ Hải Đăng', email: 'hs2026_08@gmail.com' },
  { code: 'HS2026_09', name: 'Nguyễn Tiến Đạt', email: 'hs2026_09@gmail.com' },
  { code: 'HS2026_10', name: 'Lê Minh Đức', email: 'hs2026_10@gmail.com' },
  { code: 'HS2026_11', name: 'Lê Trần Giang', email: 'hs2026_11@gmail.com' },
  { code: 'HS2026_12', name: 'Nguyễn Trọng Hiếu', email: 'hs2026_12@gmail.com' },
  { code: 'HS2026_13', name: 'Trần Nhật Huy', email: 'hs2026_13@gmail.com' },
  { code: 'HS2026_14', name: 'Võ Ngô Quang Huy', email: 'hs2026_14@gmail.com' },
  { code: 'HS2026_15', name: 'Đinh Gia Hưng', email: 'hs2026_15@gmail.com' },
  { code: 'HS2026_16', name: 'Đỗ Cao Bảo Khang', email: 'hs2026_16@gmail.com' },
  { code: 'HS2026_17', name: 'Dương Trọng Khôi', email: 'hs2026_17@gmail.com' },
  { code: 'HS2026_18', name: 'Ngô Tuấn Kiệt', email: 'hs2026_18@gmail.com' },
  { code: 'HS2026_19', name: 'Nguyễn Hoàng Kiệt', email: 'hs2026_19@gmail.com' },
  { code: 'HS2026_20', name: 'Đặng Hoàng Khánh Như', email: 'hs2026_20@gmail.com' },
  { code: 'HS2026_21', name: 'Đặng Ngọc Quỳnh Như', email: 'hs2026_21@gmail.com' },
  { code: 'HS2026_22', name: 'Huỳnh Thị Ý Như', email: 'hs2026_22@gmail.com' },
  { code: 'HS2026_23', name: 'Trần Dương Thanh Ngọc', email: 'hs2026_23@gmail.com' },
  { code: 'HS2026_24', name: 'Phan Thành Phát', email: 'hs2026_24@gmail.com' },
  { code: 'HS2026_25', name: 'Lê Đăng Phong', email: 'hs2026_25@gmail.com' },
  { code: 'HS2026_26', name: 'Huỳnh Hữu Phước', email: 'hs2026_26@gmail.com' },
  { code: 'HS2026_27', name: 'Nguyễn Trần Hồng Phúc', email: 'hs2026_27@gmail.com' },
  { code: 'HS2026_28', name: 'Trương Võ Tấn Phát', email: 'hs2026_28@gmail.com' },
  { code: 'HS2026_29', name: 'Nguyễn Hữu Tín', email: 'hs2026_29@gmail.com' },
  { code: 'HS2026_30', name: 'Huỳnh Như Ý', email: 'hs2026_30@gmail.com' },
  { code: 'HS2026_31', name: 'Lê Thị Hoàng Yến', email: 'hs2026_31@gmail.com' },
  { code: 'HS2026_32', name: 'Phạm Ngọc Hải Yến', email: 'hs2026_32@gmail.com' },
  { code: 'HS2026_33', name: 'Võ Nguyễn Hoàng Yến', email: 'hs2026_33@gmail.com' }
];

async function runFix() {
  console.log('=== KÍCH HOẠT CHUẨN HÓA TÊN THẬT CHO TẤT CẢ HỌC SINH LỚP HAI 4 ===');
  
  const { data: allProfiles, error: err } = await client.from('profiles').select('*');
  if (err) {
    console.error('Lỗi đọc profiles:', err);
    return;
  }

  console.log(`Đã tìm thấy ${allProfiles.length} bản ghi profiles trong CSDL.`);

  let updatedCount = 0;
  for (const st of STUDENT_ROSTER) {
    const codeUpper = st.code.toUpperCase();
    const emailLower = st.email.toLowerCase();

    // Tìm tất cả các profile khớp mã hoặc email
    const matches = allProfiles.filter(p => 
      (p.student_code && p.student_code.toUpperCase() === codeUpper) ||
      (p.email && p.email.toLowerCase() === emailLower)
    );

    if (matches.length > 0) {
      for (const m of matches) {
        if (m.full_name !== st.name) {
          console.log(`[UPDATE] Đổi tên từ "${m.full_name}" -> "${st.name}" (Email: ${m.email}, Code: ${m.student_code})`);
          await client.from('profiles').update({ 
            full_name: st.name,
            student_code: st.code,
            email: m.email || st.email
          }).eq('id', m.id);
          updatedCount++;
        }
      }
    } else {
      console.log(`[INSERT] Tạo mới profile chuẩn cho ${st.name} (${st.code})`);
      await client.from('profiles').insert([{
        email: st.email,
        student_code: st.code,
        full_name: st.name,
        role: 'student',
        status: 'approved'
      }]);
      updatedCount++;
    }
  }

  console.log(`=== HOÀN THÀNH CHUẨN HÓA TÊN THẬT HỌC SINH 100% (${updatedCount} BẢN GHI ĐÃ ĐƯỢC ĐỒNG BỘ) ===`);
}

runFix();
