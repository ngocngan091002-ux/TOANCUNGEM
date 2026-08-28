const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://pvhpxgczjmzwahidabzy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU');

async function checkSubs() {
  const { data: subs, error } = await client.from('assignment_submissions').select('*');
  console.log('Error:', error);
  console.log('Total Submissions in DB:', subs?.length);
  if (subs) {
    console.table(subs.map(s => ({ id: s.id, assignment_id: s.assignment_id, student_id: s.student_id, score: s.score, status: s.status })));
  }
}

checkSubs();
