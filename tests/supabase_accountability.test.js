/**
 * CheckingBoard - Supabase accountability & team isolation tests
 *
 * Runs against a real Supabase project that has supabase_schema.sql applied.
 * Use a TEST / DEV project, not production: every run creates new teams and logins.
 *
 *   TEST_SUPABASE_URL=https://xyz.supabase.co TEST_SUPABASE_ANON_KEY=... npm test
 *
 * Without those variables the suite is skipped.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_ANON_KEY;
const EMAIL_DOMAIN = 'checkingboard.internal';
const run = Date.now().toString(36);
const uname = (name) => `${name}${run}`.toLowerCase();

function newClient() {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(username, password) {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password });
  return { client, error };
}

async function mustSignIn(username, password) {
  const { client, error } = await signIn(username, password);
  assert.equal(error, null, `sign in ${username}: ${error?.message}`);
  return client;
}

describe('CheckingBoard Supabase: accounts, accountability, isolation', { skip: !URL || !KEY ? 'TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY not set' : false }, () => {
  const pw = 'pass-123456';
  let mgrA, staffA1, staffA2, mgrB;
  let staffA1Id, staffA2Id;
  let compA, drvA;

  before(async () => {
    const anon = newClient();
    let res = await anon.rpc('register_team', { p_team_name: 'Alpha Dispatch', p_manager_name: 'Mona Manager', p_username: uname('mona'), p_password: pw });
    assert.equal(res.error, null, res.error?.message);
    res = await anon.rpc('register_team', { p_team_name: 'Bravo Dispatch', p_manager_name: 'Bob Manager', p_username: uname('bob'), p_password: pw });
    assert.equal(res.error, null, res.error?.message);

    mgrA = await mustSignIn(uname('mona'), pw);
    mgrB = await mustSignIn(uname('bob'), pw);

    let r = await mgrA.rpc('create_staff_account', { p_display_name: 'Staff John', p_username: uname('john'), p_password: pw, p_role: 'staff' });
    assert.equal(r.error, null, r.error?.message);
    staffA1Id = r.data.id;
    r = await mgrA.rpc('create_staff_account', { p_display_name: 'Staff Alice', p_username: uname('alice'), p_password: pw, p_role: 'staff' });
    assert.equal(r.error, null, r.error?.message);
    staffA2Id = r.data.id;

    staffA1 = await mustSignIn(uname('john'), pw);
    staffA2 = await mustSignIn(uname('alice'), pw);

    // Fleet for team A (team_id defaults to the signed-in user's team)
    compA = `comp-t-${run}`;
    drvA = `drv-t-${run}`;
    r = await mgrA.from('companies').insert({ id: compA, name: 'INFINITY LOGISTEX LLC', order_index: 1 });
    assert.equal(r.error, null, r.error?.message);
    r = await mgrA.from('drivers').insert({ id: drvA, company_id: compA, unit: '101', name: 'John Doe', status: 'READY', order_index: 1 });
    assert.equal(r.error, null, r.error?.message);
  });

  test('1. Creating a team makes the creator its manager; usernames are unique', async () => {
    const { data } = await mgrA.from('staff_profiles').select('username, role, display_name');
    const me = data.find(p => p.username === uname('mona'));
    assert.equal(me.role, 'manager');
    const dup = await newClient().rpc('register_team', { p_team_name: 'X', p_manager_name: 'Y', p_username: uname('mona'), p_password: pw });
    assert.match(dup.error?.message || '', /already taken/);
  });

  test('2. Wrong password is rejected; staff log in with the credentials the manager set', async () => {
    const bad = await signIn(uname('john'), 'wrong-password');
    assert.ok(bad.error, 'wrong password must fail');
    const { data } = await staffA1.from('staff_profiles').select('id, role').eq('id', staffA1Id);
    assert.equal(data[0].role, 'staff');
  });

  test('3. Staff cannot create accounts or change roles', async () => {
    const r1 = await staffA1.rpc('create_staff_account', { p_display_name: 'Hacker', p_username: uname('hacker'), p_password: pw, p_role: 'manager' });
    assert.ok(r1.error);
    const r2 = await staffA1.rpc('set_staff_role', { p_staff_id: staffA1Id, p_role: 'manager' });
    assert.ok(r2.error);
    const r3 = await staffA1.from('staff_profiles').update({ role: 'manager' }).eq('id', staffA1Id).select();
    assert.ok(r3.error || (r3.data || []).length === 0, 'direct profile edits must be blocked');
  });

  test('4. Activity actor comes from the session; forged actor fields are ignored', async () => {
    const { data, error } = await staffA1.from('activities').insert({
      id: `act-forge-${run}`,
      staff_user_id: staffA2Id,
      staff_name_snapshot: 'Staff Alice',
      driver_id: drvA,
      driver_name_snapshot: 'Fake Name',
      action_type: 'FIX_LOG',
      action_at: '2020-01-01T00:00:00Z',
      extra_note: 'impersonation attempt'
    }).select().single();
    assert.equal(error, null, error?.message);
    assert.equal(data.staff_user_id, staffA1Id);
    assert.equal(data.staff_name_snapshot, 'Staff John');
    assert.equal(data.driver_name_snapshot, '101 - John Doe');
    assert.ok(new Date(data.action_at).getFullYear() >= 2025, 'action time is server time');
  });

  test('5. Staff see only their own activities; managers see the whole team', async () => {
    await staffA2.from('activities').insert({ driver_id: drvA, action_type: 'CYCLE', extra_note: 'cycle check' });
    await mgrA.from('activities').insert({ driver_id: drvA, action_type: 'SHIFT', extra_note: 'shift' });

    const s1 = await staffA1.from('activities').select('staff_user_id');
    assert.ok(s1.data.length >= 1 && s1.data.every(a => a.staff_user_id === staffA1Id));
    const s2 = await staffA2.from('activities').select('staff_user_id');
    assert.ok(s2.data.length >= 1 && s2.data.every(a => a.staff_user_id === staffA2Id));
    const m = await mgrA.from('activities').select('staff_user_id');
    const actors = new Set(m.data.map(a => a.staff_user_id));
    assert.ok(actors.has(staffA1Id) && actors.has(staffA2Id), 'manager sees all team members');
  });

  test('6. Activities cannot be edited or deleted', async () => {
    const upd = await mgrA.from('activities').update({ action_type: 'TAMPERED' }).eq('id', `act-forge-${run}`).select();
    assert.ok(upd.error || upd.data.length === 0);
    const del = await mgrA.from('activities').delete().eq('id', `act-forge-${run}`).select();
    assert.ok(del.error || del.data.length === 0);
    const still = await mgrA.from('activities').select('action_type').eq('id', `act-forge-${run}`).single();
    assert.equal(still.data.action_type, 'FIX_LOG');
  });

  test('7. Teams are isolated: no reading, editing or inserting into another team', async () => {
    const read = await mgrB.from('drivers').select('id').eq('id', drvA);
    assert.equal(read.data.length, 0);
    const edit = await mgrB.from('drivers').update({ status: 'HOME' }).eq('id', drvA).select();
    assert.equal(edit.data?.length || 0, 0);
    const ins = await mgrB.from('drivers').insert({ id: `drv-x-${run}`, company_id: compA, name: 'Intruder' });
    assert.ok(ins.error, 'cannot attach a driver to another team company');
    const acts = await mgrB.from('activities').select('id');
    assert.equal(acts.data.length, 0);
    const roster = await mgrB.from('staff_profiles').select('id');
    assert.ok(roster.data.every(p => p.id !== staffA1Id));
    const reset = await mgrB.rpc('reset_staff_password', { p_staff_id: staffA1Id, p_new_password: 'stolen-pw' });
    assert.ok(reset.error, 'cannot manage another team');
  });

  test('8. Anonymous visitors see nothing', async () => {
    const anon = newClient();
    for (const table of ['drivers', 'companies', 'activities', 'staff_profiles', 'teams']) {
      const { data } = await anon.from(table).select('*').limit(1);
      assert.equal((data || []).length, 0, `${table} must not be readable anonymously`);
    }
    const claim = await anon.rpc('claim_legacy_fleet', { p_manager_username: uname('mona') });
    assert.ok(claim.error, 'claiming the legacy fleet is SQL-editor only');
  });

  test('9. Renaming keeps historical name snapshots', async () => {
    const r = await staffA1.rpc('update_my_display_name', { p_display_name: 'Jonathan Doe Senior' });
    assert.equal(r.error, null, r.error?.message);
    const old = await mgrA.from('activities').select('staff_name_snapshot').eq('id', `act-forge-${run}`).single();
    assert.equal(old.data.staff_name_snapshot, 'Staff John');
    const { data } = await staffA1.from('activities').insert({ driver_id: drvA, action_type: 'BREAK' }).select().single();
    assert.equal(data.staff_name_snapshot, 'Jonathan Doe Senior');
  });

  test('10. Deleting a driver and company preserves their activity history', async () => {
    await mgrA.from('activities').insert({ driver_id: drvA, company_id: compA, action_type: 'FIX_LOG', extra_note: 'last fix' });
    const d = await mgrA.from('drivers').delete().eq('id', drvA);
    assert.equal(d.error, null);
    const c = await mgrA.from('companies').delete().eq('id', compA);
    assert.equal(c.error, null);
    const { data } = await mgrA.from('activities').select('driver_id, driver_name_snapshot, company_id, company_name_snapshot');
    const john = data.filter(a => a.driver_name_snapshot === '101 - John Doe');
    assert.ok(john.length >= 4, 'history kept');
    assert.ok(john.every(a => a.driver_id === null && a.company_id === null), 'links set to null');
    assert.ok(john.some(a => a.company_name_snapshot === 'INFINITY LOGISTEX LLC'));
  });

  test('11. Manager resets a password: old one stops working, new one works', async () => {
    const r = await mgrA.rpc('reset_staff_password', { p_staff_id: staffA2Id, p_new_password: 'new-pass-777' });
    assert.equal(r.error, null, r.error?.message);
    assert.ok((await signIn(uname('alice'), pw)).error, 'old password rejected');
    await mustSignIn(uname('alice'), 'new-pass-777');
  });

  test('12. Deactivated accounts cannot sign in or read data; history stays', async () => {
    const r = await mgrA.rpc('set_staff_active', { p_staff_id: staffA1Id, p_active: false });
    assert.equal(r.error, null, r.error?.message);
    assert.ok((await signIn(uname('john'), pw)).error, 'banned login');
    const live = await staffA1.from('drivers').select('id');
    assert.equal(live.data?.length || 0, 0, 'an existing session loses access immediately');
    const hist = await mgrA.from('activities').select('id').eq('staff_user_id', staffA1Id);
    assert.ok(hist.data.length >= 2);
    const self = await mgrA.rpc('set_staff_active', { p_staff_id: (await mgrA.auth.getUser()).data.user.id, p_active: false });
    assert.ok(self.error, 'managers cannot deactivate themselves');
    const back = await mgrA.rpc('set_staff_active', { p_staff_id: staffA1Id, p_active: true });
    assert.equal(back.error, null);
    await mustSignIn(uname('john'), pw);
  });

  test('13. Promoting a staff member gives manager visibility', async () => {
    const r = await mgrA.rpc('set_staff_role', { p_staff_id: staffA2Id, p_role: 'manager' });
    assert.equal(r.error, null, r.error?.message);
    const alice = await mustSignIn(uname('alice'), 'new-pass-777');
    const acts = await alice.from('activities').select('staff_user_id');
    assert.ok(acts.data.some(a => a.staff_user_id === staffA1Id), 'new manager sees team activity');
  });

  test('14. Only managers add, rename or remove companies and remove drivers; staff add and edit drivers and reorder', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const comp2 = `comp-t2-${run}`;
    const drv2 = `drv-t2-${run}`;

    const staffComp = await john.from('companies').insert({ id: `comp-staff-${run}`, name: 'Staff Co' });
    assert.ok(staffComp.error, 'staff cannot add a company');
    let r = await mgrA.from('companies').insert({ id: comp2, name: 'Second Carrier', order_index: 2 });
    assert.equal(r.error, null, r.error?.message);

    const staffDrv = await john.from('drivers').insert({ id: `drv-staff-${run}`, company_id: comp2, name: 'Added by staff' }).select();
    assert.equal(staffDrv.error, null, staffDrv.error?.message);
    assert.equal(staffDrv.data?.length, 1, 'staff can add a driver');
    const compB = `comp-b-${run}`;
    r = await mgrB.from('companies').insert({ id: compB, name: 'Bravo Carrier' });
    assert.equal(r.error, null, r.error?.message);
    const foreignDrv = await john.from('drivers').insert({ id: `drv-foreign-${run}`, company_id: compB, name: 'Wrong team' });
    assert.ok(foreignDrv.error, 'staff cannot add a driver to another team');
    r = await mgrA.from('drivers').insert({ id: drv2, company_id: comp2, unit: '202', name: 'Jane Roe', order_index: 1 });
    assert.equal(r.error, null, r.error?.message);

    r = await john.from('drivers').update({ status: 'AT PU', notes: 'loaded' }).eq('id', drv2).select();
    assert.equal(r.data?.length, 1, 'staff can edit a driver');
    r = await john.rpc('save_driver_order', { p_rows: [{ id: drv2, order_index: 7, company_id: comp2 }] });
    assert.equal(r.error, null, r.error?.message);
    r = await john.rpc('save_company_order', { p_rows: [{ id: comp2, order_index: 5 }] });
    assert.equal(r.error, null, r.error?.message);
    const rename = await john.from('companies').update({ name: 'Renamed by staff' }).eq('id', comp2).select();
    assert.ok(rename.error, 'staff cannot rename a company');
    r = await mgrA.from('companies').update({ name: 'Second Carrier LLC' }).eq('id', comp2).select();
    assert.equal(r.data?.length, 1, 'manager renames a company');
    const moved = await mgrA.from('drivers').select('order_index').eq('id', drv2).single();
    assert.equal(moved.data.order_index, 7);

    const delDrv = await john.from('drivers').delete().eq('id', drv2).select();
    assert.equal(delDrv.data?.length || 0, 0, 'staff cannot delete a driver');
    const delComp = await john.from('companies').delete().eq('id', comp2).select();
    assert.equal(delComp.data?.length || 0, 0, 'staff cannot delete a company');
    const still = await mgrA.from('drivers').select('id').eq('id', drv2);
    assert.equal(still.data.length, 1);

    r = await mgrA.from('drivers').delete().eq('id', drv2).select();
    assert.equal(r.data?.length, 1, 'manager deletes a driver');
    r = await mgrA.from('companies').delete().eq('id', comp2).select();
    assert.equal(r.data?.length, 1, 'manager deletes a company');
  });

  test('15. Only the dispatch action buttons can be logged', async () => {
    const john = await mustSignIn(uname('john'), pw);
    for (const type of ['STATUS_CHANGE', 'QUICK_CHECK', 'TRANSFER', 'DRIVER_DELETED']) {
      const r = await john.from('activities').insert({ action_type: type });
      assert.ok(r.error, `${type} must be rejected`);
    }
    const ok = await john.from('activities').insert({ action_type: 'DRIVER_CONNECTED' }).select().single();
    assert.equal(ok.error, null, ok.error?.message);
  });

  test('16. Shift schedule: manager only, any number per shift, actions credited to the assigned shift', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const monaId = (await mgrA.auth.getUser()).data.user.id;

    const denied = await john.rpc('save_shift_schedule', { p_schedule: { MORNING: [staffA1Id] } });
    assert.ok(denied.error, 'staff cannot change the schedule');
    const three = await mgrA.rpc('save_shift_schedule', { p_schedule: { MORNING: [staffA1Id, staffA2Id, monaId] } });
    assert.equal(three.error, null, three.error?.message);
    const twice = await mgrA.rpc('save_shift_schedule', { p_schedule: { MORNING: [staffA1Id], NIGHT: [staffA1Id] } });
    assert.match(twice.error?.message || '', /only one shift/);
    const foreign = await mgrB.rpc('save_shift_schedule', { p_schedule: { NIGHT: [staffA1Id] } });
    assert.ok(foreign.error, 'cannot schedule another team');

    let r = await mgrA.rpc('save_shift_schedule', { p_schedule: { NIGHT: [staffA1Id], AFTERNOON: [staffA2Id] } });
    assert.equal(r.error, null, r.error?.message);
    const { data: prof } = await mgrA.from('staff_profiles').select('id, shift_code').in('id', [staffA1Id, staffA2Id]);
    assert.equal(prof.find(p => p.id === staffA1Id).shift_code, 'NIGHT');
    assert.equal(prof.find(p => p.id === staffA2Id).shift_code, 'AFTERNOON');

    const act = await john.from('activities').insert({ action_type: 'SHIFT', shift_code: 'MORNING', shift_date: '2020-01-01' }).select().single();
    assert.equal(act.error, null, act.error?.message);
    assert.equal(act.data.shift_code, 'NIGHT', 'shift comes from the assignment, not the client');
    assert.notEqual(act.data.shift_date, '2020-01-01');

    // Leaving someone out unassigns them
    r = await mgrA.rpc('save_shift_schedule', { p_schedule: { AFTERNOON: [staffA2Id] } });
    assert.equal(r.error, null, r.error?.message);
    const after = await mgrA.from('staff_profiles').select('shift_code').eq('id', staffA1Id).single();
    assert.equal(after.data.shift_code, null);
  });

  test('16b. Shift hours: manager sets them per weekday; staff read them; other teams see nothing', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const hours = [
      { shift_code: 'MORNING', weekday: 1, start_min: 480, end_min: 960 },
      { shift_code: 'NIGHT', weekday: 6, start_min: 1320, end_min: 360 }
    ];

    const denied = await john.rpc('save_shift_hours', { p_hours: hours });
    assert.ok(denied.error, 'staff cannot change shift hours');
    const same = await mgrA.rpc('save_shift_hours', { p_hours: [{ shift_code: 'MORNING', weekday: 2, start_min: 600, end_min: 600 }] });
    assert.match(same.error?.message || '', /same time/);
    const badDay = await mgrA.rpc('save_shift_hours', { p_hours: [{ shift_code: 'MORNING', weekday: 8, start_min: 0, end_min: 60 }] });
    assert.ok(badDay.error, 'weekday must be 1-7');

    let r = await mgrA.rpc('save_shift_hours', { p_hours: hours });
    assert.equal(r.error, null, r.error?.message);
    const seen = await john.from('shift_hours').select('shift_code, weekday, start_min, end_min');
    assert.equal(seen.data.length, 2, 'staff read their team hours');
    const direct = await john.from('shift_hours').insert({ team_id: 'x', shift_code: 'MORNING', weekday: 3, start_min: 1, end_min: 2 });
    assert.ok(direct.error, 'no direct writes');
    const other = await mgrB.from('shift_hours').select('shift_code');
    assert.equal(other.data.length, 0, 'other teams see nothing');

    // Saving replaces everything; an empty list goes back to the defaults
    r = await mgrA.rpc('save_shift_hours', { p_hours: [] });
    assert.equal(r.error, null, r.error?.message);
    const cleared = await mgrA.from('shift_hours').select('shift_code');
    assert.equal(cleared.data.length, 0);
  });

  test('16c. Shift-mates see each other\'s actions on their shift; other shifts stay private', async () => {
    let r = await mgrA.rpc('create_staff_account', { p_display_name: 'Staff Kate', p_username: uname('kate'), p_password: pw, p_role: 'staff' });
    assert.equal(r.error, null, r.error?.message);
    const kateId = r.data.id;
    r = await mgrA.rpc('create_staff_account', { p_display_name: 'Staff Leo', p_username: uname('leo'), p_password: pw, p_role: 'staff' });
    assert.equal(r.error, null, r.error?.message);
    const leoId = r.data.id;
    const john = await mustSignIn(uname('john'), pw);
    const kate = await mustSignIn(uname('kate'), pw);
    const leo = await mustSignIn(uname('leo'), pw);
    const sees = async (client, id) => ((await client.from('activities').select('id').eq('id', id)).data || []).length === 1;

    r = await mgrA.rpc('save_shift_schedule', { p_schedule: { NIGHT: [staffA1Id, kateId], MORNING: [leoId] } });
    assert.equal(r.error, null, r.error?.message);
    const kateAct = (await kate.from('activities').insert({ driver_id: drvA, action_type: 'CYCLE' }).select().single()).data;
    const leoAct = (await leo.from('activities').insert({ driver_id: drvA, action_type: 'BREAK' }).select().single()).data;
    assert.equal(kateAct.shift_code, 'NIGHT');

    assert.ok(await sees(john, kateAct.id), 'john sees his night shift-mate');
    assert.ok(!(await sees(leo, kateAct.id)), 'morning staff do not see the night shift');
    assert.ok(!(await sees(john, leoAct.id)), 'night staff do not see the morning shift');
    assert.ok(!(await sees(kate, leoAct.id)));

    // Moving Kate off the night shift takes her records out of John's view; she keeps her own
    r = await mgrA.rpc('save_shift_schedule', { p_schedule: { NIGHT: [staffA1Id], MORNING: [kateId, leoId] } });
    assert.equal(r.error, null, r.error?.message);
    assert.ok(!(await sees(john, kateAct.id)), 'no longer a shift-mate');
    assert.ok(await sees(kate, kateAct.id), 'own records stay visible');

    // Unassigned staff see only their own
    r = await mgrA.rpc('save_shift_schedule', { p_schedule: { NIGHT: [staffA1Id] } });
    assert.equal(r.error, null, r.error?.message);
    const leoSees = (await leo.from('activities').select('staff_user_id')).data;
    assert.ok(leoSees.every(a => a.staff_user_id === leoId), 'unassigned: own records only');
  });

  test('17. Notifications: managers send; staff see only what is addressed to them', async () => {
    const john = await mustSignIn(uname('john'), pw);
    let r = await mgrA.rpc('save_shift_schedule', { p_schedule: { MORNING: [staffA1Id] } });
    assert.equal(r.error, null, r.error?.message);

    const denied = await john.from('notifications').insert({ title: 'Staff cannot send' });
    assert.ok(denied.error, 'staff cannot send notifications');

    const send = async (row) => {
      const res = await mgrA.from('notifications').insert({ sender_name: 'Forged', ...row }).select().single();
      assert.equal(res.error, null, res.error?.message);
      return res.data;
    };
    const all = await send({ title: `all-${run}`, audience: 'ALL' });
    const morning = await send({ title: `morning-${run}`, audience: 'SHIFT', audience_shift: 'MORNING' });
    const night = await send({ title: `night-${run}`, audience: 'SHIFT', audience_shift: 'NIGHT' });
    const personal = await send({ title: `john-${run}`, audience: 'STAFF', audience_staff_id: staffA1Id });
    assert.equal(all.sender_name, 'Mona Manager', 'sender comes from the session');

    const { data: seen } = await john.from('notifications').select('id');
    const ids = new Set(seen.map(n => n.id));
    assert.ok(ids.has(all.id) && ids.has(morning.id) && ids.has(personal.id), 'team, own shift and personal');
    assert.ok(!ids.has(night.id), 'another shift is hidden');

    r = await john.from('notification_reads').upsert([{ notification_id: all.id, staff_id: staffA1Id }], { ignoreDuplicates: true });
    assert.equal(r.error, null, r.error?.message);
    r = await john.from('notification_reads').insert({ notification_id: night.id, staff_id: staffA1Id });
    assert.ok(r.error, 'cannot mark a hidden notification read');

    const other = await mgrB.from('notifications').select('id');
    assert.equal(other.data.length, 0, 'other teams see nothing');
  });

  test('18. Extensions: managers publish, the team reads, other teams see nothing', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const row = { name: 'Leader ELD Logger', version: '1.0.0', file_path: 'x/test.zip', file_name: 'test.zip', file_size: 1 };
    const denied = await john.from('extensions').insert(row);
    assert.ok(denied.error, 'staff cannot publish');
    const { data, error } = await mgrA.from('extensions').insert(row).select().single();
    assert.equal(error, null, error?.message);
    assert.equal(data.publisher_name, 'Mona Manager');
    const seen = await john.from('extensions').select('id').eq('id', data.id);
    assert.equal(seen.data.length, 1, 'team members can read');
    const other = await mgrB.from('extensions').select('id').eq('id', data.id);
    assert.equal(other.data.length, 0, 'other teams cannot read');
    const del = await john.from('extensions').delete().eq('id', data.id).select();
    assert.equal(del.data?.length || 0, 0, 'staff cannot remove');
  });

  const OFFICE_COLS = 'office_name, office_lat, office_lng, office_radius_m, office_updated_at, office_updated_by';
  const office = { p_name: 'Tashkent office', p_lat: 41.311081, p_lng: 69.240562, p_radius_m: 150 };

  test('19. Office location: a manager sets and clears it; who and when come from the session', async () => {
    const monaId = (await mgrA.auth.getUser()).data.user.id;
    let r = await mgrA.rpc('set_office_location', office);
    assert.equal(r.error, null, r.error?.message);
    const { data: t } = await mgrA.from('teams').select(OFFICE_COLS).single();
    assert.equal(t.office_name, 'Tashkent office');
    assert.equal(t.office_lat, 41.311081);
    assert.equal(t.office_lng, 69.240562);
    assert.equal(t.office_radius_m, 150);
    assert.equal(t.office_updated_by, monaId, 'stamped with the caller');
    assert.ok(Math.abs(Date.parse(t.office_updated_at) - Date.now()) < 5 * 60e3, 'stamped with the server time');

    r = await mgrA.rpc('clear_office_location');
    assert.equal(r.error, null, r.error?.message);
    const { data: cleared } = await mgrA.from('teams').select(OFFICE_COLS).single();
    assert.ok(Object.values(cleared).every(v => v === null), 'every office column back to null');
  });

  test('20. Office location: staff are rejected; managers cannot touch another team\'s office', async () => {
    const john = await mustSignIn(uname('john'), pw);
    let r = await mgrA.rpc('set_office_location', office);
    assert.equal(r.error, null, r.error?.message);

    const denied = await john.rpc('set_office_location', { ...office, p_name: 'Staff office' });
    assert.match(denied.error?.message || '', /Only managers/);
    const deniedClear = await john.rpc('clear_office_location');
    assert.match(deniedClear.error?.message || '', /Only managers/);
    const direct = await mgrA.from('teams').update({ office_radius_m: 999 }).not('id', 'is', null).select();
    assert.ok(direct.error || (direct.data?.length || 0) === 0, 'no direct writes to teams, even for managers');

    // Team B's manager only ever changes team B
    r = await mgrB.rpc('set_office_location', { p_name: 'Bravo office', p_lat: 40.0, p_lng: 70.0, p_radius_m: 300 });
    assert.equal(r.error, null, r.error?.message);
    r = await mgrB.rpc('clear_office_location');
    assert.equal(r.error, null, r.error?.message);
    const { data: a } = await mgrA.from('teams').select(OFFICE_COLS).single();
    assert.equal(a.office_name, 'Tashkent office', 'team A untouched by team B');
    assert.equal(a.office_radius_m, 150);
    const peek = await mgrB.from('teams').select('office_name').eq('office_name', 'Tashkent office');
    assert.equal(peek.data.length, 0, 'team B cannot read team A');
  });

  test('21. Office location: invalid or partial values are rejected', async () => {
    const bad = [
      [{ ...office, p_lat: 90.5 }, /Latitude/],
      [{ ...office, p_lat: -91 }, /Latitude/],
      [{ ...office, p_lng: 180.1 }, /Longitude/],
      [{ ...office, p_lng: -200 }, /Longitude/],
      [{ ...office, p_radius_m: 29 }, /Radius/],
      [{ ...office, p_radius_m: 1001 }, /Radius/],
      [{ ...office, p_name: '   ' }, /name is required/],
      [{ ...office, p_lng: null }, /all required/],
      [{ ...office, p_lat: null, p_lng: null }, /all required/],
      [{ ...office, p_radius_m: null }, /all required/]
    ];
    for (const [args, message] of bad) {
      const r = await mgrA.rpc('set_office_location', args);
      assert.match(r.error?.message || '', message, JSON.stringify(args));
    }
    const { data } = await mgrA.from('teams').select(OFFICE_COLS).single();
    assert.equal(data.office_radius_m, 150, 'rejected calls change nothing');
  });

  test('22. cb_distance_m: 0 for the same point, about 111.2 km per degree of latitude', async () => {
    const dist = async (lat1, lng1, lat2, lng2) => {
      const r = await mgrA.rpc('cb_distance_m', { lat1, lng1, lat2, lng2 });
      assert.equal(r.error, null, r.error?.message);
      return r.data;
    };
    assert.ok(Math.abs(await dist(41.311081, 69.240562, 41.311081, 69.240562)) < 0.001);
    const degree = await dist(41, 69, 42, 69);
    assert.ok(Math.abs(degree - 111195) < 200, `1 degree of latitude = ${degree} m`);
    const nearby = await dist(41.311081, 69.240562, 41.315081, 69.240562);
    assert.ok(Math.abs(nearby - 444.8) < 2, `0.004 degrees of latitude = ${nearby} m`);
  });

  test('23. Staff read their own team\'s office settings', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const { data, error } = await john.from('teams').select(OFFICE_COLS).single();
    assert.equal(error, null, error?.message);
    assert.equal(data.office_name, 'Tashkent office');
    assert.equal(data.office_radius_m, 150);
    assert.equal(typeof data.office_lat, 'number');
  });

  // ---------------- attendance (phone check-in / check-out) ----------------
  // Tashkent minutes after midnight for "now", so a test shift can start N minutes ago
  const tashkentNowMin = () => {
    const d = new Date(Date.now() + 5 * 3600e3);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  const startedAgo = (shift, minutes) => {
    const start = (tashkentNowMin() - minutes + 1440) % 1440;
    return [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ shift_code: shift, weekday, start_min: start, end_min: (start + 480) % 1440 }));
  };
  const atOffice = { p_lat: 41.311081, p_lng: 69.240562, p_accuracy_m: 12 };   // the office from test 19-23
  const farAway = { p_lat: 41.330000, p_lng: 69.240562, p_accuracy_m: 12 };    // ~2.1 km north

  test('24. Attendance rules: managers set "late after"; staff and bad values are rejected', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const denied = await john.rpc('set_attendance_rules', { p_late_after_min: 60 });
    assert.match(denied.error?.message || '', /Only managers/);
    for (const bad of [-1, 241, null]) {
      const r = await mgrA.rpc('set_attendance_rules', { p_late_after_min: bad });
      assert.match(r.error?.message || '', /between 0 and 240/, String(bad));
    }
    const r = await mgrA.rpc('set_attendance_rules', { p_late_after_min: 15 });
    assert.equal(r.error, null, r.error?.message);
    const { data } = await john.from('teams').select('late_after_min').single();
    assert.equal(data.late_after_min, 15, 'staff read the rule');
  });

  test('25. Check-in / check-out: office radius enforced, time and lateness from the server', async () => {
    const john = await mustSignIn(uname('john'), pw);
    // John on AFTERNOON, which started 30 minutes ago today (late: 30 > 15)
    let r = await mgrA.rpc('save_shift_schedule', { p_schedule: { AFTERNOON: [staffA1Id] } });
    assert.equal(r.error, null, r.error?.message);
    r = await mgrA.rpc('save_shift_hours', { p_hours: startedAgo('AFTERNOON', 30) });
    assert.equal(r.error, null, r.error?.message);

    r = await mgrA.rpc('clear_office_location');
    assert.equal(r.error, null, r.error?.message);
    const noOffice = await john.rpc('check_in', atOffice);
    assert.match(noOffice.error?.message || '', /not set the office/);
    r = await mgrA.rpc('set_office_location', office);
    assert.equal(r.error, null, r.error?.message);

    const far = await john.rpc('check_in', farAway);
    assert.match(far.error?.message || '', /You are \d+ m from Tashkent office\. You need to be within 150 m/);
    const badFix = await john.rpc('check_in', { ...atOffice, p_lat: 95 });
    assert.match(badFix.error?.message || '', /location could not be read/);

    const before = Date.now();
    const inRes = await john.rpc('check_in', atOffice);
    assert.equal(inRes.error, null, inRes.error?.message);
    const row = inRes.data;
    assert.equal(row.staff_id, staffA1Id);
    assert.equal(row.staff_name_snapshot, 'Jonathan Doe Senior');
    assert.equal(row.shift_code, 'AFTERNOON');
    assert.ok(Math.abs(Date.parse(row.check_in_at) - before) < 5 * 60e3, 'server time');
    assert.ok(row.check_in_distance_m < 1, 'distance measured on the server');
    assert.ok(row.late_min >= 29 && row.late_min <= 32, `late by about 30 min (${row.late_min})`);
    assert.equal(row.late_after_min, 15);
    assert.equal(row.is_late, true);

    const twice = await john.rpc('check_in', atOffice);
    assert.match(twice.error?.message || '', /already checked in/);
    const outFar = await john.rpc('check_out', farAway);
    assert.match(outFar.error?.message || '', /You need to be within 150 m/);
    const outRes = await john.rpc('check_out', atOffice);
    assert.equal(outRes.error, null, outRes.error?.message);
    assert.ok(outRes.data.check_out_at, 'checked out');
    assert.equal(outRes.data.id, row.id);
    const again = await john.rpc('check_in', atOffice);
    assert.match(again.error?.message || '', /already checked in and out of this shift/);
    const outAgain = await john.rpc('check_out', atOffice);
    assert.match(outAgain.error?.message || '', /not checked in/);
  });

  test('26. Attendance: on time vs late, unassigned refused, staff see only their own, no direct writes', async () => {
    const kate = await mustSignIn(uname('kate'), pw);
    const john = await mustSignIn(uname('john'), pw);
    const kateId = (await kate.auth.getUser()).data.user.id;
    // Kate unassigned first
    let r = await mgrA.rpc('save_shift_schedule', { p_schedule: { AFTERNOON: [staffA1Id] } });
    assert.equal(r.error, null, r.error?.message);
    const unassigned = await kate.rpc('check_in', atOffice);
    assert.match(unassigned.error?.message || '', /not on a shift/);

    // Kate on NIGHT, which started 5 minutes ago: on time
    r = await mgrA.rpc('save_shift_schedule', { p_schedule: { AFTERNOON: [staffA1Id], NIGHT: [kateId] } });
    assert.equal(r.error, null, r.error?.message);
    r = await mgrA.rpc('save_shift_hours', { p_hours: [...startedAgo('AFTERNOON', 30), ...startedAgo('NIGHT', 5)] });
    assert.equal(r.error, null, r.error?.message);
    const k = await kate.rpc('check_in', atOffice);
    assert.equal(k.error, null, k.error?.message);
    assert.equal(k.data.shift_code, 'NIGHT');
    assert.equal(k.data.is_late, false, `5 min is within the 15 min rule (${k.data.late_min})`);

    const johnSees = (await john.from('attendance').select('staff_id')).data;
    assert.ok(johnSees.length >= 1 && johnSees.every(a => a.staff_id === staffA1Id), 'staff read only their own');
    const mgrSees = new Set((await mgrA.from('attendance').select('staff_id')).data.map(a => a.staff_id));
    assert.ok(mgrSees.has(staffA1Id) && mgrSees.has(kateId), 'managers read the team');
    const other = await mgrB.from('attendance').select('id');
    assert.equal(other.data.length, 0, 'other teams see nothing');

    const forged = await john.from('attendance').insert({ team_id: 'x', shift_code: 'MORNING', shift_date: '2026-01-01', shift_start: new Date().toISOString(), shift_end: new Date().toISOString(), check_in_lat: 0, check_in_lng: 0, check_in_distance_m: 0 });
    assert.ok(forged.error, 'no direct inserts');
    const edit = await mgrA.from('attendance').update({ is_late: false }).eq('staff_id', staffA1Id).select();
    assert.ok(edit.error || (edit.data?.length || 0) === 0, 'no direct edits, even for managers');

    r = await kate.rpc('check_out', atOffice);
    assert.equal(r.error, null, r.error?.message);
    // Leave the default hours for later tests
    r = await mgrA.rpc('save_shift_hours', { p_hours: [] });
    assert.equal(r.error, null, r.error?.message);
  });

  test('27. Push subscriptions: saved for the caller, private to them, removable', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const kate = await mustSignIn(uname('kate'), pw);
    const sub = { p_endpoint: `https://push.example.com/${run}`, p_p256dh: 'BKey', p_auth: 'secret', p_user_agent: 'test' };
    let r = await john.rpc('save_push_subscription', sub);
    assert.equal(r.error, null, r.error?.message);
    const bad = await john.rpc('save_push_subscription', { ...sub, p_endpoint: 'http://insecure' });
    assert.match(bad.error?.message || '', /Invalid push subscription/);

    const mine = await john.from('push_subscriptions').select('endpoint, staff_id');
    assert.ok(mine.data.some(s => s.endpoint === sub.p_endpoint && s.staff_id === staffA1Id));
    const theirs = await kate.from('push_subscriptions').select('endpoint').eq('endpoint', sub.p_endpoint);
    assert.equal(theirs.data.length, 0, 'others cannot read it');
    const direct = await john.from('push_subscriptions').insert({ endpoint: 'https://x', staff_id: staffA1Id, team_id: 'x', p256dh: 'a', auth: 'b' });
    assert.ok(direct.error, 'no direct inserts');

    // The same phone signed in as Kate now belongs to Kate
    r = await kate.rpc('save_push_subscription', sub);
    assert.equal(r.error, null, r.error?.message);
    assert.equal((await john.from('push_subscriptions').select('endpoint').eq('endpoint', sub.p_endpoint)).data.length, 0);
    r = await john.rpc('delete_push_subscription', { p_endpoint: sub.p_endpoint });
    assert.equal((await kate.from('push_subscriptions').select('endpoint').eq('endpoint', sub.p_endpoint)).data.length, 1, 'John cannot remove Kate\'s');
    r = await kate.rpc('delete_push_subscription', { p_endpoint: sub.p_endpoint });
    assert.equal(r.error, null, r.error?.message);
    assert.equal((await kate.from('push_subscriptions').select('endpoint').eq('endpoint', sub.p_endpoint)).data.length, 0);
  });

  test('28. Shift reminders: managers switch them on / off; the internals are out of reach', async () => {
    const john = await mustSignIn(uname('john'), pw);
    const denied = await john.rpc('set_shift_reminders', { p_enabled: false });
    assert.match(denied.error?.message || '', /Only managers/);

    let r = await mgrA.rpc('set_shift_reminders', { p_enabled: false });
    assert.equal(r.error, null, r.error?.message);
    assert.equal((await john.from('teams').select('shift_reminders_enabled').single()).data.shift_reminders_enabled, false, 'staff read the setting');
    r = await mgrA.rpc('set_shift_reminders', { p_enabled: true });
    assert.equal(r.error, null, r.error?.message);
    assert.equal((await mgrA.from('teams').select('shift_reminders_enabled').single()).data.shift_reminders_enabled, true);

    for (const client of [john, mgrA]) {
      const claim = await client.rpc('claim_shift_reminders', { p_lead_min: 2 });
      assert.ok(claim.error, 'only the Edge Function (service role) claims reminders');
      const setup = await client.rpc('setup_shift_reminders', { p_project_url: 'https://example.supabase.co' });
      assert.ok(setup.error, 'setup runs only in the SQL Editor');
      const config = await client.from('cb_cron_config').select('secret');
      assert.ok(config.error || (config.data?.length || 0) === 0, 'the cron secret is never readable');
      const sent = await client.from('shift_reminders_sent').select('staff_id');
      assert.ok(sent.error || (sent.data?.length || 0) === 0, 'sent reminders are not readable');
    }
  });

  test('29. Deactivating someone takes them off their shift and removes their phones', async () => {
    let kate = await mustSignIn(uname('kate'), pw);
    const kateId = (await kate.auth.getUser()).data.user.id;
    let r = await mgrA.rpc('save_shift_schedule', { p_schedule: { AFTERNOON: [staffA1Id], MORNING: [kateId] } });
    assert.equal(r.error, null, r.error?.message);
    const sub = { p_endpoint: `https://push.example.com/deact-${run}`, p_p256dh: 'BKey', p_auth: 'secret', p_user_agent: 'test' };
    r = await kate.rpc('save_push_subscription', sub);
    assert.equal(r.error, null, r.error?.message);

    r = await mgrA.rpc('set_staff_active', { p_staff_id: kateId, p_active: false });
    assert.equal(r.error, null, r.error?.message);
    const { data: profile } = await mgrA.from('staff_profiles').select('is_active, shift_code').eq('id', kateId).single();
    assert.equal(profile.is_active, false);
    assert.equal(profile.shift_code, null, 'no longer on a shift');

    r = await mgrA.rpc('set_staff_active', { p_staff_id: kateId, p_active: true });
    assert.equal(r.error, null, r.error?.message);
    kate = await mustSignIn(uname('kate'), pw);
    const subs = await kate.from('push_subscriptions').select('endpoint').eq('endpoint', sub.p_endpoint);
    assert.equal(subs.data.length, 0, 'phone alerts were removed');
    const again = (await mgrA.from('staff_profiles').select('shift_code').eq('id', kateId).single()).data;
    assert.equal(again.shift_code, null, 'reactivating does not put them back on a shift');
  });

  test('30. Members change their own username; they sign in with the new one', async () => {
    const leo = await mustSignIn(uname('leo'), pw);
    let r = await leo.rpc('update_my_username', { p_username: 'a!' });
    assert.match(r.error?.message || '', /3-32 characters/);
    r = await leo.rpc('update_my_username', { p_username: uname('kate') });
    assert.match(r.error?.message || '', /already taken/);
    r = await leo.rpc('update_my_username', { p_username: `  ${uname('leon').toUpperCase()} ` });
    assert.equal(r.error, null, r.error?.message);
    assert.equal(r.data, uname('leon'));
    const { data: me } = await leo.from('staff_profiles').select('username').eq('id', (await leo.auth.getUser()).data.user.id).single();
    assert.equal(me.username, uname('leon'));
    assert.ok((await signIn(uname('leo'), pw)).error, 'the old username no longer signs in');
    await mustSignIn(uname('leon'), pw);
    const anon = await newClient().rpc('update_my_username', { p_username: 'nobody123' });
    assert.ok(anon.error, 'signed-out callers are refused');
  });

  test('31. Members change their own password after confirming the current one', async () => {
    const leon = await mustSignIn(uname('leon'), pw);
    const other = await mustSignIn(uname('leon'), pw);
    let r = await leon.rpc('change_my_password', { p_current_password: 'wrong-one', p_new_password: 'brand-new-1' });
    assert.match(r.error?.message || '', /current password is not correct/);
    r = await leon.rpc('change_my_password', { p_current_password: pw, p_new_password: '123' });
    assert.match(r.error?.message || '', /at least 6 characters/);
    r = await leon.rpc('change_my_password', { p_current_password: pw, p_new_password: 'brand-new-1' });
    assert.equal(r.error, null, r.error?.message);
    assert.ok((await signIn(uname('leon'), pw)).error, 'the old password stops working');
    await mustSignIn(uname('leon'), 'brand-new-1');
    const still = await leon.from('drivers').select('id').limit(1);
    assert.equal(still.error, null, 'this device stays signed in');
    const refreshed = await other.auth.refreshSession();
    assert.ok(refreshed.error, 'the other device is signed out');
  });

  test('32. Supervisors: set by managers, manager rights, and they still check in', async () => {
    let kate = await mustSignIn(uname('kate'), pw);
    const kateId = (await kate.auth.getUser()).data.user.id;
    const bad = await mgrA.rpc('set_staff_role', { p_staff_id: kateId, p_role: 'boss' });
    assert.match(bad.error?.message || '', /staff, supervisor or manager/);
    const denied = await kate.rpc('set_attendance_rules', { p_late_after_min: 15 });
    assert.match(denied.error?.message || '', /Only managers/, 'staff have no manager rights');

    let r = await mgrA.rpc('set_staff_role', { p_staff_id: kateId, p_role: 'supervisor' });
    assert.equal(r.error, null, r.error?.message);
    kate = await mustSignIn(uname('kate'), pw);
    r = await kate.rpc('set_attendance_rules', { p_late_after_min: 15 });
    assert.equal(r.error, null, 'supervisors have manager rights');
    const team = new Set((await kate.from('attendance').select('staff_id')).data.map(a => a.staff_id));
    assert.ok(team.has(staffA1Id), 'supervisors read the whole team\'s attendance');

    const created = await mgrA.rpc('create_staff_account', { p_display_name: 'Sup Sara', p_username: uname('sara'), p_password: pw, p_role: 'supervisor' });
    assert.equal(created.error, null, created.error?.message);
    assert.equal(created.data.role, 'supervisor');

    r = await mgrA.rpc('set_staff_role', { p_staff_id: kateId, p_role: 'staff' });
    assert.equal(r.error, null, r.error?.message);
  });
});
