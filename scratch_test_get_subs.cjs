const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://pvhpxgczjmzwahidabzy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU');

const isUuid = (id) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function testGetSubmissions(email, studentCode, name) {
  console.log(`=== TESTING FOR: email=${email}, code=${studentCode}, name=${name} ===`);
  
  // 1. Tìm tất cả profiles của học sinh này
  const { data: profs } = await client.from('profiles').select('id, email, student_code, full_name');
  const matchedProfs = profs?.filter(p => 
    (email && p.email && p.email.toLowerCase() === email.toLowerCase()) ||
    (studentCode && p.student_code && p.student_code.toUpperCase() === studentCode.toUpperCase()) ||
    (name && p.full_name && p.full_name.trim().toLowerCase() === name.trim().toLowerCase())
  ) || [];

  const uuidSet = new Set();
  matchedProfs.forEach(p => {
    if (isUuid(p.id)) uuidSet.add(p.id);
  });

  console.log('Matched Student UUIDs:', Array.from(uuidSet));

  const uuidList = Array.from(uuidSet);
  if (uuidList.length > 0) {
    const { data: subs, error } = await client
      .from('assignment_submissions')
      .select('*, assignment:assignments(*)')
      .in('student_id', uuidList);

    console.log('Found Submissions:', subs?.length, 'Error:', error);
    if (subs && subs.length > 0) {
      console.table(subs.map(s => ({ id: s.id, assignment_title: s.assignment?.title, score: s.score, status: s.status })));
    }
  }
}

testGetSubmissions('nhungtranthikim2024@gmail.com', 'HS2026_04', 'Huỳnh Vũ Bảo Ân');
