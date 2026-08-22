const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvhpxgczjmzwahidabzy.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminAccount() {
  const email = 'ngocngan091002@gmail.com';
  const newPassword = '12345678';

  console.log(`Checking user ${email}...`);

  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('List users error:', listError);
    return;
  }

  const existingUser = usersData.users.find(u => u.email?.toLowerCase() === email);

  if (existingUser) {
    console.log(`Found existing user ${existingUser.id}. Updating password & confirming email...`);
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          full_name: 'Quản Trị Viên Ngọc Ngân',
          role: 'admin',
          status: 'approved'
        }
      }
    );

    if (updateError) {
      console.error('Update user error:', updateError);
    } else {
      console.log('Successfully updated password to 12345678 and confirmed email!');
    }

    // Upsert profile in DB
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: existingUser.id,
      email: email,
      full_name: 'Quản Trị Viên Ngọc Ngân',
      role: 'admin',
      status: 'approved'
    });
    if (profileErr) console.error('Profile upsert error:', profileErr);
    else console.log('Profile row successfully updated in public.profiles!');

  } else {
    console.log(`User ${email} not found. Creating new user...`);
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Quản Trị Viên Ngọc Ngân',
        role: 'admin',
        status: 'approved'
      }
    });

    if (createError) {
      console.error('Create user error:', createError);
    } else {
      console.log('Successfully created user with password 12345678!');
      // Upsert profile
      await supabaseAdmin.from('profiles').upsert({
        id: createData.user.id,
        email: email,
        full_name: 'Quản Trị Viên Ngọc Ngân',
        role: 'admin',
        status: 'approved'
      });
    }
  }
}

resetAdminAccount();
