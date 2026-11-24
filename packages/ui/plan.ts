// The Game plan now lives in @quina/protocol (protocol/plan.ts). This file re-exports it so the screens
// keep one import path.
export { PLAN_VERSION, checkGamePlan, sponsorOf, roundPlan } from '@quina/protocol';
export type { GamePlan, Sponsor, Prize, RoundPlan, SchedulePlan, CheatSheet, PlanCheck } from '@quina/protocol';
