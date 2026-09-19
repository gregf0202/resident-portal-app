-- 0023_curve_walkthrough_ingest.sql
-- Curve Birtinya: the register's opening state, ingested from the two paper walkarounds.
--
-- Three historical walk records are created for the paper walks (30 Jun, 5 Aug, 2 Sep 2026)
-- and marked issued. The three NaloHub trial walks already in the table are left alone.
--
-- Closed findings are INSERTED as closed rather than updated, so the committee-verification
-- guard is not bypassed: it fires on UPDATE. closed_by is left null because these closures come
-- from the 5 August photo record, not from a verification made in the app.
--
-- Re-runnable: findings are keyed on (building_id, ref).

insert into public.walkthroughs (building_id, walk_date, attendees, status, summary, issued_at)
select * from (values
  ('ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid,'2026-06-30'::date,'Body Corporate Committee and Building Manager','issued',
   'Baseline walkaround. Photographed condition record used as the comparison point for the 5 August report.','2026-06-30T09:00:00+10:00'::timestamptz),
  ('ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid,'2026-08-05'::date,'Body Corporate Committee and Building Manager','issued',
   'Photo comparison against the 30 June baseline, with spot checks through late July and early August. Approximately 60 observations.','2026-08-05T09:00:00+10:00'::timestamptz),
  ('ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid,'2026-09-02'::date,'Stephen McMillan, Claire Johansson, Phil Heiniger, Kathy Lyons','issued',
   'Tabular walkaround. Approximately 45 items.','2026-09-02T09:00:00+10:00'::timestamptz)
) as v(bid, wd, att, st, sum, iss)
 where not exists (select 1 from public.walkthroughs x
                    where x.building_id = v.bid and x.walk_date = v.wd and x.status = 'issued');

-- findings ------------------------------------------------------------------
insert into public.walkthrough_findings
  (building_id, ref, class, section_id, location, observation, required_outcome, owner,
   due_date, status, risk_rating, first_raised_walk_id, first_raised_on, closed_walk_id,
   closed_at, standard_is_general)
select 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid, v.ref, v.cls, s.id, v.loc, v.obs, v.outcome, v.owner,
       null::date, v.status, v.risk,
       (select id from public.walkthroughs
         where building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid and walk_date = v.raised_walk and status = 'issued'),
       v.raised,
       case when v.status = 'closed' then
         (select id from public.walkthroughs where building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid
           and walk_date = '2026-08-05' and status = 'issued') end,
       case when v.status = 'closed' then v.closed_on::timestamptz end,
       false
  from (values
  ('CB-0001','S','Car Parks, Driveways and Entrances','Visitor car park, bin area','Green algae on surface','Algae removed','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0002','S','Recreation Deck: Pool and Spa','Pool gate','Gate and surrounds required cleaning','Cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0003','S','General Areas, Common Property Toilets and Store Rooms','Letterboxes','Peeling tape and general soiling','Tape removed, cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0004','S','Car Parks, Driveways and Entrances','Basement car park, bay 502','Rubbish dumped in bay','Rubbish removed','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0005','S','General Areas, Common Property Toilets and Store Rooms','Basement car park near 502','Bird droppings','Cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0006','S','Rubbish Collection and Refuse Rooms','East Tower refuse roller door','Roller door required cleaning','Cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0007','S','Car Parks, Driveways and Entrances','Walkway stairs from basement exit under gym','Green algae on wall','Algae removed','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-27'::date),
  ('CB-0008','S','Car Parks, Driveways and Entrances','Exit from basement under gym','Required cleaning','Cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-27'::date),
  ('CB-0009','S','Fire Safety and Emergency Egress','East Tower fire exit stairs','Dirt present for several weeks','Dirt removed','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0010','S','Entrances, Reception Foyers and Lifts','East Tower entrance wall','Fingerprints on wall','Fingerprints removed','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0011','S','Recreation Deck: BBQ and Outdoor Areas','Artificial grass area','Area required cleaning','Improved on inspection','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-07-28'::date),
  ('CB-0012','S','Gymnasium','Gym, floor outside gym','Floor mark present since April','Mark cleaned','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-08-30'::date),
  ('CB-0013','S','Plant, Services and Infrastructure','Basement services room','Tiles required cleaning','Tiles cleaner on inspection','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-08-05'::date),
  ('CB-0014','G','Lawns, Gardens and Pathways','Gardens, Prosperity Drive and Mantra Esplanade','Re-mulching required','Mulching completed; condition noted as good','BM','closed',null,'2026-06-30'::date,'2026-06-30'::date,'2026-08-05'::date),
  ('CB-0015','L',null,'Unit 504, balcony','Resident raised cracked fascia as a safety concern','BM report provided; assessed as safe','BM','closed',null,'2026-08-05'::date,'2026-08-05'::date,'2026-09-02'::date),
  ('CB-0016','G','Plant, Services and Infrastructure','West and East Tower lifts','West tower lift returns to Ground after each use; wear and tear queried','Kone advised no additional wear; no action required','Phil H','closed',null,'2026-09-02'::date,'2026-09-02'::date,'2026-09-02'::date),
  ('CB-0017','S','Car Parks, Driveways and Entrances','Visitor car park','Green algae and tile build-up across the car park surface (7 photo frames)','Surface free of algae and build-up','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0018','S','Entrances, Reception Foyers and Lifts','West Tower entrance','Entry tiles soiled; dirt line visible; mat replaced while tiles still wet','Tiles clean, dry before mats are replaced','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0019','R','Entrances, Reception Foyers and Lifts','West Tower entrance','Door soiled; hinge rust','Door clean, hinges free of rust','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0020','S','Entrances, Reception Foyers and Lifts','East Tower entrance','Entrance tiles and door marked; recorded as no visible improvement at 28 Jul','Tiles and door clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0021','R','Fire Safety and Emergency Egress','Fire booster cabinet','Rust on door frames; recorded as no visible action at 28 Jul and no visible improvement at 5 Aug','Rust removed, frames treated','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0022','S','Entrances, Reception Foyers and Lifts','Basement lift foyer','Tiles require cleaning; recorded as no visible improvement at 28 Jul','Tiles clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0023','R','Plant, Services and Infrastructure','Basement services room','Door soiled with suspected mould or mildew; no visible improvement at 5 Aug','Door cleaned and treated','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0024','S','General Areas, Common Property Toilets and Store Rooms','West Tower rooftop common property','Area requires cleaning. Unit 702 agreed at an earlier walk that the BM could use their tap; no contact had been made as at 5 Aug','Area cleaned; access arranged with Unit 702','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0025','R','Gymnasium','Gymnasium','Rust on equipment; recorded as no visible cleaning or rust removal at 28 Jul','Equipment free of rust','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0026','R','Plant, Services and Infrastructure','Electrical switchboard room','Floor soiled; equipment rust and dirt; door requires cleaning','Room, equipment and door clean; rust removed','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0027','S','Plant, Services and Infrastructure','Communications room','Loose dirt removed; floor still to be wiped as at 5 Aug','Floor wiped and clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0028','S','Car Parks, Driveways and Entrances','Basement exit onto Prosperity Drive','Rust stains, dirt and cobwebs on walkway, door and frame','Walkway, door and frame clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0029','R','Rubbish Collection and Refuse Rooms','West Tower refuse room','Tap leaking; rust on floor','Tap repaired; rust removed','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0030','R','Recreation Deck: BBQ and Outdoor Areas','BBQ','Upper grill and housing require cleaning and rust removal (lower grill completed)','Upper grill and housing clean and free of rust','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0031','S','Recreation Deck: BBQ and Outdoor Areas','BBQ wall','Wall requires cleaning','Wall clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0032','S','Gymnasium','Gymnasium','Sliding door tracks soiled; dirt comes off with wiping','Tracks clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0033','S','Gymnasium','Gym glass exterior','Balustrade and glass require cleaning; cobwebs to be removed','Glass and balustrade clean, cobwebs removed','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0034','S','General Areas, Common Property Toilets and Store Rooms','All common property doors and frames','Door frames require cleaning','Doors and frames clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0035','S','Car Parks, Driveways and Entrances','Centre entry and Prosperity Drive entrances','Walkway and stairs require further cleaning after partial improvement','Entries and stairs clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0036','S','Fire Safety and Emergency Egress','Fire pump room exit','Exit stairs require further cleaning after partial improvement','Stairs clean','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0037','S','General Areas, Common Property Toilets and Store Rooms','Walkway brickwork','Green algae improved; brickwork still requires cleaning','Brickwork clean','BM','open',null,'2026-08-05'::date,'2026-07-26'::date,null),
  ('CB-0038','S','Upper Residential Foyers and Level Refuse Rooms','West Tower Level 6 refuse room','Requires cleaning and rust removal','Room clean, rust removed','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0039','S','Lawns, Gardens and Pathways','Mantra Esplanade path near G03','Path requires cleaning','Path clean','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0040','S','Rubbish Collection and Refuse Rooms','East Tower fire exit, outside refuse room','Tap requires rust removal','Rust removed','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0041','S','Entrances, Reception Foyers and Lifts','Basement lift tiles, West Tower','Tiles require cleaning','Tiles clean','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0042','S','Car Parks, Driveways and Entrances','Concrete pad','Further cleaning required following broom test patch','Pad clean to the standard set by the test patch','BM','open',null,'2026-08-05'::date,'2026-08-05'::date,null),
  ('CB-0043','S','Car Parks, Driveways and Entrances','Bike storage area','Dirt cleaned; rust and marks on tiles still require attention','Tiles clean, rust removed','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0044','S','Recreation Deck: Pool and Spa','Walkway outside pool','Requires cleaning; no visible improvement at 27 Jul','Walkway clean','BM','open',null,'2026-08-05'::date,'2026-07-28'::date,null),
  ('CB-0045','S','Recreation Deck: Pool and Spa','Pool, waterline tiles','Water level tiles dirty','BM to clean weekly and monitor result  [Due: Weekly, Fridays]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0046','S','Recreation Deck: Pool and Spa','Pool, tiles under table','Black marks and stains on tiles','Marks removed using tile scrubber or equivalent  [Due: Fri 25 Sep 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0047','S','Recreation Deck: Pool and Spa','Pool, tiles under sun lounges','Long standing yellow stain','Alternative product trialled; stain removed or reported as permanent  [Due: Fri 25 Sep 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0048','R','Recreation Deck: Pool and Spa','Pool and spa floor surface','Rust marks on surface','BM report on monitoring of marks','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0049','R','Recreation Deck: Pool and Spa','Sauna','Two rear panels not working. No Schedule 1 duty line covers the sauna','Supplier contacted for replacement panels; credit application status confirmed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0050','S','Fire Safety and Emergency Egress','East Tower, emergency exit stairs near refuse room','Mat wet underneath','Tiles dried after cleaning before the mat is replaced, each time  [Due: Each clean]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0051','R','Entrances, Reception Foyers and Lifts','West Tower lift','Rust extending past lift handrails and onto the panel below','Rust removed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0052','R','Gymnasium','Gymnasium','Rust on door handle','Rust removed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0053','S','Lawns, Gardens and Pathways','Lawns','Bindii through lawn areas','Bindii/clover killer purchased and lawns sprayed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0054','S','Lawns, Gardens and Pathways','Garden near yoga/gym area','Mulching of this small garden was missed','Area mulched','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0055','S','Lawns, Gardens and Pathways','BBQ area garden','Requires trim and tidy','Plants trimmed back, not touching walls','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0056','G','Lawns, Gardens and Pathways','East Wing foyer garden','Watering currently done by Ian, who is leaving','BM takes over the watering process  [Due: Mid Oct 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0057','S','Lawns, Gardens and Pathways','Gardens, miniature Tibouchina','Plants not in good condition; fertiliser required','Plants fertilised','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0058','R','Fire Safety and Emergency Egress','Fire booster door','Missing part of the door closer arm','Contractor who made and fitted the doors to rectify','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0059','S','Car Parks, Driveways and Entrances','Bike storage cage','Cage needs cleaning','A day scheduled for all bikes to be removed so the cage can be cleaned','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0060','S','General Areas, Common Property Toilets and Store Rooms','Fire escape door to Prosperity Drive near G04','Swallows nest above the light','Nest removed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0061','R','Entrances, Reception Foyers and Lifts','Intercoms','Rust on intercoms','Rust removed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0062','S','Common Area Lighting','BBQ and pool area lighting','Timing requires adjustment, lights coming on too soon','Timers adjusted','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0063','S','Common Area Lighting','External light outside fire exit below gym','Dirty and full of insects','Fitting cleaned and insects removed','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0064','S','Upper Residential Foyers and Level Refuse Rooms','Fire stairs, 7th to 8th floor East Tower','Exit door and fittings have cobwebs','De-webbed and cleaned  [Due: Fri 25 Sep 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0065','S','Upper Residential Foyers and Level Refuse Rooms','Common area tiles between 705 and 706','Green algae and dirt build-up','Tiles clean  [Due: Fortnightly, Fridays]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0066','S','Rubbish Collection and Refuse Rooms','Yellow bins','Bins not washed','Washed and disinfected after each collection  [Due: Weekly]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0067','S','Rubbish Collection and Refuse Rooms','West Tower refuse room','Wall near rusty fan by roller door dirty','Wall clean','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0068','R','Rubbish Collection and Refuse Rooms','West Tower refuse room','Rust from metal hose reel','Rust removed and reel replaced with a more suitable type','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0069','S','Rubbish Collection and Refuse Rooms','East Tower comms room door','Food splatter on door','Door clean','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0070','S','Security, Access and Emergency Response','CCTV cameras','Camera lenses dirty','Lenses wiped with a microfibre cloth after a light spray of plain water  [Due: Weekly]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0071','S','Fire Safety and Emergency Egress','Fire escape doors','Doors currently being treated and painted','Door frames wiped regularly to prevent build-up from the environment  [Due: Ongoing]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0072','H','Rubbish Collection and Refuse Rooms','West Tower refuse room','Hazard identified and photographed 30 Jun. At 28 Jul recorded as: no action taken to cover the hazard with foam and make safe. No entry in the 2 September document.','Interim: hazard covered with foam and made safe. Permanent control to be determined and recorded.  [Due: IMMEDIATE]','BM','open','high','2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0073','C',null,'Balconies and balustrades, structural engineer','Second quote provided by BM. BCC to provide more detailed requirements of the quotes so the BM can pass them to contractors. Scope of works to be clarified and confirmed.','Body Corporate decision recorded  [Due: 8 Sep 2026, OVERDUE]','BCC','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0074','C','Recreation Deck: Pool and Spa','Pool glass','BCC to arrange a quote and contractor to clean the pool glass a couple of times to assess whether it can be improved.','Body Corporate decision recorded','Phil H','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0075','C','Car Parks, Driveways and Entrances','Car wash hours sign on wall','BCC to check with MSC on the best way for the BM to remove or paint over the sign.','Body Corporate decision recorded','BCC','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0076','C','Car Parks, Driveways and Entrances','Car wash bay concrete paint','BCC to check with MSC on the best way to remove references to the car wash on the concrete and show ''Visitor'' only.','Body Corporate decision recorded','BCC','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0077','C','Plant, Services and Infrastructure','Lift floor-holding programming','Kone advised the lifts can be programmed to remain on each floor for a period. Stephen advised 15 to 20 minutes would be the likely time spent on one floor. BCC to decide.','Body Corporate decision recorded','BCC','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0078','L',null,'Unit 604','Plants on the outer edge of the balcony','BM to follow up again. Resident to be made aware that liability lies with them should damage be caused.','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0079','L',null,'Unit 204','Bike stored on common property','BM to alert resident to move the bike.','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0080','L',null,'Unit G04','Filing cabinet on common property','BM to notify owner to remove the cabinet.','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0081','L',null,'Unit 607','Kitty litter disposal, East Tower','BM to contact 607.','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0082','L',null,'Unit 504 and others','Cracked tiles reported','Second quote for a structural engineer provided. Clarification and confirmation of the scope of works to be obtained.','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0083','L',null,'Unit 702','Rooftop tap access previously agreed for cleaning the West Tower rooftop','BM to make contact and arrange access. Not actioned as at 5 Aug.','BM','open',null,'2026-06-30'::date,'2026-06-30'::date,null),
  ('CB-0084','G',null,'Budget input (cl 3.11)','BM to assist the Body Corporate to prepare annual administrative and sinking fund budgets by advising on likely expenditure on materials, equipment and service contracts.','Contract deliverable met and recorded  [Due: 18 Sep 2026, OVERDUE]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0085','G',null,'New employee, induction and duties (Sch 1 WHS)','Tony, who has worked at Curve previously, to attend 3 days per week for a minimum of 3 hours per day. To be provided with a copy of all Caretaker Duties and instructed on expectations. Site induction carried out, sign-in and sign-out forms completed, all tasks and timelines understood.','Contract deliverable met and recorded  [Due: Oct 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0086','G',null,'By-laws and conditions of approval (cl 3.10)','Monitor compliance with the conditions of approvals, use reasonable endeavours to stop breaches, and report serious or persistent breaches to the Body Corporate. Monitor and report on the conditions of approvals as listed in Committee and General meetings.','Contract deliverable met and recorded  [Due: Fortnightly, Fridays]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0087','G',null,'Car wash bay closure notice','BCC to send notice of the car wash bay closure to residents.','Contract deliverable met and recorded','BCC','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0088','G',null,'Resident portal transition','Trialling NaloHub as a replacement for MyBos. BM input required.','Contract deliverable met and recorded  [Due: Oct 2026]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0089','G',null,'Quarterly written report (cl 3.18(b))','Quarterly written report to the Body Corporate on maintenance and repair needs including future needs, significant problems within the scheme, and disputes.','Contract deliverable met and recorded  [Due: Next due, confirm at walk]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null),
  ('CB-0090','G',null,'Annual audit of master keys and security keys (Sch 1 Security)','Annual audit of master keys and security keys. Reconciles against the Key & Fob Register.','Contract deliverable met and recorded  [Due: Next due, confirm at walk]','BM','open',null,'2026-09-02'::date,'2026-09-02'::date,null)
) as v(ref,cls,sec,loc,obs,outcome,owner,status,risk,raised_walk,raised,closed_on)
  left join public.walkthrough_sections s on s.building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid and s.name = v.sec
on conflict (building_id, ref) do nothing;

-- explicit due dates ---------------------------------------------------------
update public.walkthrough_findings f set due_date = v.due
  from (values
  ('CB-0053','2026-09-16'::date),
  ('CB-0054','2026-10-02'::date),
  ('CB-0055','2026-09-09'::date),
  ('CB-0057','2026-10-02'::date),
  ('CB-0060','2026-09-09'::date),
  ('CB-0062','2026-10-01'::date),
  ('CB-0063','2026-09-09'::date),
  ('CB-0067','2026-09-09'::date),
  ('CB-0068','2026-10-02'::date),
  ('CB-0073','2026-09-08'::date),
  ('CB-0074','2026-09-09'::date),
  ('CB-0075','2026-09-09'::date),
  ('CB-0078','2026-09-09'::date),
  ('CB-0079','2026-09-09'::date),
  ('CB-0080','2026-09-09'::date),
  ('CB-0082','2026-09-08'::date),
  ('CB-0084','2026-09-18'::date),
  ('CB-0087','2026-09-09'::date)
  ) as v(ref, due)
 where f.building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid and f.ref = v.ref;

-- counter continues past the ingested block ---------------------------------
update public.walkthrough_finding_counters
   set last_seq = greatest(last_seq, (select count(*) from public.walkthrough_findings where building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid))
 where building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid;

-- observed-again trail -------------------------------------------------------
insert into public.walkthrough_finding_events (finding_id, walkthrough_id, event, note)
select f.id,
       (select id from public.walkthroughs where building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid
         and walk_date = v.wd and status = 'issued'),
       'observed_again', v.note
  from (values
  ('CB-0017','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0017','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0018','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0018','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0019','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0019','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0020','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0020','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0021','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0021','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0022','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0022','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0023','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0023','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0024','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0024','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0025','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0025','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0026','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0026','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0027','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0027','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0028','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0028','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0029','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0029','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0030','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0030','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0031','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0031','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0032','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0032','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0033','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0033','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0034','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0034','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0035','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0035','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0036','2026-08-05'::date,'Still present at the 5 August photo comparison'),
  ('CB-0036','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0037','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0038','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0039','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0040','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0041','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0042','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0043','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0044','2026-09-02'::date,'No entry in the 2 September document; proposed for re-raise'),
  ('CB-0072','2026-08-05'::date,'Recorded 28 July as: no action taken to cover the hazard with foam and make safe'),
  ('CB-0072','2026-09-02'::date,'No entry in the 2 September document')
) as v(ref, wd, note)
  join public.walkthrough_findings f on f.building_id = 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid and f.ref = v.ref
 where not exists (select 1 from public.walkthrough_finding_events e
                    where e.finding_id = f.id and e.event = 'observed_again'
                      and e.note = v.note);
