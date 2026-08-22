const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvhpxgczjmzwahidabzy.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testBatchImport33Students() {
  console.log('--- TESTING BATCH IMPORT FOR LỚP HAI 4 ---');

  const classId = '38546e64-1664-4fed-b1ca-82fbe5e2d194'; // Lớp Hai 4

  // Sample 33 students list
  const sample33Students = [];
  for (let i = 1; i <= 33; i++) {
    sample33Students.push({
      full_name: `Học Sinh Mẫu ${i}`,
      email: `hocsinh_lop2_4_${i}@toancungem.edu.vn`,
      student_code: `HS2026_${i < 10 ? '0' + i : i}`,
      phone: `09000000${i < 10 ? '0' + i : i}`
    });
  }

  // 1. Batch Upsert Profiles using supabaseAdmin
  const profilesToUpsert = sample33Students.map(s => ({
    id: crypto.randomUUID(),
    email: s.email,
    full_name: s.full_name,
    role: 'student',
    status: 'approved',
    student_code: s.student_code,
    phone: s.phone
  }));

  const { data: pData, error: pErr } = await supabaseAdmin
    .from('profiles')
    .upsert(profilesToUpsert, { onConflict: 'email' });

  console.log('Batch Profiles Upsert Error:', pErr);

  // 2. Query IDs
  const emails = sample33Students.map(s => s.email);
  const { data: createdProfiles, error: fErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .in('email', emails);

  console.log('Fetched Profiles Count:', createdProfiles ? createdProfiles.length : 0);

  if (createdProfiles && createdProfiles.length > 0) {
    const memberRows = createdProfiles.map(p => ({
      class_id: classId,
      student_id: p.id
    }));

    const { error: mErr } = await supabaseAdmin
      .from('class_members')
      .upsert(memberRows, { onConflict: 'class_id,student_id' });

    console.log('Batch Class Members Upsert Error:', mErr);
  }

  // Verify class members count for Lớp Hai 4
  const { data: members, error: memErr } = await supabaseAdmin
    .from('class_members')
    .select('*, student:profiles(*)')
    .eq('class_id', classId);

  console.log('🎉 TOTAL STUDENTS NOW IN LỚP HAI 4:', members ? members.length : 0);
}

testBatchImport33Students();
