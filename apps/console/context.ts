// The page's ConsoleModel and its Wii remote, handed to every component through Svelte context (both set once
// in App.svelte).
import { createContext } from 'svelte';
import type { ConsoleModel } from './model.svelte.ts';
import type { ConsoleSounds } from './ui-sounds.ts';
import type { WiiController } from './wii/controller.svelte.ts';

export const [getConsole, setConsole] = createContext<ConsoleModel>();
/** The Wii remote (optional): its status, the badges, connect and the Comandament dialog. */
export const [getWii, setWii] = createContext<WiiController>();
/** This tablet's touch sounds: the menu's switch reads whether this page is the show laptop's (always silent). */
export const [getConsoleSounds, setConsoleSounds] = createContext<ConsoleSounds>();
