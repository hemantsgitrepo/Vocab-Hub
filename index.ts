import { registerRootComponent } from 'expo';

import App from './App';
import { initPlaybackNotification } from './src/lib/playbackNotification';

// Registered before the app renders: Android delivers notification presses to
// the background handler, which has to already exist when they arrive.
initPlaybackNotification();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
