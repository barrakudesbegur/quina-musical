// Admin's entry: the organizers' setup and fixes page (GLOSSARY: Admin). It wires the page together and
// holds no logic: the show connection (role 'admin', or the demo fixtures with `?demo=<fixture>`), the plan
// session (autosaved through the PlanStore) and the command tracker, then mounts the Svelte app.
import '../ui/tokens.css';
import '../ui/base.css';
import './manage.css';
import './print.css';
import { mount } from 'svelte';
import { createShow } from '../ui/client/show.svelte.ts';
import { SAMPLE_PLAN } from '../ui/fixtures/plan.ts';
import { AdminPlanStore } from './data/admin-plan-store.ts';
import { PlanSession } from './state/plan-session.svelte.ts';
import { CommandTracker } from './state/commands.svelte.ts';
import App from './App.svelte';

const show = createShow('admin');
const store = AdminPlanStore.forPage(show.demo !== null);
// Demo pages fall back to the sample plan; a real page with nothing stored starts from a blank plan.
const session = new PlanSession(store, show.demo !== null ? SAMPLE_PLAN : null);
session.start();
const commands = new CommandTracker(show);

const target = document.getElementById('app');
if (!target) throw new Error('manage: #app is missing');
mount(App, { target, props: { show, session, commands } });
