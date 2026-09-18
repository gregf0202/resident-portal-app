-- 0018_permit_unit_number_from_submission
--
-- issue_parking_permit() derived unit_number FROM the units register via
-- applications.unit_id. Where unit_id is null (no register entry, or an empty
-- details.unit) the permit was created with unit_number NULL and permit-pdf
-- printed "UNIT#" with nothing after it. Both existing production permits
-- (PP-0001, PP-0002) are in that state.
--
-- The register cannot be the source of truth: only 2 of 12 production
-- buildings have any units rows, and no unit_people row has user_id set, so
-- the app cannot look a submitter's unit up.
--
-- Inverted here. The unit number the submitter typed is authoritative and is
-- what prints. The register is consulted two ways, both best-effort, neither
-- able to block issue: to set unit_id when the typed number matches (which
-- links the permit into Unit Search), and as a fallback for unit_number when
-- nothing was typed. No validation added -- the committee sees the unit on
-- the approval card before approving, which is where the human check sits.
--
-- Duplicate guard, PP-NNNN numbering and the permit_issued notification are
-- carried over unchanged.

create or replace function public.issue_parking_permit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_no          text;
  v_unit_number text;
  v_unit_id     uuid;
begin
  if tg_op = 'UPDATE' and new.category = 'parking_permit'
     and new.status = 'approved' and old.status is distinct from 'approved' then

    if exists (select 1 from parking_permits where application_id = new.id) then
      return new;
    end if;

    v_unit_number := nullif(btrim(coalesce(new.details->>'unit', '')), '');
    v_unit_id     := new.unit_id;

    -- bonus, never blocking: link to the register when the typed number matches
    if v_unit_id is null and v_unit_number is not null then
      select id into v_unit_id
      from units
      where building_id = new.building_id
        and lower(unit_number) = lower(v_unit_number)
      limit 1;
    end if;

    -- fallback only: nothing typed, but already linked to a unit
    if v_unit_number is null and v_unit_id is not null then
      select unit_number into v_unit_number from units where id = v_unit_id;
    end if;

    select 'PP-' || lpad((count(*) + 1)::text, 4, '0') into v_no
    from parking_permits where building_id = new.building_id;

    insert into parking_permits (
      building_id, unit_id, application_id, permit_no, unit_number,
      vehicle_make, vehicle_model, vehicle_colour, vehicle_rego,
      date_from, date_to, approved_by, approval_date
    ) values (
      new.building_id, v_unit_id, new.id, v_no, v_unit_number,
      new.details->>'vehicle_make', new.details->>'vehicle_model',
      new.details->>'vehicle_colour', new.details->>'vehicle_rego',
      nullif(new.details->>'date_from','')::date, nullif(new.details->>'date_to','')::date,
      new.decided_by, coalesce(new.decided_at::date, current_date)
    );

    insert into app_notifications (building_id, recipient_user_id, kind, ref_table, ref_id, title, body)
    values (new.building_id, new.submitted_by, 'permit_issued', 'parking_permits', v_no,
            'Parking permit ' || v_no || ' issued',
            'Your parking permit is ready to download from your application.');
  end if;

  return new;
end $function$;
