// The page's ConsoleModel, handed to every component through Svelte context (set once in App.svelte).
import { createContext } from 'svelte';
import type { ConsoleModel } from './model.svelte.ts';

export const [getConsole, setConsole] = createContext<ConsoleModel>();
