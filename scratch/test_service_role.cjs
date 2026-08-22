const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvhpxgczjmzwahidabzy.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRpc() {
  console.log('Testing RPC or direct table disable RLS via REST...');
  
  // Can Service Role client perform inserts to profiles & class_members? YES!
  // Because Service Role key BYPASSES RLS completely!
  
  // Test Service Role insertion:
  const testStudentId = crypto.randomUUID();
  const classId = '38546e64-1664-4fed-b1ca-82fbe5e2d194'; // Lớp Hai 4

  const { data: pData, error: pErr } = await supabase
    .from('profiles')
    .upsert({
      id: testStudentId,
      email: 'servicerole_test@toancungem.edu.vn',
      full_name: 'Test Service Role',
      role: 'student',
      status: 'approved'
    });
  console.log('Service Role Profile Upsert Error:', pErr);

  const { data: mData, error: mErr } = await supabase
    .from('class_members')
    .upsert({
      class_id: classId,
      student_id: testStudentId
    });
  console.log('Service Role Class Member Upsert Error:', mErr);

  // Clean up
  await supabase.from('class_members').delete().eq('student_id', testStudentId);
  await supabase.from('profiles').delete().eq('id', testStudentId);
}

testRpc();
