-- The party list was missing the two parties a committee actually deals with
-- most after the owner: the tenant living in the lot, and the building manager.
-- Without them both were being filed as "Other", which is how all 8 existing
-- contacts ended up there.
alter type public.corr_party_type add value if not exists 'resident_tenant';
alter type public.corr_party_type add value if not exists 'building_manager';

-- 'agent' is ambiguous in strata: it reads as a real-estate agent, a letting
-- agent or the strata manager's agent. The one meant here is the managing agent
-- of a tenanted lot. Renaming the value rather than only its label keeps the
-- stored data honest, and it is free: zero contacts currently use 'agent'
-- (verified before running, all 8 are 'other'), and RENAME VALUE rewrites the
-- label in place so any future row follows automatically.
alter type public.corr_party_type rename value 'agent' to 'managing_agent';

comment on type public.corr_party_type is
  'External parties a building corresponds with. Display order and labels live in CORR_PARTY in ResidentPortal.jsx; enum sort order here is historical and not used for display.';
