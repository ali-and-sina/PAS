create or replace function private.pas_is_provider_operator(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null and exists(
    select 1
    from public.pas_provider_memberships m
    join public.pas_provider_registry p on p.id=m.provider_id
    where m.provider_id=p_provider_id
      and m.profile_id=auth.uid()
      and m.status='active'
      and p.status='active'
      and m.role_in_provider in ('owner','manager','operator')
  )
$function$;

create or replace function private.pas_issue_referral_qr_token(
  p_referral_id uuid,p_token_hash text,p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_provider_id uuid; v_status text; v_token_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid QR token hash' using errcode='22023';
  end if;
  if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '7 days' then
    raise exception 'Referral QR expiry must be within seven days' using errcode='22023';
  end if;
  select provider_id,status into v_provider_id,v_status
  from public.pas_execution_referrals where id=p_referral_id for update;
  if not found or v_status in ('rejected','cancelled','finalized') then
    raise exception 'Referral is not active for QR issuance' using errcode='23514';
  end if;
  if not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to issue QR' using errcode='42501';
  end if;
  update public.pas_referral_qr_tokens set revoked_at=now()
  where referral_id=p_referral_id and revoked_at is null and expires_at>now();
  insert into public.pas_referral_qr_tokens(referral_id,token_hash,issued_by,expires_at)
  values(p_referral_id,p_token_hash,v_actor,p_expires_at) returning id into v_token_id;
  insert into public.pas_referral_events(
    prescription_id,referral_id,event_type,actor_profile_id,actor_kind,metadata
  )
  select r.prescription_id,r.id,'qr.issued',v_actor,'provider',
    jsonb_build_object('token_id',v_token_id,'expires_at',p_expires_at)
  from public.pas_execution_referrals r where r.id=p_referral_id;
  return v_token_id;
end
$function$;

create or replace function private.pas_revoke_referral_qr_token(p_referral_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_provider_id uuid; v_count integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select provider_id into v_provider_id from public.pas_execution_referrals where id=p_referral_id;
  if not found or not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to revoke QR' using errcode='42501';
  end if;
  update public.pas_referral_qr_tokens set revoked_at=now()
  where referral_id=p_referral_id and revoked_at is null;
  get diagnostics v_count=row_count;
  insert into public.pas_referral_events(
    prescription_id,referral_id,event_type,actor_profile_id,actor_kind,metadata
  )
  select r.prescription_id,r.id,'qr.revoked',v_actor,'provider',
    jsonb_build_object('revoked_count',v_count)
  from public.pas_execution_referrals r where r.id=p_referral_id;
  return v_count;
end
$function$;

create or replace function private.pas_respond_to_referral(
  p_referral_id uuid,p_decision text,p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_provider_id uuid; v_status text; v_next text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_decision not in ('accept','reject','cancel') then
    raise exception 'Invalid referral response' using errcode='22023';
  end if;
  if p_note is not null and length(p_note)>2000 then
    raise exception 'Referral response note is too long' using errcode='22023';
  end if;
  select provider_id,status into v_provider_id,v_status
  from public.pas_execution_referrals where id=p_referral_id for update;
  if not found or not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to respond to referral' using errcode='42501';
  end if;
  if v_status<>'assigned' then
    raise exception 'Only an assigned referral can be accepted, rejected or cancelled' using errcode='23514';
  end if;
  v_next:=case p_decision when 'accept' then 'accepted' when 'reject' then 'rejected' else 'cancelled' end;
  if p_decision in ('reject','cancel') then
    update public.pas_execution_referral_items
    set item_status=case when p_decision='reject' then 'rejected' else 'cancelled' end,
        response_note=p_note
    where referral_id=p_referral_id and item_status='assigned';
  end if;
  update public.pas_execution_referrals
  set status=v_next,response_note=p_note,
      accepted_at=case when p_decision='accept' then now() else accepted_at end,
      rejected_at=case when p_decision='reject' then now() else rejected_at end,
      cancelled_at=case when p_decision='cancel' then now() else cancelled_at end
  where id=p_referral_id and status='assigned';
  return jsonb_build_object('referral_id',p_referral_id,'status',v_next);
end
$function$;

create or replace function private.pas_update_referral_item(
  p_referral_item_id uuid,p_next_status text,p_completed_quantity numeric default null,p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_provider_id uuid; v_item public.pas_execution_referral_items%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_next_status not in ('accepted','in_progress','partially_completed','completed','rejected','cancelled') then
    raise exception 'Invalid referral item status' using errcode='22023';
  end if;
  if p_note is not null and length(p_note)>1000 then
    raise exception 'Referral item note is too long' using errcode='22023';
  end if;
  select ri.* into v_item from public.pas_execution_referral_items ri
  where ri.id=p_referral_item_id for update;
  if not found then raise exception 'Referral item not found' using errcode='P0002'; end if;
  select r.provider_id into v_provider_id from public.pas_execution_referrals r
  where r.id=v_item.referral_id;
  if not found or not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to update referral item' using errcode='42501';
  end if;
  update public.pas_execution_referral_items
  set item_status=p_next_status,
      completed_quantity=coalesce(p_completed_quantity,completed_quantity),
      response_note=p_note
  where id=p_referral_item_id;
  return jsonb_build_object(
    'referral_item_id',p_referral_item_id,'referral_id',v_item.referral_id,
    'item_status',(select ri.item_status from public.pas_execution_referral_items ri where ri.id=p_referral_item_id),
    'completed_quantity',(select ri.completed_quantity from public.pas_execution_referral_items ri where ri.id=p_referral_item_id)
  );
end
$function$;

create or replace function private.pas_finalize_referral_result(p_result_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_result public.pas_referral_results%rowtype;
        v_referral public.pas_execution_referrals%rowtype; v_next_status text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_result from public.pas_referral_results where id=p_result_id for update;
  if not found or v_result.status<>'submitted' then
    raise exception 'Only a submitted result may be finalized' using errcode='23514';
  end if;
  if not private.pas_is_provider_operator(v_result.provider_id) then
    raise exception 'Provider operator permission required to finalize result' using errcode='42501';
  end if;
  v_next_status:=case when v_result.version_number>1 then 'amended' else 'final' end;
  update public.pas_referral_results
  set status=v_next_status,finalized_by=v_actor,finalized_at=now(),published_at=now()
  where id=p_result_id;
  select * into v_referral from public.pas_execution_referrals where id=v_result.referral_id for update;
  if v_result.version_number=1 and v_referral.status='result_submitted' then
    update public.pas_execution_referrals set status='finalized' where id=v_referral.id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'provider.result.finalized','pas_referral_results',p_result_id,
    jsonb_build_object('provider_id',v_result.provider_id,'referral_id',v_result.referral_id,'status',v_next_status));
  return jsonb_build_object(
    'result_id',p_result_id,'status',v_next_status,'published_at',now(),
    'referral_status',(select r.status from public.pas_execution_referrals r where r.id=v_result.referral_id)
  );
end
$function$;

revoke all on function private.pas_is_provider_operator(uuid) from public,anon,authenticated;
revoke all on function private.pas_issue_referral_qr_token(uuid,text,timestamptz) from public,anon;
revoke all on function private.pas_revoke_referral_qr_token(uuid) from public,anon;
revoke all on function private.pas_respond_to_referral(uuid,text,text) from public,anon;
revoke all on function private.pas_update_referral_item(uuid,text,numeric,text) from public,anon;
revoke all on function private.pas_finalize_referral_result(uuid) from public,anon;
