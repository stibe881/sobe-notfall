import { registerRootComponent } from 'expo';

// Muss vor der App geladen sein: registriert die Geofence-Hintergrundaufgabe,
// damit iOS sie auch beim Wecken der beendeten App findet
import './src/geofencing';
import { registerAndroidAlarmBackgroundHandler } from './src/notifications';
import App from './App';

// Android: einziger Background-Handler für notifee, siehe notifications.ts
registerAndroidAlarmBackgroundHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
