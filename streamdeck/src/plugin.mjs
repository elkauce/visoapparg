import streamDeck, { action, SingletonAction } from '@elgato/streamdeck';
import { activate } from './request.mjs';
class VisoState extends SingletonAction {
  pending = new Set();
  async onWillAppear(ev) { await ev.action.setTitle(ev.payload.settings.label || 'VISO\nConfigurar'); }
  async onDidReceiveSettings(ev) { await ev.action.setTitle(ev.payload.settings.label || 'VISO\nConfigurar'); }
  async onKeyDown(ev) {
    if (this.pending.has(ev.action.id)) return;
    this.pending.add(ev.action.id);
    try {
      await activate(ev.payload.settings.url);
      await ev.action.showOk();
    } catch {
      // No URLs, tokens or response bodies in logs.
      await ev.action.showAlert();
    } finally { this.pending.delete(ev.action.id); }
  }
}
const RegisteredVisoState = action({ UUID: 'com.viso.deck.state' })(VisoState);
streamDeck.logger.setLevel('warn');
streamDeck.actions.registerAction(new RegisteredVisoState());
streamDeck.connect();
