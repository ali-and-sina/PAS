select
  u.id,
  u.phone as auth_phone,
  u.phone_confirmed_at,
  u.role as auth_role,
  p.role as profile_role,
  p.full_name,
  p.phone as profile_phone,
  dp.medical_license_number,
  dp.is_verified
from auth.users u
join public.profiles p
  on p.id = u.id
left join public.doctor_profiles dp
  on dp.id = u.id
where p.role = 'doctor'
  and dp.medical_license_number = '12345';


select
  has_schema_privilege(
    'authenticated',
    'public',
    'USAGE'
  ) as authenticated_schema_usage,

  has_table_privilege(
    'authenticated',
    'public.profiles',
    'SELECT'
  ) as profiles_select,

  has_table_privilege(
    'authenticated',
    'public.doctor_profiles',
    'SELECT'
  ) as doctor_profiles_select;