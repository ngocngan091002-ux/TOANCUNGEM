const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvhpxgczjmzwahidabzy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDMyNjQsImV4cCI6MjEwMjk3OTI2NH0.tRm7IGUDsLl8nu82jl1GOi520eJjNoSiA4eoYnCAXak';

const supabase = createClient(supabaseUrl, anonKey);

async function testClientImport() {
  console.log('--- TESTING ANON CLIENT INSERT TO PROFILES & CLASS_MEMBERS ---');

  const testStudentId = '00000000-0000-0000-0000-000000000088';
  const classId = '38546e64-1664-4fed-b1ca-82fbe5e2d194'; // Lớp Hai 4

  // 1. Insert Profile
  const { data: pData, error: pErr } = await supabase
    .from('profiles')
    .insert([{
      id: testStudentId,
      email: 'anon_test_student@toancungem.edu.vn',
      full_name: 'Học Sinh Thử Nghiệm',
      role: 'student',
      status: 'approved'
    }]);

  console.log('Anon Profile Insert Error:', pErr);

  // 2. Insert Class Member
  const { data: mData, error: mErr } = await supabase
    .from('class_members')
    .insert([{
      class_id: classId,
      student_id: testStudentId
    }]);

  console.log('Anon Class Member Insert Error:', mErr);
}

testClientImport();
