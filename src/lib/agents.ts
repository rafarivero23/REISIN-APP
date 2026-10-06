import { many, one, run } from './db';
import { newId, now } from './ids';

export type Agent = {
  id: string; race_id: string; name: string; email: string; phone: string | null; gender: string | null;
  half_avg_min: number | null; city: string | null; message: string | null; paid_claim: boolean; status: 'open' | 'matched' | 'closed';
  team_id: string | null; notes: string | null; created_at: string; updated_at: string;
};
export type Invite = { id: string; agent_id: string; team_id: string; status: 'pending' | 'accepted' | 'declined'; created_at: string };

export const getAgent = (id: string) => one<Agent>('SELECT * FROM free_agents WHERE id = ?', [id]);
export const openAgents = (raceId: string) => many<Agent>("SELECT * FROM free_agents WHERE race_id = ? AND status = 'open' ORDER BY created_at DESC", [raceId]);
export const agentsOfRace = (raceId: string) => many<Agent>('SELECT * FROM free_agents WHERE race_id = ? ORDER BY created_at DESC', [raceId]);

export type AgentInput = Pick<Agent, 'name' | 'email' | 'phone' | 'gender' | 'half_avg_min' | 'city' | 'message' | 'paid_claim'>;
export async function createAgent(raceId: string, a: AgentInput) {
  const id = newId();
  await run(
    `INSERT INTO free_agents (id, race_id, name, email, phone, gender, half_avg_min, city, message, paid_claim, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'open', ?, ?)`,
    [id, raceId, a.name, a.email, a.phone, a.gender, a.half_avg_min, a.city, a.message, a.paid_claim, now(), now()]
  );
  return id;
}
export async function updateAgent(id: string, a: AgentInput) {
  await run(`UPDATE free_agents SET name=?, email=?, phone=?, gender=?, half_avg_min=?, city=?, message=?, paid_claim=?, updated_at=? WHERE id=?`,
    [a.name, a.email, a.phone, a.gender, a.half_avg_min, a.city, a.message, a.paid_claim, now(), id]);
}
export const setAgentStatus = (id: string, status: string, teamId: string | null = null) =>
  run('UPDATE free_agents SET status = ?, team_id = ?, updated_at = ? WHERE id = ?', [status, teamId, now(), id]);
export const setAgentNotes = (id: string, notes: string | null) => run('UPDATE free_agents SET notes = ? WHERE id = ?', [notes, id]);
export const deleteAgent = (id: string) => run('DELETE FROM free_agents WHERE id = ?', [id]);

export async function invite(agentId: string, teamId: string) {
  await run(`INSERT INTO agent_invites (id, agent_id, team_id, status, created_at) VALUES (?,?,?, 'pending', ?)
             ON CONFLICT (agent_id, team_id) DO UPDATE SET status = 'pending'`, [newId(), agentId, teamId, now()]);
}
export const invitesOfAgent = (agentId: string) =>
  many<Invite & { team_name: string }>(`SELECT i.*, t.name AS team_name FROM agent_invites i JOIN teams t ON t.id = i.team_id WHERE i.agent_id = ? ORDER BY i.created_at DESC`, [agentId]);
export const invitesOfTeam = (teamId: string) => many<Invite>('SELECT * FROM agent_invites WHERE team_id = ?', [teamId]);
export const getInvite = (id: string) => one<Invite>('SELECT * FROM agent_invites WHERE id = ?', [id]);
export const setInviteStatus = (id: string, status: string) => run('UPDATE agent_invites SET status = ? WHERE id = ?', [status, id]);
