import { registerRootComponent } from 'expo';

// Muss vor der App geladen sein: registriert die Geofence-Hintergrundaufgabe,
// damit iOS sie auch beim Wecken der beendeten App findet
import './src/geofencing';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
