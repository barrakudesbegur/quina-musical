// The console page: tokens and base theme from ui/, the console's layout and light/dark themes, then the app.
import '../../packages/ui/tokens.css';
import '../../packages/ui/base.css';
import './theme.css';
import './console.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { S } from './strings.ts';

document.title = S.pageTitle;
const target = document.getElementById('app');
if (!target) throw new Error('console: #app is missing from index.html');
mount(App, { target });
